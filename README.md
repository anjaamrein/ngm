# Swissgeol NGM

## A Geology 3D viewer

Swissgeol is the new geology 3D viewer of [Swisstopo](https://swisstopo.ch), available at https://beta.swissgeol.ch.
It is Open Source and based on the Open Source CesiumJS 3D library.

You are welcome to use and adapt this software for your own uses; see See [LICENCE.md](./LICENCE.md).


## Your own version: getting started

git clone https://github.com/swissgeol/ngm.git
cd ngm; npm i; npm start
open http://localhost:8080


## Developping the Swisstopo version

See [DEVELOPING.md](./DEVELOPING.md).


## URL Parameters

A few URL parameters will modify the behaviour of the viewer:

- `noLimit` disable the navigation limits (sphere and lava). Use noLimit=false to enforce limits on local dev.
- `assetIds` display some additional Cesium ION 3dtilesets (coma separated list of CesiumIon ids)
- `maximumScreenSpaceError` define the visual quality (default: 2.0 except for localhost which is 100.0)
- `ownterrain` activates Swisstopo terrain (mind that their is only data in the swissrectangle)
- `swissrectangle` restrict rendering to the Swiss rectangle
- `inspector` display the Cesium Inspector widget


## Notes

Lava texture CC0 by https://opengameart.org/content/template-orange-texture-pack

Keyboard layout made with [keyboard-layout-editor](http://www.keyboard-layout-editor.com/) and [json to import](https://jira.camptocamp.com/secure/attachment/42145/keyboard-layout_upd.json)
