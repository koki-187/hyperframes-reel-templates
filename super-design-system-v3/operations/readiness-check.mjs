import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);

function result(id,label,required,ok,detail,remediation=null){return{id,label,required,ok,detail,remediation}}
function strongSecret(value){return typeof value==='string'&&value.length>=32&&!/^(changeme|password|test|example|ci-)/i.test(value)}
async function commandExists(command){try{await execFileAsync(command,['--version'],{timeout:4000});return true}catch{return false}}
async function readableFiles(directory,extensions){try{return (await fs.readdir(directory,{withFileTypes:true})).filter(e=>e.isFile()&&extensions.some(ext=>e.name.toLowerCase().endsWith(ext))).map(e=>e.name)}catch{return[]}}
async function probe(url,timeoutMs=3500){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});return{ok:response.ok,status:response.status}}catch(error){return{ok:false,error:error?.name==='AbortError'?'timeout':String(error?.message||error)}}finally{clearTimeout(timer)}}

export async function assessReadiness({root=process.cwd(),env=process.env,includeExternal=true}={}){
 const fontDir=path.join(root,'private-fonts');
 const fonts=await readableFiles(fontDir,['.ttf','.otf','.woff','.woff2']);
 const checks=[];
 checks.push(result('render-token','Render token',true,strongSecret(env.DNA_RENDER_TOKEN),strongSecret(env.DNA_RENDER_TOKEN)?'configured':'missing or weak','Set DNA_RENDER_TOKEN to a random value of at least 32 characters.'));
 checks.push(result('admin-token','Admin token',true,strongSecret(env.DNA_ADMIN_TOKEN),strongSecret(env.DNA_ADMIN_TOKEN)?'configured':'missing or weak','Set DNA_ADMIN_TOKEN to a separate random value of at least 32 characters.'));
 checks.push(result('quality-gate','Premium Quality Gate',true,env.DNA_REQUIRE_PREMIUM_GATE!=='false',env.DNA_REQUIRE_PREMIUM_GATE!=='false'?'enabled':'disabled','Set DNA_REQUIRE_PREMIUM_GATE=true.'));
 checks.push(result('device-security','Device registration',true,env.DNA_DYNAMIC_DEVICE_REGISTRY==='true'||Boolean(env.DNA_ALLOWED_DEVICE_IDS),env.DNA_DYNAMIC_DEVICE_REGISTRY==='true'?'dynamic registry enabled':env.DNA_ALLOWED_DEVICE_IDS?'static allowlist configured':'not configured','Enable DNA_DYNAMIC_DEVICE_REGISTRY=true or configure DNA_ALLOWED_DEVICE_IDS.'));
 checks.push(result('allowed-origins','Allowed origins',true,Boolean(env.DNA_ALLOWED_ORIGINS),env.DNA_ALLOWED_ORIGINS||'not configured','Set DNA_ALLOWED_ORIGINS to the exact private PWA origin.'));
 checks.push(result('font','Verified Japanese font',true,fonts.length>0,fonts.length?fonts.join(', '):'no font binaries found','Place a licensed Japanese font in private-fonts/. Font binaries must remain outside Git.'));
 checks.push(result('paid-fallback','Paid fallback disabled',true,env.PAID_API_AUTO_FALLBACK!=='true',env.PAID_API_AUTO_FALLBACK!=='true'?'disabled':'enabled','Set PAID_API_AUTO_FALLBACK=false.'));
 checks.push(result('flux-models','FLUX model configuration',false,Boolean(env.FLUX_UNET&&env.FLUX_CLIP_L&&env.FLUX_T5&&env.FLUX_VAE),env.FLUX_UNET||'not configured','Configure FLUX_UNET, FLUX_CLIP_L, FLUX_T5 and FLUX_VAE when local FLUX is required.'));
 checks.push(result('ltx-model','LTX model configuration',false,Boolean(env.LTX_MODEL),env.LTX_MODEL||'not configured','Configure LTX_MODEL when local video generation is required.'));
 if(includeExternal){
  const tailscale=await commandExists(process.platform==='win32'?'tailscale.exe':'tailscale');
  checks.push(result('tailscale','Tailscale CLI',true,tailscale,tailscale?'available':'not found','Install Tailscale, sign in, and make the tailscale command available.'));
  const comfyUrl=(env.COMFYUI_URL||'http://127.0.0.1:8188').replace(/\/$/,'');
  const comfy=await probe(`${comfyUrl}/system_stats`);
  checks.push(result('comfyui','ComfyUI connectivity',false,comfy.ok,comfy.ok?`reachable (${comfy.status})`:`unreachable (${comfy.error||comfy.status||'unknown'})`,'Start ComfyUI on localhost and install the required FLUX/LTX nodes and models.'));
 }
 const required=checks.filter(c=>c.required);
 const passedRequired=required.filter(c=>c.ok).length;
 const optional=checks.filter(c=>!c.required);
 const passedOptional=optional.filter(c=>c.ok).length;
 const requiredPercent=Math.round((passedRequired/Math.max(1,required.length))*100);
 const overallPercent=Math.round(((passedRequired+passedOptional)/Math.max(1,checks.length))*100);
 const status=requiredPercent===100?'READY':requiredPercent>=70?'PARTIAL':'BLOCKED';
 return{status,requiredPercent,overallPercent,summary:{passedRequired,totalRequired:required.length,passedOptional,totalOptional:optional.length},checks,generatedAt:new Date().toISOString()};
}

export function formatReadiness(report){
 const lines=[`14DNA-ENGINE readiness: ${report.status}`,`Required: ${report.requiredPercent}%  Overall: ${report.overallPercent}%`];
 for(const check of report.checks)lines.push(`${check.ok?'[OK]':'[NG]'} ${check.label}: ${check.detail}${check.required?' (required)':''}`);
 const actions=report.checks.filter(c=>!c.ok&&c.remediation).map(c=>`- ${c.remediation}`);
 if(actions.length)lines.push('', 'Required actions:',...actions);
 return lines.join('\n');
}
