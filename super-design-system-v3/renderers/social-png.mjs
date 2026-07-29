import sharp from 'sharp';
import {inspectJapaneseLayout} from '../japanese-typesetting.mjs';

const FORMAT={reels:[1080,1920],story:[1080,1920],x_vertical:[1080,1920],x_landscape:[1920,1080],square:[1080,1080]};
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export async function renderSocialPng({recipe,input={},font,output}){
 if(!font?.file)throw new Error('FONT_SETUP_REQUIRED');
 const id=input.format||recipe.formatId||'reels',[width,height]=FORMAT[id]||FORMAT.reels,vertical=height>width,margin=Math.round(width*.075);
 const layout=inspectJapaneseLayout(input.headline||input.theme||'14DNA-ENGINE',{maxChars:vertical?14:22,maxLines:4});
 const accent=recipe.palette?.accent?.[0]||'#b8ff2c',bg=recipe.palette?.background?.[0]||'#07090d',text=recipe.palette?.text?.[0]||'#f2f4f6';
 const base=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${xml(bg)}"/><path d="M${margin} ${Math.round(height*.13)} H${Math.round(width*.78)}" stroke="${xml(accent)}" stroke-width="${Math.max(4,Math.round(width*.006))}"/><circle cx="${Math.round(width*.83)}" cy="${Math.round(height*.15)}" r="${Math.round(width*.055)}" fill="none" stroke="${xml(accent)}" stroke-width="${Math.max(3,Math.round(width*.004))}"/></svg>`;
 const titleSize=Math.round(width*(vertical?.092:.064)),titleWidth=Math.round(width*(vertical?.84:.68));
 const titleMarkup=`<span foreground="${xml(text)}" weight="900" letter_spacing="-1200">${layout.lines.map(xml).join('\n')}</span>`;
 const subtitleMarkup=`<span foreground="${xml(text)}" alpha="72%" weight="500">${xml(input.subtitle||input.theme||'14の美学を、一つのエンジンへ。')}</span>`;
 const metaMarkup=`<span foreground="${xml(accent)}" letter_spacing="1600">14DNA / ${xml(recipe.motion?.id||'AUTO')} / ${xml(recipe.seed||'AUTO')}</span>`;
 const composites=[
  {input:{text:{text:titleMarkup,fontfile:font.file,width:titleWidth,align:'left',rgba:true,dpi:Math.max(72,titleSize*.72)}},left:margin,top:Math.round(height*.26)},
  {input:{text:{text:subtitleMarkup,fontfile:font.file,width:Math.round(width*.78),align:'left',rgba:true,dpi:Math.max(48,width*.022)}},left:margin,top:Math.round(height*.74)},
  {input:{text:{text:metaMarkup,fontfile:font.file,width:Math.round(width*.8),align:'left',rgba:true,dpi:Math.max(36,width*.014)}},left:margin,top:Math.round(height*.88)}
 ];
 await sharp(Buffer.from(base)).composite(composites).png({compressionLevel:9,adaptiveFiltering:true}).toFile(output);
 return{output,width,height,font:{name:font.name,sha256:font.sha256},layout};
}
