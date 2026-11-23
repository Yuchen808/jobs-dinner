// Dinner scene v1: a dim room, one lamp, a table, two people facing each other.
// Render: npx ink-studio render dinner.js --colored --out out/dinner.png
const path = require('path');
const fs = require('fs');
const studio = require('@shapeshift-labs/ink-studio');

module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'dinner',
  name: 'One dinner',
  seed: 11,
  build(seed) {
    const palette = [0x05040b];
    // ramp(n, ...stops): n evenly spaced tones through the given colours, dark to light; returns their palette indices
    const ramp = (n, ...stops) => {
      const ids = [];
      for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(f)), t = f - k;
        const a = stops[k], b = stops[k + 1];
        const ch = sh => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
        ids.push(palette.push((ch(16) << 16) | (ch(8) << 8) | ch(0)) - 1);
      }
      return ids;
    };
    const R = {
      floor: ramp(10, 0x08061a, 0x1e1024, 0x5a2a12, 0xa25e1e, 0xe2a644),
      floor2: ramp(10, 0x070518, 0x1a0e20, 0x4c2410, 0x8e5019, 0xcf953a),
      floor3: ramp(10, 0x080619, 0x221226, 0x663214, 0xb46c24, 0xeeb650),
      wall: ramp(30, 0x08071c, 0x1a1630, 0x4a3c2c, 0xa08a4a, 0xf0dc8c),
      dark: ramp(7, 0x060514, 0x140c20, 0x34180e, 0x6e4018),
      frame: ramp(7, 0x0a0920, 0x2a2438, 0x7a6a44, 0xdcc880),
      glow: ramp(3, 0xe39b58, 0xffca7c, 0xffe9b8),
      night: ramp(5, 0x04040e, 0x0a0a22, 0x181840),
      rug: ramp(8, 0x0c0618, 0x30101c, 0x74241c, 0xc05a2c),
      skin: ramp(5, 0x3a2218, 0xa66e4c, 0xdca67c),
      black: ramp(5, 0x030304, 0x0a0a0b, 0x161616, 0x282624),
      denim: ramp(5, 0x101828, 0x22324c, 0x46608a),
      shirt: ramp(6, 0x26261c, 0x55533c, 0xc0bc94),
      khaki: ramp(5, 0x1a1512, 0x54422f, 0x8a7050),
      ceramic: ramp(4, 0x4a4438, 0x9a9078, 0xece4c8),
      hair: ramp(3, 0x0c0806, 0x241810, 0x3a2a1c),
      brass: ramp(5, 0x2a1e0e, 0x6a5020, 0xc09a44),
      grey: ramp(4, 0x1c1a1a, 0x5a5654, 0x9a9692),
      shoe: ramp(4, 0x3a3834, 0x8a867e, 0xd4cfc4),
      white: ramp(7, 0x0c0b20, 0x34304a, 0x8a8070, 0xd8ccA0, 0xf6eed2),
      vinyl: ramp(4, 0x05040c, 0x12101c, 0x2a2634, 0x4a465a),
      steel: ramp(5, 0x0c0b1c, 0x34323c, 0x7a7670, 0xc8c2ae),
      bronze: ramp(6, 0x06050e, 0x150f12, 0x2e2014, 0x5a4020, 0x8e6c36),
      bread: ramp(5, 0x1c0e08, 0x5a3414, 0xa8742c, 0xe0b468),
      leaf: ramp(4, 0x08120c, 0x1e3e1c, 0x4c7a30, 0x86a84a),
      fruit: ramp(4, 0x2a0808, 0x7a1c14, 0xc8402a, 0xee7a3a),
      paper: ramp(5, 0x14122a, 0x4a4658, 0xa49c88, 0xe6dcc0, 0xfaf4e0),
      bolt: ramp(3, 0x1a1c4a, 0x2c4aa0, 0x4a7ad8)
    };
    const B = makeBuilder(seed, palette);
    const S = K.sculpt(makeSculpt(B));
    const tags = K.deform.tags(S);   // which splats each tagged solid becomes (used for the floor clutter)
    // Q scales every sampling spacing: smaller = more splats = sharper. Set with DINNER_Q.
    const Q = Number(process.env.DINNER_Q) || 0.5;
    for (const name of ['box', 'ball', 'lathe', 'tube']) {
      const make = S[name];
      S[name] = (...args) => {
        const o = args[args.length - 1];
        if (o && typeof o === 'object' && o.res) args[args.length - 1] = { ...o, res: o.res * Q };
        return make(...args);
      };
    }

    // The lamp is the only light: almost no ambient, no sun.
    Object.assign(S, { amb: 0.095, sky: 0.045, sunK: 0, wob: 0.015 });

    // teak with a low sheen: grain running along the boards, a soft highlight, and a faint mirror of the room
    const sheenPlane = K.reflection.plane({ id: 'floor-sheen', at: [0, 0.001, 0] });
    // wood grain: long streaks along the board, fine across it
    const grain = (x, y, z) => 0.2 * (B.n3(x * 26, 3.1, z * 1.1) - 0.5) + 0.1 * (B.n3(x * 7, 9.7, z * 0.5) - 0.5);
    const teak = r => K.reflection.material(K.surface.material({ r, mod: grain, materialId: 'teak' }, {
      direction: 'z',
      layers: {
        grain: { type: 'fiber', roughness: 0.35, color: '#e6a650', strength: 0.3, figure: 0.3, shift: 0.16 },
        sheen: { type: 'specular', roughness: 0.3, color: '#ffe6b0', strength: 0.3 }
      }
    }), sheenPlane.id, { strength: Number(process.env.SHEEN) || 0.28, f0: Number(process.env.F0) || 0.22, distortion: 0, blur: 0.45 });
    const floors = [teak(R.floor), teak(R.floor2), teak(R.floor3)];
    const wall = { r: R.wall };
    const dark = { r: R.dark };
    const glow = { r: R.glow, em: true };
    const night = { r: R.night, b: 0.12 };
    const rug = { r: R.rug };
    const rugEdge = { r: R.rug.slice(0, 5) };
    const skin = { r: R.skin };
    const black = { r: R.black };
    const denim = { r: R.denim };
    const shirt = { r: R.shirt };
    const khaki = { r: R.khaki };
    const ceramic = { r: R.ceramic };
    const hair = { r: R.hair };
    const brass = { r: R.brass };
    const frame = { r: R.frame };

    const box = (c, h, mat, res = 0.1, rd = 0.02) => S.box(c, h, mat, { res, rd });

    // Room size (half-width, half-depth, height). Front and right sides are cut away.
    const RX = 3.55, RZ = 3.6, RH = 3.7;

    // Tall floor lamp, right of the table and a little behind it.
    const LX = 1.75, LZ = -0.75, LH = 2.05;
    // Light. The shade you see is a shallow dome. What shapes the light is an invisible hood under it (a material
    // with skip: true casts shadows but is not drawn): it hangs lower than the shade and cuts the direct light into a
    // cone, so the bright band stays low on the walls and the floor pool ends before the far walls.
    const BULB = LH - 0.12, SLOPE = Number(process.env.SLOPE) || 0.62, HOOD_R = 0.6, HOOD_Y = BULB - SLOPE * HOOD_R;
    S.shSteps = 64;
    // Soft edge: the bulb is a small cluster of points, each casting its own hard shadow; where only some are hidden
    // the surface is partly lit. Few, fairly strong points: the bake skips the shadow test for any light contributing
    // under 3%, so many weak points would leak past the hood.
    const MAIN = Number(process.env.MAIN) || 2.8, BR = Number(process.env.BR) || 0.25, bulb = [[0, 0, 0]];
    for (let i = 0; i < 5; i++) bulb.push([Math.cos(i * 1.257) * BR, 0.03, Math.sin(i * 1.257) * BR]);
    for (let i = 0; i < 5; i++) bulb.push([Math.cos(i * 1.257 + 0.63) * BR * 0.55, -0.03, Math.sin(i * 1.257 + 0.63) * BR * 0.55]);
    for (const [dx, dy, dz] of bulb) S.lights.push({ p: [LX + dx, BULB + dy, LZ + dz], r: 11, s: MAIN / bulb.length, sh: true, c: R.glow });
    // the shade's own glow: weak, short reach, no shadows. This is the fade above the bright band.
    S.lights.push({ p: [LX, LH + 0.2, LZ], r: Number(process.env.GLOWR) || 6, s: Number(process.env.GLOW) || 0.7, c: R.glow });
    // candle on the table: a near light for the faces, and a faint far one that throws the sitters' shadows on the walls
    // FLICK = "dx,dy,dz,gain" moves the flame a little and changes its strength: one value per animation frame
    const [fx, fy, fz, fg] = (process.env.FLICK || '0,0,0,1').split(',').map(Number), FLAME_Y = 1.46, flame = [fx, FLAME_Y + fy, 0.02 + fz]; // keep FLAME_Y in step with export-web.js
    S.lights.push({ p: flame, r: 2.6, s: 0.95 * fg, sh: true, c: R.glow });
    S.lights.push({ p: flame, r: 8, s: (Number(process.env.CANDLE) || 0.42) * fg, sh: true, c: R.glow });

    // --- floor
    const planks = Math.round((2 * RX) / 0.2);
    let rnd = 7;
    const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < planks; i++) {
      const w = (2 * RX) / planks, x = -RX + w * (i + 0.5);
      // each strip is cut into boards of different lengths, joints staggered from strip to strip
      let z0 = -RZ - rand() * 1.6;
      while (z0 < RZ) {
        const z1 = z0 + 1.3 + rand() * 1.5, a = Math.max(z0, -RZ), b = Math.min(z1, RZ);
        if (b - a > 0.05) box([x, -0.06, (a + b) / 2], [w / 2 - 0.004, 0.06, (b - a) / 2 - 0.006], floors[Math.floor(rand() * 3)], 0.1, 0.01);
        z0 = z1;
      }
    }

    // --- back wall with one wide bank of windows in the middle
    const WZ = -RZ - 0.06;
    const wx0 = -2.1, wx1 = 2.1, wy0 = 0.55, wy1 = 3.0, wyT = 2.42; // opening; wyT = transom bar
    // Walls run down past the floor's top to its underside (FLOOR_T below zero) and meet in a corner post, so the two
    // open ends of the room finish flush with the floor slab instead of leaving a notch under the wall.
    const FLOOR_T = 0.12, WY = (RH - FLOOR_T) / 2, WH = (RH + FLOOR_T) / 2;
    box([(-RX + wx0) / 2, WY, WZ], [(wx0 + RX) / 2, WH, 0.06], wall, 0.07);
    box([(wx1 + RX) / 2, WY, WZ], [(RX - wx1) / 2, WH, 0.06], wall, 0.07);
    box([0, (wy0 - FLOOR_T) / 2, WZ], [(wx1 - wx0) / 2, (wy0 + FLOOR_T) / 2, 0.06], wall, 0.07);
    box([0, (wy1 + RH) / 2, WZ], [(wx1 - wx0) / 2, (RH - wy1) / 2, 0.06], wall, 0.07);
    box([-RX - 0.06, WY, 0], [0.06, WH, RZ], wall, 0.07);
    box([-RX - 0.06, WY, WZ], [0.06, WH, 0.06], wall, 0.07);   // corner post where the two walls meet

    const wcy = (wy0 + wy1) / 2, ww = (wx1 - wx0) / 2, wh = (wy1 - wy0) / 2;
    // no pane: the windows are open frames, so the room can be seen through them from outside
    const bays = 4, bw = (wx1 - wx0) / bays;
    for (let i = 0; i <= bays; i++) box([wx0 + i * bw, wcy, WZ + 0.04], [0.05, wh + 0.04, 0.05], frame, 0.06);
    for (let i = 0; i < bays; i++) box([wx0 + (i + 0.5) * bw, wcy, WZ + 0.02], [0.018, wh, 0.03], frame, 0.05);
    box([0, wyT, WZ + 0.04], [ww, 0.05, 0.05], frame, 0.06);
    for (let j = 1; j <= 3; j++) box([0, wy0 + (j * (wyT - wy0)) / 4, WZ + 0.02], [ww, 0.018, 0.03], frame, 0.05);
    box([0, wy0 - 0.03, WZ + 0.09], [ww + 0.1, 0.035, 0.09], frame, 0.07);
    box([0, wy1 + 0.04, WZ + 0.05], [ww + 0.08, 0.045, 0.05], frame, 0.07);

    // skirting, beams running across the room, a tall cabinet in the left corner
    box([0, 0.08, WZ + 0.085], [RX, 0.08, 0.025], frame, 0.09);
    box([-RX + 0.025, 0.08, 0], [0.025, 0.08, RZ], frame, 0.09);
    for (const z of [-2.7, -1.5, -0.3, 0.9, 2.1, 3.3]) box([0, RH - 0.14, z], [RX, 0.13, 0.11], dark, 0.1, 0.03);
    box([-RX + 0.62, 1.3, -RZ + 0.36], [0.6, 1.3, 0.34], dark, 0.1, 0.03); // against the window wall, left corner

    // rug
    box([0, 0.012, 0.05], [1.75, 0.014, 1.15], rugEdge, 0.09, 0.01);
    box([0, 0.02, 0.05], [1.6, 0.014, 1.0], rug, 0.09, 0.01);

    // --- floor lamp. If lamp/lampps_512.glb exists (generated with TRELLIS from the reference photo) it is used:
    // everything above the shade's rim glows, the stem and foot are dark bronze. Both are drawn without blocking
    // light, because the invisible hood and ring below are what shape the lamp's light. It is off by default (Yuchen preferred the hand-built lamp, 2026-11-21); LAMP_MESH=1 turns it on, otherwise the
    // hand-built lamp below is used.
    const lampFile = path.join(__dirname, 'lamp', 'lampps_512.glb');
    if (fs.existsSync(lampFile) && process.env.LAMP_MESH === '1') {
      const LAMP_H = LH + 0.56, RIM = 0.69;                 // total height; where the shade starts, as a share of the height
      const lm = K.mesh.fit(studio.readMesh(lampFile), { size: LAMP_H, at: [LX, 0, LZ] });
      const part = keep => {
        const tri = [];
        for (let t = 0; t < lm.tri.length; t += 3) {
          const y = (lm.pos[lm.tri[t] * 3 + 1] + lm.pos[lm.tri[t + 1] * 3 + 1] + lm.pos[lm.tri[t + 2] * 3 + 1]) / 3;
          if (keep(y / LAMP_H)) tri.push(lm.tri[t], lm.tri[t + 1], lm.tri[t + 2]);
        }
        return K.mesh.make(lm.pos, tri, null, null, [{ name: 'lamp', rgb: [0.7, 0.7, 0.7] }]);
      };
      S.mesh(part(h => h >= RIM), glow, { cells: 110, res: 0.03, ghost: true });
      // stem and foot: solid up to SOLID so they are shaded and throw a small shadow; the top of the stem, right
      // under the bulb, is drawn without blocking light (it would darken a wide ring of floor otherwise)
      const SOLID = 0.6;
      S.mesh(part(h => h < SOLID), { r: R.bronze }, { cells: 150, res: 0.022 });
      S.mesh(part(h => h >= SOLID && h < RIM), { r: R.bronze }, { cells: 60, res: 0.022, ghost: true });
    } else {
      S.lathe([LX, 0, LZ], 0.09, [0.3, 0.2], brass, { res: 0.05 });
      const stemR = y => 0.03 + 0.012 * Math.sin((y / LH) * 9), CUT = 1.8;
      S.lathe([LX, 0.09, LZ], CUT - 0.09, t => stemR(0.09 + t * (CUT - 0.09)), brass, { res: 0.05 });
      S.lathe([LX, CUT, LZ], LH - CUT, t => stemR(CUT + t * (LH - CUT)), brass, { res: 0.05, ghost: true });
      S.lathe([LX, LH, LZ], 0.42, t => 0.56 * Math.sqrt(Math.max(0.03, 1 - t * t)), glow, { res: 0.045 });
      S.lathe([LX, LH + 0.42, LZ], 0.14, [0.03, 0.008], brass, { res: 0.04 });
    }
    // invisible shadow casters: the hood that cuts the light, and a ring that keeps a small shadow round the foot
    const unseen = { r: R.dark, skip: true };
    for (let y = HOOD_Y + 0.03; y < LH + 0.03; y += 0.05) S.torus([LX, y, LZ], HOOD_R, 0.036, unseen, { res: 0.05 });
    S.torus([LX, 0.12, LZ], 0.31, 0.03, unseen, { res: 0.05 });

    // --- clutter along the window wall
    const white = { r: R.white }, vinyl = { r: R.vinyl }, steel = { r: R.steel };
    const lean = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]; // tip the top back toward the wall
    // two white boards standing free in front of the window wall, one at each end of the windows, splayed like
    // open wings: the inner end near the window and the wall, the outer end further out and further into the room
    const board = (inner, outer, h, lower) => {
      const dx = outer[0] - inner[0], dz = outer[1] - inner[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const ax = [[ux, 0, uz], [0, 1, 0], [-uz, 0, ux]], cx = (inner[0] + outer[0]) / 2, cz = (inner[1] + outer[1]) / 2;
      S.box([cx, h / 2, cz], [len / 2, h / 2, 0.022], white, { res: 0.06, ax });
      if (lower) S.box([cx - uz * -0.03, lower / 2, cz + ux * -0.03 + 0.0], [len / 2, lower / 2, 0.03], frame, { res: 0.06, ax });
    };
    board([-1.64, -RZ + 0.58], [-2.4, -RZ + 1.24], 1.75);
    board([2.0, -RZ + 0.56], [2.8, -RZ + 1.07], 1.75, 0.5);
    // record sleeves standing against the wall under the windows
    S.box([wx0 + 0.25, 0.17, -RZ + 0.16], [0.17, 0.17, 0.02], white, { res: 0.05, ax: lean(0.25) });
    S.box([wx0 + 0.3, 0.17, -RZ + 0.21], [0.17, 0.17, 0.012], rug, { res: 0.05, ax: lean(0.3) });
    S.lathe([wx0 + 0.3, 0.1, -RZ + 0.245], 0.012, 0.09, brass, { res: 0.04, ax: lean(0.3 + Math.PI / 2) });
    // turntable and receiver on the floor
    box([wx0 + 1.0, 0.05, -RZ + 0.42], [0.26, 0.05, 0.2], dark, 0.05);
    S.lathe([wx0 + 0.96, 0.1, -RZ + 0.42], 0.015, 0.16, vinyl, { res: 0.035 });
    S.lathe([wx0 + 0.96, 0.115, -RZ + 0.42], 0.006, 0.05, rug, { res: 0.03 });
    box([wx0 + 1.2, 0.12, -RZ + 0.3], [0.012, 0.012, 0.11], steel, 0.03, 0);
    box([wx0 + 1.62, 0.07, -RZ + 0.4], [0.27, 0.07, 0.18], steel, 0.05);
    box([wx0 + 1.62, 0.07, -RZ + 0.585], [0.24, 0.045, 0.006], vinyl, 0.04, 0);
    // --- things left on the floor: notebooks, loose paper, record sleeves.
    // They are listed in order of importance. Each one is tagged clutter-1, clutter-2, ... so the web viewer's
    // "floor clutter" slider can show just the first N. For stills, CLUTTER=N does the same at bake time.
    const turned = a => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
    const paperM = { r: R.paper }, boltM = { r: R.bolt }, bread = { r: R.bread }, leaf = { r: R.leaf }, fruit = { r: R.fruit };
    const SHOW = process.env.WEB ? 99 : Number(process.env.CLUTTER ?? 99);
    let rank = 0, tag = null;
    const flat = (x, z, hx, hz, mat, a, y = 0.016) => S.box([x, y + 0.004, z], [hx, 0.014, hz], mat, { res: 0.035, ax: turned(a), tag });
    const sheet = (x, z, a) => flat(x, z, 0.105, 0.15, paperM, a);
    const sleeve = (x, z, a, mat) => flat(x, z, 0.155, 0.155, mat, a);
    const notebooks = (x, z, a, n) => {       // dark covers with a pale page edge showing
      for (let k = 0; k < n; k++) {
        flat(x + k * 0.02, z + k * 0.015, 0.1, 0.14, paperM, a + k * 0.12, 0.016 + k * 0.05);
        flat(x + k * 0.02, z + k * 0.015, 0.105, 0.145, k % 2 ? rug : vinyl, a + k * 0.12, 0.04 + k * 0.05);
      }
    };
    const things = [
      () => {   // a pale sleeve with a red and a blue bolt across it: a colour note for a Bowie cover
        sleeve(2.45, 2.4, 0.25, paperM);
        S.box([2.45, 0.036, 2.4], [0.035, 0.006, 0.17], fruit, { res: 0.03, ax: turned(0.75), tag });
        S.box([2.51, 0.037, 2.38], [0.02, 0.006, 0.15], boltM, { res: 0.03, ax: turned(0.75), tag });
      },
      () => notebooks(1.95, 2.0, 0.35, 3),
      () => {   // an orange sleeve, the second Bowie colour note
        sleeve(0.15, 2.35, -0.4, { r: R.fruit.slice(1) });
        S.lathe([0.15, 0.034, 2.35], 0.008, 0.07, vinyl, { res: 0.03, tag });
      },
      () => {   // a record out of its sleeve
        S.lathe([1.1, 0.004, 2.2], 0.02, 0.15, vinyl, { res: 0.035, tag });
        S.lathe([1.1, 0.024, 2.2], 0.008, 0.05, fruit, { res: 0.03, tag });
      },
      () => sheet(0.95, 1.75, 0.3),
      () => notebooks(-1.25, 1.95, -0.3, 2),
      () => sleeve(-1.95, 1.5, 0.1, paperM),
      () => sheet(2.35, 1.45, 1.1),
      () => sheet(1.2, 1.95, -0.5),
      () => sleeve(-1.5, 1.78, 0.6, vinyl),
      () => notebooks(2.9, 1.5, 1.2, 1),
      () => sheet(2.75, 0.5, 0.2),
      () => sleeve(wx0 + 0.75, -RZ + 1.0, -0.2, leaf),
      () => sheet(-0.3, 2.2, -0.9),
      () => notebooks(0.5, 2.75, 0.1, 1),
      () => sheet(1.7, 2.6, 0.7),
      () => sheet(-1.9, 1.3, 0.4)
    ];
    // Made after the room is baked (see the end of build): the floor is then lit as if nothing lay on it, so hiding
    // an item in the viewer leaves clean boards instead of a dark patch.
    const addClutter = () => { for (const make of things) { rank++; tag = 'clutter-' + rank; if (rank <= SHOW) make(); } tag = null; };
    // the lamp's cord: a little slack by the foot, then one lazy curve back to an outlet on the window wall
    S.tube([[LX + 0.27, 0.008, LZ - 0.08], [LX + 0.52, 0.008, LZ - 0.3], [LX + 0.45, 0.008, LZ - 0.58], [LX + 0.72, 0.008, LZ - 0.95],
      [LX + 1.12, 0.008, LZ - 1.7], [RX - 0.4, 0.008, -RZ + 0.6], [RX - 0.3, 0.008, -RZ + 0.1], [RX - 0.3, 0.3, -RZ + 0.04]], 0.007, 0.007, dark, { res: 0.02 });
    box([RX - 0.3, 0.33, -RZ + 0.02], [0.04, 0.06, 0.012], white, 0.03, 0);

    // --- dining table
    const TY = 0.82;   // raised with the seats so hands rest just above the top now that the sitters stand on the floor
    box([0, TY, 0], [0.62, 0.03, 0.44], dark, 0.055, 0.015);
    for (const [dx, dz] of [[-0.54, -0.37], [0.54, -0.37], [-0.54, 0.37], [0.54, 0.37]])
      box([dx, TY / 2 - 0.02, dz], [0.03, TY / 2 - 0.01, 0.03], dark, 0.06);
    const top = TY + 0.03;
    for (const sx of [-1, 1]) {
      S.lathe([sx * 0.33, top, 0], 0.016, [0.1, 0.14], ceramic, { res: 0.04 });
      S.lathe([sx * 0.3, top, -0.24], 0.1, [0.028, 0.036], ceramic, { res: 0.035 });
    }
    // one tall candlestick with a single candle
    S.lathe([0, top, 0.02], 0.03, [0.085, 0.04], brass, { res: 0.03 });
    S.lathe([0, top + 0.03, 0.02], 0.32, t => 0.013 + 0.012 * Math.pow(Math.sin(t * 9.4), 2), brass, { res: 0.025 });
    S.lathe([0, top + 0.35, 0.02], 0.025, [0.02, 0.036], brass, { res: 0.025 });
    S.lathe([0, top + 0.37, 0.02], 0.2, 0.016, { r: R.paper }, { res: 0.025, ghost: true });
    if (!process.env.WEB) S.ball([0, FLAME_Y, 0.02], [0.022, 0.045, 0.022], glow, { res: 0.02, ghost: true }); // the web viewer draws its own moving flame
    // food
    box([-0.3, top + 0.008, 0.27], [0.15, 0.008, 0.085], { r: R.floor2 }, 0.03, 0.006);          // bread board
    S.ball([-0.3, top + 0.05, 0.27], [0.11, 0.045, 0.055], bread, { res: 0.025 });               // loaf
    S.lathe([0.27, top, 0.25], 0.045, [0.06, 0.1], ceramic, { res: 0.03 });                      // fruit bowl
    for (const [dx, dz, m] of [[-0.03, 0.0, fruit], [0.035, 0.02, bread], [0.0, -0.035, fruit], [0.01, 0.03, leaf]])
      S.ball([0.27 + dx, top + 0.065, 0.25 + dz], 0.034, m, { res: 0.02 });
    S.lathe([0.2, top, -0.26], 0.19, t => (t < 0.62 ? 0.036 : 0.036 - (t - 0.62) * 0.062), leaf, { res: 0.025 }); // bottle
    S.lathe([-0.06, top, -0.24], 0.03, [0.085, 0.11], ceramic, { res: 0.03 });                   // salad bowl
    S.ball([-0.06, top + 0.035, -0.24], [0.085, 0.03, 0.085], leaf, { res: 0.02 });
    for (const sx of [-1, 1]) {                                                                  // something on each plate
      S.ball([sx * 0.34, top + 0.024, 0.01], [0.055, 0.02, 0.04], sx < 0 ? bread : fruit, { res: 0.02 });
      S.ball([sx * 0.3, top + 0.024, -0.05], [0.03, 0.015, 0.03], leaf, { res: 0.02 });
    }

    // --- a seated person. sx = -1 sits on the left facing right; +1 sits on the right facing left.
    const steelMat = { r: R.steel }, leather = { r: R.vinyl };
    function person(sx, top, legs, hairMat, body = true, shift = 0) {
      const X = d => sx * (d + shift); // distance from the table centre along the facing axis
      // ottoman: four-star metal base, short stem, moulded plywood shell, black leather cushion; no back
      const ox = X(1.06);
      for (const [ux, uz] of [[0.71, 0.71], [0.71, -0.71]])
        S.box([ox, 0.035, 0], [0.27, 0.014, 0.026], steelMat, { res: 0.04, ax: [[ux, 0, uz], [0, 1, 0], [-uz, 0, ux]] });
      S.lathe([ox, 0.04, 0], 0.31, 0.028, steelMat, { res: 0.04 });
      S.ball([ox, 0.38, 0], [0.33, 0.07, 0.28], dark, { res: 0.05 });
      S.box([ox, 0.47, 0], [0.29, 0.07, 0.24], leather, { res: 0.05, rd: 0.06 });
      if (!body) return;
      // torso, leaning a little toward the table
      S.tube([[X(1.06), 0.56, 0], [X(1.0), 0.95, 0], [X(0.93), 1.24, 0]], t => 0.17 + 0.035 * Math.sin(t * Math.PI), 0, top, { res: 0.05 });
      S.ball([X(0.94), 1.2, 0], [0.13, 0.11, 0.26], top, { res: 0.05 }); // shoulders
      // neck and head
      S.tube([[X(0.92), 1.28, 0], [X(0.9), 1.4, 0]], 0.055, 0.05, skin, { res: 0.04 });
      S.ball([X(0.88), 1.5, 0], [0.125, 0.145, 0.12], skin, { res: 0.04 });
      S.ball([X(0.915), 1.545, 0], [0.125, 0.12, 0.128], hairMat, { res: 0.04 });
      S.ball([X(0.755), 1.49, 0], 0.028, skin, { res: 0.03 }); // nose
      // legs
      for (const z of [-0.11, 0.11]) {
        S.tube([[X(1.04), 0.55, z], [X(0.66), 0.56, z]], 0.09, 0.075, legs, { res: 0.05 });
        S.tube([[X(0.66), 0.56, z], [X(0.68), 0.1, z]], 0.07, 0.055, legs, { res: 0.05 });
        box([X(0.63), 0.045, z], [0.1, 0.04, 0.05], black, 0.045, 0.03);
      }
      // arms: elbows out, forearms resting on the table edge
      for (const z of [-1, 1]) {
        S.tube([[X(0.95), 1.2, z * 0.25], [X(0.84), 0.95, z * 0.29]], 0.065, 0.055, top, { res: 0.045 });
        S.tube([[X(0.84), 0.95, z * 0.29], [X(0.56), 0.835, z * 0.15]], 0.052, 0.042, top, { res: 0.045 });
        S.ball([X(0.5), 0.83, z * 0.13], [0.05, 0.035, 0.045], skin, { res: 0.035 });
      }
    }
    person(-1, shirt, khaki, hair, !fs.existsSync(path.join(__dirname, 'visitor', 'painted.glb')), 0.17); // the visitor: sculpted stand-in until the mesh exists
    person(1, black, denim, hair, false, 0.17); // the host's chair only; his body is the imported mesh below

    // --- a person imported from a generated mesh (<folder>/painted.glb), coloured by part from the scene palette.
    // parts: ramps for [clothes, trousers, skin, hair, shoes]
    const importFigure = (folder, at, turn, size, parts) => {
      // mapped.glb (from map_materials.py, Blender) carries one material per body part; painted.glb is the older
      // vertex-colour version, kept as a fallback
      const mapped = path.join(__dirname, folder, 'mapped.glb'), useMats = fs.existsSync(mapped) && !process.env.NO_MAPPED;
      const fig = K.mesh.fit(studio.readMesh(useMats ? mapped : path.join(__dirname, folder, 'painted.glb')), { size, at, turn });
      // the reader hands back vertex colours gamma-encoded once more, so encode the reference colours the same way
      const enc = v => { v /= 255; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
      const refs = [[16, 16, 20], [70, 96, 138], [214, 160, 128], [96, 90, 88], [168, 164, 158]].map(c => c.map(enc));
      const T = fig.tri, C = fig.vcol, triPart = new Uint8Array(T.length / 3);
      for (let t = 0; !useMats && t < triPart.length; t++) {
        let best = 0, bd = 1e9;
        for (let p = 0; p < refs.length; p++) {
          let d = 0;
          for (let k = 0; k < 3; k++) {
            const c = ((C[T[t * 3] * 3 + k] + C[T[t * 3 + 1] * 3 + k] + C[T[t * 3 + 2] * 3 + k]) / 3) * 255 - refs[p][k];
            d += c * c;
          }
          if (d < bd) { bd = d; best = p; }
        }
        triPart[t] = best;
      }
      if (useMats) {
        const idx = fig.mats.map(m => Math.max(0, ['top', 'trousers', 'skin', 'hair', 'shoe'].indexOf(m.name)));
        for (let t = 0; t < triPart.length; t++) triPart[t] = idx[fig.tmat[t]];
      }
      const look = {
        pal: palette, ramps: parts, triHue: triPart, hues: refs,
        mat: (S2, field, extra) => Object.assign({
          r: parts[0],
          tex: (x, y, z, ny, t) => {
            const ti = field.tri(x, y, z), r = parts[ti < 0 ? 0 : triPart[ti]];
            return r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
          }
        }, extra)
      };
      S.mesh(fig, look, { cells: 150, res: 0.022 });
    };
    importFigure('seated', [0.83, 0.03, 0], -Math.PI / 2, 1.45, [R.black, R.denim, R.skin, R.grey, R.shoe]); // the host
    // Glasses on the host. NOT baked by default: a splat is never thinner than the sampling spacing, so a wire frame
    // bakes into a solid dark blob. The web viewer draws them as one-pixel lines (see glasses in export-web.js and
    // web/main.js). GLASSES_SPLATS=1 bakes this old version anyway.
    if (process.env.GLASSES_SPLATS === '1') {
      // Dark round rims, silver wire for the bridge and temples. Kept barely there, like the lamp cord: hair-thin and sampled sparsely, so at room scale it is a few
      // dark specks that come and go as the view turns rather than a drawn pair of glasses.
      const rim = { r: R.vinyl.slice(0, 2) }, wire = { r: R.steel.slice(3) }, GX = 1.059, GY = 1.359, EYE = 0.04, LENS = 0.027, W = 0.0028, o = { res: 0.026, ghost: true };
      for (const z of [-EYE, EYE]) S.torus([GX, GY, z], LENS, W, rim, { ...o, ax: S.AX });   // dark round rims
      S.tube([[GX, GY + 0.008, -EYE + LENS], [GX - 0.006, GY + 0.014, 0], [GX, GY + 0.008, EYE - LENS]], W, W, wire, o);          // bridge
      for (const sz of [-1, 1]) S.tube([[GX, GY + 0.006, sz * (EYE + LENS)], [GX + 0.082, GY + 0.01, sz * 0.107], [GX + 0.154, GY + 0.004, sz * 0.11]], W, W, wire, o);   // temples
    }
    if (fs.existsSync(path.join(__dirname, 'visitor', 'painted.glb')))
      importFigure('visitor', [-0.83, 0.03, 0], Math.PI / 2, 1.45, [R.black, R.black, R.skin, R.hair, R.vinyl]); // the visitor

    S.bake();
    addClutter();
    S.bake();

    const W = B.finish({
      cam: { target: [0.3, 1.2, 0.2], dist: 16, pitch: 0.58, yaw: 0.72, sway: 0 },
      detail: 14,
      dither: 0.15,
      radius: 7.5,
      reflections: [sheenPlane],
      // film grade: lifted blue in the blacks, held-back blue in the lights, a little more contrast
      look: { colorCurves: { channels: {
        red: { stops: [[0, 0], [0.25, 0.2], [0.6, 0.66], [1, 1]] },
        green: { stops: [[0, 0], [0.25, 0.2], [0.6, 0.64], [1, 0.97]] },
        blue: { stops: [[0, 0.03], [0.25, 0.24], [0.6, 0.52], [1, 0.8]] }
      } } }
    });
    W.clutter = Object.keys(tags).filter(k => k.startsWith('clutter-')).map(k => ({ rank: Number(k.slice(8)), splats: tags[k] }));
    return W;
  }
});
