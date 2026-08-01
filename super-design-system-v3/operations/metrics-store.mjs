import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(error){if(error?.code==='ENOENT')return fallback;throw error}}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2),{mode:0o600})}

export class MetricsStore{
 constructor({file}={}){if(!file)throw new Error('METRICS_FILE_REQUIRED');this.file=file}
 async initialize(){if(!(await readJson(this.file,null)))await writeJson(this.file,{version:1,updatedAt:new Date().toISOString(),counters:{},durations:{}})}
 async increment(name,amount=1){const data=await readJson(this.file,{version:1,counters:{},durations:{}});data.counters[name]=(data.counters[name]||0)+Number(amount||0);data.updatedAt=new Date().toISOString();await writeJson(this.file,data);return data.counters[name]}
 async recordDuration(name,milliseconds){const data=await readJson(this.file,{version:1,counters:{},durations:{}});const entry=data.durations[name]||{count:0,totalMs:0,maxMs:0,minMs:null};const ms=Math.max(0,Number(milliseconds)||0);entry.count+=1;entry.totalMs+=ms;entry.maxMs=Math.max(entry.maxMs,ms);entry.minMs=entry.minMs===null?ms:Math.min(entry.minMs,ms);data.durations[name]=entry;data.updatedAt=new Date().toISOString();await writeJson(this.file,data);return entry}
 async snapshot(){const data=await readJson(this.file,{version:1,counters:{},durations:{}});const durations={};for(const [name,entry] of Object.entries(data.durations||{}))durations[name]={...entry,averageMs:entry.count?Math.round(entry.totalMs/entry.count):0};return {...data,durations}}
}
