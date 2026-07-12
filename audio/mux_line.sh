#!/bin/bash
# LINE精緻版に音を焼き込む（ビートマップはindex.htmlのGSAPタイムラインと同期）
set -e
cd "$(dirname "$0")"
V="${1:?入力mp4}"
OUT="${2:?出力mp4}"

ffmpeg -y -i "$V" -i bgm30.wav -i pop_send.wav -i pop_recv.wav -i tap.wav -i whoosh.wav -i reveal.wav -i pinpon.wav -i cta.wav -filter_complex "
[1:a]volume=0.5[bgm];
[2:a]volume=0.8,asplit=3[p1][p2][p3];
[3:a]volume=0.8,asplit=6[r1][r2][r3][r4][r5][r6];
[p1]adelay=750[d1];[p2]adelay=6250[d2];[p3]adelay=14050[d3];
[r1]adelay=2350[d4];[r2]adelay=4650[d5];[r3]adelay=8650[d6];[r4]adelay=10450[d7];[r5]adelay=15550[d8];
[r6]adelay=12150,volume=1.15[d9];
[4:a]adelay=16600,volume=0.9[d10];
[5:a]adelay=17100,volume=0.7[d11];
[6:a]adelay=18450,volume=0.85[d12];
[7:a]adelay=20950,volume=0.8[d13];
[8:a]adelay=22350,volume=0.9[d14];
[bgm][d1][d2][d3][d4][d5][d6][d7][d8][d9][d10][d11][d12][d13][d14]amix=inputs=15:duration=first:normalize=0,alimiter=limit=0.89:level=0,pan=stereo|c0=c0|c1=c0[a]
" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "== 音入り完成: $OUT =="
