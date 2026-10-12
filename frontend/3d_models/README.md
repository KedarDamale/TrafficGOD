# TrafficGod low-poly fleet

29 texture-free, stylized Three.js models, each with exactly one visible occupant. All units are metres, Y is up, +Z is forward, and wheels touch Y=0. Shapes evoke the requested models rather than reproduce manufacturer CAD. The supplied model list is used as a design brief, not a verified sales ranking.

## Models

- Cars: Baleno, Nexon, Punch, Fronx, Wagon R, Dzire, Creta, Swift, Scorpio, Ertiga.
- Two-wheelers: Splendor Plus, Activa, Jupiter, Shine, Pulsar, Apache, HF Deluxe, Classic 350, Access 125, XL100.
- Emergency: police patrol car, police motorcycle, ambulance, fire engine.
- Heavy vehicles: delivery truck, tipper, tanker, box semi trailer, flatbed semi trailer. Each articulated combination has one driver in its tractor cab and a movable trailer pivot.

Civilian models support six paint options plus custom colors. Emergency liveries are fixed even when a paint override is supplied. Contrasting roofs, seats, tires, and accents retain their own colors.

## Use the factories

```js
import { createVehicle, animateVehicle, disposeVehicle } from './3d_models/index.js';
import { createCityMap, disposeCityMap } from './3d_models/maps/city-map.js';

const car = createVehicle('baleno', { colorIndex: 2 }); // 0–5
scene.add(car);
car.position.set(4, 0, 10);
car.rotation.y = Math.PI / 2;

// In your render loop; speed is m/s, times are seconds.
animateVehicle(car, { deltaSeconds: dt, speed: 8, timeSeconds: elapsed });

const semi = createVehicle('tractor-trailer', { color: '#506c92' });
scene.add(semi);
animateVehicle(semi, { deltaSeconds: dt, speed: 5, trailerAngle: 0.2 });
// Articulation is clamped to ±0.65 radians.

const city = createCityMap();
scene.add(city);

// When removing instances:
disposeVehicle(car);
disposeVehicle(semi);
disposeCityMap(city);
```

`VEHICLES`, `VEHICLE_IDS`, `getVehicleSpec`, and `PAINT_COLORS` are exported from `index.js`. Each factory returns a `THREE.Group` with wheel, occupant, and beacon references in `userData`, plus `trailerPivot` for articulated models. `dimensions` records approximate design dimensions; use `THREE.Box3` for exact bounds including riders, mirrors, and accessories.

Primitive geometry is shared across the fleet; materials are owned by each instance. Call `disposeVehicle` rather than disposing shared geometry manually. Factories retain animation references; static JSON/GLB exports use stable identifiers instead.

## Assets and exports

Run commands from `frontend`, which owns the only package manifest:

```sh
npm run export:models
```

This writes one native Three.js ObjectLoader JSON asset per model, the city map, and `manifest.json` to `public/models`. Load a saved asset with:

```js
import { ObjectLoader } from 'three';
const model = await new ObjectLoader().loadAsync('/models/baleno.json');
scene.add(model);
```

For GLB, select a model and paint in the frontend, then click **Export GLB**. GLB exports are standalone, include the occupant, and reset the root transform to the origin. The city view exports the currently selected fleet model. The procedural factory is recommended for animated traffic integration.

## Sample map

`maps/city-map.js` creates Ivory District: nine blocks, pale roads and sidewalks, residential buildings, a blue civic plaza, park, hospital, police station, fire station, parking marks, trees, benches, crosswalks, and signal poles. The full plinth is 96 × 96 metres. The frontend places 14 vehicles on its streets and uses an orthographic camera with soft shadows to echo the supplied isometric reference.

This is a visual asset and frontend preview. Vehicle motion is a demonstration loop; SUMO routing, signal orchestration, collision avoidance, and RL are future simulator work.
