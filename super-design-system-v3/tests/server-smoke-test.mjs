import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const port=4400+Math.floor(Math.random()*400);
const base=`http://127.0.0.1:${port}`;
const device='ci-device';
const token='ci-render-token-0123456789abcdef';

function headers(method='GET',payload){
 const h={'accept':'application/json','authorization':`Bearer ${token}`,'x-device-id':device,'connection':'close'};
 if(payload!==undefined){h['content-type']='application/json';h['content-length']=String(Buffer.byteLength(payload))}
 if(['POST','PUT','PATCH','DELETE'].includes(method)){
  h['x-request-timestamp']=String(Date.now());
  h['x-request-nonce']=crypto.randomUUID();
 }
 return h;
}
function rawRequest(url,{method='GET',body,requestHeaders}={}){
 const payload=body===undefined?undefined:JSON.stringify(body);
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{...headers(method,payload),...(requestHeaders||{})}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode||0,headers:res.headers,body:Buffer.concat(chunks)}));
  });
  req.on('error',reject);if(payload!==undefined)req.write(payload,'utf8');req.end();
 });
}
async function request(url,options={}){
 const response=await rawRequest(url,options);const text=response.body.toString('utf8');let data;try{data=JSON.parse(text)}catch{data=text}
 if(response.status<200||response.status>=300)throw new Error(`${options.method||'GET'} ${url} ${response.status}: ${text}`);
 return {response,data};
}
async function waitFor(id,statuses,timeout=30000){
 const started=Date.now();
 while(Date.now()-started<timeout){
  const {data}=await request(`/api/jobs/${id}`);
  if(statuses.includes(data.status))return data;
  await new Promise(r=>setTimeout(r,200));
 }
 throw new Error(`Timeout waiting for ${id}: ${statuses.join(',')}`);
}
function scores(value){return Object.fromEntries(['concept','composition','hierarchy','materiality','typography','brand','technical'].map(k=>[k,value]))}

await fs.rm(path.join(root,'runtime'),{recursive:true,force:true});
const child=spawn(process.execPath,['server.mjs'],{
 cwd:root,
 env:{...process.env,NODE_ENV:'test',PORT:String(port),DNA_BIND_HOST:'127.0.0.1',DNA_RENDER_TOKEN:token,DNA_REQUIRE_DEVICE_ID:'true',DNA_ALLOWED_DEVICE_IDS:device,DNA_ALLOW_FONT_FALLBACK:'true',DNA_REQUIRE_PREMIUM_GATE:'true',DNA_RETENTION_HOURS:'1'},
 stdio:['ignore','pipe','pipe']
});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
try{
 for(let i=0;i<80;i++){
  try{const r=await rawRequest('/api/health');if(r.status===200)break}catch{}
  await new Promise(r=>setTimeout(r,100));
  if(i===79)throw new Error(`Server did not start: ${logs}`);
 }
 const {data:catalog}=await request('/api/catalog');
 assert.equal(catalog.qualityGate.required,true);

 const {data:created}=await request('/api/jobs',{method:'POST',body:{mode:'template_png',format:'square',theme:'実運用テスト',headline:'14DNA-ENGINE',subtitle:'Quality Gate',seed:'SMOKE-APPROVE'}});
 const review=await waitFor(created.id,['review_required','failed']);
 assert.equal(review.status,'review_required',JSON.stringify(review));
 assert.equal(review.candidateResult.qa.ok,true);
 assert.equal(review.candidateResult.files[0].restricted,true);
 assert.ok(review.candidateResult.files[0].previewUrl);

 const preview=await rawRequest(review.candidateResult.files[0].previewUrl,{requestHeaders:{accept:'image/png'}});
 assert.equal(preview.status,200);
 assert.match(String(preview.headers['content-type']||''),/image\/png/);

 const {data:approved}=await request(`/api/jobs/${created.id}/quality`,{method:'POST',body:{minimumLevel:'RELEASE',scores:scores(94),reference:{provided:true,required:true,compositionSimilarity:90,materialSimilarity:90,hierarchySimilarity:92},premiumSignals:{decorativeNoise:5,neonDependence:0,templateFeeling:5,genericIconDensity:5,visualFocusCount:1,negativeSpace:30,controlledAsymmetry:85,materialEvidence:88}}});
 assert.equal(approved.status,'completed',JSON.stringify(approved));
 assert.equal(approved.qualityGate.shouldOutput,true);
 const output=await rawRequest(approved.result.files[0].url,{requestHeaders:{accept:'image/png'}});
 assert.equal(output.status,200);
 assert.ok(output.body.byteLength>1000);

 const {data:createdReject}=await request('/api/jobs',{method:'POST',body:{mode:'template_png',format:'square',theme:'拒否テスト',headline:'低品質候補',seed:'SMOKE-REJECT'}});
 await waitFor(createdReject.id,['review_required']);
 const {data:rejected}=await request(`/api/jobs/${createdReject.id}/quality`,{method:'POST',body:{minimumLevel:'RELEASE',scores:scores(60),reference:{provided:true,required:true,compositionSimilarity:50,materialSimilarity:50,hierarchySimilarity:50},premiumSignals:{decorativeNoise:80,neonDependence:70,templateFeeling:80,genericIconDensity:80,visualFocusCount:6,negativeSpace:5,controlledAsymmetry:30,materialEvidence:30}}});
 assert.equal(rejected.status,'rejected');
 assert.equal(rejected.qualityGate.shouldOutput,false);
 assert.equal(rejected.result.files.length,0);
 assert.equal(rejected.regenerationRecipe.decision,'REGENERATE');

 const {data:regenerated}=await request(`/api/jobs/${createdReject.id}/regenerate`,{method:'POST',body:{headline:'改善候補'}});
 assert.equal(regenerated.parentJobId,createdReject.id);
 assert.equal(regenerated.status,'queued');
 await waitFor(regenerated.id,['review_required','failed']);

 console.log('14DNA-ENGINE authenticated server smoke test passed.');
}finally{
 child.kill('SIGTERM');
 await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2000)});
 await fs.rm(path.join(root,'runtime'),{recursive:true,force:true});
}
