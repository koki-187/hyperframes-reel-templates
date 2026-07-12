#!/bin/bash
# X版に音を焼き込む（X版タイムラインのビートマップ）
set -e
cd "$(dirname "$0")"
V="${1:?入力mp4}"
OUT="${2:?出力mp4}"

ffmpeg -y -i "$V" -i bgm30.wav -i pop_send.wav -i pop_recv.wav -i tap.wav -i whoosh.wav -i reveal.wav -i pinpon.wav -i cta.wav -filter_complex "
[1:a]volume=0.5[bgm];
[2:a]volume=0.8,asplit=3[p1][p2][p3];
[3:a]volume=0.8,asplit=3[r1][r2][r3];
[4:a]asplit=2[t1][t2];
[p1]adelay=800[d1];[p2]adelay=13200[d2];[p3]adelay=15450,volume=0.6[d3];
[r1]adelay=4200[d4];[r2]adelay=8400[d5];[r3]adelay=9000,volume=1.15[d6];
[t1]adelay=16600,volume=0.9[d7];
[t2]adelay=1600,volume=0.5[d8];
[5:a]adelay=17100,volume=0.7[d9];
[6:a]adelay=18450,volume=0.85[d10];
[7:a]adelay=20950,volume=0.8[d11];
[8:a]adelay=22350,volume=0.9[d12];
[bgm][d1][d2][d3][d4][d5][d6][d7][d8][d9][d10][d11][d12]amix=inputs=13:duration=first:normalize=0,alimiter=limit=0.89:level=0,pan=stereo|c0=c0|c1=c0[a]
" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "== 音入り完成: $OUT =="
