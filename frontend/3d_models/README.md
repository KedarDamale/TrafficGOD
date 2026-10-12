# TrafficGod low-poly city assets

29 texture-free vehicle models, each with exactly one visible occupant, plus 11 building types. Units are metres, Y is up, +Z is forward, and wheels touch Y=0. Shapes evoke the requested models rather than reproduce manufacturer CAD. The supplied vehicle list is a design brief, not a verified sales ranking.

## Vehicles

- Cars: Baleno, Nexon, Punch, Fronx, Wagon R, Dzire, Creta, Swift, Scorpio, Ertiga.
- Two-wheelers: Splendor Plus, Activa, Jupiter, Shine, Pulsar, Apache, HF Deluxe, Classic 350, Access 125, XL100.
- Emergency: police patrol car, police motorcycle, ambulance, fire engine.
- Heavy vehicles: delivery truck, tipper, tanker, box semi trailer, flatbed semi trailer. Each articulated combination has one driver in its tractor and a movable trailer pivot.

Each car has an independent sculpted body with wheel arches, tapered cabin/window geometry, and its own lights and grille. The sedan boot, tall Wagon R, rugged Scorpio, coupe-like Fronx, and long Ertiga distinguish their silhouettes.

Civilian models support six paint options and custom colors. Emergency liveries remain fixed even when a paint override is supplied.

    import { createVehicle, animateVehicle, disposeVehicle } from './3d_models/index.js';

    const car = createVehicle('baleno', { colorIndex: 2 }); // 0–5
    scene.add(car);
    car.position.set(4, 0, 10);
    car.rotation.y = Math.PI / 2;
    animateVehicle(car, { deltaSeconds: dt, speed: 8, timeSeconds: elapsed });

    const semi = createVehicle('tractor-trailer', { color: '#506c92' });
    scene.add(semi);
    animateVehicle(semi, { deltaSeconds: dt, speed: 5, trailerAngle: 0.2 });

    disposeVehicle(car);
    disposeVehicle(semi);

Articulation is clamped to ±0.65 radians. Vehicle groups carry wheel, occupant, and beacon references in userData, and a trailerPivot for articulated models. Dimensions record approximate design dimensions; use THREE.Box3 for exact bounds including accessories.

Primitive geometry is shared across the fleet; materials belong to each instance. Call disposeVehicle rather than disposing shared geometry manually. Factories retain animation references; JSON exports use stable identifiers instead.

## Buildings

buildings/index.js exports BUILDINGS, createBuilding(id), and disposeBuilding(group). Available IDs:

- police-station: blue facade band, badge, portico, radio mast, security booth.
- fire-station: three engine bays, roller shutters, drill tower, apron markings.
- hospital: central ward tower, wings, ambulance canopy, crosses, rooftop helipad.
- clinic: smaller healthcare building with sign and canopy.
- bungalow: pitched roof, chimney, veranda, garden hedges, picket fence.
- villa: two-storey wing, balcony, courtyard pergola, swimming pool.
- low-rise-apartment: four storeys with balconies and roof utilities.
- mid-rise-apartment: eight storeys with balconies and roof utilities.
- office-tower: twelve storeys, curtain walls, lobby, stepped roof.
- corner-shop: shopfront, striped awning, planters.
- warehouse: pitched roof, loading dock, shutters, safety bollards.

    import { createBuilding, disposeBuilding } from './3d_models/buildings/index.js';
    const hospital = createBuilding('hospital');
    scene.add(hospital);
    disposeBuilding(hospital);

Entrances face +Z and the foundation rests at Y=0. Building geometry and materials are owned by each instance.

## Maps and exports

maps/city-map.js creates the large Mumbai-inspired coastal metropolis used by the simulation. This is a deterministic fictional map rather than actual Mumbai geography. City userData contains the road graph, service positions, and counts. Call city.setDetail(camera.zoom) to hide small details in the overview. City signals holds the instanced signal lenses for live color updates.

maps/neighborhood.js retains the smaller Ivory District through createNeighborhoodMap and disposeNeighborhoodMap.

Run from frontend, the only package root:

    npm run export:models

This writes standalone Three.js ObjectLoader JSON assets for every vehicle and building, plus the small neighborhood and manifest, to public/models. The large city is generated from source to avoid committing a huge static mesh.

    import { ObjectLoader } from 'three';
    const model = await new ObjectLoader().loadAsync('/models/baleno.json');
    scene.add(model);

The frontend now shows only the simulation. The old fleet inspector and GLB download UI have been removed. Use Three.js GLTFExporter in your integration when GLB is needed.

The [simulation guide](../simulation/README.md) describes the scripted ambulance dispatch, signal preemption, civilian response, and controller interface for a future trained policy.
