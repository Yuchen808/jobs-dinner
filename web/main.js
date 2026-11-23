// Real-time viewer for the baked dinner scene.
// The splats are baked by ink studio (export-web.js) and drawn here with three.js as square points on a small canvas
// that the browser enlarges without smoothing. Drag to orbit, scroll to zoom. The candle flicker plays back a loop of
// separately baked lighting frames, so the shadows on the walls really move.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

const hud = document.getElementById('hud');
const fail = message => { const e = document.getElementById('err'); e.style.display = 'flex'; e.textContent = message; throw new Error(message); };
window.addEventListener('error', e => { hud.textContent = 'error: ' + e.message; });

// ---------- settings: every look decision that can change without re-baking lives here
const DEFAULTS = {            // Yuchen's settings of 2026-11-21, copied from the panel
  pixel: 4,            // screen pixels per art pixel
  splat: 3.2,          // splat size, in multiples of its baked radius
  clutter: 0,          // how many of the things on the floor to show, most important first
  glasses: 1,          // the host's glasses: 0 hides them, 1 is full strength
  beams: 'auto',       // ceiling beams: 'three' = back three only, 'all' = six, 'auto' = front three show only from above, 'none'
  exposure: 1, shadows: 1, grade: 1, glow: 1.05,
  reflect: 0.37, reflectBlur: 2.7,   // floor sheen: how much of the mirrored room shows in the boards
  flicker: true, flickerFps: 3.5, flickerSoft: 1,
  flame: 1,            // candle flame size
  sway: false, swayDegrees: 5, swaySeconds: 9,
  dust: true, dustAmount: 90,
  background: '#05040b'
};
let saved = {};
try { saved = JSON.parse(localStorage.getItem('dinner-settings-5') || '{}'); } catch { saved = {}; }
const P = { ...DEFAULTS, ...saved };
if (typeof P.beams !== 'string') P.beams = 'auto';
const save = () => { try { localStorage.setItem('dinner-settings-5', JSON.stringify(P)); } catch { /* storage unavailable */ } };

// ---------- data
const get = async (file, type) => {
  const r = await fetch('data/' + file, { cache: 'no-store' });
  if (!r.ok) return null;
  return type ? new type(await r.arrayBuffer()) : r.json();
};
const meta = await get('scene.json');
if (!meta) fail('web/data/scene.json is missing.\nRun:  node export-web.js 0 1');
const pts = await get('points.bin', Float32Array), kind = await get('kind.bin', Uint8Array);
const clutterRank = (await get('clutter.bin', Uint8Array)) || new Uint8Array(meta.count);
const N = meta.count;
const frames = [];
for (let i = 0; i < meta.frames; i++) {
  const f = await get(`colour-${String(i).padStart(2, '0')}.bin`, Uint8Array);
  if (!f || f.length !== N) break;       // frames still baking: use what is there
  frames.push(f);
}
if (!frames.length) fail('No colour frames found in web/data.');

// The floor boards have a hairline gap where two board ends meet. Through it the camera sometimes sees a point on the
// unlit end of a board: a single near-black pixel in the middle of the lit floor. Lift those hidden side points up
// into the floor surface and give each the colour of the nearest surface point, in every light frame.
{
  const { rx, rz } = meta.room, CELL = 0.06, key = (x, z) => Math.round(x / CELL) * 4096 + Math.round(z / CELL);
  const top = new Map();
  for (let i = 0; i < N; i++) {
    const y = pts[i * 4 + 1];
    if (y > -0.004 && y < 0.004 && !clutterRank[i]) { const k = key(pts[i * 4], pts[i * 4 + 2]); (top.get(k) || top.set(k, []).get(k)).push(i); }
  }
  let mended = 0;
  for (let i = 0; i < N; i++) {
    const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2];
    if (!(y <= -0.004 && y > -0.13) || Math.abs(x) > rx - 0.06 || Math.abs(z) > rz - 0.06 || clutterRank[i]) continue;   // the floor's outer edge stays as it is
    let best = -1, bd = 1e9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of top.get(key(x + a * CELL, z + b * CELL)) || []) {
      const d = (pts[j * 4] - x) ** 2 + (pts[j * 4 + 2] - z) ** 2; if (d < bd) { bd = d; best = j; }
    }
    if (best < 0) continue;
    pts[i * 4 + 1] = 0;
    for (const f of frames) f[i] = f[best];
    mended++;
  }
  console.log('floor gaps mended:', mended);
}

// ---------- palette (with the film grade from the scene applied in JS, so the slider can blend it)
const curve = (stops, v) => {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, b] = [stops[i - 1], stops[i]];
    return a[1] + ((v - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return stops[stops.length - 1][1];
};
const palData = new Uint8Array(256 * 4);
const palTex = new THREE.DataTexture(palData, 256, 1, THREE.RGBAFormat);
palTex.magFilter = palTex.minFilter = THREE.NearestFilter;
function buildPalette() {
  meta.palette.forEach((hex, i) => {
    const c = parseInt(hex.slice(1), 16), raw = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map(v => v / 255);
    ['red', 'green', 'blue'].forEach((ch, k) => {
      const graded = meta.curves[ch] ? curve(meta.curves[ch].stops, raw[k]) : raw[k];
      palData[i * 4 + k] = Math.round(255 * Math.min(1, Math.max(0, raw[k] + (graded - raw[k]) * P.grade)));
    });
    palData[i * 4 + 3] = 255;
  });
  palTex.needsUpdate = true;
}
buildPalette();

// ---------- renderer and camera (parallel projection, like the stills)
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // colours are already display values: pass them through untouched
const scene = new THREE.Scene();
const VIEW = 11.6;                                         // world units across the height of the picture at zoom 1
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -80, 160);
const target = new THREE.Vector3(...meta.cam.target);
const home = () => {
  const { yaw, pitch } = meta.cam, d = 30;
  camera.position.set(target.x + d * Math.sin(yaw) * Math.cos(pitch), target.y + d * Math.sin(pitch), target.z + d * Math.cos(yaw) * Math.cos(pitch));
  camera.zoom = 1; camera.updateProjectionMatrix();
  controls.target.copy(target); controls.update();
};
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minZoom = 0.6; controls.maxZoom = 7;
controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI / 2 - 0.06;
controls.zoomToCursor = true;
let lastTouch = -1e9;
controls.addEventListener('start', () => { lastTouch = performance.now(); });
controls.addEventListener('change', () => { if (controls.state !== -1) lastTouch = performance.now(); });

// ---------- the splats
const pos = new Float32Array(N * 3), size = new Float32Array(N), rnd = new Float32Array(N), kindF = new Float32Array(N);
const floorF = new Float32Array(N), beamF = new Float32Array(N), clutF = new Float32Array(N);
for (let i = 0; i < N; i++) {
  pos[i * 3] = pts[i * 4]; pos[i * 3 + 1] = pts[i * 4 + 1]; pos[i * 3 + 2] = pts[i * 4 + 2];
  size[i] = pts[i * 4 + 3]; kindF[i] = kind[i];
  clutF[i] = clutterRank[i];
  const y = pts[i * 4 + 1];
  floorF[i] = y > -0.004 && y < 0.004 ? 1 : 0;          // top face of the floor boards
  const inside = pts[i * 4] > -meta.room.rx + 0.005 && pts[i * 4 + 2] > -meta.room.rz + 0.005;   // walls sit just outside these
  beamF[i] = inside && y > meta.room.rh - 0.3 ? (pts[i * 4 + 2] > 0.3 ? 2 : 1) : 0;   // ceiling beams: 1 = over the back half, 2 = over the front half
  let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  rnd[i] = (h >>> 8) / 16777216;
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
geo.setAttribute('aKind', new THREE.BufferAttribute(kindF, 1));
geo.setAttribute('aFloor', new THREE.BufferAttribute(floorF, 1));
geo.setAttribute('aBeam', new THREE.BufferAttribute(beamF, 1));
geo.setAttribute('aClutter', new THREE.BufferAttribute(clutF, 1));
const colA = new THREE.BufferAttribute(new Float32Array(N), 1), colB = new THREE.BufferAttribute(new Float32Array(N), 1);
colA.setUsage(THREE.DynamicDrawUsage); colB.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('aColA', colA); geo.setAttribute('aColB', colB);
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 12);

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
let mirror = null;   // render target holding the room drawn upside down, for the floor to pick up
const uniforms = {
  uMirror: { value: 0 }, uRefl: { value: blank }, uReflect: { value: P.reflect }, uTexel: { value: new THREE.Vector2(1, 1) }, uBeams: { value: 1 }, uFront: { value: 1 }, uClutter: { value: P.clutter },
  uPal: { value: palTex }, uPx: { value: 1 }, uSize: { value: P.splat }, uMix: { value: 0 }, uSoft: { value: P.flickerSoft },
  uExposure: { value: P.exposure }, uShadows: { value: P.shadows }, uGlow: { value: P.glow }
};
const mat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: /* glsl */`
    uniform sampler2D uPal, uRefl; uniform vec2 uTexel;
    uniform float uPx, uSize, uMix, uSoft, uExposure, uShadows, uGlow, uMirror, uReflect, uBeams, uFront, uClutter;
    attribute float aSize, aRand, aKind, aColA, aColB, aFloor, aBeam, aClutter;
    varying vec3 vCol;
    void main() {
      vec3 p = position;
      bool hide = (aBeam > 0.5 && uBeams < 0.5) || (aBeam > 1.5 && uFront < 0.5) || aClutter > uClutter + 0.5;
      if (uMirror > 0.5) { hide = hide || p.y < 0.03; p.y = -p.y; }   // the mirrored pass: everything above the floor, flipped
      if (hide) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vCol = vec3(0.0); return; }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      // Between two baked lighting frames each splat switches at its own moment. Every pixel stays a palette colour,
      // and the change sweeps through as a dither instead of a cross-fade.
      float when = mix(0.5, aRand, uSoft);
      float idx = uMix > when ? aColB : aColA;
      vec3 c = texture2D(uPal, vec2((idx + 0.5) / 256.0, 0.5)).rgb;
      c = pow(c, vec3(1.0 / uShadows)) * uExposure;
      if (aKind > 0.5) c *= uGlow;
      if (uMirror < 0.5 && aFloor > 0.5 && uReflect > 0.0) {   // floor boards pick up the mirrored room, a little blurred
        vec2 uv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
        vec3 r = texture2D(uRefl, uv).rgb * 0.4;
        r += texture2D(uRefl, uv + vec2(uTexel.x, 0.0)).rgb * 0.15 + texture2D(uRefl, uv - vec2(uTexel.x, 0.0)).rgb * 0.15;
        r += texture2D(uRefl, uv + vec2(0.0, uTexel.y)).rgb * 0.15 + texture2D(uRefl, uv - vec2(0.0, uTexel.y)).rgb * 0.15;
        c += r * uReflect;
      }
      vCol = c;
      gl_PointSize = max(1.0, aSize * uSize * uPx);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vCol;
    void main() { gl_FragColor = vec4(vCol, 1.0); }`
});
const world = new THREE.Group();
scene.add(world);
world.add(new THREE.Points(geo, mat));

// ---------- dust in the lamp light, and the flame
const DUST = 400, dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  const a = Math.random() * 6.283, y = 0.15 + Math.random() * 1.75, r = Math.sqrt(Math.random()) * (2.0 - y) * 1.45;
  dPos[i * 3] = meta.lamp[0] + Math.cos(a) * r; dPos[i * 3 + 1] = y; dPos[i * 3 + 2] = meta.lamp[2] + Math.sin(a) * r;
  dSeed[i] = Math.random();
}
const dGeo = new THREE.BufferGeometry();
dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
dGeo.boundingSphere = geo.boundingSphere;
const dMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uShow: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uShow; attribute float aSeed; varying float vA;
    void main() {
      vec3 p = position;
      float t = uTime * (0.05 + 0.08 * aSeed) + aSeed * 40.0;
      p.x += 0.12 * sin(t * 1.3 + aSeed * 9.0); p.z += 0.12 * cos(t * 1.1 + aSeed * 5.0);
      p.y = 0.15 + mod(p.y + t * 0.6, 1.75);
      vA = step(aSeed, uShow) * (0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (0.7 + aSeed) + aSeed * 30.0), 3.0));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = 1.0;
    }`,
  fragmentShader: /* glsl */`
    varying float vA;
    void main() { gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * 0.22 * vA, 1.0); }`
});
const dust = new THREE.Points(dGeo, dMat);
world.add(dust);

// ---------- the candle flame: three stacked squares that lean and stretch, plus a stepped halo
const flick = meta.flick || [[0, 0, 0, 1]];
const fGeo = new THREE.BufferGeometry();
fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
fGeo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
fGeo.boundingSphere = geo.boundingSphere;
const wick = meta.wick || [meta.flame[0], meta.flame[1] - 0.035, meta.flame[2]];   // top of the candle
const fUni = { uFlame: { value: new THREE.Vector3(...wick) }, uLean: { value: new THREE.Vector2(0, 0) }, uTime: { value: 0 }, uGain: { value: 1 }, uScale: { value: P.flame },
  uPx: uniforms.uPx, uMirror: uniforms.uMirror };
const flameShader = halo => new THREE.ShaderMaterial({
  uniforms: fUni, transparent: halo, depthWrite: !halo, blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
  vertexShader: /* glsl */`
    uniform vec3 uFlame; uniform vec2 uLean; uniform float uTime, uGain, uScale, uPx, uMirror; attribute float aPart; varying vec3 vC; varying float vHalo;
    void main() {
      float lick = 0.5 + 0.5 * sin(uTime * 13.0) * sin(uTime * 7.3 + 1.0);          // quick, irregular
      vec3 p = uFlame; float s = 0.0; vHalo = 0.0;
      float lean = 0.012 * sin(uTime * 5.1) + 0.008 * sin(uTime * 11.7);
      // The flame sits on the wick. The body does not move sideways at all; the tip leans toward where the baked
      // light wandered (uLean), so flame and shadows agree without the flame ever leaving the candle.
      vec2 tipLean = uLean * 0.45 + vec2(lean, 0.0);
      float k = uScale * (0.85 + 0.15 * uGain);
      if (aPart < 0.5)      { s = 0.07;  p.y += 0.03 * k;  vC = vec3(1.0, 0.5, 0.12); }                                       // body
      else if (aPart < 1.5) { s = 0.042; p.y += 0.026 * k; vC = vec3(1.0, 0.93, 0.62); }                                      // hot core
      else if (aPart < 2.5) { s = 0.04;  p.y += (0.075 + 0.035 * lick) * k; p.xz += tipLean; vC = vec3(1.0, 0.72, 0.25); }    // tip
      else                  { s = 0.62 + 0.1 * lick; p.y += 0.03 * k; vC = vec3(1.0, 0.62, 0.25) * 0.13; vHalo = 1.0; }       // halo
      s *= k;
      if (uMirror > 0.5) p.y = -p.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = max(1.0, s * uPx);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vC; varying float vHalo;
    void main() {
      if (vHalo > 0.5) {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vC * (d < 0.45 ? 1.0 : d < 0.75 ? 0.55 : 0.25), 1.0);   // three flat rings, no smooth falloff
      } else gl_FragColor = vec4(vC, 1.0);
    }`
});
const flameCore = new THREE.Points(fGeo, flameShader(false)); flameCore.geometry.setDrawRange(0, 3);
const hGeo = fGeo.clone(); hGeo.setDrawRange(3, 1); hGeo.boundingSphere = geo.boundingSphere;
const flameHalo = new THREE.Points(hGeo, flameShader(true));
world.add(flameCore, flameHalo);

// ---------- the host's glasses, drawn as one-pixel lines (rimless round lenses after the reference portrait):
// each lens shows only a dark grey lower edge and a small pale highlight at the top; thin wire bridge; black temples.
const specs = new THREE.Group(); world.add(specs);
const specMats = [];
if (meta.glasses) {
  const g = meta.glasses, line = (pts, colour, strength) => {
    const m = new THREE.LineBasicMaterial({ color: colour, transparent: true, depthWrite: false });
    m.userData.strength = strength; specMats.push(m);
    specs.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), m));
  };
  // a lens is a circle in the plane x = g.x. Angles: 0 = toward +z, 90 = up.
  const arc = (cz, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
    const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / n);
    return [g.x, g.y + Math.sin(a) * g.lens, cz + Math.cos(a) * g.lens];
  });
  for (const s of [-1, 1]) {
    const cz = s * g.eye;
    line(arc(cz, 200, 340), 0x4a4a52, 0.9);                         // lower edge of the lens: dark grey
    line(arc(cz, s > 0 ? 55 : 95, s > 0 ? 85 : 125, 3), 0xf2eee2, 1); // small highlight on the top edge
    line([[g.x, g.y + 0.006, s * (g.eye + g.lens)], [g.x + g.temple[0] * 0.5, g.y + 0.009, s * (g.temple[2] - 0.004)],
          [g.x + g.temple[0], g.y + g.temple[1], s * g.temple[2]]], 0x0b0b10, 1);   // temple: black
  }
  line([[g.x, g.y + 0.007, -g.eye + g.lens], [g.x - 0.005, g.y + 0.013, 0], [g.x, g.y + 0.007, g.eye - g.lens]], 0x7a7a80, 0.8);   // bridge
}

// ---------- sizes
function resize() {
  const w = window.innerWidth, h = window.innerHeight, px = Math.max(1, Math.round(P.pixel));
  const aw = Math.max(64, Math.round(w / px)), ah = Math.max(64, Math.round(h / px));
  renderer.setPixelRatio(1);
  renderer.setSize(aw, ah, false);
  const half = VIEW / 2, aspect = aw / ah;
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
  if (mirror) mirror.dispose();
  mirror = new THREE.WebGLRenderTarget(aw, ah, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  uniforms.uTexel.value.set(P.reflectBlur / aw, P.reflectBlur / ah);
}
window.addEventListener('resize', resize);

// ---------- controls panel
const gui = new GUI({ title: 'Look' });
const on = fn => () => { fn && fn(); save(); };
gui.add(P, 'pixel', 2, 10, 1).name('pixel size').onChange(on(resize));
gui.add(P, 'splat', 1.5, 6, 0.1).name('splat size').onChange(on(() => { uniforms.uSize.value = P.splat; }));
gui.add(P, 'clutter', 0, meta.clutter || 0, 1).name('floor clutter').onChange(on(() => { uniforms.uClutter.value = P.clutter; }));
gui.add(P, 'glasses', 0, 1, 0.01).name('glasses').onChange(on());
gui.add(P, 'beams', { 'three (back half)': 'three', 'all six': 'all', 'six, front 3 only from above': 'auto', 'none': 'none' }).name('ceiling beams').onChange(on());
const fL = gui.addFolder('Light');
fL.add(P, 'exposure', 0.5, 2, 0.01).onChange(on(() => { uniforms.uExposure.value = P.exposure; }));
fL.add(P, 'shadows', 0.6, 1.8, 0.01).name('lift shadows').onChange(on(() => { uniforms.uShadows.value = P.shadows; }));
fL.add(P, 'grade', 0, 1, 0.01).name('film grade').onChange(on(buildPalette));
fL.add(P, 'glow', 0.6, 1.6, 0.01).name('lamp glow').onChange(on(() => { uniforms.uGlow.value = P.glow; }));
fL.add(P, 'reflect', 0, 1, 0.01).name('floor reflection').onChange(on(() => { uniforms.uReflect.value = P.reflect; }));
fL.add(P, 'reflectBlur', 0, 5, 0.1).name('reflection blur').onChange(on(resize));
fL.addColor(P, 'background').onChange(on(() => renderer.setClearColor(P.background)));
const fM = gui.addFolder('Motion');
fM.add(P, 'flicker').name('candle flicker').onChange(on());
fM.add(P, 'flickerFps', 1, 20, 0.5).name('flicker speed').onChange(on());
fM.add(P, 'flickerSoft', 0, 1, 0.01).name('flicker dither').onChange(on(() => { uniforms.uSoft.value = P.flickerSoft; }));
fM.add(P, 'flame', 0, 2.5, 0.01).name('flame size').onChange(on(() => { fUni.uScale.value = P.flame; }));
fM.add(P, 'sway').name('idle sway').onChange(on());
fM.add(P, 'swayDegrees', 0, 25, 0.5).name('sway angle').onChange(on());
fM.add(P, 'swaySeconds', 3, 30, 0.5).name('sway period').onChange(on());
fM.add(P, 'dust').name('dust').onChange(on());
fM.add(P, 'dustAmount', 0, DUST, 1).name('dust amount').onChange(on());
gui.add({ reset: () => home() }, 'reset').name('reset view');
gui.add({ defaults: () => { Object.assign(P, DEFAULTS); gui.controllersRecursive().forEach(c => c.updateDisplay()); apply(); save(); } }, 'defaults').name('default settings');
gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(P, null, 1)) }, 'copy').name('copy settings');
function apply() {
  uniforms.uSize.value = P.splat; uniforms.uExposure.value = P.exposure; uniforms.uShadows.value = P.shadows;
  uniforms.uGlow.value = P.glow; uniforms.uSoft.value = P.flickerSoft;
  uniforms.uReflect.value = P.reflect; fUni.uScale.value = P.flame; uniforms.uClutter.value = P.clutter;
  renderer.setClearColor(P.background); buildPalette(); resize();
}
apply(); home();

// ---------- loop
let shownA = -1, shownB = -1, fpsT = performance.now(), fpsN = 0, fps = 0;
const setFrame = (attr, f) => { const a = attr.array, s = frames[f]; for (let i = 0; i < N; i++) a[i] = s[i]; attr.needsUpdate = true; };
function tick(now) {
  const t = window.__t ?? now / 1000, F = frames.length;   // __t: a fixed clock, set when frames are being captured
  const f = P.flicker && F > 1 ? (t * P.flickerFps) % F : 0, A = Math.floor(f), B = (A + 1) % F;
  if (A !== shownA) { setFrame(colA, A); shownA = A; }
  if (B !== shownB) { setFrame(colB, B); shownB = B; }
  const mixT = P.flicker && F > 1 ? f - A : 0;
  uniforms.uMix.value = mixT;
  // the flame follows the same path the baked light took, so it sits where its shadows say it is
  const fa = flick[A % flick.length], fb = flick[B % flick.length], live = P.flicker ? 1 : 0;
  fUni.uLean.value.set(live * (fa[0] + (fb[0] - fa[0]) * mixT), live * (fa[2] + (fb[2] - fa[2]) * mixT));
  fUni.uGain.value = fa[3] + (fb[3] - fa[3]) * mixT; fUni.uTime.value = P.flicker ? t : 0;
  flameCore.visible = flameHalo.visible = P.flame > 0.01;

  // idle sway: a slow turn left and right, eased back in a second after you let go
  const idle = Math.min(1, Math.max(0, (now - lastTouch - 1200) / 1500));
  world.rotation.y = P.sway ? THREE.MathUtils.degToRad(P.swayDegrees) * Math.sin((t * 6.283) / P.swaySeconds) * idle * idle * (3 - 2 * idle) : 0;

  dust.visible = P.dust; dMat.uniforms.uTime.value = t; dMat.uniforms.uShow.value = P.dustAmount / DUST;
  controls.update();
  // glasses fade out as they shrink: at room scale a lens is under a pixel wide, and drawn at full strength they
  // would read as a dark smudge on the face
  if (meta.glasses) {
    const lensPx = 2 * meta.glasses.lens * uniforms.uPx.value, seen = Math.min(1, Math.max(0.12, (lensPx - 1.2) / 4));
    for (const m of specMats) m.opacity = P.glasses * m.userData.strength * seen;
    specs.visible = P.glasses > 0.01;
  }
  // beams: in 'auto' the three over the front half are hidden while the view is from the side, so they do not
  // cover the table, and come back when you look down from above
  uniforms.uBeams.value = P.beams === 'none' ? 0 : 1;
  uniforms.uFront.value = P.beams === 'all' || (P.beams === 'auto' && controls.getPolarAngle() < 0.82) ? 1 : 0;
  uniforms.uPx.value = (renderer.domElement.height * camera.zoom) / (camera.top - camera.bottom);
  if (P.reflect > 0 && mirror) {            // pass 1: the room upside down, into a texture
    const showDust = dust.visible; dust.visible = false; flameHalo.visible = false; const showSpecs = specs.visible; specs.visible = false;
    uniforms.uMirror.value = 1; uniforms.uRefl.value = blank;
    renderer.setRenderTarget(mirror); renderer.setClearColor(0x000000); renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.setClearColor(P.background);
    uniforms.uMirror.value = 0; uniforms.uRefl.value = mirror.texture;
    dust.visible = showDust; flameHalo.visible = P.flame > 0.01; specs.visible = showSpecs;
  } else uniforms.uRefl.value = blank;
  renderer.render(scene, camera);          // pass 2: the picture

  if (++fpsN && now - fpsT > 500) { fps = Math.round((fpsN * 1000) / (now - fpsT)); fpsN = 0; fpsT = now; }
  hud.innerHTML = `<b>${N.toLocaleString()}</b> splats · <b>${renderer.domElement.width}×${renderer.domElement.height}</b> art pixels · ` +
    `<b>${F}</b>/${meta.frames} light frames · <b>${fps}</b> fps<br>drag to turn · scroll to zoom · right-drag to move`;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
// for checking a view without the mouse: __view(yaw, pitch, zoom, [x, y, z]) in radians, looking at the given point
window.__view = (yaw, pitch, zoom, at) => {
  const t = new THREE.Vector3(...at), d = 30;
  camera.position.set(t.x + d * Math.sin(yaw) * Math.cos(pitch), t.y + d * Math.sin(pitch), t.z + d * Math.cos(yaw) * Math.cos(pitch));
  camera.zoom = zoom; camera.updateProjectionMatrix(); controls.target.copy(t); controls.update(); lastTouch = performance.now();
};
// for recording: hide the panel and the text, and (with __t) step time by hand so every frame is exact
window.__capture = on => { gui.domElement.style.display = on ? 'none' : ''; hud.style.display = on ? 'none' : ''; };
window.__loopSeconds = () => frames.length / P.flickerFps;
window.__ready = true;
