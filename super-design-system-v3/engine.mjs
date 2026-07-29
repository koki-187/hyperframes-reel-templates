import crypto from 'node:crypto';

export const FORMATS={
  reels:{id:'reels',platform:'Instagram Reels',width:1080,height:1920,aspect:'9:16',safe:'top 250 / bottom 340 / sides 80px'},
  story:{id:'story',platform:'Instagram/Facebook Story',width:1080,height:1920,aspect:'9:16',safe:'top 250 / bottom 300 / sides 72px'},
  x_vertical:{id:'x_vertical',platform:'X vertical',width:1080,height:1920,aspect:'9:16',safe:'top 120 / bottom 180 / sides 72px'},
  x_landscape:{id:'x_landscape',platform:'X landscape',width:1920,height:1080,aspect:'16:9',safe:'top/bottom 90 / sides 96px'},
  square:{id:'square',platform:'Square social video',width:1080,height:1080,aspect:'1:1',safe:'top 72 / bottom 96 / sides 72px'}
};

export const MOTION=[
['visual_music_orbit','音楽構造を幾何形態の軌道・反復・色変化へ変換','拍単位の反復と漸進変化','固定または正投影',['円・楕円の軌道','スケールの呼吸','拍同期の色面転換']],
['direct_film_energy','素材へ直接刻むような線・傷・色の運動','不均一な短い衝撃','フィルム面固定',['スクラッチ線','飛沫','手描きストローク']],
['synchromy_system','音・図形・速度を同じ規則で同期','加速・定速・減速を明示','固定',['セル分裂','音階と色の対応','速度曲線']],
['computational_harmony','数学的周期と位相差から調和する運動を生成','長い周期と位相ずれ','中心軸固定',['同心回転','リサージュ軌道','収束と発散']],
['title_sequence_tension','単一記号と切断的編集で物語の緊張を圧縮','硬いカット、2〜4秒単位','グラフィック面固定',['分断線','切り抜き形状','段階的タイトル']],
['kinetic_typography_system','文字を空間・速度・視点で探索可能な情報構造にする','読み取り速度に合わせる','情報空間を前進・旋回',['文字の奥行き配置','ズーム階層','情報群の再整列']],
['interface_emergence','小さな要素のルールから全体の形が立ち上がる','入力→反応→収束','固定または追従',['エージェント群','軌跡の蓄積','自己整列']],
['organic_morph_brand','プロダクト形状を有機的変形と精密な材質でブランド化','滑らかなイーズ','マクロからワイド',['材質変形','押し出し','シームレスループ']],
['tactile_surreal_3d','触れられそうな3D素材と小さな超現実性を組み合わせる','期待から短い変化','商品撮影的ドリー',['柔らかな物体','粒子凝集','質感転換']],
['graphic_character_burst','強いグラフィック形状とキャラクター的運動で感情を作る','スナッピー、オーバーシュート','平面中心',['弾む形','伸縮','マッチカット']],
['cinematic_hard_surface','硬質な構造物・建築を映画的照明と編集で見せる','緩い導入→強いカット→余韻','低い視点、長焦点',['構造展開','光の走査','霧中の移動']],
['procedural_spectral','光学・レーザー・干渉・データをスペクトル現象へ変換','パルス、走査、波形同期','精密ドリー',['光線走査','干渉縞','スペクトル分解']],
['architectural_transformation','建築・都市・グリッドを変形させ空間をメッセージにする','構築→変形→再構築','建築的ワイド',['都市ブロック展開','面の反転','地図から建築へ']],
['monumental_simulation','巨大スケールと日常的対象の対比で一瞬の物語を作る','静かな観察＋単一の大きな事象','超ワイド、ゆっくりプッシュ',['巨大構造物','環境シミュレーション','スケール対比']]
].map(([id,principle,timing,camera,moves])=>({id,principle,timing,camera,moves}));

function random(seed){const h=crypto.createHash('sha256').update(String(seed)).digest();let i=0;return()=>h.readUInt32LE((i++%7)*4)/0xffffffff}
export function createRecipe(input={}){
 const seed=input.seed||crypto.randomUUID(),r=random(seed),formatId=FORMATS[input.format]?input.format:'reels',format=FORMATS[formatId];
 const selected=input.motionId?MOTION.find(x=>x.id===input.motionId):null;const motion=selected||MOTION[Math.floor(r()*MOTION.length)];
 const seconds=Math.min(60,Math.max(3,Number(input.seconds||10))),outputs=Math.min(4,Math.max(1,Number(input.outputs||1))),shots=seconds<=6?3:seconds<=15?5:8;
 const storyboard=Array.from({length:shots},(_,i)=>({shot:i+1,start:+(i*seconds/shots).toFixed(2),end:+((i+1)*seconds/shots).toFixed(2),role:i===0?'HOOK':i===shots-1?'CTA':'DEVELOP'}));
 const productionPrompt=`Create an original ${format.aspect} ${seconds}-second social video at ${format.width}x${format.height}, 30fps. Theme: ${input.theme||'brand message'}. Headline: ${input.headline||'none'}. Motion principle: ${motion.principle}. Timing: ${motion.timing}. Camera: ${motion.camera}. Animation language: ${motion.moves.join(', ')}. Keep essential text inside ${format.safe}. Preserve official brand assets. Do not name or imitate any designer, studio, film, campaign, character or copyrighted work. Do not fabricate metrics, endorsements or client logos.`;
 return{version:'4.3.0',seed,outputs,seconds,fps:Number(input.fps||30),formatId,format,motion,storyboard,productionPrompt,limitNotice:'Actual local render limits depend on GPU/VRAM. Paid API fallback is disabled.'};
}
