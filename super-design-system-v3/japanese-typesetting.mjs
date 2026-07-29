const PROHIBITED_LINE_START = new Set([...`、。，．・：；？！ー〜～）］｝〕〉》」』】〙〗〟’”ゝゞ々ぁぃぅぇぉっゃゅょァィゥェォッャュョヵヶ`]);
const PROHIBITED_LINE_END = new Set([...`（［｛〔〈《「『【〘〖〝‘“`]);

export function normalizeJapaneseText(value){
  return String(value??'')
    .replace(/\r\n?/g,'\n')
    .replace(/[ \t]+/g,' ')
    .replace(/ *\n */g,'\n')
    .trim();
}

export function wrapJapaneseText(value,{maxChars=16,maxLines=4}={}){
  const text=normalizeJapaneseText(value);
  if(!text) return [];
  const paragraphs=text.split('\n');
  const lines=[];

  for(const paragraph of paragraphs){
    const chars=[...paragraph];
    while(chars.length&&lines.length<maxLines){
      let take=Math.min(maxChars,chars.length);
      while(take>1&&PROHIBITED_LINE_START.has(chars[take])) take--;
      while(take<chars.length&&PROHIBITED_LINE_END.has(chars[take-1])) take++;
      const line=chars.splice(0,take).join('');
      if(line) lines.push(line);
    }
    if(lines.length>=maxLines) break;
  }

  const consumed=lines.join('').length;
  const original=[...text.replace(/\n/g,'')].length;
  if(original>consumed&&lines.length){
    const last=[...lines.at(-1)];
    while(last.length&&PROHIBITED_LINE_END.has(last.at(-1))) last.pop();
    if(last.length>=2){last.splice(Math.max(1,last.length-1),1,'…');lines[lines.length-1]=last.join('')}
  }
  return lines;
}

export function inspectJapaneseLayout(value,{maxChars=16,maxLines=4}={}){
  const normalized=normalizeJapaneseText(value);
  const lines=wrapJapaneseText(normalized,{maxChars,maxLines});
  const warnings=[];
  const total=[...normalized.replace(/\n/g,'')].length;
  if(total>maxChars*maxLines) warnings.push('TEXT_TRUNCATED');
  if(lines.some(line=>PROHIBITED_LINE_START.has([...line][0]))) warnings.push('KINSOKU_LINE_START');
  if(lines.some(line=>PROHIBITED_LINE_END.has([...line].at(-1)))) warnings.push('KINSOKU_LINE_END');
  return {normalized,lines,total,warnings,ok:warnings.length===0};
}
