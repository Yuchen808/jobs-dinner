# Dinner, 1982

A small pixel-art gaussian-splat room you can turn around in the browser: a dim room, a floor lamp, a table,
two people facing each other, a candle that flickers and moves the shadows.

Built with [ink studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio) (scene sculpting and baking)
and [three.js](https://threejs.org) (the viewer).

## Look at it

```
npm install
node patch-ink.js        # softer lamp shadows: lowers ink studio's shadow cut-off
python serve.py 8766     # then open http://127.0.0.1:8766/web/
```

Drag to turn, scroll to zoom. The panel on the right has a slider for every detail: reflection, candle,
flicker speed, dust, beams, floor clutter. `web/data/` already holds a baked scene, so the viewer runs
without baking anything.

## How it is put together

| File | What it does |
|---|---|
| `dinner.js` | The scene: room, lamp, table, food, clutter, lights. About 269,000 points. |
| `export-web.js` | Bakes the scene once per candle position (12 frames) into `web/data/`. |
| `web/main.js` | The viewer: low-resolution canvas, swaps the 12 light frames, floor reflection, tuning panel. |
| `map_materials.py` | Blender script that assigns body-part materials to the two figure meshes. |
| `record-loop.js` | Records an exact seamless loop, centring the room in the frame first. |
| `make-music.py` | Synthesises a short loop of music the same length as the video. |

Re-bake after changing the scene (about 5 minutes):

```
seq 0 11 | xargs -P 6 -I{} node export-web.js {} 12
```

## Notes

- The two figures are meshes generated from drawings, then coloured by part in Blender.
- The glasses are drawn as one-pixel lines in the viewer: splats cannot be thinner than their spacing.
- The lamp's soft edge comes from a cluster of 11 point lights instead of one.
- Some scripts hold paths from the machine they were written on (Chrome, a Python environment); change them to yours.

The room is modelled after a 1982 photograph by Diana Walker. This is a personal, non-commercial study.
