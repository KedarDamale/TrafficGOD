import * as THREE from 'three';
/** Deterministic, texture-free ivory neighborhood; Y up, metre units, 90 × 90 m. */
export function createCityMap() {
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
  function building(x,z,w,d,h,c='#f0f3f4',name='residential') {
    const p=new THREE.Group(); p.name=name; p.position.set(x,.27,z); city.add(p);
    box(c,[0,h/2,0],[w,h,d],'building',p);
    box('#e3e9ec',[0,h+.15,0],[w+.18,.3,d+.18],'roof-rim',p);
    box('#f4f6f7',[w*.12,h+.43,-d*.1],[w*.5,.32,d*.45],'rooftop',p);
    for (const side of [-1,1]) {
      for (let floor=1.2;floor<h-.5;floor+=1.8) {
        for (let a=-w*.32;a<=w*.33;a+=2) box('#d1dce2',[a,floor,side*(d/2+.012)],[.65,.7,.024],'window',p);
        for (let a=-d*.32;a<=d*.33;a+=2) box('#d1dce2',[side*(w/2+.012),floor,a],[.024,.7,.65],'window',p);
      }
    }
    box('#acbeca',[0,1,d/2+.03],[1.3,2,.03],'entry',p);
    return p;
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
      const medical=z<0, police=x<0, col=police?'#8594ea':'#e98689';
      const p=building(x,z,12,10,medical?7:5,col,medical?'hospital':police?'police-station':'fire-station');
      box(col,[5.8,1.5,2],[5,3,7],'service-wing',p);
      if(medical) {
        box('#fff8ee',[0,5,5.03],[.6,2.3,.06],'medical-cross',p);
        box('#fff8ee',[0,5,5.065],[2.3,.6,.06],'medical-cross',p);
      } else if(police) cylinder('#f2daa1',[0,3,5.1],.85,.07,'police-badge',p,6).rotation.x=Math.PI/2;
      else for(const dx of [-3,0,3]) box('#ba5a64',[dx,1.5,5.04],[2.3,2.6,.045],'fire-bay',p);
      for(let i=0;i<4;i++) box('#d4dce3',[x-6+i*3.4,.28,z+8],[.06,.02,3],'parking-mark');
    } else if(x===0 && z===0) {
      building(-4,-3,8,10,12,'#7c8fe9','blue-office');
      building(4,2,8,8,8,'#a2b0f0','creative-studio');
      box('#7c8fe9',[0,.6,9],[13,.6,2.2],'civic-plaza');
    } else if(x===-30 && z===0) {
      box('#e0e8e3',[x,.27,z],[13,.08,15],'park-lawn');
      box('#f6f5ef',[x,.33,z],[2,.04,17],'park-path');
      for(const dx of [-4,4]) for(const dz of [-5,1,5]) tree(x+dx,z+dz,1.1);
      cylinder('#c2dce3',[x,.53,z],2.3,.35,'fountain',city,16);
      cylinder('#edf3f4',[x,1.05,z],.35,1,'fountain-centre');
    } else {
      const heights=[4,6,8,5];
      for(let i=0;i<4;i++) building(x+(i%2?4.4:-4.4),z+(i<2?-4.4:4.4),6.2,6.6,heights[(i+Math.abs(x/30)+Math.abs(z/30))%4]);
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
export function disposeCityMap(city) {
  const geometry=new Set(), materials=new Set();
  city.traverse(o=>{if(o.isMesh){geometry.add(o.geometry); materials.add(o.material);}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());city.removeFromParent();
}
