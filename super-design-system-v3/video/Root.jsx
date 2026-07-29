import React from 'react';
import {Composition} from 'remotion';
import {SocialMotion} from './SocialMotion.jsx';

const PRESETS={
  reels:{width:1080,height:1920},story:{width:1080,height:1920},x_vertical:{width:1080,height:1920},x_landscape:{width:1920,height:1080},square:{width:1080,height:1080}
};

export const RemotionRoot=()=>Object.entries(PRESETS).map(([id,size])=>React.createElement(Composition,{
  key:id,id:`14DNA-${id}`,component:SocialMotion,width:size.width,height:size.height,fps:30,durationInFrames:300,
  defaultProps:{format:id,headline:'14の美学を、一つのエンジンへ。',subtitle:'SNS専用デザインシステム',dna:'digital_nature',accent:'#b8ff2c',background:'#07090d',seconds:10,safeAreas:null}
}));
