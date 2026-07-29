import crypto from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {createRecipe,MOTION,FORMATS} from '../engine.mjs';
import {validateAsset,buildDesignProvenance} from '../quality/asset-qa.mjs';

const server=new McpServer({name:'14dna-engine',version:'4.4.0'});
const baseUrl=process.env.DNA_RENDER_URL||'http://127.0.0.1:4314';
const token=process.env.DNA_RENDER_TOKEN||'';
const deviceId=process.env.DNA_DEVICE_ID||'mcp-local';

async function api(path,options={}){
  const method=(options.method||'GET').toUpperCase();
  const mutation=['POST','PUT','PATCH','DELETE'].includes(method);
  const response=await fetch(`${baseUrl}${path}`,{
    ...options,
    headers:{
      'content-type':'application/json',
      ...(token?{authorization:`Bearer ${token}`}:{single:'local'}),
      'x-device-id':deviceId,
      ...(mutation?{
        'x-request-timestamp':String(Date.now()),
        'x-request-nonce':crypto.randomUUID()
      }:{}),
      ...(options.headers||{})
    }
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
server.tool('create_render_job','Create a free local render job',{theme:z.string(),headline:z.string().optional(),subheadline:z.string().optional(),format:z.enum(['reels','story','x_vertical','x_landscape','square']).default('square'),mode:z.enum(['prompt_only','template_svg','template_png','template_video','flux_local','ltx_video_local']).default('template_png'),seconds:z.number().min(3).max(60).default(10),seed:z.string().optional(),motionId:z.string().optional()},async args=>result(await api('/api/jobs',{method:'POST',body:JSON.stringify(args)})));
server.tool('get_render_job','Get render job status and output metadata',{jobId:z.string().uuid()},async({jobId})=>result(await api(`/api/jobs/${jobId}`)));
server.tool('cancel_render_job','Cancel a queued render job',{jobId:z.string().uuid()},async({jobId})=>result(await api(`/api/jobs/${jobId}`,{method:'DELETE'})));
server.tool('prepare_font_manifest','Inspect locally installed font binaries, licenses and checksums',{},async()=>result(await api('/api/fonts')));
server.tool('validate_social_asset','Validate a rendered image, QR destination, text manifest and safe area',{file:z.string(),expectedQrUrl:z.string().url().optional(),expectedWidth:z.number().int().positive().optional(),expectedHeight:z.number().int().positive().optional(),threshold:z.number().min(0).max(100).default(82),texts:z.array(z.object({id:z.string(),value:z.string(),required:z.boolean().optional(),maxChars:z.number().int().positive().optional()})).default([]),boxes:z.array(z.object({id:z.string(),x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),width:z.number().int().positive(),height:z.number().int().positive(),critical:z.boolean().optional(),allowOverlap:z.boolean().optional()})).default([])},async args=>result(await validateAsset({file:args.file,expectedQrUrl:args.expectedQrUrl,threshold:args.threshold,manifest:{expectedWidth:args.expectedWidth,expectedHeight:args.expectedHeight,texts:args.texts,boxes:args.boxes}})));
server.tool('build_design_provenance','Record the design DNA, compositional principles and abstract inspirations used by an output',{dna:z.array(z.string()).default([]),principles:z.array(z.string()).default([]),inspiration:z.array(z.object({source:z.string(),abstraction:z.string()})).default([]),forbidden:z.array(z.string()).default([])},async args=>result(buildDesignProvenance(args)));

await server.connect(new StdioServerTransport());
