import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, createBuilding, disposeBuilding } from '../buildings/index.js';
export { createNeighborhoodMap, disposeNeighborhoodMap } from './neighborhood.js';

// A fictional Mumbai-inspired peninsula and mainland, not surveyed OSM geography.
const PENINSULA = [[-3500,-11500],[1300,-11500],[2000,-9300],[1600,-7000],[1400,-5300],[800,-3800],[1400,-2400],[900,-500],[1200,1200],[500,3000],[600,4300],[-100,5600],[100,6500],[-600,8600],[-1200,10700],[-2000,11200],[-2300,9500],[-2800,7200],[-2400,4800],[-3000,2900],[-3300,600],[-3700,-1200],[-3300,-3400],[-4000,-5800],[-3500,-7900],[-3900,-9300]];
const MAINLAND = [[2500,-11500],[5700,-11500],[5700,6000],[5200,6000],[4500,4000],[3800,2800],[3200,1000],[2800,-1400],[2100,-3700],[2600,-6100],[2000,-8800]];
function inside(x,z,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z) && x<(xj-xi)*(z-zi)/(zj-zi)+xi) result=!result;
  }
  return result;
}
const land=(x,z)=>inside(x,z,PENINSULA)||inside(x,z,MAINLAND);
const lake=(x,z)=>((x-400)/650)**2+((z+6100)/450)**2<1;
const forest=(x,z)=>((x+1200)/1350)**2+((z+8900)/2000)**2<1;
function random(seed) {let v=seed>>>0;return()=>{v=(1664525*v+1013904223)>>>0;return v/4294967296;};}

/** Large deterministic, car-free base map. Road graph and service metadata power the demo controller. */
export function createCityMap() {
  const city=new THREE.Group();city.name='mumbai-inspired-city';
  const rand=random(721), batches=new Map(), nodes=[], roads=[], cells=[], services=[];
  const roofShape=new THREE.Shape();roofShape.moveTo(-.5,0);roofShape.lineTo(0,1);roofShape.lineTo(.5,0);roofShape.closePath();
  const gable=new THREE.ExtrudeGeometry(roofShape,{depth:1,bevelEnabled:false});gable.translate(0,0,-.5);
  const geometries={box:new THREE.BoxGeometry(1,1,1),gable,crown:new THREE.IcosahedronGeometry(1,0),lens:new THREE.SphereGeometry(1,6,3)};
  const transform=new THREE.Object3D();
  function instance(kind,color,pos,size,angle=0) {
    const key=`${kind}:${color}:${Math.floor(pos[0]/1800)}:${Math.floor(pos[2]/1800)}`;
    if(!batches.has(key)) batches.set(key,{kind,color,matrices:[]});
    transform.position.set(...pos);transform.scale.set(...size);transform.rotation.set(0,angle,0);transform.updateMatrix();
    batches.get(key).matrices.push(transform.matrix.clone());
  }
  function segment(a,b,width,y,color,name='road') {
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    instance('box',color,[(a.x+b.x)/2,y,(a.z+b.z)/2],[width,.08,length],Math.atan2(dx,dz));
  }
  function polygon(points,color,y,name) {
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:3}));m.position.y=y;m.name=name;m.receiveShadow=true;city.add(m);
  }
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000),new THREE.MeshStandardMaterial({color:'#a9c9dc',roughness:1}));sea.rotation.x=-Math.PI/2;sea.position.y=-.12;sea.name='arabian-sea-and-harbor';city.add(sea);
  polygon(PENINSULA,'#eef0ec',.02,'peninsula');polygon(MAINLAND,'#ecefe9',.02,'mainland');
  const park=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshStandardMaterial({color:'#c5d7be',roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3}));park.rotation.x=-Math.PI/2;park.position.set(-1200,.07,-8900);park.scale.set(1350,2000,1);park.name='northern-forest';city.add(park);
  const water=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshStandardMaterial({color:'#91bcd4',roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3}));water.rotation.x=-Math.PI/2;water.position.set(400,.08,-6100);water.scale.set(650,450,1);water.name='inland-lake';city.add(water);
  const STEP=180, X=-5000, Z=-11520, COLS=60, ROWS=128, lookup=new Map();
  for(let i=0;i<=COLS;i++)for(let j=0;j<=ROWS;j++) {
    const x=X+i*STEP,z=Z+j*STEP;
    if(!land(x,z)||lake(x,z)||forest(x,z)) continue;
    const n={id:`${i}:${j}`,x,z,i,j,neighbors:[],signal:null};lookup.set(n.id,n);nodes.push(n);
  }
  function connect(a,b,arterial=false,bridge=false) {
    const width=arterial?22:12;
    roads.push({a:a.id,b:b.id,width,bridge,length:Math.hypot(a.x-b.x,a.z-b.z)});a.neighbors.push(b.id);b.neighbors.push(a.id);
    segment(a,b,width,bridge?.4:.07,arterial?'#ced7de':'#d8dfe3');
    if(arterial) segment(a,b,.25,bridge?.47:.13,'#f4f4e9');
    if(bridge) {
      const distance=Math.hypot(a.x-b.x,a.z-b.z),count=Math.floor(distance/140);
      for(let k=1;k<count;k++){const t=k/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;instance('box','#b9c8cf',[x,-1,z],[3,3,4]);}
      for(const side of [-1,1]) {const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);segment({x:a.x+side*dz/d*10,z:a.z-side*dx/d*10},{x:b.x+side*dz/d*10,z:b.z-side*dx/d*10},.8,1.4,'#b7c8d1');}
    }
  }
  for(const n of nodes) for(const [di,dj] of [[1,0],[0,1]]) {
    const next=lookup.get(`${n.i+di}:${n.j+dj}`);
    if(next && land((n.x+next.x)/2,(n.z+next.z)/2)) connect(n,next,di===1?n.j%8===0:n.i%7===0);
  }
  const closest=(x,z,predicate=()=>true)=>nodes.filter(predicate).reduce((best,n)=>!best||Math.hypot(n.x-x,n.z-z)<Math.hypot(best.x-x,best.z-z)?n:best,null);
  const west=closest(-1600,4500,n=>n.x<1500),east=closest(4800,4500,n=>n.x>2500);
  connect(west,east,true,true);
  const coastalA=closest(-3100,1200,n=>n.x<0),coastalB=closest(-2500,6600,n=>n.x<0);
  const via={id:'sea-link',x:-3900,z:4100,neighbors:[],signal:null};nodes.push(via);lookup.set(via.id,via);connect(coastalA,via,true,true);connect(via,coastalB,true,true);
  for(let i=0;i<COLS;i++)for(let j=0;j<ROWS;j++) {
    const corners=[lookup.get(`${i}:${j}`),lookup.get(`${i+1}:${j}`),lookup.get(`${i}:${j+1}`),lookup.get(`${i+1}:${j+1}`)];
    if(corners.some(n=>!n)) continue;
    const x=X+(i+.5)*STEP,z=Z+(j+.5)*STEP;if(!land(x,z)||lake(x,z)||forest(x,z))continue;
    cells.push({id:`lot:${i}:${j}`,x,z,i,j});
  }
  // Every inhabited district receives all three emergency services on separate blocks.
  const districts=new Map();
  for(const c of cells) {const id=`${Math.floor(c.i/10)}:${Math.floor(c.j/12)}`;if(!districts.has(id))districts.set(id,[]);districts.get(id).push(c);}
  const serviceCells=new Set();
  for(const [district,list] of districts) {
    const spread=[.2,.5,.8];
    ['hospital','fire-station','police-station'].forEach((type,k)=>{
      const c=list[Math.min(list.length-1,Math.floor(list.length*spread[k]))];
      const offsets=list.length<3?[[-42,-30],[42,-30],[0,40]][k]:[0,0];
      const x=c.x+offsets[0],z=c.z+offsets[1];
      serviceCells.add(c.id);services.push({scale:list.length<3?1.3:2.8,id:`${type}:${district}`,type,district,x,z,roadNode:closest(x,z+(list.length<3?20:35)).id,entrance:{x,z:z+(list.length<3?20:35)}});
    });
  }
  let buildingCount=0,treeCount=0;
  const colors=['#e8ebe8','#e5e9ea','#f0ede4','#dde5e5','#dce3e8','#cbd8df'];
  function tree(x,z,size=5) {instance('box','#acb8af',[x,size*.48,z],[.55,size,.55]);instance('crown','#b9ccbe',[x,size*1.25,z],[size*.62,size*.85,size*.62]);treeCount++;}
  for(const c of cells) {
    instance('box','#f5f5ed',[c.x,.055,c.z],[STEP-18,.07,STEP-18]);
    if(serviceCells.has(c.id))continue;
    const small=c.z>4200,industrial=c.x>2800&&c.z>0;
    for(let i=0;i<3;i++)for(let j=0;j<3;j++) {
      if(i===1&&j===1&&rand()<.45){tree(c.x,c.z,8);continue;}
      const x=c.x+(i-1)*48+(rand()-.5)*8,z=c.z+(j-1)*48+(rand()-.5)*8;
      const w=industrial?30:14+rand()*13,d=industrial?33:14+rand()*14;
      const h=industrial?10:small?5+rand()*8:8+Math.floor(rand()*8)*4;
      instance('box',colors[Math.floor(rand()*colors.length)],[x,h/2+.15,z],[w,h,d]);
      if(small||industrial)instance('gable','#b1c1ca',[x,h+.15,z],[w+1.2,industrial?3:2.5,d+1.2]);
      else instance('box','#f3f4ed',[x,h+.3,z],[w+.8,.5,d+.8]);
      instance('box','#c2d1d8',[x,h*.55,z+d/2+.12],[w*.70,h*.52,.15]);
      instance('box','#c2d1d8',[x+w/2+.12,h*.55,z],[.15,h*.52,d*.70]);
      for(let floor=3;floor<h-1;floor+=5) instance('box','#e2e7e7',[x,floor,z+d/2+.23],[w*.75,.4,.12]);
      if(h>16)instance('box','#cbd7db',[x+w*.16,h+1,z-d*.15],[w*.25,1.5,d*.25]);
      else if(small) instance('box','#ecece4',[x,2.4,z+d*.55],[w*.55,.15,3]);
      buildingCount++;
    }
    for(const dx of [-67,67])for(const dz of [-61,61])tree(c.x+dx,c.z+dz,4+rand()*3);
  }
  for(let k=0;k<1600;k++){const x=-1200+(rand()-.5)*2600,z=-8900+(rand()-.5)*3900;if(forest(x,z)&&land(x,z))tree(x,z,7+rand()*7);}
  // Flatten the detailed service buildings by material to keep draw calls low at city scale.
  const detailed=new Map();
  for(const poi of services) {
    const s=BUILDINGS.find(b=>b.id===poi.type),b=createBuilding(poi.type);b.position.set(poi.x,.15,poi.z);b.scale.setScalar(poi.scale);b.updateMatrixWorld(true);
    b.traverse(o=>{
      if(!o.isMesh)return;
      let g=o.geometry.clone();if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
      for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
      g.applyMatrix4(o.matrixWorld);const color=o.material.color.getHexString(),key=color+':'+poi.district;if(!detailed.has(key))detailed.set(key,[]);detailed.get(key).push(g);
    });
    disposeBuilding(b);buildingCount++;
    instance('box',poi.type==='police-station'?'#d4dbf0':poi.type==='hospital'?'#eadcda':'#ecd4cc',[poi.x,.085,poi.z],[poi.scale<2?74:150,.06,poi.scale<2?74:150]);
    // Flags identify the service campuses from the wide city view.
    instance('box','#b2bec4',[poi.x+(poi.scale<2?28:54),20,poi.z+(poi.scale<2?28:50)],[1,40,1]);
    instance('box',s.color,[poi.x+(poi.scale<2?37:63),38,poi.z+(poi.scale<2?28:50)],[20,12,.8]);
  }
  for(const [key,list] of detailed) {
    const color=key.split(':')[0];
    const g=mergeGeometries(list,false);list.forEach(g=>g.dispose());
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:`#${color}`,roughness:.92,flatShading:true}));m.name='emergency-service-buildings';m.castShadow=true;m.receiveShadow=true;city.add(m);
  }
  const intersections=nodes.filter(n=>n.neighbors.length>=3),signalMatrices=[],signalNodes=[];
  for(const n of intersections) {
    instance('box','#e2e8e8',[n.x,.11,n.z],[13,.06,13]);
    for(let i=0;i<4;i++) {instance('box','#f7f7ed',[n.x-4+i*2.5,.13,n.z+9],[1.15,.03,4]);instance('box','#f7f7ed',[n.x+9,.13,n.z-4+i*2.5],[4,.03,1.15]);}
    for(const side of [-1,1]) {
      const x=n.x+side*9,z=n.z+9;
      instance('box','#9baeb8',[x,2.5,z],[.24,5,.24]);instance('box','#60788a',[x,5,z],[.75,1.6,.65]);
      transform.position.set(x,5,z+.38);transform.scale.set(.23,.23,.12);transform.rotation.set(0,0,0);transform.updateMatrix();signalMatrices.push(transform.matrix.clone());signalNodes.push({node:n.id,axis:side<0?'x':'z'});
    }
    n.signal=signalMatrices.length-2;
  }
  for(const [key,b] of batches) {
    const mesh=new THREE.InstancedMesh(geometries[b.kind],new THREE.MeshStandardMaterial({color:b.color,roughness:.92,flatShading:true}),b.matrices.length);
    mesh.userData.detailOnly=['#c2d1d8','#e2e7e7','#cbd7db','#9baeb8','#60788a','#f7f7ed','#f3f4ed','#acb8af'].includes(b.color);
    mesh.name=`city-batch:${key}`;b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.castShadow=b.kind!=='box'||!key.includes('#d8dfe3');mesh.computeBoundingSphere();city.add(mesh);
  }
  const signals=new THREE.InstancedMesh(geometries.lens,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.5}),signalMatrices.length);signals.name='traffic-signal-lenses';
  const green=new THREE.Color('#60ad87'),red=new THREE.Color('#df847d');
  signalMatrices.forEach((m,i)=>{signals.setMatrixAt(i,m);signals.setColorAt(i,i%2?red:green);});signals.instanceMatrix.needsUpdate=true;signals.instanceColor.needsUpdate=true;city.add(signals);
  city.userData={id:city.name,description:'Stylized procedural Mumbai-inspired coastal metropolis',seed:721,nodes,roads,services,signalNodes,stats:{roads:roads.length,intersections:intersections.length,signals:signalMatrices.length,buildings:buildingCount,trees:treeCount,districts:districts.size,services:services.length},bounds:{width:10700,length:23000}};
  // Runtime handles are not included in exported userData.
  city.signals=signals;
  let detailedView=null;
  city.setDetail=zoom=>{
    const detail=zoom>3;
    if(detail===detailedView)return;
    detailedView=detail;
    for(const child of city.children)if(child.userData.detailOnly)child.visible=detail;
    signals.visible=detail;
  };
  return city;
}
export function disposeCityMap(city) {
  const geometry=new Set(),materials=new Set();city.traverse(o=>{if(o.isMesh){geometry.add(o.geometry);materials.add(o.material);if(o.isInstancedMesh)o.dispose();}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());city.removeFromParent();
}
