#!/bin/zsh
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install
npm start &
sleep 2
open http://127.0.0.1:4314
