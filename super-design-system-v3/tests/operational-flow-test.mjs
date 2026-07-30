import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createRecipe} from '../engine.mjs';
import {renderSocialSvg} from '../renderers/social-svg.mjs';
import {evaluateQualityGate} from '../quality/quality-gate.mjs';
import {createReferenceProfile,compareReferenceProfile} from '../quality/reference-profile.mjs';
import {createRegenerationRecipe} from '../quality/regeneration.mjs';

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'14dna-operational-'));
const recipe=createRecipe({theme:'宅建学習アプリ',headline:'合格まで、何をやるかもう迷わない。',format:'x_landscape',seed:'OPERATIONAL-TEST'});
const svg=renderSocialSvg(recipe,{format:'x_landscape',headline:'合格まで、何をやるかもう迷わない。'});
const png=path.join(temp,'candidate.png');
await sharp(Buffer.from(svg)).png().toFile(png);
const metadata=await sharp(png).metadata();
assert.equal(metadata.width,recipe.format.width);
assert.equal(metadata.height,recipe.format.height);

const profile=createReferenceProfile({required:true,provided:true,negativeSpace:32,controlledAsymmetry:82,focalDiscipline:88,gridIntegrity:86,materialEvidence:86,lightControl:88,textureDepth:82,headlineDominance:90,supportRestraint:86,metadataDiscipline:88,colorCount:4,accentRestraint:90});
const reference=compareReferenceProfile(profile,{negativeSpace:30,controlledAsymmetry:84,focalDiscipline:87,gridIntegrity:88,materialEvidence:84,lightControl:86,textureDepth:83,headlineDominance:88,supportRestraint:85,metadataDiscipline:86});
assert.ok(reference.compositionSimilarity>=95);
assert.ok(reference.materialSimilarity>=95);
assert.ok(reference.hierarchySimilarity>=95);

const approved=evaluateQualityGate({scores:{concept:93,composition:92,hierarchy:91,materiality:90,typography:92,brand:91,technical:96},reference,premiumSignals:{decorativeNoise:5,neonDependence:4,templateFeeling:5,genericIconDensity:8,visualFocusCount:1,negativeSpace:30,controlledAsymmetry:84,materialEvidence:84},technicalReport:{failures:[],warnings:[]},minimumLevel:'RELEASE'});
assert.equal(approved.decision,'APPROVED');
assert.equal(approved.shouldOutput,true);

const rejected=evaluateQualityGate({scores:{concept:90,composition:62,hierarchy:84,materiality:61,typography:88,brand:85,technical:95},reference:{...reference,compositionSimilarity:55,materialSimilarity:58},premiumSignals:{decorativeNoise:45,neonDependence:35,templateFeeling:60,genericIconDensity:50,visualFocusCount:5,negativeSpace:8,controlledAsymmetry:40,materialEvidence:45},technicalReport:{failures:[],warnings:[]},minimumLevel:'RELEASE'});
assert.equal(rejected.decision,'REJECTED');
const regen=createRegenerationRecipe({job:{id:'test-job',mode:'template_png'},gate:rejected});
assert.equal(regen.decision,'REGENERATE');
assert.ok(regen.actions.length>=3);
assert.ok(regen.fixedAssets.includes('verified QR'));

await fs.rm(temp,{recursive:true,force:true});
console.log('14DNA-ENGINE operational flow test passed.');
