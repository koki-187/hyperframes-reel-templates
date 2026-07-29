import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRecipe,MOTION,FORMATS} from './engine.mjs';
import {renderSocialSvg} from './renderers/social-svg.mjs';
import {inspectFonts} from './font-manager.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(__dirname,'runtime');
const jobsDir=path.join(dataDir,'jobs');
const outputDir=path.join(dataDir,'outputs');
await fs.mkdir(jobsDir,{recursive:true});
await fs.mkdir(outputDir,{recursive:true});

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'10mb'}));

const allowedOrigins=(process.env.DNA_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin&&allowedOrigins.length&&allowedOrigins.includes(origin)){
    res.setHeader('access-control-allow-origin',origin);
    res.setHeader('vary','origin');
    res.setHeader('access-control-allow-headers','authorization,content-type,x-device-id');
    res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS');
  }
  if(req.method==='OPTIONS') return res.sendStatus(204);
  next();
});

function requireToken(req,res,next){
  const configured=process.env.DNA_RENDER_TOKEN;
  const local=req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::1';
  if(!configured&&local) return next();
  const supplied=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!configured) return res.status(503).json({error:'RENDER_TOKEN_NOT_CONFIGURED'});
  const a=Buffer.from(supplied||''); const b=Buffer.from(configured);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'UNAUTHORIZED'});
  next();
}

async function writeJob(job){await fs.writeFile(path.join(jobsDir,`${job.id}.json`),JSON.stringify(job,null,2));}
async function readJob(id){return JSON.parse(await fs.readFile(path.join(jobsDir,`${id}.json`),'utf8'));}

async function executeJob(job){
  job.status='processing'; job.startedAt=new Date().toISOString(); await writeJob(job);
  try{
    if(job.mode==='prompt_only'){
      job.result={recipe:job.recipe};
    }else if(job.mode==='template_svg'){
      const svg=renderSocialSvg(job.recipe,job.input);
      const file=`${job.id}.svg`;
      await fs.writeFile(path.join(outputDir,file),svg);
      job.result={files:[{name:file,type:'image/svg+xml',url:`/api/outputs/${file}`}]};
    }else{
      throw new Error(`ADAPTER_NOT_CONFIGURED:${job.mode}`);
    }
    job.status='completed'; job.completedAt=new Date().toISOString();
  }catch(error){job.status='failed';job.error=String(error?.message||error);job.completedAt=new Date().toISOString();}
  await writeJob(job);
}

app.get('/api/health',(_,res)=>res.json({ok:true,name:'14DNA-ENGINE',version:'4.1.0',freeMode:true}));
app.get('/api/catalog',(_,res)=>res.json({motion:MOTION,formats:FORMATS,modes:['prompt_only','template_svg']}));
app.get('/api/fonts',requireToken,async(_,res)=>res.json(await inspectFonts(path.join(__dirname,'private-fonts'))));
app.post('/api/recipe',(req,res)=>{try{res.json(createRecipe(req.body||{}))}catch(e){res.status(400).json({error:e.message})}});

app.post('/api/jobs',requireToken,async(req,res)=>{
  try{
    const input=req.body||{};
    const recipe=createRecipe(input);
    const job={id:crypto.randomUUID(),status:'queued',mode:input.mode||'prompt_only',input,recipe,createdAt:new Date().toISOString(),deviceId:req.headers['x-device-id']||null};
    await writeJob(job); queueMicrotask(()=>executeJob(job));
    res.status(202).json(job);
  }catch(error){res.status(400).json({error:String(error?.message||error)});}
});
app.get('/api/jobs/:id',requireToken,async(req,res)=>{try{res.json(await readJob(req.params.id))}catch{res.status(404).json({error:'JOB_NOT_FOUND'})}});
app.delete('/api/jobs/:id',requireToken,async(req,res)=>{
  try{const job=await readJob(req.params.id);if(['completed','failed'].includes(job.status))return res.status(409).json({error:'JOB_ALREADY_FINISHED'});job.status='cancelled';job.cancelledAt=new Date().toISOString();await writeJob(job);res.json(job)}catch{res.status(404).json({error:'JOB_NOT_FOUND'})}
});
app.get('/api/outputs/:file',requireToken,(req,res)=>{
  const safe=path.basename(req.params.file);res.sendFile(path.join(outputDir,safe));
});

app.post('/api/generate',requireToken,async(req,res)=>{
  const input={...(req.body||{}),mode:req.body?.provider==='prompt_only'?'prompt_only':'template_svg'};
  const recipe=createRecipe(input);const job={id:crypto.randomUUID(),status:'queued',mode:input.mode,input,recipe,createdAt:new Date().toISOString()};
  await writeJob(job);queueMicrotask(()=>executeJob(job));res.status(202).json(job);
});

app.use(express.static(path.join(__dirname,'app')));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'app','index.html')));
const port=Number(process.env.PORT||4314);
app.listen(port,process.env.DNA_BIND_HOST||'127.0.0.1',()=>console.log(`14DNA-ENGINE http://${process.env.DNA_BIND_HOST||'127.0.0.1'}:${port}`));
