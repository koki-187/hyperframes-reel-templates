import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SECRET_KEYS=/token|authorization|secret|password|api[-_]?key|cookie|session/i;
const PATH_PATTERN=/(?:[A-Za-z]:\\|\/(?:Users|home|var|tmp|private|mnt)\/)[^\s"']+/g;

function redact(value,depth=0){
 if(depth>6)return '[TRUNCATED]';
 if(value===null||value===undefined)return value;
 if(typeof value==='string')return value.replace(PATH_PATTERN,'[LOCAL_PATH]').slice(0,1000);
 if(typeof value==='number'||typeof value==='boolean')return value;
 if(Array.isArray(value))return value.slice(0,50).map(item=>redact(item,depth+1));
 if(typeof value==='object'){
  const out={};
  for(const [key,item] of Object.entries(value))out[key]=SECRET_KEYS.test(key)?'[REDACTED]':redact(item,depth+1);
  return out;
 }
 return String(value).slice(0,1000);
}
function digest(value,pepper=''){
 return crypto.createHash('sha256').update(`${pepper}:${String(value||'')}`).digest('hex').slice(0,24);
}

export class AuditLog{
 constructor({file,pepper='',retentionDays=30}={}){
  if(!file)throw new Error('AUDIT_LOG_FILE_REQUIRED');
  this.file=file;this.pepper=pepper;this.retentionDays=Number(retentionDays)||30;
 }
 async initialize(){await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.appendFile(this.file,'',{mode:0o600})}
 async write({event,status='success',deviceId=null,ip=null,route=null,method=null,jobId=null,details={}}={}){
  const row={id:crypto.randomUUID(),at:new Date().toISOString(),event:String(event||'unknown').slice(0,120),status:String(status).slice(0,32),device:digest(deviceId,this.pepper),ip:digest(ip,this.pepper),route:String(route||'').slice(0,240),method:String(method||'').slice(0,12),jobId:jobId?String(jobId).slice(0,64):null,details:redact(details)};
  await fs.appendFile(this.file,`${JSON.stringify(row)}\n`,{mode:0o600});
  return row;
 }
 async readRecent({limit=100,event=null}={}){
  let text='';try{text=await fs.readFile(this.file,'utf8')}catch(error){if(error?.code!=='ENOENT')throw error}
  return text.trim().split('\n').filter(Boolean).slice(-Math.min(1000,Number(limit)||100)).map(line=>JSON.parse(line)).filter(row=>!event||row.event===event).reverse();
 }
 async prune(){
  let text='';try{text=await fs.readFile(this.file,'utf8')}catch(error){if(error?.code==='ENOENT')return 0;throw error}
  const cutoff=Date.now()-this.retentionDays*86400000;
  const rows=text.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  const kept=rows.filter(row=>Date.parse(row.at)>=cutoff);
  await fs.writeFile(this.file,kept.length?`${kept.map(row=>JSON.stringify(row)).join('\n')}\n`:'',{mode:0o600});
  return rows.length-kept.length;
 }
}

export {redact as redactAuditValue};
