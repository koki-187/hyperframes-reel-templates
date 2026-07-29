const SAFE={reels:{top:250,bottom:340,sides:80},story:{top:250,bottom:300,sides:72},x_vertical:{top:120,bottom:180,sides:72},x_landscape:{top:90,bottom:90,sides:96},square:{top:72,bottom:96,sides:72}};
const LIMITS={reels:14,story:14,x_vertical:14,x_landscape:24,square:17};
const units=s=>[...String(s||'')].reduce((n,c)=>n+(/[\x00-\xff]/.test(c)?.55:1),0);
export function validateVideoPlan({format='reels',seconds=10,headline='',subtitle='',ctaSeconds=1.5}){
 const errors=[],warnings=[];const safe=SAFE[format];
 if(!safe)errors.push('FORMAT_UNSUPPORTED');
 if(seconds<3||seconds>60)errors.push('DURATION_OUT_OF_RANGE');
 if(units(headline)>LIMITS[format]*4)warnings.push('HEADLINE_DENSE');
 if(units(subtitle)>70)warnings.push('SUBTITLE_DENSE');
 if(ctaSeconds<1.2)warnings.push('CTA_TOO_SHORT');
 const subtitleCharsPerSecond=units(subtitle)/Math.max(1,seconds-2);
 if(subtitleCharsPerSecond>12)warnings.push('SUBTITLE_READING_SPEED_HIGH');
 return{ok:errors.length===0,score:Math.max(0,100-errors.length*30-warnings.length*6),errors,warnings,safeArea:safe,subtitleCharsPerSecond:+subtitleCharsPerSecond.toFixed(2),rules:{minimumCtaSeconds:1.2,maxSubtitleCharsPerSecond:12}};
}
