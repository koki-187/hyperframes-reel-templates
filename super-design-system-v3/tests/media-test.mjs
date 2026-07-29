import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import {bundle} from '@remotion/bundler';
import {validateMp4} from '../video/ffmpeg.mjs';
import {renderSocialPng} from '../renderers/social-png.mjs';
import {createRecipe} from '../engine.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),repo=path.resolve(root,'..');
await import('../scripts/generate-pwa-icons.mjs');
for(const name of ['icon-192.png','icon-512.png','maskable-512.png']){const stat=await fs.stat(path.join(repo,'apps/mobile-pwa/icons',name));assert.ok(stat.size>1000,`${name} is too small`)}
const systemFont='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';await fs.access(systemFont);const png=path.join(root,'runtime','outputs','ci-sharp-font-test.png');
const recipe=createRecipe({format:'square',headline:'14DNA ENGINE',seed:'CI-FONT'});await renderSocialPng({recipe,input:{format:'square',headline:'14DNA ENGINE',subtitle:'Sharp fontfile test'},font:{file:systemFont,name:'DejaVu Sans',sha256:'ci'},output:png});assert.ok((await fs.stat(png)).size>1000);await fs.rm(png,{force:true});
const serveUrl=await bundle({entryPoint:path.join(root,'video/index.jsx'),webpackOverride:config=>config});assert.ok(serveUrl);
const mp4=path.join(root,'runtime','outputs','ci-ffmpeg-test.mp4');await fs.mkdir(path.dirname(mp4),{recursive:true});
await new Promise((resolve,reject)=>{const p=spawn(ffmpegPath,['-y','-f','lavfi','-i','color=c=black:s=320x320:d=1:r=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(err)))});
const check=await validateMp4(mp4);assert.equal(check.ok,true);assert.ok((await fs.stat(mp4)).size>1000);await fs.rm(mp4,{force:true});
console.log('14DNA media execution tests passed.');
