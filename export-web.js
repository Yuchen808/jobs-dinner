// Bake the dinner scene and write it out for the three.js viewer in web/.
//   node export-web.js <frame> <frames>
// Each frame is one full bake with the candle flame nudged (FLICK), so shadows differ from frame to frame while the
// splats stay where they are. Frame 0 also writes positions, sizes and the palette.
//   web/data/scene.json   count, frames, palette, camera, lamp and flame positions
//   web/data/points.bin   Float32: x,y,z,size per splat
//   web/data/kind.bin     Uint8: 1 = glowing splat
//   web/data/clutter.bin  Uint8: 0, or the floor item's place in the importance order
//   web/data/colour-NN.bin Uint8: palette index per splat for frame NN
const fs = require('fs'), path = require('path');
const frame = Number(process.argv[2] || 0), frames = Number(process.argv[3] || 1);
const t = (2 * Math.PI * frame) / frames;
const flick = frames > 1
  ? [0.06 * Math.sin(t) + 0.03 * Math.sin(3 * t + 1), 0.03 * Math.sin(2 * t + 2), 0.06 * Math.cos(t + 0.5) + 0.025 * Math.sin(2 * t),
     1 + 0.3 * Math.sin(2 * t) + 0.14 * Math.sin(3 * t + 1)]
  : [0, 0, 0, 1];
process.env.FLICK = flick.map(v => v.toFixed(4)).join(',');
process.env.WEB = '1';
const FLAME = [0, 1.46, 0.02]; // keep in step with FLAME_Y in dinner.js

const studio = require('@shapeshift-labs/ink-studio');
const scene = require('./dinner.js')(studio.load());
const w = scene.build(scene.seed);
const out = path.join(__dirname, 'web', process.env.WEB_OUT || 'data');
fs.mkdirSync(out, { recursive: true });

const n = w.count, d = w.data;
// palette of the colours actually used, in a stable order (sorted), so every frame indexes the same table
const pal = w.pal.map(c => c >>> 0);
const index = new Map(pal.map((c, i) => [c, i]));
const col = new Uint8Array(n);
let missing = 0;
for (let i = 0; i < n; i++) {
  const p = d[i * 16 + 7] >>> 0, c = ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255); // stored blue-high; the palette is red-high
  let k = index.get(c);
  if (k === undefined) {  // a colour outside the scene palette: add it (only safe on frame 0, checked below)
    k = pal.length; pal.push(c); index.set(c, k); missing++;
  }
  col[i] = k;
}
if (pal.length > 256) throw Error('more than 256 colours: ' + pal.length);
fs.writeFileSync(path.join(out, `colour-${String(frame).padStart(2, '0')}.bin`), col);

if (frame === 0) {
  const pts = new Float32Array(n * 4), kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 16;
    pts[i * 4] = d[o]; pts[i * 4 + 1] = d[o + 1]; pts[i * 4 + 2] = d[o + 2];
    pts[i * 4 + 3] = Math.sqrt(Math.max(d[o + 4], d[o + 8], d[o + 10]));
    kind[i] = d[o + 11] ? 1 : 0;
  }
  fs.writeFileSync(path.join(out, 'points.bin'), Buffer.from(pts.buffer));
  fs.writeFileSync(path.join(out, 'kind.bin'), kind);
  const clutter = new Uint8Array(n);   // 0 = not clutter, otherwise its place in the importance order
  for (const g of w.clutter || []) for (const i of g.splats) clutter[i] = g.rank;
  fs.writeFileSync(path.join(out, 'clutter.bin'), clutter);
  fs.writeFileSync(path.join(out, 'scene.json'), JSON.stringify({
    count: n, frames, clutter: (w.clutter || []).length, palette: pal.map(c => '#' + c.toString(16).padStart(6, '0')), extraColours: missing,
    background: '#' + (w.pal[0] >>> 0).toString(16).padStart(6, '0'), curves: w.look.colorCurves.channels,
    glasses: { x: 1.059, y: 1.359, eye: 0.04, lens: 0.027, temple: [0.154, 0.004, 0.11] },   // host faces -X; lens centres at z = +-eye
    cam: w.cam, lamp: [1.75, 2.05, -0.75], flame: FLAME, wick: [0, 1.42, 0.02], flick: Array.from({ length: frames }, (_, i) => { const u = (2 * Math.PI * i) / frames; return frames > 1 ? [0.06 * Math.sin(u) + 0.03 * Math.sin(3 * u + 1), 0.03 * Math.sin(2 * u + 2), 0.06 * Math.cos(u + 0.5) + 0.025 * Math.sin(2 * u), 1 + 0.3 * Math.sin(2 * u) + 0.14 * Math.sin(3 * u + 1)] : [0, 0, 0, 1]; }), room: { rx: 3.55, rz: 3.6, rh: 3.7 }
  }, null, 1));
}
console.log(`frame ${frame}/${frames} splats ${n} colours ${pal.length} extra ${missing} flick ${process.env.FLICK}`);
