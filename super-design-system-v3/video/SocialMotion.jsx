import React from 'react';
import {AbsoluteFill,interpolate,spring,useCurrentFrame,useVideoConfig} from 'remotion';

const SAFE={reels:{top:250,bottom:340,left:80,right:80},story:{top:250,bottom:300,left:72,right:72},x_vertical:{top:120,bottom:180,left:72,right:72},x_landscape:{top:90,bottom:90,left:96,right:96},square:{top:72,bottom:96,left:72,right:72}};

export const SocialMotion=({format='reels',headline,subtitle,dna,accent='#b8ff2c',background='#07090d',fontFamily='Noto Sans JP',seconds=10})=>{
  const frame=useCurrentFrame();const {fps,width,height}=useVideoConfig();const safe=SAFE[format]||SAFE.reels;
  const enter=spring({frame,fps,config:{damping:18,stiffness:120,mass:.8}});
  const y=interpolate(enter,[0,1],[80,0]);const opacity=interpolate(frame,[0,Math.max(8,fps*.45)],[0,1],{extrapolateRight:'clamp'});
  const progress=Math.min(1,frame/Math.max(1,seconds*fps));const vertical=height>width;
  return React.createElement(AbsoluteFill,{style:{background,color:'#f2f4f6',fontFamily,overflow:'hidden'}},
    React.createElement('div',{style:{position:'absolute',left:safe.left,right:safe.right,top:safe.top,bottom:safe.bottom,border:`2px solid ${accent}22`,pointerEvents:'none'}}),
    React.createElement('div',{style:{position:'absolute',left:safe.left,top:safe.top,width:`${Math.max(180,width*.52)}px`,height:Math.max(6,width*.006),background:accent,transform:`scaleX(${Math.max(.02,progress)})`,transformOrigin:'left center'}}),
    React.createElement('div',{style:{position:'absolute',left:safe.left,right:safe.right,top:height*.28,transform:`translateY(${y}px)`,opacity}},
      React.createElement('div',{style:{fontSize:vertical?width*.09:width*.058,fontWeight:900,lineHeight:1.05,letterSpacing:'-.05em',maxWidth:vertical?'92%':'70%',whiteSpace:'pre-wrap'}},headline),
      React.createElement('div',{style:{marginTop:28,fontSize:vertical?width*.035:width*.022,fontWeight:500,opacity:.72,maxWidth:vertical?'88%':'62%'}},subtitle)
    ),
    React.createElement('div',{style:{position:'absolute',left:safe.left,bottom:safe.bottom,fontSize:Math.max(18,width*.014),letterSpacing:'.12em',color:accent}},`14DNA / ${dna} / ${format}`),
    React.createElement('div',{style:{position:'absolute',right:safe.right,top:safe.top,width:width*.11,height:width*.11,border:`4px solid ${accent}`,borderRadius:'50%',transform:`rotate(${frame*.35}deg)`}})
  );
};
