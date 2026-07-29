import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const FONT_EXT=/\.(woff2?|ttf|otf)$/i;
const LICENSE_RE=/(^|\/)(ofl|license|licence|copyright)(\.|$)/i;
const PREFERRED=[/NotoSansJP.*(?:Bold|700|Black|900)/i,/NotoSansJP/i,/ZenKakuGothic/i,/IBMPlexSansJP/i,/\.(ttf|otf)$/i];

async function walk(dir){
  const out=[];
  try{
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) out.push(...await walk(full)); else out.push(full);
    }
  }catch{}
  return out;
}

async function checksum(file){return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}

export async function inspectFonts(dir){
  const files=await walk(dir);
  const fonts=[];
  for(const file of files.filter(file=>FONT_EXT.test(file))){
    const stat=await fs.stat(file);
    fonts.push({file:path.relative(dir,file),bytes:stat.size,sha256:await checksum(file)});
  }
  const licenses=files.filter(file=>LICENSE_RE.test(file)).map(file=>path.relative(dir,file));
  const status=fonts.length&&licenses.length?'ready':'setup_required';
  return{status,directory:dir,fonts,licenses,errors:[...(fonts.length?[]:['FONT_SETUP_REQUIRED']),...(licenses.length?[]:['FONT_LICENSE_REQUIRED'])],policy:{publicCommitAllowed:false,finalExportRequiresReady:true}};
}

export async function assertFontsReady(dir){
  const report=await inspectFonts(dir);
  if(report.status!=='ready') throw new Error(report.errors.join(','));
  return report;
}

export async function loadJapaneseFont(dir,{required=true}={}){
  const files=(await walk(dir)).filter(file=>FONT_EXT.test(file));
  if(!files.length){if(required)throw new Error('FONT_SETUP_REQUIRED');return null;}
  const selected=[...files].sort((a,b)=>{
    const score=file=>PREFERRED.findIndex(re=>re.test(path.basename(file)));
    const sa=score(a),sb=score(b);return(sa<0?999:sa)-(sb<0?999:sb);
  })[0];
  const ext=path.extname(selected).slice(1).toLowerCase();
  const format=ext==='otf'?'opentype':ext==='woff2'?'woff2':ext==='woff'?'woff':'truetype';
  const buffer=await fs.readFile(selected);
  return{name:path.basename(selected),file:selected,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),format,weight:/900|black/i.test(selected)?900:/700|bold/i.test(selected)?700:400,dataUri:`data:font/${ext};base64,${buffer.toString('base64')}`};
}
