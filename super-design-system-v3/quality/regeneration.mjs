const uniq=items=>[...new Set(items.filter(Boolean))];

export function createRegenerationRecipe({job={},gate={}}={}){
  const reasons=uniq([...(gate.reasons||[]),...(gate.failures||[]),...(gate.warnings||[])]);
  const actions=[];
  const preserve=[];
  const replace=[];
  const has=prefix=>reasons.some(reason=>String(reason).startsWith(prefix));

  if(has('QR_')||has('TEXT_')||has('LOGO_')||has('ASSET_')||has('WIDTH_')||has('HEIGHT_')){
    preserve.push('hero material','composition','approved palette');
    actions.push('recompose fixed assets from verified source files','rerun Japanese glyph and overflow checks','decode QR from completed canvas and compare destination');
  }
  if(has('DIMENSION_BELOW_MINIMUM:composition')||has('COMPOSITION_TENSION_WEAK')||has('REFERENCE_COMPOSITION_GAP')){
    replace.push('composition system');actions.push('reduce focal points to one','increase controlled asymmetry','rebuild layout on a measured modular grid','preserve only the strongest hero material');
  }
  if(has('DIMENSION_BELOW_MINIMUM:materiality')||has('MATERIALITY_WEAK')||has('REFERENCE_MATERIAL_GAP')){
    replace.push('hero material');actions.push('regenerate the primary material with stronger light evidence and depth','remove generic glow and decorative particles');
  }
  if(has('DIMENSION_BELOW_MINIMUM:hierarchy')||has('REFERENCE_HIERARCHY_GAP')||has('FOCAL_POINT_FRAGMENTED')){
    replace.push('information hierarchy');actions.push('shorten headline','reduce support copy weight','remove equal-weight cards','keep one evidence block');
  }
  if(has('DIMENSION_BELOW_MINIMUM:typography'))actions.push('rebuild Japanese line breaks and spacing with verified font metrics');
  if(has('TEMPLATE_FEELING')||has('GENERIC_ICON_DENSITY_HIGH')||has('DECORATIVE_NOISE_HIGH')||has('NEON_DEPENDENCE'))actions.push('remove template advertising patterns','remove generic icon rows','limit palette and accents','increase negative space');
  if(!actions.length)actions.push('create a new variation with a different composition principle and preserve only verified fixed assets');

  return {
    engine:'14DNA-ENGINE',
    sourceJobId:job.id||null,
    sourceMode:job.mode||null,
    decision:'REGENERATE',
    reasons,
    preserve:uniq(preserve),
    replace:uniq(replace),
    actions:uniq(actions),
    fixedAssets:['verified logo','verified QR','verified URL','verified price','verified Japanese copy'],
    minimumLevel:'RELEASE',
    createdAt:new Date().toISOString()
  };
}
