import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';

const DEFAULT_QA_THRESHOLD = 82;

function normalizeUrl(value=''){
  try{
    const url=new URL(value);
    url.hash='';
    if(url.pathname.endsWith('/')&&url.pathname!=='/')url.pathname=url.pathname.slice(0,-1);
    return url.toString();
  }catch{return value.trim()}
}

function intersects(a,b){
  return !(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
}

function inside(box,width,height){
  return box.x>=0&&box.y>=0&&box.width>0&&box.height>0&&box.x+box.width<=width&&box.y+box.height<=height;
}

export async function decodeQr(imagePath){
  const {data,info}=await sharp(imagePath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const code=jsQR(new Uint8ClampedArray(data.buffer,data.byteOffset,data.byteLength),info.width,info.height,{inversionAttempts:'attemptBoth'});
  return code?.data||null;
}

export async function composeFixedAssets({baseImage,output,assets=[],canvas}){
  if(!baseImage||!output)throw new Error('COMPOSITE_PATH_REQUIRED');
  const metadata=await sharp(baseImage).metadata();
  const width=canvas?.width||metadata.width;
  const height=canvas?.height||metadata.height;
  if(!width||!height)throw new Error('CANVAS_SIZE_REQUIRED');

  const composites=[];
  for(const asset of assets){
    if(!asset.path)throw new Error(`ASSET_PATH_REQUIRED:${asset.id||'unknown'}`);
    const box=asset.box;
    if(!box||!inside(box,width,height))throw new Error(`ASSET_OUT_OF_BOUNDS:${asset.id||'unknown'}`);
    const resized=await sharp(asset.path)
      .resize(box.width,box.height,{fit:asset.fit||'contain',kernel:asset.kind==='qr'?'nearest':'lanczos3',background:asset.background||'#ffffff'})
      .png()
      .toBuffer();
    composites.push({input:resized,left:box.x,top:box.y});
  }

  await fs.mkdir(path.dirname(output),{recursive:true});
  await sharp(baseImage).resize(width,height,{fit:'fill'}).composite(composites).png().toFile(output);
  return {output,width,height,assets:assets.map(({path,...asset})=>asset)};
}

export async function validateAsset({file,expectedQrUrl,manifest={},threshold=DEFAULT_QA_THRESHOLD}){
  const metadata=await sharp(file).metadata();
  const width=metadata.width||0,height=metadata.height||0;
  const warnings=[];
  const failures=[];
  let score=100;

  if(!width||!height){failures.push('IMAGE_DIMENSIONS_MISSING');score-=40}
  if(manifest.expectedWidth&&width!==manifest.expectedWidth){failures.push('WIDTH_MISMATCH');score-=20}
  if(manifest.expectedHeight&&height!==manifest.expectedHeight){failures.push('HEIGHT_MISMATCH');score-=20}

  const boxes=(manifest.boxes||[]).filter(Boolean);
  for(const box of boxes){
    if(!inside(box,width,height)){failures.push(`BOX_OUT_OF_BOUNDS:${box.id||'unknown'}`);score-=20}
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    if(boxes[i].allowOverlap||boxes[j].allowOverlap)continue;
    if(intersects(boxes[i],boxes[j])){warnings.push(`BOX_OVERLAP:${boxes[i].id||i}:${boxes[j].id||j}`);score-=8}
  }

  for(const text of manifest.texts||[]){
    if(text.required&&!String(text.value||'').trim()){failures.push(`TEXT_MISSING:${text.id||'unknown'}`);score-=25}
    if(text.maxChars&&[...String(text.value||'')].length>text.maxChars){warnings.push(`TEXT_TOO_LONG:${text.id||'unknown'}`);score-=8}
    if(/[�□]{2,}/.test(String(text.value||''))){failures.push(`TEXT_GLYPH_ERROR:${text.id||'unknown'}`);score-=30}
  }

  let qrDecoded=null;
  if(expectedQrUrl){
    qrDecoded=await decodeQr(file);
    if(!qrDecoded){failures.push('QR_NOT_READABLE');score-=40}
    else if(normalizeUrl(qrDecoded)!==normalizeUrl(expectedQrUrl)){failures.push('QR_URL_MISMATCH');score-=40}
  }

  if(manifest.safeArea){
    const s=manifest.safeArea;
    for(const box of boxes.filter(b=>b.critical)){
      if(box.x<s.left||box.y<s.top||box.x+box.width>width-s.right||box.y+box.height>height-s.bottom){warnings.push(`SAFE_AREA_VIOLATION:${box.id||'unknown'}`);score-=10}
    }
  }

  score=Math.max(0,score);
  const ok=failures.length===0&&score>=threshold;
  return {ok,score,threshold,warnings,failures,qrDecoded,width,height};
}

export function buildDesignProvenance({dna=[],principles=[],inspiration=[],forbidden=[]}={}){
  return {
    engine:'14DNA-ENGINE',
    dna,
    principles,
    inspiration:inspiration.map(item=>({
      source:item.source,
      abstraction:item.abstraction,
      copiedWork:false
    })),
    forbidden:[
      'specific artwork replication',
      'artist-name-only prompting',
      'AI-generated QR codes',
      'AI-generated logos',
      'AI-generated legal or pricing text',
      ...forbidden
    ],
    generatedAt:new Date().toISOString()
  };
}

export async function writeQaReport(reportPath,payload){
  await fs.mkdir(path.dirname(reportPath),{recursive:true});
  await fs.writeFile(reportPath,JSON.stringify(payload,null,2));
  return reportPath;
}
