import assert from 'node:assert/strict';
import {SOCIAL_PRESETS,createSafeSlug,createAltText,createDeliveryItem,createSocialBatch} from '../social/social-delivery.mjs';

assert.ok(Object.keys(SOCIAL_PRESETS).length>=14);
assert.equal(SOCIAL_PRESETS.instagram_feed_portrait.width,1080);
assert.equal(SOCIAL_PRESETS.instagram_feed_portrait.height,1350);
assert.equal(SOCIAL_PRESETS.note_cover.width,1280);
assert.equal(SOCIAL_PRESETS.zenn_ogp.height,630);

assert.equal(createSafeSlug(' AFP・資産形成 2026! '),'afp-資産形成-2026');
const alt=createAltText({brand:'LIFE DESIGN PARTNER',headline:'未来を設計する',platform:'Instagram',placement:'Feed portrait'});
assert.match(alt,/LIFE DESIGN PARTNER/);
assert.match(alt,/未来を設計する/);
assert.ok(alt.length<=180);

const item=createDeliveryItem({brand:'AFP Financial Planning',theme:'人生設計',headline:'今日を整え、未来を描く',date:'2026-08-06'},'instagram_reel');
assert.equal(item.kind,'video');
assert.match(item.filename,/\.mp4$/);
assert.equal(item.renderInput.width,1080);
assert.equal(item.renderInput.height,1920);
assert.equal(item.renderInput.mode,'template_video');
assert.ok(!/[\\/:*?"<>|]/.test(item.filename));

const batch=createSocialBatch({brand:'AFP Financial Planning',theme:'ライフプラン相談',headline:'未来をともにデザインする',date:'2026-08-06'});
assert.ok(batch.batchId);
assert.equal(batch.count,9);
assert.equal(new Set(batch.items.map(x=>x.presetId)).size,batch.count);
assert.ok(batch.items.every(x=>x.altText&&x.filename&&x.renderInput));
assert.ok(batch.items.some(x=>x.presetId==='note_cover'));
assert.ok(batch.items.some(x=>x.presetId==='instagram_reel'));

const custom=createSocialBatch({theme:'test',presets:['x_landscape','x_landscape','qiita_ogp']});
assert.equal(custom.count,2);
assert.deepEqual(custom.items.map(x=>x.presetId),['x_landscape','qiita_ogp']);

assert.throws(()=>createDeliveryItem({},'unknown'),/UNKNOWN_SOCIAL_PRESET/);
console.log('14DNA social delivery tests passed.');
