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

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(__dirname,'..');
const mobilePwaDir=path.join(repoRoot,'apps','mobile-pwa');
const dataDir=path.join(__dirname,'runtime');
const jobsDir=path.join(dataDir,'jobs');
const outputDir=path.join(dataDir,'outputs');
const fontDir=path.join(__dirname,'private-fonts');
await fs.mkdir(jobsDir,{recursive:true});
await fs.mkdir(outputDir,{recursive:true});

const MODES=['prompt_only','template_svg','template_png','template_video','flux_local','ltx_video_local'];
const allowedOrigins=(process.env.DNA_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
const allowedDevices=new Set((process.env.DNA_ALLOWED_DEVICE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
const requireDevice=process.env.DNA_REQUIRE_DEVICE_ID!=='false';
const allowLocalNoToken=process.env.DNA_ALLOW_LOCAL_NO_TOKEN==='true';
const rateWindowMs=Number(process.env.DNA_RATE_WINDOW_MS||60000);
const rateMax=Number(process.env.DNA_RATE_MAX||60);
const replayWindowMs=Number(process.env.DNA_REPLAY_WINDOW_MS||300000);
const retentionHours=Number(process.env.DNA_RETENTION_HOURS||24);
const rateBuckets=new Map();
const seenNonces=new Map();

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
  res.setHeader('access-control-allow-headers','authorization,content-type,x-device-id,x-request-timestamp,x-request-nonce');
  res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS');
 }
 if(req.method==='OPTIONS')return res.sendStatus(204);
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
function requireToken(req,res,next){
 const configured=process.env.DNA_RENDER_TOKEN;
 if(!configured&&allowLocalNoToken&&isLocal(req))return next();
 if(!configured)return res.status(503).json({error:'RENDER_TOKEN_NOT_CONFIGURED'});
 const supplied=req.headers.authorization?.replace(/^Bearer\s+/i,'')||'';
 const a=Buffer.from(supplied),b=Buffer.from(configured);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'UNAUTHORIZED'});
 next();
}
function requireDeviceId(req,res,next){
 const id=String(req.headers['x-device-id']||'').trim();
 if(requireDevice&&!id)return res.status(400).json({error:'DEVICE_ID_REQUIRED'});
 if(id.length>128||!/^[A-Za-z0-9._:-]*$/.test(id))return res.status(400).json({error:'DEVICE_ID_INVALID'});
 if(allowedDevices.size&&!allowedDevices.has(id))return res.status(403).json({error:'DEVICE_NOT_REGISTERED'});
 req.deviceId=id||null;
 next();
}
function requireFreshRequest(req,res,next){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 const timestamp=Number(req.headers['x-request-timestamp']);
 const nonce=String(req.headers['x-request-nonce']||'');
 const now=Date.now();
 if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>replayWindowMs)return res.status(401).json({error:'REQUEST_TIMESTAMP_INVALID'});
 if(!/^[A-Za-z0-9-]{16,128}$/.test(nonce))return res.status(401).json({error:'REQUEST_NONCE_INVALID'});
 if(seenNonces.has(nonce))return res.status(409).json({error:'REQUEST_REPLAYED'});
 seenNonces.set(nonce,now+replayWindowMs);
 next();
}
function secureApi(req,res,next){return rateLimit(req,res,()=>requireToken(req,res,()=>requireDeviceId(req,res,()=>requireFreshRequest(req,res,next))))}

async function writeJob(job){await fs.writeFile(path.join(jobsDir,`${job.id}.json`),JSON.stringify(job,null,2),{mode:0o600})}
async function readJob(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('INVALID_JOB_ID');return JSON.parse(await fs.readFile(path.join(jobsDir,`${id}.json`),'utf8'))}
function assertOwner(job,req){if(job.deviceId&&job.deviceId!==req.deviceId){const e=new Error('JOB_FORBIDDEN');e.status=403;throw e}}
function fileResult(name,type){return{name,type,url:`/api/outputs/${name}`}}

async function executeJob(job){
 job.status='processing';job.startedAt=new Date().toISOString();await writeJob(job);
 try{
  if(job.mode==='prompt_only')job.result={recipe:job.recipe};
  else if(job.mode==='template_svg'){
   const font=await loadJapaneseFont(fontDir,{required:false});const svg=renderSocialSvg(job.recipe,job.input,font||{}),svgFile=`${job.id}.svg`;await fs.writeFile(path.join(outputDir,svgFile),svg,{mode:0o600});job.result={files:[fileResult(svgFile,'image/svg+xml')],font:font?{name:font.name,sha256:font.sha256}:null};
  }else if(job.mode==='template_png'){
   const font=await loadJapaneseFont(fontDir,{required:process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});const pngFile=`${job.id}.png`;
   if(!font&&process.env.DNA_ALLOW_FONT_FALLBACK==='true'){const svg=renderSocialSvg(job.recipe,job.input,{});const sharp=(await import('sharp')).default;await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir,pngFile));job.result={files:[fileResult(pngFile,'image/png')],font:null,warning:'FONT_FALLBACK_USED'}}
   else{const result=await renderSocialPng({recipe:job.recipe,input:job.input,font,output:path.join(outputDir,pngFile)});job.result={files:[fileResult(pngFile,'image/png')],font:result.font,layout:result.layout}}
  }else if(job.mode==='template_video'){
   const font=await loadJapaneseFont(fontDir,{required:process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});const file=`${job.id}.mp4`;const result=await renderVideo({...job.input,format:job.input.format||'reels',dna:job.recipe.motion?.id,output:path.join(outputDir,file),fontFamily:font?.name||'Noto Sans JP',fontDataUri:font?.dataUri||''});await validateMp4(path.join(outputDir,file));job.result={files:[fileResult(file,'video/mp4')],qa:result.qa,font:font?{name:font.name,sha256:font.sha256}:null};
  }else if(job.mode==='flux_local'){
   const workflowPath=path.join(__dirname,'workflows/comfyui/flux1-schnell.json');const queued=await queueComfyWorkflow({workflowPath,variables:{prompt:job.recipe.productionPrompt,width:job.recipe.format.width,height:job.recipe.format.height,seed:job.input.seed||1,unet_name:process.env.FLUX_UNET||'flux1-schnell.safetensors',clip_l:process.env.FLUX_CLIP_L||'clip_l.safetensors',t5xxl:process.env.FLUX_T5||'t5xxl_fp16.safetensors',vae_name:process.env.FLUX_VAE||'ae.safetensors'}});job.result={provider:'comfyui-flux',queued,limits:{cost:'local_free',hardwareDependent:true}};
  }else if(job.mode==='ltx_video_local')job.result=await generateLtxVideo({prompt:job.recipe.productionPrompt,imagePath:job.input.imagePath,width:job.input.width||768,height:job.input.height||1280,frames:job.input.frames||121,fps:job.input.fps||24,seed:job.input.seed||1,models:{ltx_model:process.env.LTX_MODEL||'ltx-video.safetensors'}});
  else throw new Error('ADAPTER_NOT_CONFIGURED');
  if(job.status!=='cancelled'){job.status='completed';job.completedAt=new Date().toISOString()}
 }catch(error){if(job.status!=='cancelled'){job.status='failed';job.error=process.env.NODE_ENV==='production'?'GENERATION_FAILED':String(error?.message||error);job.completedAt=new Date().toISOString()}}
 await writeJob(job);
}

async function cleanupExpired(){
 const cutoff=Date.now()-retentionHours*3600000;
 for(const dir of [jobsDir,outputDir]){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   if(!entry.isFile())continue;
   const file=path.join(dir,entry.name),stat=await fs.stat(file);
   if(stat.mtimeMs<cutoff)await fs.rm(file,{force:true});
  }
 }
 const now=Date.now();for(const [nonce,expiry] of seenNonces)if(expiry<now)seenNonces.delete(nonce);
 for(const [key,entry] of rateBuckets)if(now-entry.start>rateWindowMs*2)rateBuckets.delete(key);
}
setInterval(()=>cleanupExpired().catch(()=>{}),Math.min(3600000,retentionHours*1800000)).unref();

app.get('/api/health',rateLimit,(_,res)=>res.json({ok:true,name:'14DNA-ENGINE'}));
app.get('/api/catalog',secureApi,(_,res)=>res.json({motion:MOTION,formats:FORMATS,modes:MODES}));
app.get('/api/fonts',secureApi,async(_,res)=>res.json(await inspectFonts(fontDir)));
app.post('/api/recipe',secureApi,(req,res)=>{try{res.json(createRecipe(req.body||{}))}catch{res.status(400).json({error:'RECIPE_INVALID'})}});
app.post('/api/jobs',secureApi,async(req,res)=>{try{const input=req.body||{};if(!MODES.includes(input.mode||'prompt_only'))throw new Error('MODE_UNSUPPORTED');const recipe=createRecipe(input);const job={id:crypto.randomUUID(),status:'queued',mode:input.mode||'prompt_only',input,recipe,createdAt:new Date().toISOString(),deviceId:req.deviceId};await writeJob(job);queueMicrotask(()=>executeJob(job));res.status(202).json(job)}catch(error){res.status(400).json({error:String(error?.message||'JOB_INVALID')})}});
app.get('/api/jobs/:id',secureApi,async(req,res)=>{try{const job=await readJob(req.params.id);assertOwner(job,req);res.json(job)}catch(error){res.status(error.status||404).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'JOB_NOT_FOUND'})}});
app.delete('/api/jobs/:id',secureApi,async(req,res)=>{try{const job=await readJob(req.params.id);assertOwner(job,req);if(['completed','failed'].includes(job.status))return res.status(409).json({error:'JOB_ALREADY_FINISHED'});job.status='cancelled';job.cancelledAt=new Date().toISOString();await writeJob(job);res.json(job)}catch(error){res.status(error.status||404).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'JOB_NOT_FOUND'})}});
app.get('/api/outputs/:file',secureApi,async(req,res)=>{try{const name=path.basename(req.params.file);const match=name.match(/^([0-9a-f-]{36})\.(svg|png|mp4)$/i);if(!match)throw new Error('OUTPUT_NOT_FOUND');const job=await readJob(match[1]);assertOwner(job,req);res.setHeader('content-disposition',`attachment; filename="${name}"`);res.setHeader('cache-control','private, no-store, max-age=0');res.sendFile(path.join(outputDir,name))}catch(error){res.status(error.status||404).json({error:error.message==='JOB_FORBIDDEN'?'JOB_FORBIDDEN':'OUTPUT_NOT_FOUND'})}});

app.use((req,res,next)=>{if(req.path.endsWith('.html')||req.path.endsWith('.js')||req.path.endsWith('manifest.webmanifest')||req.path.endsWith('sw.js'))res.setHeader('cache-control','no-store, max-age=0');next()});
app.use(express.static(mobilePwaDir,{index:'index.html',dotfiles:'deny',fallthrough:true}));
app.get('*',(_,res)=>res.sendFile(path.join(mobilePwaDir,'index.html')));

const port=Number(process.env.PORT||4314);
const host=process.env.DNA_BIND_HOST||'127.0.0.1';
app.listen(port,host,()=>console.log(`14DNA-ENGINE private PWA http://${host}:${port}`));
