import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {createRecipe,MOTION,FORMATS} from '../engine.mjs';

const server=new McpServer({name:'14dna-engine',version:'4.1.0'});
const baseUrl=process.env.DNA_RENDER_URL||'http://127.0.0.1:4314';
const token=process.env.DNA_RENDER_TOKEN||'';

async function api(path,options={}){
  const response=await fetch(`${baseUrl}${path}`,{
    ...options,
    headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{single:'local'}),...(options.headers||{})}
  });
  const text=await response.text();
  let body;try{body=JSON.parse(text)}catch{body=text}
  if(!response.ok) throw new Error(`${response.status}:${typeof body==='string'?body:JSON.stringify(body)}`);
  return body;
}
const result=value=>({content:[{type:'text',text:JSON.stringify(value,null,2)}]});

server.tool('create_design_recipe','Create a seeded image or video design recipe using 14DNA-ENGINE',{theme:z.string(),headline:z.string().optional(),format:z.enum(['reels','story','x_vertical','x_landscape','square']).default('reels'),seconds:z.number().min(3).max(60).default(10),outputs:z.number().min(1).max(4).default(1),seed:z.string().optional(),motionId:z.string().optional()},async args=>result(createRecipe(args)));
server.tool('list_motion_dna','List the 14 abstract motion systems',{},async()=>result(MOTION));
server.tool('list_social_formats','List Reels, Story, X and square presets',{},async()=>result(FORMATS));
server.tool('create_render_job','Create a free local prompt-only or SVG render job',{theme:z.string(),headline:z.string().optional(),subheadline:z.string().optional(),format:z.enum(['reels','story','x_vertical','x_landscape','square']).default('square'),mode:z.enum(['prompt_only','template_svg']).default('template_svg'),seconds:z.number().min(3).max(60).default(10),seed:z.string().optional(),motionId:z.string().optional(),deviceId:z.string().optional()},async args=>result(await api('/api/jobs',{method:'POST',headers:args.deviceId?{'x-device-id':args.deviceId}:{},body:JSON.stringify(args)})));
server.tool('get_render_job','Get render job status and output metadata',{jobId:z.string().uuid()},async({jobId})=>result(await api(`/api/jobs/${jobId}`)));
server.tool('cancel_render_job','Cancel a queued render job',{jobId:z.string().uuid()},async({jobId})=>result(await api(`/api/jobs/${jobId}`,{method:'DELETE'})));
server.tool('prepare_font_manifest','Inspect locally installed font binaries, licenses and checksums',{},async()=>result(await api('/api/fonts')));
server.tool('validate_social_asset','Validate a design recipe against basic mobile/SNS rules',{headline:z.string(),format:z.enum(['reels','story','x_vertical','x_landscape','square']),seconds:z.number().min(3).max(60).optional()},async args=>{
  const warnings=[];
  if([...args.headline].length>34) warnings.push('HEADLINE_TOO_LONG');
  if(['reels','story','x_vertical'].includes(args.format)&&[...args.headline].length>28) warnings.push('VERTICAL_HEADLINE_DENSE');
  if(args.seconds&&args.seconds<5) warnings.push('CTA_TIME_LIMITED');
  return result({ok:warnings.length===0,score:Math.max(0,100-warnings.length*12),warnings,args});
});

await server.connect(new StdioServerTransport());
