import fs from 'node:fs/promises';
import path from 'node:path';
import {createSocialBatch} from '../social/social-delivery.mjs';

const args=process.argv.slice(2);
function value(flag,fallback=''){
 const index=args.indexOf(flag);
 return index>=0&&args[index+1]?args[index+1]:fallback;
}
const presets=value('--presets','').split(',').map(x=>x.trim()).filter(Boolean);
const input={
 brand:value('--brand',''),
 campaign:value('--campaign',''),
 theme:value('--theme',''),
 headline:value('--headline',''),
 subtitle:value('--subtitle',''),
 date:value('--date',new Date().toISOString().slice(0,10)),
 ...(presets.length?{presets}:{})
};
if(!input.theme&&!input.headline){
 console.error('Usage: npm run social:batch -- --theme "テーマ" --headline "見出し" --brand "ブランド名" [--presets instagram_feed_portrait,x_landscape]');
 process.exit(2);
}
const batch=createSocialBatch(input);
const output=value('--output',path.join('runtime','social-batches',`${batch.batchId}.json`));
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(batch,null,2));
console.log(JSON.stringify({status:'created',output,batchId:batch.batchId,count:batch.count,summary:batch.summary},null,2));
