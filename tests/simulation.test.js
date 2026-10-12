import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCityMap,disposeCityMap } from '../3d_models/maps/city-map.js';
import { BUILDINGS,createBuilding,disposeBuilding } from '../3d_models/buildings/index.js';
import { VEHICLES,createVehicle,disposeVehicle } from '../3d_models/index.js';
import { AmbulanceDemoController,CivilianTraffic,chooseLocations,TRAFFIC_COUNT } from '../simulation/demo-controller.js';
import { FleetRenderer } from '../simulation/fleet-renderer.js';
import { findRoute } from '../simulation/graph.js';
import { nearestRoad } from '../simulation/road-network.js';
import { createBuildingPicker } from '../simulation/building-selection.js';

test('ten cars have distinct cabin silhouettes even after removing scale and paint',()=>{
  const signatures=new Set();
  for(const s of VEHICLES.filter(s=>s.category==='cars')){
    const v=createVehicle(s.id),p=v.getObjectByName('side-glass').geometry.attributes.position;
    signatures.add(Array.from(p.array,(value,i)=>Number((value/[s.width,s.height,s.length][i%3]).toFixed(3))).join(','));
    disposeVehicle(v);
  }
  assert.equal(signatures.size,10);
});

test('all building models have finite grounded geometry and visible identifying features',()=>{
  for(const s of BUILDINGS){
    const b=createBuilding(s.id),bounds=new THREE.Box3().setFromObject(b);
    assert.equal(bounds.min.y,0);
    assert.ok(bounds.max.y>2);
    b.traverse(o=>{if(o.isMesh)for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
    if(['fire-station','hospital','police-station','clinic'].includes(s.id))assert.ok(b.getObjectByName('sign-text'));
    disposeBuilding(b);
  }
});

test('city physically shrinks around 100 curved streets and fills its blocks with named buildings',()=>{
  const city=createCityMap(),map=city.userData;
  assert.equal(map.stats.roads,100);
  assert.ok(map.bounds.width<=1400&&map.bounds.length<=1550);
  assert.ok(map.bounds.width*map.bounds.length<.15*(10700*23000*.08),'City footprint must shrink too');
  assert.equal(new Set(map.roads.map(r=>r.name)).size,100);
  assert.deepEqual([...new Set(map.roads.map(r=>r.lanes))].sort(),[1,2,4]);
  for(const road of map.roads){
    const a=road.points[0],b=road.points.at(-1),mid=road.points[8];
    assert.ok(Math.abs((b.x-a.x)*(mid.z-a.z)-(b.z-a.z)*(mid.x-a.x))>.005*Math.hypot(b.x-a.x,b.z-a.z)**2,'Road must curve');
  }
  assert.ok(map.stats.buildings>1000);
  assert.ok(map.stats.buildings/(map.bounds.width*map.bounds.length/1e6)>450);
  const buildings=[...map.buildingPlots,...map.services];
  assert.equal(buildings.length,map.stats.buildings);
  assert.equal(new Set(buildings.map(b=>b.name)).size,buildings.length);
  for(const b of buildings)assert.ok(b.name&&b.district&&b.roadName);
  for(const b of map.buildingPlots){const near=nearestRoad(map.roads,b.x,b.z);assert.ok(near.distance>=near.road.width/2+b.radius+1.99);}
  const districts=new Map();
  for(const s of map.services){if(!districts.has(s.district))districts.set(s.district,new Set());districts.get(s.district).add(s.type);}
  assert.equal(districts.size,map.stats.districts);
  assert.ok(districts.has('Tilak Nagar')&&districts.has('Shivaji Nagar'));
  for(const types of districts.values())assert.deepEqual([...types].sort(),['fire-station','hospital','police-station']);
  assert.equal(city.getObjectByName('ambulance'),undefined);
  const graph=new Map(map.nodes.map(n=>[n.id,n]));
  for(const road of map.roads){assert.ok(graph.get(road.a).neighbors.includes(road.b));assert.ok(graph.get(road.b).neighbors.includes(road.a));}
  disposeCityMap(city);
});

test('all location and event choices finish one hospital-incident-hospital round trip',()=>{
  const city=createCityMap(),map=city.userData,locations=chooseLocations(map);
  for(const location of locations)for(const event of ['ambulance','fire','accident','closure','flood','signal','congestion']){
    const c=new AmbulanceDemoController(map);
    assert.equal(c.start(location.node,event),true);
    assert.equal(c.start(location.node,event),false);
    assert.ok(c.priorities.size>0);
    const before=c.snapshot();c.paused=true;c.tick(1);assert.deepEqual(c.snapshot(),{...before,paused:true});c.paused=false;
    const phases=new Set();
    for(let i=0;i<1500&&c.phase!=='completed';i++){phases.add(c.phase);c.tick(.25);}
    assert.equal(c.phase,'completed',location.name);
    assert.ok(phases.has('at-incident')&&phases.has('returning'));
    assert.equal(c.priorities.size,0);
    assert.equal(c.snapshot().progress,1);
    assert.ok(Math.hypot(c.pose.x-c.hospital.entrance.x,c.pose.z-c.hospital.entrance.z)<.001);
  }
  assert.equal(findRoute(map.nodes,locations[0].node,locations.at(-1).node)?.length>0,true);
  disposeCityMap(city);
});

test('ambulance green wave stops cross traffic and keeps its own road moving without sideways jumps',()=>{
  const nodes=[{id:'w',x:-150,z:0,signal:null},{id:'j',x:0,z:0,signal:0},{id:'e',x:150,z:0,signal:null},{id:'n',x:0,z:-150,signal:null}];
  const roads=[{id:'W',a:'w',b:'j'},{id:'E',a:'j',b:'e'},{id:'N',a:'n',b:'j'}],traffic=new CivilianTraffic({nodes,roads},[],2);
  const [corridor,cross]=traffic.agents;
  Object.assign(corridor,{kind:'car',road:'W',a:'w',b:'j',t:.88,offset:1.75});
  Object.assign(cross,{kind:'car',road:'N',a:'n',b:'j',t:.88,offset:1.75});
  const controller={timeScale:6,clock:0,pose:{x:-18,z:0},phase:'outbound',priorities:new Map([['j',{roads:['W','E']}]])};
  traffic.tick(.1,controller);
  assert.equal(cross.stopped,true);assert.equal(cross.t,.88);
  assert.equal(corridor.stopped,false);assert.ok(corridor.road!=='W'||corridor.t>.88);assert.ok(corridor.pose.x>-18);
  assert.equal(cross.offset,1.75);assert.equal(corridor.offset,1.75);
  controller.priorities.clear();controller.phase='completed';controller.clock=12;
  traffic.tick(.1,controller);assert.equal(cross.stopped,true,'Wait until the junction is clear');
  for(let i=0;i<50&&cross.stopped;i++)traffic.tick(.1,controller);
  assert.equal(cross.stopped,false);assert.ok(cross.pose.z>-18);
});

test('a green approach waits at its stop line when the exit is full, then clears normally',()=>{
  const nodes=[{id:'w',x:-150,z:0,signal:null},{id:'j',x:0,z:0,signal:0},{id:'e',x:150,z:0,signal:null}];
  const traffic=new CivilianTraffic({nodes,roads:[{id:'W',a:'w',b:'j'},{id:'E',a:'j',b:'e'}]},[],2);
  const [incoming,exit]=traffic.agents;
  Object.assign(incoming,{kind:'car',road:'W',a:'w',b:'j',t:.88,offset:1.75});
  Object.assign(exit,{kind:'car',road:'E',a:'j',b:'e',t:.02,offset:1.75});
  const controller={timeScale:6,clock:0,phase:'outbound',priorities:new Map([['j',{roads:['W','E']}]])};
  traffic.tick(.1,controller);assert.equal(incoming.stopped,true);assert.equal(incoming.t,.88);assert.equal(incoming.turn,null);
  exit.t=.5;
  traffic.tick(.1,controller);assert.equal(incoming.stopped,false);assert.ok(incoming.pose.x>-18);
});

test('building selection hits rotated roofs and chooses the closest named volume',()=>{
  const buildings=[{id:'a',name:'Shivkrupa Niwas',x:0,z:0,width:10,depth:30,height:20,yaw:Math.PI/2},{id:'b',name:'Tilak Nagar Rugnalaya',x:80,z:0,width:20,depth:20,height:30}];
  const pick=createBuildingPicker(buildings);
  assert.equal(pick(new THREE.Ray(new THREE.Vector3(12,100,0),new THREE.Vector3(0,-1,0))).name,'Shivkrupa Niwas');
  assert.equal(pick(new THREE.Ray(new THREE.Vector3(80,100,0),new THREE.Vector3(0,-1,0))).name,'Tilak Nagar Rugnalaya');
  assert.equal(pick(new THREE.Ray(new THREE.Vector3(0,100,12),new THREE.Vector3(0,-1,0))),null);
});

test('dense mixed traffic covers all 100 roads and stays inside its lanes through emergency preemption',()=>{
  const city=createCityMap(),map=city.userData,c=new AmbulanceDemoController(map),traffic=new CivilianTraffic(map);
  assert.equal(new Set(traffic.agents.map(a=>a.road)).size,100);
  assert.ok(traffic.agents.filter(a=>a.kind==='bike').length>traffic.agents.length*.5);
  assert.ok(traffic.agents.some(a=>a.kind==='truck'));
  traffic.tick(.1,c);
  const fleet=new FleetRenderer(traffic.agents);
  fleet.update();assert.equal(fleet.visibleCount,TRAFFIC_COUNT);
  let meshes=0;fleet.root.traverseVisible(o=>{if(o.isMesh)meshes++;});assert.ok(meshes<400);
  c.start(chooseLocations(map)[1].node);
  let moving=0;
  for(let i=0;i<200;i++){
    c.tick(.1);traffic.tick(.1,c);
    for(const a of traffic.agents){
      const road=traffic.lookup.get(a.road),margin=a.kind==='bike'?.65:a.kind==='truck'?1.6:1.3;
      assert.ok(Math.abs(a.offset)+margin<=road.width/2+.001);
      if(a.turn&&i%5===0){
        const node=traffic.nodes.get(a.turn.node);
        const onJunction=Math.hypot(a.pose.x-node.x,a.pose.z-node.z)<=node.junctionRadius+.1;
        const onRoad=onJunction||map.roads.some(r=>nearestRoad([r],a.pose.x,a.pose.z).distance<=r.width/2+.1);
        assert.ok(onRoad,'A turning vehicle must remain on the road or paved junction');
      }
      if(!a.stopped)moving++;
    }
  }
  assert.ok(moving>2000,'City traffic must continue moving during dispatch');
  assert.ok(traffic.yielding>0);
  assert.ok(traffic.agents.every(a=>Object.values(a.pose).every(Number.isFinite)));
  fleet.dispose();disposeCityMap(city);
});

test('a clicked point halfway along a curved road is reached exactly, then the ambulance returns',()=>{
  const city=createCityMap(),map=city.userData,road=map.roads.find(r=>!r.bridge&&r.length>150),p=road.points[8],c=new AmbulanceDemoController(map);
  c.start(road.a,'accident',{x:p.x,z:p.z,roadId:road.id,along:p.distance});
  while(c.phase==='outbound')c.tick(.25);
  assert.equal(c.phase,'at-incident');assert.ok(Math.hypot(c.pose.x-p.x,c.pose.z-p.z)<.001);
  for(let i=0;i<2000&&c.phase!=='completed';i++)c.tick(.25);
  assert.equal(c.phase,'completed');assert.ok(Math.hypot(c.pose.x-c.hospital.entrance.x,c.pose.z-c.hospital.entrance.z)<.001);
  disposeCityMap(city);
});
