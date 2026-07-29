const REQUIRED_DIMENSIONS = ['concept','composition','hierarchy','materiality','typography','brand','technical'];

const DEFAULT_WEIGHTS = Object.freeze({
  concept: 0.16,
  composition: 0.18,
  hierarchy: 0.15,
  materiality: 0.14,
  typography: 0.14,
  brand: 0.13,
  technical: 0.10
});

const HARD_FAILURES = new Set([
  'QR_NOT_READABLE',
  'QR_URL_MISMATCH',
  'TEXT_GLYPH_ERROR',
  'TEXT_MISSING',
  'LOGO_MISSING',
  'ASSET_OUT_OF_BOUNDS',
  'WIDTH_MISMATCH',
  'HEIGHT_MISMATCH',
  'WATERMARK_VISIBLE',
  'PROMPT_ARTIST_NAME_ONLY',
  'FIXED_ASSET_GENERATED_BY_AI'
]);

export const QUALITY_LEVELS = Object.freeze({
  MASTER: {min: 92, label: 'MASTER'},
  RELEASE: {min: 88, label: 'RELEASE'},
  REVIEW: {min: 82, label: 'REVIEW'},
  REJECT: {min: 0, label: 'REJECT'}
});

function clamp(value,min=0,max=100){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function normalizeScores(scores={}){
  const normalized={};
  for(const key of REQUIRED_DIMENSIONS)normalized[key]=clamp(scores[key]);
  return normalized;
}

function weightedScore(scores,weights=DEFAULT_WEIGHTS){
  return Math.round(REQUIRED_DIMENSIONS.reduce((sum,key)=>sum+scores[key]*(weights[key]||0),0)*10)/10;
}

function levelFor(score){
  if(score>=QUALITY_LEVELS.MASTER.min)return QUALITY_LEVELS.MASTER.label;
  if(score>=QUALITY_LEVELS.RELEASE.min)return QUALITY_LEVELS.RELEASE.label;
  if(score>=QUALITY_LEVELS.REVIEW.min)return QUALITY_LEVELS.REVIEW.label;
  return QUALITY_LEVELS.REJECT.label;
}

function collectHardFailures(failures=[]){
  return failures.filter(item=>HARD_FAILURES.has(String(item).split(':')[0]));
}

function evaluateReferenceGap(reference={}){
  const gaps=[];
  if(reference.required&&!reference.provided)gaps.push('REFERENCE_REQUIRED');
  if(reference.provided&&reference.compositionSimilarity<70)gaps.push('REFERENCE_COMPOSITION_GAP');
  if(reference.provided&&reference.materialSimilarity<70)gaps.push('REFERENCE_MATERIAL_GAP');
  if(reference.provided&&reference.hierarchySimilarity<75)gaps.push('REFERENCE_HIERARCHY_GAP');
  return gaps;
}

function evaluatePremiumSignals(signals={}){
  const warnings=[];
  if(signals.decorativeNoise>30)warnings.push('DECORATIVE_NOISE_HIGH');
  if(signals.neonDependence>20)warnings.push('NEON_DEPENDENCE');
  if(signals.templateFeeling>20)warnings.push('TEMPLATE_FEELING');
  if(signals.genericIconDensity>35)warnings.push('GENERIC_ICON_DENSITY_HIGH');
  if(signals.visualFocusCount>3)warnings.push('FOCAL_POINT_FRAGMENTED');
  if(signals.negativeSpace<18)warnings.push('NEGATIVE_SPACE_INSUFFICIENT');
  if(signals.controlledAsymmetry<65)warnings.push('COMPOSITION_TENSION_WEAK');
  if(signals.materialEvidence<65)warnings.push('MATERIALITY_WEAK');
  return warnings;
}

export function evaluateQualityGate({
  scores={},
  technicalReport={},
  reference={},
  premiumSignals={},
  minimumLevel='RELEASE',
  candidateId='candidate',
  provenance={}
}={}){
  const normalized=normalizeScores(scores);
  const score=weightedScore(normalized);
  const level=levelFor(score);
  const failures=[...(technicalReport.failures||[])];
  const warnings=[...(technicalReport.warnings||[])];
  const hardFailures=collectHardFailures(failures);
  const referenceGaps=evaluateReferenceGap(reference);
  const premiumWarnings=evaluatePremiumSignals(premiumSignals);
  warnings.push(...referenceGaps,...premiumWarnings);

  const requiredMin=QUALITY_LEVELS[minimumLevel]?.min??QUALITY_LEVELS.RELEASE.min;
  const dimensionFailures=REQUIRED_DIMENSIONS
    .filter(key=>normalized[key]<70)
    .map(key=>`DIMENSION_BELOW_MINIMUM:${key}`);
  failures.push(...dimensionFailures);

  const blocked = hardFailures.length>0 || dimensionFailures.length>0 || score<requiredMin;
  const decision = blocked?'REJECTED':'APPROVED';
  const shouldOutput = decision==='APPROVED';
  const reasons=[];
  if(score<requiredMin)reasons.push(`QUALITY_SCORE_BELOW_${requiredMin}`);
  reasons.push(...hardFailures,...dimensionFailures);

  return {
    engine:'14DNA-ENGINE',
    candidateId,
    decision,
    shouldOutput,
    score,
    level,
    requiredLevel:minimumLevel,
    dimensions:normalized,
    failures:[...new Set(failures)],
    warnings:[...new Set(warnings)],
    reasons:[...new Set(reasons)],
    provenance,
    rule:'A rejected candidate must not be exported, displayed as completed, or presented as a 14DNA-ENGINE result.'
  };
}

export function rankCandidates(candidates=[]){
  const evaluated=candidates.map(candidate=>({
    ...candidate,
    gate:evaluateQualityGate(candidate)
  }));
  return evaluated.sort((a,b)=>{
    if(a.gate.shouldOutput!==b.gate.shouldOutput)return a.gate.shouldOutput?-1:1;
    return b.gate.score-a.gate.score;
  });
}

export function selectReleaseCandidates(candidates=[],limit=3){
  return rankCandidates(candidates)
    .filter(candidate=>candidate.gate.shouldOutput)
    .slice(0,limit);
}

export function createVariationPlan({theme='',count=3}={}){
  const systems=[
    {
      id:'controlled-organic-editorial',
      imageDna:['digital_nature','material_silence'],
      composition:'controlled asymmetry with one dominant material image and disciplined negative space',
      hierarchy:'editorial headline, sparse metadata, one evidence block',
      rejectIf:['generic app-ad layout','feature-icon grid','excessive glow']
    },
    {
      id:'precision-information-system',
      imageDna:['swiss_grid','corporate_modernism'],
      composition:'strict modular grid with measured density and a single focal datum',
      hierarchy:'data first, restrained labels, asymmetric balance',
      rejectIf:['dashboard screenshot collage','equal-weight cards','decorative charts']
    },
    {
      id:'japanese-geometric-tension',
      imageDna:['japanese_geometry','typographic_energy'],
      composition:'bold planar geometry, limited palette and culturally restrained rhythm',
      hierarchy:'short headline, symbolic numerals, minimal support copy',
      rejectIf:['festival-poster cliché','random geometric decoration','over-saturated palette']
    }
  ];
  return systems.slice(0,Math.max(1,Math.min(count,systems.length))).map((system,index)=>({
    ...system,
    index:index+1,
    theme,
    fixedAssets:['logo','qr','url','price','legal text','verified Japanese copy'],
    aiGeneratedRegions:['hero material','background atmosphere','abstract structural imagery']
  }));
}
