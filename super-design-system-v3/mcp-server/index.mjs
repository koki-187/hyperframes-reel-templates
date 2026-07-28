import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {createRecipe,MOTION,FORMATS} from '../engine.mjs';
const server=new McpServer({name:'maw-hyperframe',version:'3.0.0'});
server.tool('create_design_recipe','Create a seeded image or video design recipe using MAW Hyperframe',{theme:z.string(),headline:z.string().optional(),format:z.enum(['reels','story','x_vertical','x_landscape','square']).default('reels'),seconds:z.number().min(3).max(60).default(10),outputs:z.number().min(1).max(4).default(1),seed:z.string().optional(),motionId:z.string().optional()},async args=>({content:[{type:'text',text:JSON.stringify(createRecipe(args),null,2)}]}));
server.tool('list_motion_dna','List the 14 abstract motion systems',{},async()=>({content:[{type:'text',text:JSON.stringify(MOTION,null,2)}]}));
server.tool('list_social_formats','List Reels, Story, X and square video presets',{},async()=>({content:[{type:'text',text:JSON.stringify(FORMATS,null,2)}]}));
await server.connect(new StdioServerTransport());
