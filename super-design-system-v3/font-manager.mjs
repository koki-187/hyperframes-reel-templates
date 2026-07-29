import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const FONT_EXT=/\.(woff2?|ttf|otf)$/i;
const LICENSE_RE=/(^|\/)(ofl|license|licence|copyright)(\.|$)/i;

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

async function checksum(file){
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

export async function inspectFonts(dir){
  const files=await walk(dir);
  const fonts=[];
  for(const file of files.filter(file=>FONT_EXT.test(file))){
    const stat=await fs.stat(file);
    fonts.push({file:path.relative(dir,file),bytes:stat.size,sha256:await checksum(file)});
  }
  const licenses=files.filter(file=>LICENSE_RE.test(file)).map(file=>path.relative(dir,file));
  const status=fonts.length&&licenses.length?'ready':'setup_required';
  return {
    status,
    directory:dir,
    fonts,
    licenses,
    errors:[
      ...(fonts.length?[]:['FONT_SETUP_REQUIRED']),
      ...(licenses.length?[]:['FONT_LICENSE_REQUIRED'])
    ],
    policy:{publicCommitAllowed:false,finalExportRequiresReady:true}
  };
}

export async function assertFontsReady(dir){
  const report=await inspectFonts(dir);
  if(report.status!=='ready') throw new Error(report.errors.join(','));
  return report;
}
