import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia} from '@remotion/renderer';
import ffmpegPath from 'ffmpeg-static';
import {validateVideoPlan} from './video-qa.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
let cachedBundle=null;
export async function renderVideo({format='reels',seconds=10,headline='14の美学を、一つのエンジンへ。',subtitle='SNS専用デザインシステム',dna='digital_nature',accent='#b8ff2c',background='#07090d',fontFamily='Noto Sans JP',fontDataUri='',output}){
  const qa=validateVideoPlan({format,seconds,headline,subtitle});
  if(!qa.ok) throw new Error(`VIDEO_QA_FAILED:${qa.errors.join(',')}`);
  cachedBundle ||= await bundle({entryPoint:path.join(here,'index.jsx'),webpackOverride:config=>config});
  const inputProps={format,seconds,headline,subtitle,dna,accent,background,fontFamily,fontDataUri};
  const composition=await selectComposition({serveUrl:cachedBundle,id:`14DNA-${format}`,inputProps});
  const durationInFrames=Math.max(90,Math.round(seconds*composition.fps));
  const out=output||path.resolve(here,'../runtime/outputs',`14dna-${format}-${Date.now()}.mp4`);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await renderMedia({composition:{...composition,durationInFrames},serveUrl:cachedBundle,codec:'h264',outputLocation:out,inputProps,chromiumOptions:{disableWebSecurity:true},ffmpegOverride:({args})=>({executable:ffmpegPath,args:[...args,'-movflags','+faststart']})});
  return{file:out,qa,durationInFrames,fps:composition.fps,width:composition.width,height:composition.height};
}

if(process.argv.includes('--test'))console.log(JSON.stringify(validateVideoPlan({format:'reels',seconds:10,headline:'スマホで完結',subtitle:'14DNA-ENGINE'}),null,2));
