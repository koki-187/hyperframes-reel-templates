import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DEVICE_ID=/^[A-Za-z0-9._:-]{8,128}$/;
const CODE=/^[A-Z0-9]{8,32}$/;

async function readJson(file,fallback){
 try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(error){if(error?.code==='ENOENT')return fallback;throw error}
}
async function writeJson(file,value){
 await fs.mkdir(path.dirname(file),{recursive:true});
 const temporary=`${file}.${crypto.randomUUID()}.tmp`;
 await fs.writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});
 await fs.rename(temporary,file);
}
function nowIso(){return new Date().toISOString()}
function hashCode(code,pepper=''){return crypto.createHash('sha256').update(`${pepper}:${code}`).digest('hex')}
function publicDevice(device){
 if(!device)return null;
 const {tokenHash,...safe}=device;
 return safe;
}

export class DeviceRegistry{
 constructor({directory,pepper='',codeTtlMinutes=15}={}){
  if(!directory)throw new Error('DEVICE_REGISTRY_DIRECTORY_REQUIRED');
  this.directory=directory;
  this.pepper=pepper;
  this.codeTtlMinutes=Number(codeTtlMinutes)||15;
  this.devicesFile=path.join(directory,'devices.json');
  this.codesFile=path.join(directory,'enrollment-codes.json');
 }
 async initialize(){
  await fs.mkdir(this.directory,{recursive:true});
  if(!(await readJson(this.devicesFile,null)))await writeJson(this.devicesFile,{version:1,devices:{}});
  if(!(await readJson(this.codesFile,null)))await writeJson(this.codesFile,{version:1,codes:{}});
 }
 async createEnrollmentCode({label='New device',createdBy='admin',ttlMinutes=this.codeTtlMinutes}={}){
  const raw=crypto.randomBytes(8).toString('hex').toUpperCase();
  const code=raw.slice(0,16);
  const store=await readJson(this.codesFile,{version:1,codes:{}});
  const id=crypto.randomUUID();
  store.codes[id]={id,codeHash:hashCode(code,this.pepper),label:String(label).slice(0,120),createdBy:String(createdBy).slice(0,120),createdAt:nowIso(),expiresAt:new Date(Date.now()+Number(ttlMinutes)*60000).toISOString(),usedAt:null,usedBy:null,revokedAt:null};
  await writeJson(this.codesFile,store);
  return {id,code,label:store.codes[id].label,expiresAt:store.codes[id].expiresAt};
 }
 async registerDevice({deviceId,code,label='Registered device',userAgent=''}={}){
  if(!DEVICE_ID.test(String(deviceId||'')))throw new Error('DEVICE_ID_INVALID');
  if(!CODE.test(String(code||'')))throw new Error('ENROLLMENT_CODE_INVALID');
  const codes=await readJson(this.codesFile,{version:1,codes:{}});
  const match=Object.values(codes.codes).find(item=>item.codeHash===hashCode(code,this.pepper));
  if(!match)throw new Error('ENROLLMENT_CODE_INVALID');
  if(match.revokedAt)throw new Error('ENROLLMENT_CODE_REVOKED');
  if(match.usedAt)throw new Error('ENROLLMENT_CODE_USED');
  if(Date.parse(match.expiresAt)<=Date.now())throw new Error('ENROLLMENT_CODE_EXPIRED');
  const devices=await readJson(this.devicesFile,{version:1,devices:{}});
  const existing=devices.devices[deviceId];
  if(existing&&!existing.revokedAt)throw new Error('DEVICE_ALREADY_REGISTERED');
  const device={id:deviceId,label:String(label||match.label).slice(0,120),registeredAt:nowIso(),lastSeenAt:null,revokedAt:null,revokedReason:null,userAgent:String(userAgent).slice(0,240),enrollmentId:match.id};
  devices.devices[deviceId]=device;
  match.usedAt=nowIso();match.usedBy=deviceId;
  await writeJson(this.devicesFile,devices);
  await writeJson(this.codesFile,codes);
  return publicDevice(device);
 }
 async authorize(deviceId,{touch=true}={}){
  if(!DEVICE_ID.test(String(deviceId||'')))return {ok:false,reason:'DEVICE_ID_INVALID'};
  const devices=await readJson(this.devicesFile,{version:1,devices:{}});
  const device=devices.devices[deviceId];
  if(!device)return {ok:false,reason:'DEVICE_NOT_REGISTERED'};
  if(device.revokedAt)return {ok:false,reason:'DEVICE_REVOKED'};
  if(touch){device.lastSeenAt=nowIso();await writeJson(this.devicesFile,devices)}
  return {ok:true,device:publicDevice(device)};
 }
 async revokeDevice(deviceId,{reason='revoked',revokedBy='admin'}={}){
  const devices=await readJson(this.devicesFile,{version:1,devices:{}});
  const device=devices.devices[deviceId];
  if(!device)throw new Error('DEVICE_NOT_FOUND');
  if(!device.revokedAt){device.revokedAt=nowIso();device.revokedReason=String(reason).slice(0,240);device.revokedBy=String(revokedBy).slice(0,120);await writeJson(this.devicesFile,devices)}
  return publicDevice(device);
 }
 async listDevices(){
  const devices=await readJson(this.devicesFile,{version:1,devices:{}});
  return Object.values(devices.devices).map(publicDevice).sort((a,b)=>String(b.registeredAt).localeCompare(String(a.registeredAt)));
 }
}
