import assert from 'node:assert/strict';
import {createRecipe} from '../engine.mjs';
import {renderSocialSvg} from '../renderers/social-svg.mjs';

const recipe=createRecipe({theme:'不動産AIの新機能',headline:'調査時間を短縮',format:'square',seed:'V4-TEST'});
const svg=renderSocialSvg(recipe,{headline:'調査時間を短縮',theme:'不動産AIの新機能'});
assert.match(svg,/^<\?xml/);
assert.match(svg,/1080/);
assert.match(svg,/調査時間を短縮/);
assert.doesNotMatch(svg,/<script/i);

const vertical=createRecipe({theme:'Reelsテスト',format:'reels',seed:'V4-VERTICAL'});
const verticalSvg=renderSocialSvg(vertical,{headline:'スマホで完結'});
assert.match(verticalSvg,/height="1920"/);
assert.match(verticalSvg,/width="1080"/);

console.log('14DNA-ENGINE v4 tests passed.');
