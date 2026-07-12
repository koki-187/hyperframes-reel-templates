#!/bin/bash
# 宅建BOOSTリール用 SFX/BGM 合成（ffmpegのみ・完全ローカル・権利フリー）
set -e
cd "$(dirname "$0")"

# --- 受信ポップ（LINE風「ポコッ」低め） ---
ffmpeg -y -f lavfi -i "aevalsrc='exp(-t*26)*0.9*sin(2*PI*(560+300*exp(-t*38))*t)':s=44100:d=0.20" -ar 44100 pop_recv.wav

# --- 送信ポップ（高め「ポンッ」） ---
ffmpeg -y -f lavfi -i "aevalsrc='exp(-t*30)*0.8*sin(2*PI*(920+380*exp(-t*45))*t)':s=44100:d=0.16" -ar 44100 pop_send.wav

# --- タップ音（短いクリック） ---
ffmpeg -y -f lavfi -i "anoisesrc=d=0.06:c=white:a=0.55" -af "highpass=f=1800,lowpass=f=6000,afade=t=out:st=0.012:d=0.045" -ar 44100 tap.wav

# --- 画面遷移ワッシュ（ノイズスイープ） ---
ffmpeg -y -f lavfi -i "anoisesrc=d=1.0:c=pink:a=0.85" -af "lowpass=f=2400,highpass=f=180,afade=t=in:st=0:d=0.38,afade=t=out:st=0.5:d=0.5" -ar 44100 whoosh.wav

# --- アプリ起動アルペジオ（C6-E6-G6 きらっ） ---
ffmpeg -y -f lavfi -i "aevalsrc='0.5*exp(-t*7)*sin(2*PI*1046.5*t)*between(t\,0\,0.5)+0.5*exp(-(t-0.09)*7)*sin(2*PI*1318.5*t)*gte(t\,0.09)+0.5*exp(-(t-0.18)*7)*sin(2*PI*1568*t)*gte(t\,0.18)':s=44100:d=0.9" -ar 44100 reveal.wav

# --- 正解チャイム（ピンポン E6→A6） ---
ffmpeg -y -f lavfi -i "aevalsrc='0.55*exp(-t*6)*sin(2*PI*1318.5*t)+0.55*exp(-(t-0.16)*6)*sin(2*PI*1760*t)*gte(t\,0.16)':s=44100:d=0.8" -ar 44100 pinpon.wav

# --- CTA登場（低音サム＋高音スパークル） ---
ffmpeg -y -f lavfi -i "aevalsrc='exp(-t*9)*0.95*sin(2*PI*145*t)+0.22*exp(-t*7)*sin(2*PI*2093*t)':s=44100:d=0.6" -ar 44100 cta.wav

# --- BGMパッド（C→G→Am→F 各2s / ソフトアタック） ---
mk_chord() { # $1=out $2 $3 $4 = 周波数3つ
  ffmpeg -y -f lavfi -i "aevalsrc='0.30*min(t*3\,1)*min((2-t)*3\,1)*(sin(2*PI*$2*t)+sin(2*PI*$3*t)+sin(2*PI*$4*t))/3':s=44100:d=2" -ar 44100 "$1"
}
mk_chord c_C.wav 261.63 329.63 392.00
mk_chord c_G.wav 246.94 293.66 392.00
mk_chord c_Am.wav 220.00 261.63 329.63
mk_chord c_F.wav 174.61 220.00 261.63
printf "file 'c_C.wav'\nfile 'c_G.wav'\nfile 'c_Am.wav'\nfile 'c_F.wav'\n" > chords.txt
ffmpeg -y -f concat -safe 0 -i chords.txt -c copy bgm8.wav
ffmpeg -y -stream_loop 3 -i bgm8.wav -t 30 -af "lowpass=f=1500,volume=0.9,afade=t=in:st=0:d=0.8,afade=t=out:st=28.6:d=1.4" -ar 44100 bgm30.wav

echo "== 生成完了 =="
ls -la *.wav
