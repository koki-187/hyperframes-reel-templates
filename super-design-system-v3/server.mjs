import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRecipe,MOTION,FORMATS} from './engine.mjs';
import {renderSocialSvg} from './renderers/social-svg.mjs';
import {renderSocialPng} from './renderers/social-png.mjs';
import {inspectFonts,loadJapaneseFont} from './font-manager.mjs';
import {renderVideo} from './video/render-video.mjs';
import {validateMp4} from './video/ffmpeg.mjs';
import {queueComfyWorkflow} from './adapters/comfyui.mjs';
import {generateLtxVideo} from './adapters/ltx-video.mjs';
import {evaluateQualityGate,createVariationPlan} from './quality/quality-gate.mjs';
import {validateAsset,writeQaReport} from './quality/asset-qa.mjs';
import {createReferenceProfile,compareReferenceProfile} from './quality/reference-profile.mjs';
import {createRegenerationRecipe} from './quality/regeneration.mjs';
import {DeviceRegistry} from './security/device-registry.mjs';
import {AuditLog} from './security/audit-log.mjs';
import {MetricsStore} from './operations/metrics-store.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(__dirname,'..');
const mobilePwaDir=path.join(repoRoot,'apps','mobile-pwa');
const dataDir=path.join(__dirname,'runtime');
const jobsDir=path.join(dataDir,'jobs');
const outputDir=path.join(dataDir,'outputs');
const reportsDir=path.join(dataDir,'reports');
const securityDir=path.join(dataDir,'security');
const operationsDir=path.join(dataDir,'operations');
const fontDir=path.join(__dirname,'private-fonts');
for(const dir of [jobsDir,outputDir,reportsDir,securityDir,operationsDir])await fs.mkdir(dir,{recursive:true});

const MODES=['prompt_only','template_svg','template_png','template_video','flux_local','ltx_video_local'];
const VISUAL_MODES=new Set(['template_svg','template_png','template_video','flux_local','ltx_video_local']);
const allowedOrigins=(process.env.DNA_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
const allowedDevices=new Set((process.env.DNA_ALLOWED_DEVICE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
const requireDevice=process.env.DNA_REQUIRE_DEVICE_ID!=='false';
const allowLocalNoToken=process.env.DNA_ALLOW_LOCAL_NO_TOKEN==='true';
const requirePremiumGate=process.env.DNA_REQUIRE_PREMIUM_GATE!=='false';
const dynamicDeviceRegistry=process.env.DNA_DYNAMIC_DEVICE_REGISTRY==='true';
const rateWindowMs=Number(process.env.DNA_RATE_WINDOW_MS||60000);
const rateMax=Number(process.env.DNA_RATE_MAX||60);
const replayWindowMs=Number(process.env.DNA_REPLAY_WINDOW_MS||300000);
const retentionHours=Number(process.env.DNA_RETENTION_HOURS||24);
const rateBuckets=new Map();
const seenNonces=new Map();

const deviceRegistry=new DeviceRegistry({directory:path.join(securityDir,'devices'),pepper:process.env.DNA_DEVICE_REGISTRY_PEPPER||process.env.DNA_RENDER_TOKEN||'',codeTtlMinutes:Number(process.env.DNA_ENROLLMENT_CODE_TTL_MINUTES||15)});
const auditLog=new AuditLog({file:path.join(securityDir,'audit.jsonl'),pepper:process.env.DNA_AUDIT_PEPPER||process.env.DNA_RENDER_TOKEN||'',retentionDays:Number(process.env.DNA_AUDIT_RETENTION_DAYS||30)});
const metrics=new MetricsStore({file:path.join(operationsDir,'metrics.json')});
await Promise.all([deviceRegistry.initialize(),auditLog.initialize(),metrics.initialize()]);

const app=express();
app.disable('x-powered-by');
app.set('trust proxy','loopback');
app.use(express.json({limit:process.env.DNA_JSON_LIMIT||'2mb',strict:true}));
app.use((req,res,next)=>{
 res.setHeader('x-content-type-options','nosniff');
 res.setHeader('x-frame-options','DENY');
 res.setHeader('referrer-policy','no-referrer');
 res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 res.setHeader('cross-origin-resource-policy','same-site');
 res.setHeader('cache-control','no-store, max-age=0');
 const origin=req.headers.origin;
 if(origin){
  if(!allowedOrigins.includes(origin))return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'});
  res.setHeader('access-control-allow-origin',origin);
  res.setHeader('vary','origin');
  res.setHeader('access-control-allow-headers','authorization,content-type,x-device-id,x-request-timestamp,x-request-nonce,x-admin-token');
  res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS');
 }
 if(req.method==='OPTIONS')return res.sendStatus(204);
 next();
});
app.use((req,res,next)=>{
 const started=Date.now();
 res.on('finish',()=>{
  if(!req.path.startsWith('/api/'))return;
  const details={statusCode:res.statusCode,userAgent:req.headers['user-agent']||'',queryKeys:Object.keys(req.query||{})};
  auditLog.write({event:'http.request',status:res.statusCode<400?'success':'error',deviceId:req.headers['x-device-id'],ip:req.ip,route:req.route?.path||req.path,method:req.method,jobId:req.params?.id,details}).catch(()=>{});
  metrics.increment(`http.status.${res.statusCode}`).catch(()=>{});
  metrics.recordDuration('http.request',Date.now()-started).catch(()=>{});
 });
 next();
});

function clientKey(req){return `${req.ip}|${req.headers['x-device-id']||'none'}`}
function rateLimit(req,res,next){
 const now=Date.now(),key=clientKey(req),entry=rateBuckets.get(key);
 if(!entry||now-entry.start>=rateWindowMs){rateBuckets.set(key,{start:now,count:1});return next()}
 entry.count+=1;
 if(entry.count>rateMax){res.setHeader('retry-after',String(Math.ceil((rateWindowMs-(now-entry.start))/1000)));return res.status(429).json({error:'RATE_LIMITED'})}
 next();
}
function isLocal(req){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)}
function secureCompare(supplied,configured){const a=Buffer.from(String(supplied||'')),b=Buffer.from(String(configured||''));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function requireToken(req,res,next){
 const configured=process.env.DNA_RENDER_TOKEN;
 if(!configured&&allowLocalNoToken&&isLocal(req))return next();
 if(!configured)return res.status(503).json({error:'RENDER_TOKEN_NOT_CONFIGURED'});
 const supplied=req.headers.authorization?.replace(/^Bearer\s+/i,'')||'';
 if(!secureCompare(supplied,configured))return res.status(401).json({error:'UNAUTHORIZED'});
 next();
}
function requireAdmin(req,res,next){
 const configured=process.env.DNA_ADMIN_TOKEN;
 if(!configured)return res.status(503).json({error:'ADMIN_TOKEN_NOT_CONFIGURED'});
 if(!secureCompare(req.headers['x-admin-token'],configured))return res.status(401).json({error:'ADMIN_UNAUTHORIZED'});
 next();
}
function requireDeviceId(req,res,next){
 const id=String(req.headers['x-device-id']||'').trim();
 if(requireDevice&&!id)return res.status(400).json({error:'DEVICE_ID_REQUIRED'});
 if(id.length>128||!/^[A-Za-z0-9._:-]*$/.test(id))return res.status(400).json({error:'DEVICE_ID_INVALID'});
 if(!dynamicDeviceRegistry&&allowedDevices.size&&!allowedDevices.has(id))return res.status(403).json({error:'DEVICE_NOT_REGISTERED'});
 req.deviceId=id||null;
 next();
}
async function requireRegisteredDevice(req,res,next){
 if(!dynamicDeviceRegistry)return next();
 try{
  const authorization=await deviceRegistry.authorize(req.deviceId);
  if(!authorization.ok)return res.status(403).json({error:authorization.reason});
  req.registeredDevice=authorization.device;next();
 }catch{return res.status(503).json({error:'DEVICE_REGISTRY_UNAVAILABLE'})}
}
function requireFreshRequest(req,res,next){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 const timestamp=Number(req.headers['x-request-timestamp']);
 const nonce=String(req.headers['x-request-nonce']||'');
 const now=Date.now();
 if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>replayWindowMs)return res.status(401).json({error:'REQUEST_TIMESTAMP_INVALID'});
 if(!/^[A-Za-z0-9-]{16,128}$/.test(nonce))return res.status(401).json({error:'REQUEST_NONCE_INVALID'});
 if(seenNonces.has(nonce))return res.status(409).json({error:'REQUEST_REPLAYED'});
 seenNonces.set(nonce,now+replayWindowMs);next();
}
function secureApi(req,res,next){return rateLimit(req,res,()=>requireToken(req,res,()=>requireDeviceId(req,res,()=>requireRegisteredDevice(req,res,()=>requireFreshRequest(req,res,next)))))}
function enrollmentApi(req,res,next){return rateLimit(req,res,()=>requireToken(req,res,()=>requireDeviceId(req,res,()=>requireFreshRequest(req,res,next))))}
function adminApi(req,res,next){return rateLimit(req,res,()=>requireToken(req,res,()=>requireAdmin(req,res,()=>requireFreshRequest(req,res,next))))}

async function writeJob(job){await fs.writeFile(path.join(jobsDir,`${job.id}.json`),JSON.stringify(job,null,2),{mode:0o600})}
async function readJob(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('INVALID_JOB_ID');return JSON.parse(await fs.readFile(path.join(jobsDir,`${id}.json`),'utf8'))}
function assertOwner(job,req){if(job.deviceId&&job.deviceId!==req.deviceId){const e=new Error('JOB_FORBIDDEN');e.status=403;throw e}}
function fileResult(name,type){return{name,type,url:`/api/outputs/${name}`,previewUrl:`/api/previews/${name}`}}
function candidateFileNames(job){return (job.candidateResult?.files||[]).map(file=>file.name).filter(Boolean)}
async function removeCandidateFiles(job){for(const name of candidateFileNames(job))await fs.rm(path.join(outputDir,path.basename(name)),{force:true})}
function sanitizedJob(job){const copy=structuredClone(job);if(copy.status!=='completed'&&copy.candidateResult?.files)copy.candidateResult.files=copy.candidateResult.files.map(({name,type,previewUrl})=>({name,type,previewUrl:previewUrl||`/api/previews/${name}`,restricted:true}));return copy}
function defaultAssetManifest(job){return{expectedWidth:job.recipe?.format?.width,expectedHeight:job.recipe?.format?.height,boxes:job.input?.assetManifest?.boxes||[],texts:job.input?.assetManifest?.texts||[{id:'headline',value:job.input?.headline,required:Boolean(job.input?.headline),maxChars:80},{id:'subtitle',value:job.input?.subtitle,required:false,maxChars:120}],safeArea:job.input?.assetManifest?.safeArea}}
async function automaticImageQa(job,filePath){return validateAsset({file:filePath,expectedQrUrl:job.input?.expectedQrUrl||null,manifest:defaultAssetManifest(job),threshold:82})}
function resolveReference(assessment={}){if(!assessment.referenceProfile)return assessment.reference||{};const profile=createReferenceProfile(assessment.referenceProfile);const comparison=compareReferenceProfile(profile,assessment.candidateSignals||assessment.premiumSignals||{});return {...comparison,profileId:profile.id}}

async function applyQualityAssessment(job,assessment){
 const technicalReport={failures:[...(assessment.failures||[]),...(job.candidateResult?.qa?.failures||[])],warnings:[...(assessment.warnings||[]),...(job.candidateResult?.qa?.warnings||[])]};
 const gate=evaluateQualityGate({candidateId:job.id,scores:assessment.scores||{},technicalReport,reference:resolveReference(assessment),premiumSignals:assessment.premiumSignals||{},minimumLevel:assessment.minimumLevel||'RELEASE',provenance:assessment.provenance||job.provenance||{}});
 job.qualityGate=gate;const reportPath=path.join(reportsDir,`${job.id}.quality.json`);await writeQaReport(reportPath,{jobId:job.id,gate,automaticQa:job.candidateResult?.qa||null,assessedAt:new Date().toISOString()});job.qualityReport={name:path.basename(reportPath)};
 if(gate.shouldOutput){job.result={...job.candidateResult,qualityGate:gate};job.status='completed';job.completedAt=new Date().toISOString();await metrics.increment('jobs.completed')}
 else{job.regenerationRecipe=createRegenerationRecipe({job,gate});await removeCandidateFiles(job);job.result={files:[],qualityGate:gate,regenerationRecipe:job.regenerationRecipe};job.status='rejected';job.rejectedAt=new Date().toISOString();await metrics.increment('jobs.rejected')}
 await writeJob(job);return job;
}

async function executeJob(job){
 job.status='processing';job.startedAt=new Date().toISOString();await writeJob(job);const started=Date.now();
 try{
  let candidateResult;
  if(job.mode==='prompt_only')candidateResult={recipe:job.recipe};
  else if(job.mode==='template_svg'){
   const font=await loadJapaneseFont(fontDir,{required:false});const svg=renderSocialSvg(job.recipe,job.input,font||{}),svgFile=`${job.id}.svg`;await fs.writeFile(path.join(outputDir,svgFile),svg,{mode:0o600});candidateResult={files:[fileResult(svgFile,'image/svg+xml')],font:font?{name:font.name,sha256:font.sha256}:null,qa:{ok:true,score:100,failures:[],warnings:[]}};
  }else if(job.mode==='template_png'){
   const font=await loadJapaneseFont(fontDir,{required:process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});const pngFile=`${job.id}.png`;const pngPath=path.join(outputDir,pngFile);
   if(!font&&process.env.DNA_ALLOW_FONT_FALLBACK==='true'){const svg=renderSocialSvg(job.recipe,job.input,{});const sharp=(await import('sharp')).default;await sharp(Buffer.from(svg)).png().toFile(pngPath);candidateResult={files:[fileResult(pngFile,'image/png')],font:null,warning:'FONT_FALLBACK_USED'}}
   else{const rendered=await renderSocialPng({recipe:job.recipe,input:job.input,font,output:pngPath});candidateResult={files:[fileResult(pngFile,'image/png')],font:rendered.font,layout:rendered.layout}}
   candidateResult.qa=await automaticImageQa(job,pngPath);
  }else if(job.mode==='template_video'){
   const font=await loadJapaneseFont(fontDir,{required:process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});const file=`${job.id}.mp4`;const rendered=await renderVideo({...job.input,format:job.input.format||'reels',dna:job.recipe.motion?.id,output:path.join(outputDir,file),fontFamily:font?.name||'Noto Sans JP',fontDataUri:font?.dataUri||''});await validateMp4(path.join(outputDir,file));candidateResult={files:[fileResult(file,'video/mp4')],qa:rendered.qa,font:font?{name:font.name,sha256:font.sha256}:null};
  }else if(job.mode==='flux_local'){
   const workflowPath=path.join(__dirname,'workflows/comfyui/flux1-schnell.json');const queued=await queueComfyWorkflow({workflowPath,variables:{prompt:job.recipe.productionPrompt,width:job.recipe.format.width,height:job.recipe.format.height,seed:job.input.seed||1,unet_name:process.env.FLUX_UNET||'flux1-schnell.safetensors',clip_l:process.env.FLUX_CLIP_L||'clip_l.safetensors',t5xxl:process.env.FLUX_T5||'t5xxl_fp16.safetensors',vae_name:process.env.FLUX_VAE||'ae.safetensors'}});candidateResult={provider:'comfyui-flux',queued,limits:{cost:'local_free',hardwareDependent:true},qa:{ok:true,score:82,failures:[],warnings:['EXTERNAL_RESULT_PENDING']}};
  }else if(job.mode==='ltx_video_local')candidateResult=await generateLtxVideo({prompt:job.recipe.productionPrompt,imagePath:job.input.imagePath,width:job.input.width||768,height:job.input.height||1280,frames:job.input.frames||121,fps:job.input.fps||24,seed:job.input.seed||1,models:{ltx_model:process.env.LTX_MODEL||'ltx-video.safetensors'}});
  else throw new Error('ADAPTER_NOT_CONFIGURED');
  job.candidateResult=candidateResult;if(job.status==='cancelled')return;
  if(!VISUAL_MODES.has(job.mode)||!requirePremiumGate){job.result=candidateResult;job.status='completed';job.completedAt=new Date().toISOString();await metrics.increment('jobs.completed')}
  else if(job.input.qualityAssessment)await applyQualityAssessment(job,job.input.qualityAssessment);
  else{job.result={files:[],reviewRequired:true};job.status='review_required';job.reviewRequiredAt=new Date().toISOString();await metrics.increment('jobs.review_required')}
 }catch(error){if(job.status!=='cancelled'){job.status='failed';job.error=process.env.NODE_ENV==='production'?'GENERATION_FAILED':String(error?.message||error);job.completedAt=new Date().toISOString();await metrics.increment('jobs.failed')}}
 await metrics.recordDuration(`render.${job.mode}`,Date.now()-started);await writeJob(job);
}

async function cleanupExpired(){
 const cutoff=Date.now()-retentionHours*3600000;
 for(const dir of [jobsDir,outputDir,reportsDir])for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(!entry.isFile())continue;const file=path.join(dir,entry.name),stat=await fs.stat(file);if(stat.mtimeMs<cutoff)await fs.rm(file,{force:true})}
 const now=Date.now();for(const [nonce,expiry] of seenNonces)if(expiry<now)seenNonces.delete(nonce);for(const [key,entry] of rateBuckets)if(now-entry.start>rateWindowMs*2)rateBuckets.delete(key);await auditLog.prune();
}
setInterval(()=>cleanupExpired().catch(()=>{}),Math.min(3600000,retentionHours*1800000)).unref();

app.get('/api/health',rateLimit,(_,res)=>res.json({ok:true,name:'14DNA-ENGINE'}));
app.post('/api/admin/enrollment-codes',adminApi,async(req,res)=>{try{const enrollment=await deviceRegistry.createEnrollmentCode({label:req.body?.label,createdBy:'admin',ttlMinutes:req.body?.ttlMinutes});await auditLog.write({event:'device.enrollment.create',status:'success',ip:req.ip,route:req.path,method:req.method,details:{enrollmentId:enrollment.id,label:enrollment.label,expiresAt:enrollment.expiresAt}});res.status(201).json(enrollment)}catch(error){res.status(400).json({error:error.message||'ENROLLMENT_CREATE_FAILED'})}});
app.post('/api/devices/register',enrollmentApi,async(req,res)=>{try{const device=await deviceRegistry.registerDevice({deviceId:req.deviceId,code:req.body?.code,label:req.body?.label,userAgent:req.headers['user-agent']||''});await auditLog.write({event:'device.register',status:'success',deviceId:req.deviceId,ip:req.ip,route:req.path,method:req.method,details:{label:device.label}});await metrics.increment('devices.registered');res.status(201).json(device)}catch(error){res.status(400).json({error:error.message||'DEVICE_REGISTRATION_FAILED'})}});
app.get('/api/devices/me',secureApi,async(req,res)=>{if(!dynamicDeviceRegistry)return res.json({id:req.deviceId,mode:'static_allowlist'});const authorization=await deviceRegistry.authorize(req.deviceId,{touch:false});res.json(authorization.device)});
app.get('/api/admin/devices',adminApi,async(_,res)=>res.json({devices:await deviceRegistry.listDevices()}));
app.delete('/api/admin/devices/:id',adminApi,async(req,res)=>{try{const device=await deviceRegistry.revokeDevice(req.params.id,{reason:req.body?.reason,revokedBy:'admin'});await auditLog.write({event:'device.revoke',status:'success',deviceId:req.params.id,ip:req.ip,route:req.path,method:req.method,details:{reason:device.revokedReason}});res.json(device)}catch(error){res.status(404).json({error:error.message||'DEVICE_REVOKE_FAILED'})}});
app.get('/api/admin/audit',adminApi,async(req,res)=>res.json({events:await auditLog.readRecent({limit:req.query.limit,event:req.query.event})}));
app.get('/api/admin/metrics',adminApi,async(_,res)=>res.json(await metrics.snapshot()));
app.get('/api/catalog',secureApi,(_,res)=>res.json({motion:MOTION,formats:FORMATS,modes:MODES,qualityGate:{required:requirePremiumGate,minimumLevel:'RELEASE'},security:{dynamicDeviceRegistry}}));
app.get('/api/fonts',secureApi,async(_,res)=>res.json(await inspectFonts(fontDir)));
app.post('/api/recipe',secureApi,(req,res)=>{try{res.json(createRecipe(req.body||{}))}catch{res.status(400).json({error:'RECIPE_INVALID'})}});
app.post('/api/variations',secureApi,(req,res)=>{try{res.json(createVariationPlan(req.body||{}))}catch{res.status(400).json({error:'VARIATION_PLAN_INVALID'})}});
app.post('/api/jobs',secureApi,async(req,res)=>{try{const input=req.body||{};if(!MODES.includes(input.mode||'prompt_only'))throw new Error('MODE_UNSUPPORTED');const recipe=createRecipe(input);const job={id:crypto.randomUUID(),status:'queued',mode:input.mode||'prompt_only',input,recipe,createdAt:new Date().toISOString(),deviceId:req.deviceId};await writeJob(job);await metrics.increment('jobs.created');queueMicrotask(()=>executeJob(job));res.status(202).json(sanitizedJob(job))}catch(error){res.status(400).json({error:String(error?.message||'JOB_INVALID')})}});
app.get('/api/jobs/:id',secureApi,async(req,res)=>{try{const job=await readJob(req.params.id);assertOwner(job,req);res.json(sanitizedJob(job))}catch(error){res.status(error.status||404).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'JOB_NOT_FOUND'})}});
app.post('/api/jobs/:id/quality',secureApi,async(req,res)=>{try{const job=await readJob(req.params.id);assertOwner(job,req);if(job.status!=='review_required')return res.status(409).json({error:'JOB_NOT_AWAITING_REVIEW'});res.json(sanitizedJob(await applyQualityAssessment(job,req.body||{})))}catch(error){res.status(error.status||400).json({error:error.message||'QUALITY_ASSESSMENT_FAILED'})}});
app.post('/api/jobs/:id/regenerate',secureApi,async(req,res)=>{try{const source=await readJob(req.params.id);assertOwner(source,req);if(source.status!=='rejected')return res.status(409).json({error:'JOB_NOT_REJECTED'});const regenerationRecipe=source.regenerationRecipe||createRegenerationRecipe({job:source,gate:source.qualityGate||{}});const input={...source.input,...(req.body||{}),qualityAssessment:undefined,regenerationRecipe,parentJobId:source.id,seed:crypto.randomUUID()};const job={id:crypto.randomUUID(),status:'queued',mode:input.mode||source.mode,input,recipe:createRecipe(input),createdAt:new Date().toISOString(),deviceId:req.deviceId,parentJobId:source.id,regenerationRecipe};await writeJob(job);await metrics.increment('jobs.regenerated');queueMicrotask(()=>executeJob(job));res.status(202).json(sanitizedJob(job))}catch(error){res.status(error.status||400).json({error:error.message||'REGENERATION_FAILED'})}});
app.delete('/api/jobs/:id',secureApi,async(req,res)=>{try{const job=await readJob(req.params.id);assertOwner(job,req);if(['completed','failed','rejected'].includes(job.status))return res.status(409).json({error:'JOB_ALREADY_FINISHED'});job.status='cancelled';job.cancelledAt=new Date().toISOString();await removeCandidateFiles(job);await writeJob(job);await metrics.increment('jobs.cancelled');res.json(sanitizedJob(job))}catch(error){res.status(error.status||404).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'JOB_NOT_FOUND'})}});
app.get('/api/previews/:file',secureApi,async(req,res)=>{try{const name=path.basename(req.params.file);const match=name.match(/^([0-9a-f-]{36})\.(svg|png|mp4)$/i);if(!match)throw new Error('PREVIEW_NOT_FOUND');const job=await readJob(match[1]);assertOwner(job,req);if(!['review_required','completed'].includes(job.status)||!candidateFileNames(job).includes(name))throw new Error('PREVIEW_NOT_AVAILABLE');res.setHeader('content-disposition',`inline; filename="${name}"`);res.setHeader('cache-control','private, no-store, max-age=0');res.sendFile(path.join(outputDir,name))}catch(error){res.status(error.status||403).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'PREVIEW_NOT_AVAILABLE'})}});
app.get('/api/outputs/:file',secureApi,async(req,res)=>{try{const name=path.basename(req.params.file);const match=name.match(/^([0-9a-f-]{36})\.(svg|png|mp4)$/i);if(!match)throw new Error('OUTPUT_NOT_FOUND');const job=await readJob(match[1]);assertOwner(job,req);if(job.status!=='completed'||!job.qualityGate?.shouldOutput)throw new Error('OUTPUT_NOT_APPROVED');res.setHeader('content-disposition',`attachment; filename="${name}"`);res.setHeader('cache-control','private, no-store, max-age=0');res.sendFile(path.join(outputDir,name))}catch(error){res.status(error.status||403).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'OUTPUT_NOT_APPROVED'})}});

app.use((req,res,next)=>{if(req.path.endsWith('.html')||req.path.endsWith('.js')||req.path.endsWith('manifest.webmanifest')||req.path.endsWith('sw.js'))res.setHeader('cache-control','no-store, max-age=0');next()});
app.use(express.static(mobilePwaDir,{index:'index.html',dotfiles:'deny',fallthrough:true}));
app.use((_,res)=>res.sendFile(path.join(mobilePwaDir,'index.html')));

const port=Number(process.env.PORT||4314);
const host=process.env.DNA_BIND_HOST||'127.0.0.1';
app.listen(port,host,()=>console.log(`14DNA-ENGINE private PWA http://${host}:${port}`));
