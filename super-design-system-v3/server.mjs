import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {createRecipe,MOTION,FORMATS} from './engine.mjs';
import {renderSocialSvg} from './renderers/social-svg.mjs';
import {inspectFonts,loadJapaneseFont} from './font-manager.mjs';
import {renderVideo} from './video/render-video.mjs';
import {validateMp4} from './video/ffmpeg.mjs';
import {queueComfyWorkflow,waitForComfyResult} from './adapters/comfyui.mjs';
import {generateLtxVideo} from './adapters/ltx-video.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(__dirname,'runtime'),jobsDir=path.join(dataDir,'jobs'),outputDir=path.join(dataDir,'outputs'),fontDir=path.join(__dirname,'private-fonts');
await fs.mkdir(jobsDir,{recursive:true});await fs.mkdir(outputDir,{recursive:true});
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'10mb'}));
const allowedOrigins=(process.env.DNA_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
app.use((req,res,next)=>{const origin=req.headers.origin;if(origin&&allowedOrigins.includes(origin)){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','origin');res.setHeader('access-control-allow-headers','authorization,content-type,x-device-id');res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS')}if(req.method==='OPTIONS')return res.sendStatus(204);next()});
function requireToken(req,res,next){const configured=process.env.DNA_RENDER_TOKEN;const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);if(!configured&&local)return next();const supplied=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!configured)return res.status(503).json({error:'RENDER_TOKEN_NOT_CONFIGURED'});const a=Buffer.from(supplied||''),b=Buffer.from(configured);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'UNAUTHORIZED'});next()}
async function writeJob(job){await fs.writeFile(path.join(jobsDir,`${job.id}.json`),JSON.stringify(job,null,2))}async function readJob(id){return JSON.parse(await fs.readFile(path.join(jobsDir,`${id}.json`),'utf8'))}
function fileResult(name,type){return{name,type,url:`/api/outputs/${name}`}}
async function executeJob(job){job.status='processing';job.startedAt=new Date().toISOString();await writeJob(job);try{
 if(job.mode==='prompt_only')job.result={recipe:job.recipe};
 else if(['template_svg','template_png'].includes(job.mode)){
  const font=await loadJapaneseFont(fontDir,{required:job.mode==='template_png'&&process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});
  const svg=renderSocialSvg(job.recipe,job.input,font||{}),svgFile=`${job.id}.svg`;await fs.writeFile(path.join(outputDir,svgFile),svg);const files=[fileResult(svgFile,'image/svg+xml')];
  if(job.mode==='template_png'){const pngFile=`${job.id}.png`;await sharp(Buffer.from(svg)).png({compressionLevel:9,adaptiveFiltering:true}).toFile(path.join(outputDir,pngFile));files.unshift(fileResult(pngFile,'image/png'))}job.result={files,font:font?{name:font.name,sha256:font.sha256}:null};
 }else if(job.mode==='template_video'){
  const font=await loadJapaneseFont(fontDir,{required:process.env.DNA_ALLOW_FONT_FALLBACK!=='true'});const file=`${job.id}.mp4`;const result=await renderVideo({...job.input,format:job.input.format||'reels',dna:job.recipe.motion?.id,output:path.join(outputDir,file),fontFamily:font?.name||'Noto Sans JP',fontDataUri:font?.dataUri||''});await validateMp4(path.join(outputDir,file));job.result={files:[fileResult(file,'video/mp4')],qa:result.qa,font:font?{name:font.name,sha256:font.sha256}:null};
 }else if(job.mode==='flux_local'){
  const workflowPath=path.join(__dirname,'workflows/comfyui/flux1-schnell.json');const queued=await queueComfyWorkflow({workflowPath,variables:{prompt:job.recipe.productionPrompt,width:job.recipe.format.width,height:job.recipe.format.height,seed:job.input.seed||1,unet_name:process.env.FLUX_UNET||'flux1-schnell.safetensors',clip_l:process.env.FLUX_CLIP_L||'clip_l.safetensors',t5xxl:process.env.FLUX_T5||'t5xxl_fp16.safetensors',vae_name:process.env.FLUX_VAE||'ae.safetensors'}});job.result={provider:'comfyui-flux',queued,limits:{cost:'local_free',watermark:'none_added_by_14DNA',hardwareDependent:true}};
 }else if(job.mode==='ltx_video_local')job.result=await generateLtxVideo({prompt:job.recipe.productionPrompt,imagePath:job.input.imagePath,width:job.input.width||768,height:job.input.height||1280,frames:job.input.frames||121,fps:job.input.fps||24,seed:job.input.seed||1,models:{ltx_model:process.env.LTX_MODEL||'ltx-video.safetensors'}});
 else throw new Error(`ADAPTER_NOT_CONFIGURED:${job.mode}`);
 if(job.status!=='cancelled'){job.status='completed';job.completedAt=new Date().toISOString()}
 }catch(error){if(job.status!=='cancelled'){job.status='failed';job.error=String(error?.message||error);job.completedAt=new Date().toISOString()}}await writeJob(job)}
const MODES=['prompt_only','template_svg','template_png','template_video','flux_local','ltx_video_local'];
app.get('/api/health',(_,res)=>res.json({ok:true,name:'14DNA-ENGINE',version:'4.3.0',freeMode:true,modes:MODES}));app.get('/api/catalog',(_,res)=>res.json({motion:MOTION,formats:FORMATS,modes:MODES}));app.get('/api/fonts',requireToken,async(_,res)=>res.json(await inspectFonts(fontDir)));app.post('/api/recipe',(req,res)=>{try{res.json(createRecipe(req.body||{}))}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/jobs',requireToken,async(req,res)=>{try{const input=req.body||{};if(!MODES.includes(input.mode||'prompt_only'))throw new Error('MODE_UNSUPPORTED');const recipe=createRecipe(input);const job={id:crypto.randomUUID(),status:'queued',mode:input.mode||'prompt_only',input,recipe,createdAt:new Date().toISOString(),deviceId:req.headers['x-device-id']||null};await writeJob(job);queueMicrotask(()=>executeJob(job));res.status(202).json(job)}catch(error){res.status(400).json({error:String(error?.message||error)})}});
app.get('/api/jobs/:id',requireToken,async(req,res)=>{try{res.json(await readJob(req.params.id))}catch{res.status(404).json({error:'JOB_NOT_FOUND'})}});app.delete('/api/jobs/:id',requireToken,async(req,res)=>{try{const job=await readJob(req.params.id);if(['completed','failed'].includes(job.status))return res.status(409).json({error:'JOB_ALREADY_FINISHED'});job.status='cancelled';job.cancelledAt=new Date().toISOString();await writeJob(job);res.json(job)}catch{res.status(404).json({error:'JOB_NOT_FOUND'})}});app.get('/api/outputs/:file',requireToken,(req,res)=>res.sendFile(path.join(outputDir,path.basename(req.params.file))));
app.use(express.static(path.join(__dirname,'app')));app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'app','index.html')));const port=Number(process.env.PORT||4314);app.listen(port,process.env.DNA_BIND_HOST||'127.0.0.1',()=>console.log(`14DNA-ENGINE http://${process.env.DNA_BIND_HOST||'127.0.0.1'}:${port}`));
