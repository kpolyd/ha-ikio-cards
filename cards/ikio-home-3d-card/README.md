# Ikio Home 3D

The existing interactive 3D home viewer, migrated into Ikio with **three external configuration files**. The public card contains the renderer and UI, never a personal house model, entity inventory or device map. It keeps the top-down/full-wall defaults, room selection, standard Ikio appearance, Reset, live lights/fans/openings/screens and individually clickable sensor badges.

```yaml
type: custom:ikio-home-3d-card
home_model: /local/ikio-home/home-model.json
entity_inventory: /local/ikio-home/entities.json
device_bindings: /local/ikio-home/device-bindings.json
appearance:
  theme: ha # dark, light, or ha
```

All three file fields are required and available in the visual editor, alongside Appearance: Ikio dark, Ikio light, or Follow Home Assistant (default). The background, toolbar and badges follow this appearance independently of time of day. Use same-origin URLs served by your Home Assistant host; no API keys or external service are needed. HA dashboard metadata is retained by visual edits. A missing/partial set shows setup guidance, not a default floorplan.

| Input | Data |
| --- | --- |
| `home_model` | Geometry, materials, model orientation, room targets and physical fixtures |
| `entity_inventory` | Stable inventory IDs, actual Home Assistant entity IDs, names and optional demo metadata |
| `device_bindings` | Inventory-to-model links, light/fan/screen/contact behaviour, labels, groups and layout |

Files are JSON containing the same plain-data structures used by the original three JavaScript configuration modules. Home model and device bindings use `schemaVersion: 1`; the inventory is an array. All three are fetched together and validated before replacing the view. File errors identify the input, preserve no previous home's scene and offer Retry. Loading is bounded; remapping and disconnection cancel requests and ignore late results. Updates to HA entity states do not reload files. Refresh the dashboard after editing the external files, or change their URL version query.

Keep personal files in your private configuration repository and deploy them separately. Home Assistant maps `/config/www/ikio-home/` to `/local/ikio-home/`. These are browser-readable static resources, not secret storage; they are not uploaded to or bundled in the public Ikio repository. Do not put credentials in them.

## Export your existing three modules

From the Ikio source checkout, use the supplied helper with the paths to the trusted configuration modules in your private checkout and a separate output directory:

```sh
node scripts/export-home-configuration.mjs \
  /path/to/private/src/configuration/home-model.js \
  /path/to/private/src/configuration/entities.js \
  /path/to/private/src/configuration/device-bindings.js \
  /path/to/private/home-json
```

This reads the named `homeModel`, `entityInventory` and `deviceBindings` exports, validates them, and writes `home-model.json`, `entities.json` and `device-bindings.json`. It executes trusted local JavaScript modules in Node; it does not execute configuration in the browser or upload anything. Keep the original three modules as editable private source and export again after changes. No model conversion or GLB asset is required.

## Structure and behaviour

Coordinates use metres: x/z on the floor and y for height. `coordinates.origin`, `rotationY` and `bearing` position/orient the model and sun. `rooms` contains a reserved `Overview` target plus any named rooms. Physical objects have stable IDs, referenced by bindings; entity IDs are declared once in the inventory.

The supported geometry kinds are box, wall, wallRun, cylinder, sphere, rail, cabinet, chair, picture, radiator, opening, doorFrame, light, fan, halo and mesh (torus/cylinder/cone). Keep dimensions and all home-specific positions in the model file. Named materials resolve through its materials map. Wall runs reference openings so doorway moves retain their lintels and adjacent wall segments.

Bindings support light, fan, fanLight, opening, screen and pick. `onOffOnly: true` keeps a light's configured colour/intensity independent of reported brightness/RGB. Screen `activeStates` remains explicit. Labels support climate (including a separate humidity target), fridge, power, alarm, device, motion and contact, with existing inline/stacked climate styles and grouped readings. Names, room names and units remain user/integration data. Labels show unknown values as a dash, never zero. Taps and holds open native entity details; they do not command devices.

One finger scrolls the dashboard; two fingers rotate/zoom. The model fits the available card below its measured toolbar. Rendering pauses when hidden, offscreen or zero-sized, resumes from current state, and disposes observers, labels, controls and GPU resources when disconnected. Cached shadows and static geometry batching are retained. Sun direction is sampled once per model lifetime from the first valid configured `sun.*` entity, falling back to standard `sun.sun`; Scene lighting follows later solar-elevation updates, fading through twilight from brighter daytime lighting to dim nighttime ambient light. It never changes the background or theme. Missing sun data retains the last valid lighting level, initially nighttime lighting.

`examples/` contains three files for a **fictional studio** and is never imported into the production bundle. The collection gallery supplies those files locally as simulated responses, including when its HTML is opened offline. The example inventory names are placeholders, not discovered devices.

## Build and validation

Build with `npm run build --workspace @ikio/home-3d-card`. Standalone output preserves the local `chunks/` folder; HACS includes the viewer in the single collection bundle and requires no separate Three.js download. Three.js is bundled under MIT; notices and its full license accompany builds and the HACS asset.

DOM/model-double tests cover configuration, lifecycle, labels, geometry helpers, fitting, cached rendering and sun logic. Browser checks use the compiled card and software WebGL with fictional data; they do not establish native Home Assistant touch/WebGL support, physical-device behaviour or performance on a phone.
