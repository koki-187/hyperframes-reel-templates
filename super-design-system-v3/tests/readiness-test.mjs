import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assessReadiness} from '../operations/readiness-check.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'14dna-ready-'));
await fs.mkdir(path.join(root,'private-fonts'),{recursive:true});
await fs.writeFile(path.join(root,'private-fonts','licensed-japanese.otf'),'test');
const env={
 DNA_RENDER_TOKEN:'a'.repeat(64),DNA_ADMIN_TOKEN:'b'.repeat(64),DNA_REQUIRE_PREMIUM_GATE:'true',
 DNA_DYNAMIC_DEVICE_REGISTRY:'true',DNA_ALLOWED_ORIGINS:'https://device.tailnet.ts.net',
 PAID_API_AUTO_FALLBACK:'false',FLUX_UNET:'flux.safetensors',FLUX_CLIP_L:'clip.safetensors',
 FLUX_T5:'t5.safetensors',FLUX_VAE:'ae.safetensors',LTX_MODEL:'ltx.safetensors'
};
const ready=await assessReadiness({root,env,includeExternal:false});
assert.equal(ready.status,'READY');
assert.equal(ready.requiredPercent,100);
const blocked=await assessReadiness({root,env:{},includeExternal:false});
assert.equal(blocked.status,'BLOCKED');
assert.ok(blocked.checks.some(c=>c.id==='render-token'&&!c.ok));
await fs.rm(root,{recursive:true,force:true});
console.log('14DNA production readiness tests passed.');
