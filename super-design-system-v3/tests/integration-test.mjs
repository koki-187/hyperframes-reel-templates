import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRecipe} from '../engine.mjs';
import {renderSocialSvg} from '../renderers/social-svg.mjs';
import {validateVideoPlan} from '../video/video-qa.mjs';
import {inspectFonts,loadJapaneseFont} from '../font-manager.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
for(const format of ['reels','story','x_vertical','x_landscape','square']){
 const recipe=createRecipe({theme:'統合テスト',headline:'14の美学を、一つのエンジンへ。',format,seed:`TEST-${format}`});
 const svg=renderSocialSvg(recipe,{format,headline:'14の美学を、一つのエンジンへ。'});
 assert.match(svg,new RegExp(`width="${recipe.format.width}"`));assert.match(svg,new RegExp(`height="${recipe.format.height}"`));
 const qa=validateVideoPlan({format,seconds:10,headline:'スマホで完結',subtitle:'SNS専用画像・動画'});assert.equal(qa.ok,true);assert.ok(qa.score>=70);
}
const fontReport=await inspectFonts(path.join(root,'private-fonts'));assert.ok(['ready','setup_required'].includes(fontReport.status));assert.equal(await loadJapaneseFont(path.join(root,'private-fonts'),{required:false}),null);
for(const file of ['workflows/comfyui/flux1-schnell.json','workflows/comfyui/ltx-image-to-video.json'])JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
for(const file of ['video/Root.jsx','video/SocialMotion.jsx','video/render-video.mjs','video/ffmpeg.mjs','adapters/comfyui.mjs','adapters/ltx-video.mjs'])await fs.access(path.join(root,file));
console.log('14DNA-ENGINE integration tests passed.');
