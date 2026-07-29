import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

function run(args){return new Promise((resolve,reject)=>{const child=spawn(ffmpegPath,args,{stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>code===0?resolve({code,stderr}):reject(new Error(`FFMPEG_${code}:${stderr.slice(-2000)}`)));});}
export async function muxAudio({video,audio,output,duration}){
 const args=['-y','-i',video,'-stream_loop','-1','-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart'];
 if(duration)args.splice(1,0,'-t',String(duration));args.push(output);return run(args);
}
export async function validateMp4(file){
 const result=await run(['-v','error','-i',file,'-f','null','-']);return{ok:true,file,diagnostics:result.stderr||''};
}
