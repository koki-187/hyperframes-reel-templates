import assert from 'node:assert/strict';
import {evaluateQualityGate,selectReleaseCandidates,createVariationPlan} from '../quality/quality-gate.mjs';

const approved=evaluateQualityGate({
  candidateId:'approved',
  scores:{concept:94,composition:93,hierarchy:92,materiality:91,typography:92,brand:94,technical:100},
  technicalReport:{failures:[],warnings:[]},
  reference:{provided:true,compositionSimilarity:88,materialSimilarity:86,hierarchySimilarity:90},
  premiumSignals:{decorativeNoise:5,neonDependence:0,templateFeeling:4,genericIconDensity:5,visualFocusCount:1,negativeSpace:28,controlledAsymmetry:92,materialEvidence:90}
});
assert.equal(approved.shouldOutput,true);
assert.equal(approved.decision,'APPROVED');
assert.ok(approved.score>=88);

const rejected=evaluateQualityGate({
  candidateId:'rejected',
  scores:{concept:80,composition:62,hierarchy:75,materiality:58,typography:74,brand:65,technical:95},
  technicalReport:{failures:['QR_NOT_READABLE'],warnings:[]},
  reference:{provided:true,compositionSimilarity:55,materialSimilarity:50,hierarchySimilarity:65},
  premiumSignals:{decorativeNoise:60,neonDependence:50,templateFeeling:70,genericIconDensity:80,visualFocusCount:7,negativeSpace:6,controlledAsymmetry:40,materialEvidence:35}
});
assert.equal(rejected.shouldOutput,false);
assert.equal(rejected.decision,'REJECTED');
assert.ok(rejected.failures.includes('QR_NOT_READABLE'));
assert.ok(rejected.failures.includes('DIMENSION_BELOW_MINIMUM:composition'));

const selected=selectReleaseCandidates([
  {candidateId:'low',scores:{concept:82,composition:82,hierarchy:82,materiality:82,typography:82,brand:82,technical:100}},
  {candidateId:'high',scores:{concept:95,composition:95,hierarchy:95,materiality:95,typography:95,brand:95,technical:100}}
]);
assert.equal(selected.length,1);
assert.equal(selected[0].candidateId,'high');

const plan=createVariationPlan({theme:'宅建BOOST',count:3});
assert.equal(plan.length,3);
assert.notEqual(plan[0].composition,plan[1].composition);
assert.ok(plan.every(item=>item.fixedAssets.includes('qr')));

console.log('14DNA premium quality gate tests passed.');
