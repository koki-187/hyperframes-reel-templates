import crypto from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {createRecipe,MOTION,FORMATS} from '../engine.mjs';
import {validateAsset,buildDesignProvenance} from '../quality/asset-qa.mjs';
import {evaluateQualityGate,createVariationPlan,selectReleaseCandidates} from '../quality/quality-gate.mjs';

const server=new McpServer({name:'14dna-engine',version:'4.5.0'});
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
      ...(mutation?{'x-request-timestamp':String(Date.now()),'x-request-nonce':crypto.randomUUID()}:{}),
      ...(options.headers||{})
    }
  });
  const text=await response.text();
  let body;try{body=JSON.parse(text)}catch{body=text}
  if(!response.ok)throw new Error(`${response.status}:${typeof body==='string'?body:JSON.stringify(body)}`);
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

const scoreSchema=z.object({concept:z.number().min(0).max(100),composition:z.number().min(0).max(100),hierarchy:z.number().min(0).max(100),materiality:z.number().min(0).max(100),typography:z.number().min(0).max(100),brand:z.number().min(0).max(100),technical:z.number().min(0).max(100)});
const signalSchema=z.object({decorativeNoise:z.number().min(0).max(100).default(0),neonDependence:z.number().min(0).max(100).default(0),templateFeeling:z.number().min(0).max(100).default(0),genericIconDensity:z.number().min(0).max(100).default(0),visualFocusCount:z.number().min(0).max(20).default(1),negativeSpace:z.number().min(0).max(100).default(25),controlledAsymmetry:z.number().min(0).max(100).default(80),materialEvidence:z.number().min(0).max(100).default(80)};
server.tool('evaluate_premium_quality','Decide whether a candidate is allowed to carry the 14DNA-ENGINE name. Rejected outputs must not be exported.',{candidateId:z.string(),scores:scoreSchema,failures:z.array(z.string()).default([]),warnings:z.array(z.string()).default([]),minimumLevel:z.enum(['MASTER','RELEASE','REVIEW']).default('RELEASE'),reference:z.object({required:z.boolean().default(false),provided:z.boolean().default(false),compositionSimilarity:z.number().min(0).max(100).default(0),materialSimilarity:z.number().min(0).max(100).default(0),hierarchySimilarity:z.number().min(0).max(100).default(0)}).default({}),premiumSignals:signalSchema.default({}),provenance:z.record(z.any()).default({})},async args=>result(evaluateQualityGate({candidateId:args.candidateId,scores:args.scores,technicalReport:{failures:args.failures,warnings:args.warnings},minimumLevel:args.minimumLevel,reference:args.reference,premiumSignals:args.premiumSignals,provenance:args.provenance})));
server.tool('create_premium_variation_plan','Create compositionally distinct premium directions before image generation',{theme:z.string(),count:z.number().int().min(1).max(3).default(3)},async args=>result(createVariationPlan(args)));
server.tool('select_release_candidates','Rank candidates and return only outputs that meet the premium release gate',{candidates:z.array(z.object({candidateId:z.string(),scores:scoreSchema,minimumLevel:z.enum(['MASTER','RELEASE','REVIEW']).default('RELEASE'),technicalReport:z.object({failures:z.array(z.string()).default([]),warnings:z.array(z.string()).default([])}).default({}),reference:z.record(z.any()).default({}),premiumSignals:signalSchema.default({}),provenance:z.record(z.any()).default({})})),limit:z.number().int().min(1).max(3).default(3)},async args=>result(selectReleaseCandidates(args.candidates,args.limit)));

await server.connect(new StdioServerTransport());
