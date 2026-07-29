import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function substitute(value,vars){
 if(Array.isArray(value))return value.map(v=>substitute(v,vars));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,substitute(v,vars)]));
 if(typeof value==='string')return value.replace(/\{\{(\w+)\}\}/g,(_,k)=>String(vars[k]??''));
 return value;
}
export async function queueComfyWorkflow({baseUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188',workflowPath,variables={},clientId=crypto.randomUUID()}){
 const workflow=JSON.parse(await fs.readFile(path.resolve(workflowPath),'utf8'));
 const prompt=substitute(workflow,variables);
 const response=await fetch(`${baseUrl.replace(/\/$/,'')}/prompt`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,client_id:clientId})});
 if(!response.ok)throw new Error(`COMFYUI_HTTP_${response.status}:${await response.text()}`);
 return{baseUrl,clientId,...await response.json()};
}
export async function waitForComfyResult({baseUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188',promptId,timeoutMs=900000,intervalMs=2000}){
 const started=Date.now();
 while(Date.now()-started<timeoutMs){
  const r=await fetch(`${baseUrl.replace(/\/$/,'')}/history/${promptId}`);
  if(r.ok){const json=await r.json();const item=json[promptId];if(item?.outputs)return item;}
  await new Promise(resolve=>setTimeout(resolve,intervalMs));
 }
 throw new Error('COMFYUI_TIMEOUT');
}
