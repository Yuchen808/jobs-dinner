#!/bin/bash
# One frame of the loop: candle flicker (re-baked lighting, so the shadows move) plus a slow left-right camera sway.
# usage: anim.sh <frame> <frames>
i=$1; N=$2
read FL YAW <<<$(node -e '
const i=+process.argv[1],N=+process.argv[2],t=2*Math.PI*i/N,f=x=>x.toFixed(4);
const dx=0.035*Math.sin(2*t)+0.018*Math.sin(5*t+1), dy=0.02*Math.sin(3*t+2), dz=0.035*Math.cos(2*t+0.5)+0.015*Math.sin(7*t);
const g=1+0.14*Math.sin(3*t)+0.07*Math.sin(7*t+1);
console.log([dx,dy,dz,g].map(f).join(","), f(0.72+0.09*Math.sin(t)));' $i $N)
FLICK=$FL npx ink-studio render dinner.js --ortho --clean --yaw $YAW --w 1440 --h 1200 --px 4 --out out/anim/f$(printf %03d $i).png > /dev/null 2>&1
echo "frame $i done"
