import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCityMap,disposeCityMap } from '../3d_models/maps/city-map.js';
import { BUILDINGS,createBuilding,disposeBuilding } from '../3d_models/buildings/index.js';
import { VEHICLES,createVehicle,disposeVehicle } from '../3d_models/index.js';
import { AmbulanceDemoController,CivilianTraffic,chooseLocations } from '../simulation/demo-controller.js';
import { FleetRenderer } from '../simulation/fleet-renderer.js';
import { findRoute } from '../simulation/graph.js';

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

test('compact city has exactly 150 unique curved streets and service coverage',()=>{
  const city=createCityMap(),map=city.userData;
  assert.equal(map.stats.roads,150);
  assert.equal(map.areaFraction,.08);
  assert.equal(new Set(map.roads.map(r=>r.name)).size,150);
  assert.deepEqual([...new Set(map.roads.map(r=>r.lanes))].sort(),[1,2,4]);
  for(const road of map.roads){
    const a=road.points[0],b=road.points.at(-1),mid=road.points[8];
    assert.ok(Math.abs((b.x-a.x)*(mid.z-a.z)-(b.z-a.z)*(mid.x-a.x))>.005*Math.hypot(b.x-a.x,b.z-a.z)**2,'Road must curve');
  }
  assert.ok(map.stats.buildings>1000);
  const districts=new Map();
  for(const s of map.services){if(!districts.has(s.district))districts.set(s.district,new Set());districts.get(s.district).add(s.type);}
  assert.equal(districts.size,map.stats.districts);
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

test('civilian cars stop on red approaches, yield near ambulance, and resume after passage',()=>{
  const nodes=[{id:'a',x:0,z:0,neighbors:['b'],signal:0},{id:'b',x:180,z:0,neighbors:['a','c'],signal:1},{id:'c',x:180,z:180,neighbors:['b'],signal:2}];
  const map={nodes,roads:[{a:'a',b:'b'}]},traffic=new CivilianTraffic(map,nodes,1);
  const agent=traffic.agents[0];agent.a='a';agent.b='b';agent.t=.94;
  const controller={timeScale:6,clock:0,pose:{x:-500,z:-500},phase:'outbound',priorities:new Map([['b',{axis:'z'}]])};
  traffic.tick(.1,controller);assert.equal(agent.stopped,true);const position=agent.t;
  controller.priorities.set('b',{axis:'x'});traffic.tick(.1,controller);assert.equal(agent.stopped,false);assert.ok(agent.t>position);
  controller.pose={x:170,z:0};traffic.tick(.1,controller);assert.equal(agent.stopped,true);assert.ok(agent.offset>3.2);
  controller.phase='completed';traffic.tick(.1,controller);assert.equal(agent.stopped,false);
});

test('dense mixed traffic covers all 150 roads and stays batched for rendering',()=>{
  const city=createCityMap(),map=city.userData,c=new AmbulanceDemoController(map),traffic=new CivilianTraffic(map,[],3600);
  assert.equal(new Set(traffic.agents.map(a=>a.road)).size,150);
  assert.ok(traffic.agents.filter(a=>a.kind==='bike').length>traffic.agents.length*.5);
  assert.ok(traffic.agents.some(a=>a.kind==='truck'));
  traffic.tick(.1,c);
  const fleet=new FleetRenderer(traffic.agents);
  fleet.update();assert.equal(fleet.visibleCount,3600);
  let meshes=0;fleet.root.traverseVisible(o=>{if(o.isMesh)meshes++;});assert.ok(meshes<400);
  for(let i=0;i<100;i++){c.tick(.1);traffic.tick(.1,c);}
  assert.ok(traffic.yielding>0);
  assert.ok(traffic.agents.every(a=>Object.values(a.pose).every(Number.isFinite)));
  fleet.dispose();disposeCityMap(city);
});

test('a clicked point halfway along a curved road is reached exactly, then the ambulance returns',()=>{
  const city=createCityMap(),map=city.userData,road=map.roads.find(r=>!r.bridge&&r.length>300),p=road.points[8],c=new AmbulanceDemoController(map);
  c.start(road.a,'accident',{x:p.x,z:p.z,roadId:road.id,along:p.distance});
  while(c.phase==='outbound')c.tick(.25);
  assert.equal(c.phase,'at-incident');assert.ok(Math.hypot(c.pose.x-p.x,c.pose.z-p.z)<.001);
  for(let i=0;i<2000&&c.phase!=='completed';i++)c.tick(.25);
  assert.equal(c.phase,'completed');assert.ok(Math.hypot(c.pose.x-c.hospital.entrance.x,c.pose.z-c.hospital.entrance.z)<.001);
  disposeCityMap(city);
});
