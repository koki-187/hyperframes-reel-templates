import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {validateAsset,buildDesignProvenance,writeQaReport} from '../quality/asset-qa.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'14dna-asset-qa-'));
const image=path.join(dir,'candidate.png');
await sharp({create:{width:1200,height:675,channels:4,background:'#071421'}}).png().toFile(image);

const report=await validateAsset({
  file:image,
  manifest:{
    expectedWidth:1200,
    expectedHeight:675,
    boxes:[{id:'headline',x:40,y:40,width:500,height:100,critical:true}],
    texts:[{id:'headline',value:'14DNA-ENGINE',required:true,maxChars:40}],
    safeArea:{left:24,top:24,right:24,bottom:24}
  }
});
assert.equal(report.ok,true);
assert.equal(report.width,1200);
assert.equal(report.height,675);

const provenance=buildDesignProvenance({
  dna:['digital_nature'],
  principles:['controlled asymmetry'],
  inspiration:[{source:'Swiss editorial systems',abstraction:'modular hierarchy'}]
});
assert.equal(provenance.engine,'14DNA-ENGINE');
assert.equal(provenance.inspiration[0].copiedWork,false);
assert.ok(provenance.forbidden.includes('AI-generated QR codes'));

const reportPath=path.join(dir,'qa.json');
await writeQaReport(reportPath,{report,provenance});
assert.ok(JSON.parse(await fs.readFile(reportPath,'utf8')).report.ok);

await fs.rm(dir,{recursive:true,force:true});
console.log('14DNA asset QA tests passed.');
