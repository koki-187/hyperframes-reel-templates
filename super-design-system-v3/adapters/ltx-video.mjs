import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {queueComfyWorkflow,waitForComfyResult} from './comfyui.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function generateLtxVideo({prompt,imagePath='',width=768,height=1280,frames=121,fps=24,seed=1,baseUrl,workflowPath=path.resolve(here,'../workflows/comfyui/ltx-image-to-video.json'),models={}}){
 const queued=await queueComfyWorkflow({baseUrl,workflowPath,variables:{prompt,image_path:imagePath,width,height,frames,fps,seed,...models}});
 const promptId=queued.prompt_id||queued.promptId;
 if(!promptId)throw new Error('LTX_PROMPT_ID_MISSING');
 const result=await waitForComfyResult({baseUrl,promptId});
 return{provider:'ltx-video-local',promptId,result,limits:{cost:'local_free',resolution:`${width}x${height}`,frames,fps,seconds:+(frames/fps).toFixed(2),note:'Actual speed and maximum resolution depend on local GPU/VRAM.'}};
}
