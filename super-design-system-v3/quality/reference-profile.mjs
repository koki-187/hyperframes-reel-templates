const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));

export function createReferenceProfile(input={}){
  return {
    id:input.id||'reference',
    required:Boolean(input.required),
    provided:Boolean(input.provided),
    composition:{negativeSpace:clamp(input.negativeSpace),controlledAsymmetry:clamp(input.controlledAsymmetry),focalDiscipline:clamp(input.focalDiscipline),gridIntegrity:clamp(input.gridIntegrity)},
    material:{materialEvidence:clamp(input.materialEvidence),lightControl:clamp(input.lightControl),textureDepth:clamp(input.textureDepth)},
    hierarchy:{headlineDominance:clamp(input.headlineDominance),supportRestraint:clamp(input.supportRestraint),metadataDiscipline:clamp(input.metadataDiscipline)},
    palette:{colorCount:Math.max(1,Number(input.colorCount)||3),accentRestraint:clamp(input.accentRestraint)},
    prohibited:[...(input.prohibited||[])],
    createdAt:new Date().toISOString()
  };
}

function average(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}

export function compareReferenceProfile(profile={},candidate={}){
  if(profile.required&&!profile.provided)return {provided:false,required:true,compositionSimilarity:0,materialSimilarity:0,hierarchySimilarity:0,failures:['REFERENCE_REQUIRED']};
  const c=candidate||{};
  const similarity=(a,b)=>Math.max(0,100-Math.abs(clamp(a)-clamp(b)));
  const compositionSimilarity=average([
    similarity(profile.composition?.negativeSpace,c.negativeSpace),similarity(profile.composition?.controlledAsymmetry,c.controlledAsymmetry),similarity(profile.composition?.focalDiscipline,c.focalDiscipline),similarity(profile.composition?.gridIntegrity,c.gridIntegrity)
  ]);
  const materialSimilarity=average([
    similarity(profile.material?.materialEvidence,c.materialEvidence),similarity(profile.material?.lightControl,c.lightControl),similarity(profile.material?.textureDepth,c.textureDepth)
  ]);
  const hierarchySimilarity=average([
    similarity(profile.hierarchy?.headlineDominance,c.headlineDominance),similarity(profile.hierarchy?.supportRestraint,c.supportRestraint),similarity(profile.hierarchy?.metadataDiscipline,c.metadataDiscipline)
  ]);
  return {provided:Boolean(profile.provided),required:Boolean(profile.required),compositionSimilarity:Math.round(compositionSimilarity),materialSimilarity:Math.round(materialSimilarity),hierarchySimilarity:Math.round(hierarchySimilarity),failures:[]};
}
