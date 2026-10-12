import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBuilding, disposeBuilding, getBuildingSpec } from '../buildings/index.js';
import { CITY_BOUNDS,CITY_PARK,CITY_LAKE,CITY_AREA_FRACTION,PENINSULA,MAINLAND,isLand,isLake,isForest,seededRandom } from '../../simulation/city-layout.js';
import { createRoadNetwork,sampleRoad,nearestRoad,distance } from '../../simulation/road-network.js';
export { CITY_SCALE,CITY_AREA_FRACTION } from '../../simulation/city-layout.js';
export { createNeighborhoodMap,disposeNeighborhoodMap } from './neighborhood.js';

function ribbon(points,width,y) {
  const vertices=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],before=points[Math.max(0,i-2)],after=points[Math.min(points.length-1,i+1)];
    const normal=p=>{const length=Math.hypot(p.x,p.z);return{x:p.z/length*width/2,z:-p.x/length*width/2};};
    const na=normal({x:b.x-before.x,z:b.z-before.z}),nb=normal({x:after.x-a.x,z:after.z-a.z});
    const v=[[a.x-na.x,y,a.z-na.z],[a.x+na.x,y,a.z+na.z],[b.x+nb.x,y,b.z+nb.z],[b.x-nb.x,y,b.z-nb.z]];
    vertices.push(...v[0],...v[2],...v[1],...v[0],...v[3],...v[2]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
/** Dense 100-street coastal neighborhood with buildings filling the blocks. */
export function createCityMap() {
  const city=new THREE.Group();city.name='mumbai-inspired-city';
  const {nodes,roads}=createRoadNetwork(),rand=seededRandom(721),batches=new Map(),surfaces=new Map();
  const geometries={box:new THREE.BoxGeometry(1,1,1),crown:new THREE.IcosahedronGeometry(1,0),lens:new THREE.SphereGeometry(1,6,3),disc:new THREE.CylinderGeometry(1,1,1,12)};
  const roofShape=new THREE.Shape();roofShape.moveTo(-.5,0);roofShape.lineTo(0,1);roofShape.lineTo(.5,0);roofShape.closePath();
  geometries.gable=new THREE.ExtrudeGeometry(roofShape,{depth:1,bevelEnabled:false});geometries.gable.translate(0,0,-.5);
  const transform=new THREE.Object3D();
  function instance(kind,color,pos,size,angle=0){
    const key=[kind,color,Math.floor(pos[0]/600),Math.floor(pos[2]/600)].join(':');
    if(!batches.has(key))batches.set(key,{kind,color,matrices:[]});
    transform.position.set(...pos);transform.scale.set(...size);transform.rotation.set(0,angle,0);transform.updateMatrix();batches.get(key).matrices.push(transform.matrix.clone());
  }
  function surface(g,color){
    if(!surfaces.has(color))surfaces.set(color,[]);surfaces.get(color).push(g);
  }
  function polygon(points,color,y,name){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:1}));m.position.y=y;m.name=name;m.receiveShadow=true;city.add(m);
  }
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),new THREE.MeshStandardMaterial({color:'#b4cfde',roughness:1}));sea.rotation.x=-Math.PI/2;sea.position.y=-.15;sea.name='sea-and-harbor';city.add(sea);
  polygon(PENINSULA,'#edf0eb',.02,'peninsula');polygon(MAINLAND,'#e9eee8',.02,'mainland');
  for(const [name,area,color] of [['forest',CITY_PARK,'#c7d9c0'],['lake',CITY_LAKE,'#93bed5']]){
    const m=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshStandardMaterial({color,roughness:1,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-1}));
    m.rotation.x=-Math.PI/2;m.position.set(area.x,.07,area.z);m.scale.set(area.rx,area.rz,1);m.name=name;city.add(m);
  }
  let treeCount=0,buildingCount=0;const buildingPlots=[];
  function tree(x,z,size=5){
    instance('box','#a5b7aa',[x,size*.48,z],[.5,size,.5]);
    instance('crown','#b2c8b7',[x,size*1.25,z],[size*.65,size*.8,size*.65]);treeCount++;
  }
  for(const road of roads){
    const y=road.bridge?.5:.14;
    surface(ribbon(road.points,road.width+3,.095),'#e2e7e5');
    surface(ribbon(road.points,road.width,y),road.lanes===4?'#c4d1d9':road.lanes===1?'#dce0d8':'#d1dbe0');
    if(road.lanes>1)for(let along=14;along<road.length-14;along+=14){
      const p=sampleRoad(road,along);
      for(const offset of road.lanes===4?[-3.5,0,3.5]:[0])instance('box',offset===0&&road.lanes===4?'#ebe2ba':'#f5f5ea',[p.x+Math.cos(p.heading)*offset,y+.012,p.z-Math.sin(p.heading)*offset],[.12,.018,5],p.heading);
    }
    if(road.bridge)for(let along=20;along<road.length;along+=45){
      const p=sampleRoad(road,along);instance('box','#adbfca',[p.x,-1,p.z],[2.5,3,3],p.heading);
      for(const side of [-1,1])instance('box','#a4bccb',[p.x+Math.cos(p.heading)*side*(road.width/2+.4),1.1,p.z-Math.sin(p.heading)*side*(road.width/2+.4)],[.5,1.2,43],p.heading);
    }
    if(road.lanes===4)for(let along=30;along<road.length-30;along+=65){
      const p=sampleRoad(road,along);for(const side of [-1,1])tree(p.x+Math.cos(p.heading)*side*(road.width/2+7),p.z-Math.sin(p.heading)*side*(road.width/2+7),5);
    }
    // Each street's signature feature is attached to its own curve.
    const p=sampleRoad(road,road.length*.54),side=road.width/2+5;
    if(road.character==='Bazaar lane'){
      for(let j=0;j<4;j++)instance('box',['#d7a59a','#a7bccb','#d9c796','#abc3a9'][j],[p.x+Math.cos(p.heading)*(side+j*3.5),2.3,p.z-Math.sin(p.heading)*(side+j*3.5)],[3.2,.15,4],p.heading);
    }else if(road.character==='School street'){
      instance('box','#d4b572',[p.x+Math.cos(p.heading)*side,1.3,p.z-Math.sin(p.heading)*side],[.5,2.6,.5]);
    }else if(road.lanes===2){
      instance('box','#acc5cc',[p.x+Math.cos(p.heading)*side,2,p.z-Math.sin(p.heading)*side],[4,.15,2.5],p.heading);
      instance('box','#b0c0c6',[p.x+Math.cos(p.heading)*side,1,p.z-Math.sin(p.heading)*side],[3,.2,.7],p.heading);
    }
  }
  const services=[],districts=[...new Set(nodes.map(n=>n.district))];
  for(const district of districts){
    const local=roads.filter(r=>r.district===district&&!r.bridge);
    for(const [k,type] of ['hospital','fire-station','police-station'].entries()){
      let poi;
      for(let attempt=0;attempt<400&&!poi;attempt++){
        const road=local[(attempt+k*3)%local.length],along=road.length*(.2+rand()*.6),p=sampleRoad(road,along),side=attempt%2?-1:1,offset=road.width/2+34;
        const x=p.x+Math.cos(p.heading)*offset*side,z=p.z-Math.sin(p.heading)*offset*side;
        if(!isLand(x,z)||isLake(x,z)||isForest(x,z)||nearestRoad(roads,x,z).distance<27||services.some(s=>Math.hypot(s.x-x,s.z-z)<76))continue;
        const yaw=Math.atan2(p.x-x,p.z-z),scale=1.5,entry={x:x+Math.sin(yaw)*17,z:z+Math.cos(yaw)*17};
        const toA=along<road.length/2,tail=toA?road.points.filter(q=>q.distance<along).reverse():road.points.filter(q=>q.distance>along);
        const connector=[entry,{x:p.x,z:p.z,roadId:road.id},...tail.map(q=>({x:q.x,z:q.z,...(q.node?{id:q.node}:{}),roadId:road.id}))];
        const name=district+' '+({'hospital':'Rugnalaya','fire-station':'Agnishaman Kendra','police-station':'Police Thane'}[type]);
        const spec=getBuildingSpec(type);
        poi={id:type+':'+district,name,type,district,x,z,yaw,scale,width:spec.width*scale,depth:spec.depth*scale,height:spec.height*scale,roadId:road.id,roadName:road.name,roadNode:toA?road.a:road.b,entrance:entry,connector};
      }
      if(!poi)throw new Error('Could not place '+type+' in '+district);
      services.push(poi);
    }
  }
  const detailed=new Map();
  for(const poi of services){
    const b=createBuilding(poi.type);b.position.set(poi.x,.15,poi.z);b.rotation.y=poi.yaw;b.scale.setScalar(poi.scale);b.updateMatrixWorld(true);
    b.traverse(o=>{
      if(!o.isMesh)return;
      let g=o.geometry.clone();if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
      for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
      g.applyMatrix4(o.matrixWorld);const key=o.material.color.getHexString();if(!detailed.has(key))detailed.set(key,[]);detailed.get(key).push(g);
    });
    disposeBuilding(b);buildingCount++;
    instance('box',poi.type==='police-station'?'#d2dbef':'#ead6d1',[poi.x,.07,poi.z],[48,.06,44],poi.yaw);
  }
  for(const [color,list] of detailed){const g=mergeGeometries(list,false);list.forEach(g=>g.dispose());const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#'+color,roughness:.9,flatShading:true}));m.name='service-buildings';city.add(m);}
  const occupied=new Map(),colors=['#e4e9e6','#e0e7e9','#ede8dc','#d6e1e0','#d9e2e8'];
  const buildingNames=['Shivkrupa','Sahyadri','Matoshri','Shivneri','Rajgad','Raigad','Pratapgad','Tulsi','Ganesh','Gokul','Vrindavan','Saraswati','Sukhshanti','Anand','Samarth','Mauli','Jijau','Vitthal','Dnyaneshwar','Chaitanya','Mangal','Nandadeep','Pragati','Yashwant'];
  const nameCounts=new Map();
  function placeHouse(x,z,w,d,h,yaw,style){
    const r=Math.hypot(w,d)/2;
    if(!isLand(x,z)||!isLand(x-r,z)||!isLand(x+r,z)||!isLand(x,z-r)||!isLand(x,z+r)||isLake(x,z)||isForest(x,z)||services.some(s=>Math.hypot(s.x-x,s.z-z)<38+r))return false;
    const near=nearestRoad(roads,x,z);if(near.distance<near.road.width/2+r+2)return false;
    const bx=Math.floor(x/50),bz=Math.floor(z/50);
    for(let i=bx-1;i<=bx+1;i++)for(let j=bz-1;j<=bz+1;j++)if((occupied.get(i+':'+j)||[]).some(o=>Math.hypot(o.x-x,o.z-z)<r+o.r+2))return false;
    const key=bx+':'+bz;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({x,z,r});
    instance('box',colors[Math.floor(rand()*colors.length)],[x,h/2+.15,z],[w,h,d],yaw);
    if(style==='bungalow'||style==='warehouse')instance('gable','#a8bdc8',[x,h+.15,z],[w+.8,style==='warehouse'?2:2.6,d+.8],yaw);
    else instance('box','#f0f2eb',[x,h+.25,z],[w+.5,.4,d+.5],yaw);
    const front={x:x+Math.sin(yaw)*(d/2+.04),z:z+Math.cos(yaw)*(d/2+.04)};
    instance('box','#b3c9d4',[front.x,h*.54,front.z],[w*.68,h*.45,.06],yaw);
    if(style==='apartment')for(let floor=3;floor<h;floor+=4)instance('box','#dae4e5',[front.x,floor,front.z],[w*.75,.18,1.3],yaw);
    if(style==='bungalow')instance('box','#e6ebe2',[front.x,2.3,front.z],[w*.55,.12,2],yaw);
    const index=buildingPlots.length,suffix=style==='bungalow'?'Niwas':style==='warehouse'?'Godam':['Sadan','Sankul','Apartments','Heights'][Math.floor(index/buildingNames.length)%4];
    const baseName=buildingNames[index%buildingNames.length]+' '+suffix,count=(nameCounts.get(baseName)||0)+1;nameCounts.set(baseName,count);
    const name=baseName+(count>1?' · Wing '+count:'');
    buildingPlots.push({id:'B'+String(index+1).padStart(4,'0'),name,district:near.road.district,roadId:near.road.id,roadName:near.road.name,x,z,width:w,depth:d,height:h,radius:r,yaw,style});buildingCount++;return true;
  }
  for(const road of roads){
    if(road.bridge)continue;
    for(let along=22;along<road.length-22;along+=22+rand()*6)for(const side of [-1,1])for(let row=0;row<3;row++){
      const p=sampleRoad(road,along),w=12+rand()*9,d=13+rand()*10,offset=road.width/2+d/2+5+row*28;
      const x=p.x+Math.cos(p.heading)*offset*side,z=p.z-Math.sin(p.heading)*offset*side,yaw=p.heading-side*Math.PI/2;
      const style=road.lanes===1&&row===0?'bungalow':rand()<.12?'warehouse':'apartment',h=style==='bungalow'?3.5:style==='warehouse'?6:9+Math.floor(rand()*9)*4;
      placeHouse(x,z,w,d,h,yaw,style);
      if(row===0&&rand()<.18&&isLand(x,z))tree(p.x+Math.cos(p.heading)*side*(road.width/2+4),p.z-Math.sin(p.heading)*side*(road.width/2+4),3.5);
    }
  }
  // Fill block interiors too; reducing road count must not leave an empty city.
  for(let z=CITY_BOUNDS.minZ+18;z<CITY_BOUNDS.maxZ;z+=25)for(let x=CITY_BOUNDS.minX+18;x<CITY_BOUNDS.maxX;x+=25){
    const px=x+(rand()-.5)*7,pz=z+(rand()-.5)*7,near=nearestRoad(roads,px,pz);
    if(near.distance>170)continue;
    const p=sampleRoad(near.road,near.along);
    placeHouse(px,pz,12+rand()*9,13+rand()*9,9+Math.floor(rand()*10)*4,p.heading-Math.PI/2,'apartment');
  }
  for(let k=0;k<45;k++){const x=CITY_PARK.x+(rand()-.5)*CITY_PARK.rx*2,z=CITY_PARK.z+(rand()-.5)*CITY_PARK.rz*2;if(isForest(x,z)&&!isLake(x,z))tree(x,z,5+rand()*3);}
  for(const [color,list] of surfaces){const g=mergeGeometries(list,false);list.forEach(g=>g.dispose());const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1}));m.name='curved-road-surfaces';city.add(m);}
  const signalMatrices=[],signalNodes=[],intersections=nodes.filter(n=>n.neighbors.length>=3);
  // Small paved aprons join the curved road ribbons, including unsignalled
  // corners and cul-de-sacs. Turning paths must remain on actual pavement.
  for(const n of nodes){
    const connected=roads.filter(r=>r.a===n.id||r.b===n.id);
    n.junctionRadius=Math.max(...connected.map(r=>r.width))*.6+2;
    instance('disc','#cad7de',[n.x,.14,n.z],[n.junctionRadius,.04,n.junctionRadius]);
  }
  for(const n of intersections){
    const approaches=roads.filter(r=>r.a===n.id||r.b===n.id);
    for(const road of approaches){
      const p=sampleRoad(road,road.a===n.id?12:road.length-12),side=road.a===n.id?1:-1,offset=road.width/2+.8;
      const x=p.x+Math.cos(p.heading)*offset*side,z=p.z-Math.sin(p.heading)*offset*side;
      instance('box','#92a7b3',[x,2.6,z],[.2,5.2,.2]);instance('box','#536e80',[x,5,z],[.7,1.45,.6],p.heading);
      transform.position.set(x,5,z);transform.scale.set(.26,.26,.26);transform.rotation.set(0,0,0);transform.updateMatrix();signalMatrices.push(transform.matrix.clone());signalNodes.push({node:n.id,road:road.id,axis:Math.abs(Math.sin(p.heading))>Math.abs(Math.cos(p.heading))?'x':'z'});
      for(let stripe=0;stripe<Math.floor(road.width/1.6);stripe++)instance('box','#f4f4e9',[p.x+Math.cos(p.heading)*(-road.width/2+stripe*1.6+.7),.17,p.z-Math.sin(p.heading)*(-road.width/2+stripe*1.6+.7)],[.8,.02,3.2],p.heading);
    }
    n.signal=signalMatrices.length-1;
  }
  for(const [key,b] of batches){
    const m=new THREE.InstancedMesh(geometries[b.kind],new THREE.MeshStandardMaterial({color:b.color,roughness:.9,flatShading:true}),b.matrices.length);
    m.name='city-batch:'+key;b.matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();city.add(m);
  }
  const signals=new THREE.InstancedMesh(geometries.lens,new THREE.MeshBasicMaterial({color:'#ffffff'}),signalMatrices.length);
  signalMatrices.forEach((m,i)=>{signals.setMatrixAt(i,m);signals.setColorAt(i,new THREE.Color(i%2?'#dc7a76':'#58a989'));});
  signals.instanceMatrix.needsUpdate=true;signals.instanceColor.needsUpdate=true;signals.name='traffic-signals';city.add(signals);city.signals=signals;city.setDetail=()=>{};
  city.userData={id:city.name,seed:721,areaFraction:CITY_AREA_FRACTION,nodes,roads,services,signalNodes,buildingPlots,stats:{roads:roads.length,intersections:intersections.length,signals:signalMatrices.length,buildings:buildingCount,trees:treeCount,districts:districts.length,services:services.length,lanes:roads.reduce((counts,r)=>(counts[r.lanes]=(counts[r.lanes]||0)+1,counts),{})},bounds:{...CITY_BOUNDS}};
  return city;
}
export function disposeCityMap(city){
  const geometries=new Set(),materials=new Set();city.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);if(o.isInstancedMesh)o.dispose();}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());city.removeFromParent();
}
