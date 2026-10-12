import * as THREE from 'three';
import { createBuilding } from '../buildings/index.js';
/** Deterministic, texture-free ivory neighborhood; Y up, metre units, 90 × 90 m. */
export function createNeighborhoodMap() {
  const city = new THREE.Group(); city.name = 'ivory-district';
  city.userData = { blocks: 9, style: 'low-poly-isometric', extent: 90 };
  const geometries = new Map(), materials = new Map();
  const material = c => { if (!materials.has(c)) materials.set(c, new THREE.MeshStandardMaterial({color:c, roughness: .95, flatShading:true})); return materials.get(c); };
  const geom = (id, fn) => { if (!geometries.has(id)) geometries.set(id, fn()); return geometries.get(id); };
  function add(g, c, pos, size, name, parent = city) { const m = new THREE.Mesh(g, material(c)); m.position.set(...pos); m.scale.set(...size); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const box = (c, pos, size, name, p) => add(geom('box', () => new THREE.BoxGeometry(1,1,1)), c, pos, size, name, p);
  const cylinder = (c, pos, radius, height, name, p, n=8) => add(geom(`cyl-${n}`, () => new THREE.CylinderGeometry(1,1,1,n)), c, pos, [radius,height,radius], name, p);
  box('#e4e9ef', [0,-.65,0], [94,1.2,94], 'city-plinth');
  box('#d9e0e8', [0,-1.3,0], [96,.18,96], 'plinth-shadow');
  // Pale roads sit below raised sidewalks; lane marks give the street grid legibility.
  for (const t of [-44,-16,16,44]) {
    box('#d8dfe8', [t,.005,0], [6,.04,92], 'north-south-road');
    box('#d8dfe8', [0,.005,t], [92,.04,6], 'east-west-road');
    for (let i=-41; i<=41; i+=5) {
      if ([-44,-16,16,44].some(j => Math.abs(i-j)<5)) continue;
      box('#f7f9fb', [t,.032,i], [.09,.015,1.8], 'lane-dash');
      box('#f7f9fb', [i,.032,t], [1.8,.015,.09], 'lane-dash');
    }
  }
  function tree(x,z,scale=1) {
    const p = new THREE.Group(); p.name='tree'; p.position.set(x,.25,z); p.scale.setScalar(scale); city.add(p);
    cylinder('#aab8b9',[0,1,0],.16,2,'trunk',p,6);
    add(geom('crown',()=>new THREE.IcosahedronGeometry(1,0)), '#bac9c7',[0,2.45,0],[1.25,1.5,1.2],'tree-crown',p);
    add(geom('crown',()=>new THREE.IcosahedronGeometry(1,0)), '#cdd8d2',[.45,3,0],[.85,.9,.8],'tree-crown',p);
  }
  function placeBuilding(id, x, z, scale = 1, color) {
    const building = createBuilding(id, { color });
    building.position.set(x, .25, z); building.scale.setScalar(scale); city.add(building);
    return building;
  }
  for(const x of [-30,0,30]) for(const z of [-30,0,30]) {
    const width=x===0?25:21, depth=z===0?25:21;
    box('#f1f4f5',[x,.12,z],[width,.24,depth],'sidewalk-block');
    // Small roadside planting pockets and benches frame every city block.
    for(const side of [-1,1]) {
      for(const offset of [-7,7]) tree(x+side*(width/2-1.4),z+offset,.7);
      box('#ced9d8',[x+side*(width/2-1.2),.38,z],[1.3,.35,2.8],'planter');
      box('#b2bdc5',[x+side*(width/2-2.3),.7,z+3],[.55,.14,1.6],'bench');
    }
    const civic=(x===30 && Math.abs(z)===30)||(x===-30 && z===30);
    if(civic) {
      const id = z < 0 ? 'hospital' : x < 0 ? 'police-station' : 'fire-station';
      placeBuilding(id, x, z, .94);
      for(let i=0;i<4;i++) box('#d4dce3',[x-6+i*3.4,.28,z+8],[.06,.02,3],'parking-mark');
    } else if(x===0 && z===0) {
      placeBuilding('office-tower', -5.5, -3, .78, '#92a2df');
      placeBuilding('corner-shop', 5.5, 3, .94);
      box('#a7b4e0',[0,.45,9],[13,.3,2.2],'civic-plaza');
    } else if(x===-30 && z===0) {
      box('#e0e8e3',[x,.27,z],[13,.08,15],'park-lawn');
      box('#f6f5ef',[x,.33,z],[2,.04,17],'park-path');
      for(const dx of [-4,4]) for(const dz of [-5,1,5]) tree(x+dx,z+dz,1.1);
      cylinder('#c2dce3',[x,.53,z],2.3,.35,'fountain',city,16);
      cylinder('#edf3f4',[x,1.05,z],.35,1,'fountain-centre');
    } else {
      if(x===-30 && z===-30) {
        for(let i=0;i<4;i++) placeBuilding('bungalow', x+(i%2?4.6:-4.6), z+(i<2?-4.8:4.8), .70);
      } else if(x===0 && z===-30) {
        placeBuilding('mid-rise-apartment', -5.4, z, .72);
        placeBuilding('low-rise-apartment', 5.4, z+1, .76);
      } else if(x===0 && z===30) {
        placeBuilding('villa', 0, z, .95);
      } else {
        placeBuilding('warehouse', x, -5.8, .65);
        placeBuilding('clinic', x, 6.5, .74);
      }
    }
  }
  for(const x of [-16,16]) for(const z of [-16,16]) {
    for(const side of [-1,1]) {
      for(let i=0;i<6;i++) {
        box('#f6f8fa',[x-2.5+i,.038,z+side*4.1],[.55,.02,1.6],'crosswalk');
        box('#f6f8fa',[x+side*4.1,.038,z-2.5+i],[1.6,.02,.55],'crosswalk');
      }
      cylinder('#899baa',[x+side*4.3,1.5,z+4.3],.07,3,'signal-pole');
      box('#516577',[x+side*4.3,3,z+4.3],[.35,.7,.3],'signal-housing');
      cylinder(side<0?'#73b9a2':'#eb9d98',[x+side*4.3,3,z+4.47],.105,.05,'signal-light').rotation.x=Math.PI/2;
    }
  }
  return city;
}
export function disposeNeighborhoodMap(city) {
  const geometry=new Set(), materials=new Set();
  city.traverse(o=>{if(o.isMesh){geometry.add(o.geometry); materials.add(o.material);}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());city.removeFromParent();
}
