import {wrapJapanese} from '../japanese-typesetting.mjs';

const ESCAPE={"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>ESCAPE[char]);

function resolveFormat(recipe,input){
  const id=input.format||input.preset||recipe.formatId||recipe.format?.id||'reels';
  const width=Number(recipe.format?.width||input.width||(['x_landscape'].includes(id)?1920:1080));
  const height=Number(recipe.format?.height||input.height||(['reels','story','x_vertical'].includes(id)?1920:1080));
  return{id,width,height};
}

export function renderSocialSvg(recipe,input={},font={}){
  const format=resolveFormat(recipe,input);
  const {width,height}=format;
  const vertical=height>width;
  const margin=Math.round(width*.075);
  const wrapped=wrapJapanese(input.headline||recipe.headline||input.theme||'14DNA-ENGINE',{maxUnits:vertical?14:22,maxLines:4});
  const sub=esc(input.subheadline||input.subtitle||input.theme||'14の美学を、一つのエンジンへ。');
  const accent=recipe.palette?.accent?.[0]||'#b8ff2c';
  const bg=recipe.palette?.background?.[0]||'#07090d';
  const text=recipe.palette?.text?.[0]||'#f2f4f6';
  const lineHeight=Math.round(width*(vertical?.105:.064));
  const titleSize=Math.round(width*(vertical?.092:.064));
  const startY=Math.round(height*.27);
  const title=wrapped.lines.map((line,index)=>`<text x="${margin}" y="${startY+index*lineHeight}" class="headline">${esc(line)}</text>`).join('');
  const fontFace=font.dataUri?`@font-face{font-family:'14DNA Japanese';src:url('${font.dataUri}') format('${font.format||'truetype'}');font-weight:${font.weight||700};font-style:normal}`:'';
  const fontFamily=font.dataUri?"'14DNA Japanese'":"'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif";
  const meta=esc(JSON.stringify({format:format.id,units:wrapped.units,truncated:wrapped.truncated,warnings:wrapped.warnings,font:font.name||'fallback'}));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(input.headline||input.theme||'14DNA-ENGINE')}</title><desc id="desc">${meta}</desc>
<rect width="100%" height="100%" fill="${esc(bg)}"/>
<path d="M${margin} ${Math.round(height*.13)} H${Math.round(width*.78)}" stroke="${esc(accent)}" stroke-width="${Math.max(4,Math.round(width*.006))}"/>
<circle cx="${Math.round(width*.83)}" cy="${Math.round(height*.15)}" r="${Math.round(width*.055)}" fill="none" stroke="${esc(accent)}" stroke-width="${Math.max(3,Math.round(width*.004))}"/>
<style>${fontFace}.headline{font-family:${fontFamily};font-size:${titleSize}px;font-weight:900;letter-spacing:-0.05em;fill:${esc(text)}}.sub{font-family:${fontFamily};font-size:${Math.round(width*.029)}px;font-weight:500;fill:${esc(text)};opacity:.72}.meta{font-family:ui-monospace,monospace;font-size:${Math.round(width*.018)}px;fill:${esc(accent)};letter-spacing:.12em}</style>
${title}
<text x="${margin}" y="${Math.round(height*.76)}" class="sub">${sub}</text>
<text x="${margin}" y="${Math.round(height*.9)}" class="meta">14DNA / ${esc(recipe.motion?.id||recipe.motionId||'AUTO')} / ${esc(recipe.seed||'AUTO')}</text>
</svg>`;
}
