import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VEHICLES, createVehicle, disposeVehicle } from '../3d_models/index.js';
import { createNeighborhoodMap, disposeNeighborhoodMap } from '../3d_models/maps/city-map.js';
import { BUILDINGS, createBuilding, disposeBuilding } from '../3d_models/buildings/index.js';
// Native Three.js ObjectLoader JSON. GLB export is available in the browser preview.
const out = fileURLToPath(new URL('../public/models/', import.meta.url));
await fs.mkdir(out, {recursive:true});
for (const spec of VEHICLES) {
  const model=createVehicle(spec.id);
  model.userData={ id:spec.id, label:spec.name, category:spec.category, paint:spec.color, occupantCount:1, forward:'+Z', units:'metres' };
  await fs.writeFile(path.join(out,`${spec.id}.json`), JSON.stringify(model.toJSON()));
  disposeVehicle(model);
}
for (const spec of BUILDINGS) {
  const building=createBuilding(spec.id);
  await fs.writeFile(path.join(out,spec.id+'.json'),JSON.stringify(building.toJSON()));
  disposeBuilding(building);
}
const city=createNeighborhoodMap();
await fs.writeFile(path.join(out,'ivory-district.json'),JSON.stringify(city.toJSON()));
disposeNeighborhoodMap(city);
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({ format:'THREE.ObjectLoader', models:VEHICLES.map(s=>({id:s.id,name:s.name,file:`${s.id}.json`,category:s.category})), buildings:BUILDINGS.map(s=>({id:s.id,name:s.name,file:s.id+'.json'})),map:'ivory-district.json',proceduralCity:'3d_models/maps/city-map.js' }, null,2));
console.log(`Exported ${VEHICLES.length} vehicle models, 11 buildings and Ivory District to ${out}`);
