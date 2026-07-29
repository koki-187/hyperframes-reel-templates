import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createRecipe} from '../engine.mjs';
import {renderSocialSvg} from '../renderers/social-svg.mjs';
import {wrapJapaneseText,inspectJapaneseLayout} from '../japanese-typesetting.mjs';

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

const lines=wrapJapaneseText('不動産AIで、調査時間を大幅に短縮する。',{maxChars:8,maxLines:4});
assert.ok(lines.length>=2);
assert.ok(lines.every(line=>!/^、/.test(line)));
const layout=inspectJapaneseLayout('これは非常に長いSNS投稿用見出しであり表示可能な文字数を超えるため省略されます',{maxChars:8,maxLines:2});
assert.ok(layout.warnings.includes('TEXT_TRUNCATED'));

const png=await sharp(Buffer.from(svg)).png().toBuffer();
assert.ok(png.length>1000);
assert.equal(png[0],0x89);
assert.equal(png[1],0x50);

console.log('14DNA-ENGINE v4.2 tests passed.');
