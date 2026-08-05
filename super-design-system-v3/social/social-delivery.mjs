import crypto from 'node:crypto';

export const SOCIAL_PRESETS={
 instagram_feed_square:{platform:'Instagram',placement:'Feed square',width:1080,height:1080,aspect:'1:1',safe:{top:72,right:72,bottom:96,left:72},kind:'image'},
 instagram_feed_portrait:{platform:'Instagram',placement:'Feed portrait',width:1080,height:1350,aspect:'4:5',safe:{top:90,right:72,bottom:110,left:72},kind:'image'},
 instagram_carousel:{platform:'Instagram',placement:'Carousel',width:1080,height:1350,aspect:'4:5',safe:{top:90,right:72,bottom:110,left:72},kind:'carousel',maxSlides:10},
 instagram_story:{platform:'Instagram',placement:'Story',width:1080,height:1920,aspect:'9:16',safe:{top:250,right:72,bottom:300,left:72},kind:'story'},
 instagram_reel:{platform:'Instagram',placement:'Reel',width:1080,height:1920,aspect:'9:16',safe:{top:250,right:80,bottom:340,left:80},kind:'video'},
 facebook_feed:{platform:'Facebook',placement:'Feed',width:1200,height:1500,aspect:'4:5',safe:{top:96,right:80,bottom:120,left:80},kind:'image'},
 facebook_story:{platform:'Facebook',placement:'Story',width:1080,height:1920,aspect:'9:16',safe:{top:250,right:72,bottom:300,left:72},kind:'story'},
 facebook_reel:{platform:'Facebook',placement:'Reel',width:1080,height:1920,aspect:'9:16',safe:{top:250,right:80,bottom:340,left:80},kind:'video'},
 x_square:{platform:'X',placement:'Post square',width:1200,height:1200,aspect:'1:1',safe:{top:80,right:80,bottom:96,left:80},kind:'image'},
 x_landscape:{platform:'X',placement:'Post landscape',width:1600,height:900,aspect:'16:9',safe:{top:80,right:80,bottom:80,left:80},kind:'image'},
 note_cover:{platform:'note',placement:'Article cover',width:1280,height:670,aspect:'1.91:1',safe:{top:70,right:90,bottom:70,left:90},kind:'image'},
 zenn_ogp:{platform:'Zenn',placement:'Article OGP',width:1200,height:630,aspect:'1.91:1',safe:{top:64,right:80,bottom:64,left:80},kind:'image'},
 qiita_ogp:{platform:'Qiita',placement:'Article OGP',width:1200,height:630,aspect:'1.91:1',safe:{top:64,right:80,bottom:64,left:80},kind:'image'},
 tips_cover:{platform:'Tips',placement:'Article cover',width:1280,height:670,aspect:'1.91:1',safe:{top:70,right:90,bottom:70,left:90},kind:'image'}
};

const DEFAULT_SET=['instagram_feed_portrait','instagram_story','instagram_reel','facebook_feed','x_landscape','note_cover','zenn_ogp','qiita_ogp','tips_cover'];

function normalizeText(value=''){
 return String(value).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
}

export function createSafeSlug(value='asset'){
 const normalized=normalizeText(value).toLowerCase();
 const ascii=normalized
  .replace(/&/g,' and ')
  .replace(/[^\p{Letter}\p{Number}]+/gu,'-')
  .replace(/^-+|-+$/g,'')
  .slice(0,72);
 return ascii||'asset';
}

export function createAltText({brand='',headline='',theme='',platform='',placement=''}={}){
 const subject=normalizeText(headline||theme||brand||'ブランド告知');
 const owner=normalizeText(brand);
 const context=[platform,placement].filter(Boolean).join(' ');
 const parts=[owner?`${owner}の`:'',`「${subject}」を伝える${context?`${context}向けの`:''}ブランドビジュアル。`];
 return parts.join('').slice(0,180);
}

export function createDeliveryItem(input={},presetId,index=0){
 const preset=SOCIAL_PRESETS[presetId];
 if(!preset)throw new Error(`UNKNOWN_SOCIAL_PRESET:${presetId}`);
 const brand=normalizeText(input.brand||'brand');
 const headline=normalizeText(input.headline||input.theme||'message');
 const campaign=normalizeText(input.campaign||headline);
 const date=normalizeText(input.date||new Date().toISOString().slice(0,10));
 const base=[date,brand,campaign,presetId,index?String(index+1):''].filter(Boolean).map(createSafeSlug).join('_');
 const extension=preset.kind==='video'?'mp4':'png';
 return{
  id:crypto.createHash('sha256').update(`${base}:${preset.width}x${preset.height}`).digest('hex').slice(0,16),
  presetId,
  ...preset,
  filename:`${base}.${extension}`,
  altText:createAltText({brand,headline,theme:input.theme,platform:preset.platform,placement:preset.placement}),
  renderInput:{
   mode:preset.kind==='video'?'template_video':'template_png',
   format:presetId,
   width:preset.width,
   height:preset.height,
   aspect:preset.aspect,
   safeArea:preset.safe,
   theme:normalizeText(input.theme||campaign),
   headline,
   subtitle:normalizeText(input.subtitle||''),
   brand,
   outputFilename:`${base}.${extension}`
  }
 };
}

export function createSocialBatch(input={}){
 const requested=Array.isArray(input.presets)&&input.presets.length?input.presets:DEFAULT_SET;
 const unique=[...new Set(requested)];
 const items=unique.map((id,index)=>createDeliveryItem(input,id,index));
 return{
  version:'1.0.0',
  batchId:crypto.randomUUID(),
  createdAt:new Date().toISOString(),
  theme:normalizeText(input.theme||''),
  brand:normalizeText(input.brand||''),
  count:items.length,
  items,
  summary:Object.fromEntries(items.map(item=>[item.presetId,`${item.width}x${item.height} ${item.kind}`]))
 };
}
