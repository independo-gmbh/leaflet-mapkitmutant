# MapkitMutant file split — design

**Date:** 2026-07-17
**Status:** Approved

## Goal

Improve maintainability of the plugin (currently one ~380-line file built with
`L.Layer.extend({...})`) by converting it to a native `class MapkitMutant extends
L.Layer` split across focused modules, without changing the public API, runtime
behavior, or the published `dist` bundle.

## Target layout

```
src/
  index.ts                   entry: imports MapkitMutant, registers
                             L.MapkitMutant + L.mapkitMutant on the global L
  MapkitMutant.ts            class MapkitMutant extends L.Layer — lifecycle,
                             container, canvas overlay, opacity
  projection.ts              pure coordinate math (no `this`)
  defaultMapkitOptions.ts    default mapkit.Map constructor options (data)
  Leaflet.MapkitMutant.d.ts  unchanged leaflet module augmentation
```

## Key decisions

- **Leaflet integration.** `initialize(options)` stays a method that calls
  `L.Util.setOptions(this, options)`; default options are assigned to
  `MapkitMutant.prototype.options` after the class body (not a class field,
  which would overwrite merged options). If `@types/leaflet`'s `Layer` fights
  `strict` mode, extend a cast base (`L.Layer as unknown as new () => L.Layer`)
  while keeping instance methods typed. `this`-heavy internals remain `any`.
- **projection.ts** exposes `leafletBoundsToMapkitRect(map, prevRect)` and
  `mapkitRectToLeafletBounds(rect, centerLng)` as pure functions. The class keeps
  thin `_leafletBoundsToMapkitRect` / `_mapkitRectToLeafletBounds` wrappers so
  existing call sites and tests are unchanged.
- **No container.ts / overlay.ts split.** Those methods are tightly coupled to
  instance state; extracting them would spread `this` across a fake boundary.
  They stay private methods on the class.
- **Build.** tsup `entry` becomes `{ "Leaflet.MapkitMutant": "src/index.ts" }` so
  the output filename stays `dist/Leaflet.MapkitMutant.js`. The `.d.ts` copy step
  is unchanged.

## Testing / verification

- All existing vitest suites are preserved (method names and public behavior
  unchanged); `test/helpers.ts` switches its dynamic import to `src/index.ts`.
- New `test/projection.test.ts` covers the pure math directly (rect projection,
  prevRect reuse, antimeridian shift with/without offset).
- Full gate (lint, typecheck, build, test) + node load-harness must pass.
- **Caveat:** the canvas/overlay render path in `_onRegionChangeEnd` moves
  verbatim but cannot be verified without a live MapKit token in a browser. The
  user will run `example.html` with a real token after the unit work lands.

## Commit breakdown

1. Extract `defaultMapkitOptions.ts` and pure `projection.ts` (+ tests); wire the
   existing file to use them.
2. Convert the layer to `class MapkitMutant` + `index.ts`; rewire the tsup entry
   and the test harness import.
