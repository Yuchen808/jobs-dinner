// One figure, imported from figure/painted.glb, to see how much detail a person can hold.
// Render: npx ink-studio render figure.js --colored --ortho --px 2 --out out/figure.png
const path = require('path');
const studio = require('@shapeshift-labs/ink-studio');

module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'figure',
  name: 'Figure test',
  seed: 3,
  build(seed) {
    const RES = Number(process.env.FIG_RES) || 0.03;
    const CELLS = Number(process.env.FIG_CELLS) || 160;
    const mesh = K.mesh.fit(studio.readMesh(path.join(__dirname, 'figure', 'painted.glb')), { size: 4 });
    const look = K.mesh.look(mesh, { hues: 12, shades: 5 });
    const B = makeBuilder(seed, look.pal);
    const S = K.sculpt(makeSculpt(B));
    Object.assign(S, { amb: 0.3, sky: 0.15, sunK: 0.4, sun: K.V.norm([-0.4, 0.6, 0.7]), wob: 0.02 });
    S.mesh(mesh, look, { cells: CELLS, res: RES });
    S.bake();
    return B.finish({
      cam: { target: [0, 2, 0], dist: 6.5, pitch: 0.1, yaw: 0.45, sway: 0 },
      detail: 14,
      dither: 0.2,
      radius: 3
    });
  }
});
