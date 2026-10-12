import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VEHICLES, PAINT_COLORS, createVehicle, animateVehicle, disposeVehicle } from '../3d_models/index.js';
import { createNeighborhoodMap, disposeNeighborhoodMap } from '../3d_models/maps/city-map.js';

test('all 29 models have finite, road-level geometry and exactly one occupant', () => {
  assert.equal(VEHICLES.length, 29);
  assert.equal(new Set(VEHICLES.map(v => v.id)).size, 29);
  for (const spec of VEHICLES) {
    const model = createVehicle(spec.id);
    assert.equal(model.userData.occupants.length, 1, spec.id);
    assert.equal(model.userData.wheels.length >= 2, true, spec.id);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < .02, `${spec.id}: wheels touch road`);
    assert.ok(bounds.max.z > 0 && bounds.min.z < 0, spec.id);
    let triangles = 0;
    model.traverse(o => {
      if (!o.isMesh) return;
      for (const n of o.geometry.attributes.position.array) assert.ok(Number.isFinite(n), spec.id);
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles < 12000, `${spec.id}: ${triangles} triangles`);
    disposeVehicle(model);
  }
});

test('all enclosed occupants fit below their cabin roofs', () => {
  for (const spec of VEHICLES) {
    const v = createVehicle(spec.id);
    const roof = v.getObjectByName('roof') || v.getObjectByName('cab-roof');
    if (roof) {
      const personBounds = new THREE.Box3().setFromObject(v.userData.occupants[0]);
      const roofBounds = new THREE.Box3().setFromObject(roof);
      assert.ok(personBounds.max.y <= roofBounds.min.y, `${spec.id}: occupant clips roof`);
    }
    disposeVehicle(v);
  }
});

test('six paints change civilian body colors and service liveries remain fixed', () => {
  for (const spec of VEHICLES) for (let i = 0; i < 6; i++) {
    const model = createVehicle(spec.id, { colorIndex: i });
    assert.equal(model.userData.paint, spec.emergency ? spec.color : PAINT_COLORS[i]);
    const body = model.getObjectByName(spec.category === 'cars' || spec.id === 'police-car' ? 'body' : ['box','tipper','tanker','semi-box','semi-flatbed','fire','ambulance'].includes(spec.style) ? 'cab-base' : spec.style === 'scooter' ? 'rear-cowl' : spec.style === 'moped' ? 'side-panel' : 'fuel-tank');
    assert.equal(body.material.color.getHex(), new THREE.Color(model.userData.paint).getHex());
    disposeVehicle(model);
  }
});

test('animation spins wheels, alternates beacons, and clamps articulation', () => {
  const v = createVehicle('police-car');
  animateVehicle(v, {deltaSeconds:1, speed:3, timeSeconds:0});
  assert.ok(v.userData.wheels.every(w => w.rotation.x > 0));
  assert.equal(v.userData.beacons[0].material.emissiveIntensity, 2);
  assert.equal(v.userData.beacons[1].material.emissiveIntensity, 0);
  animateVehicle(v, {timeSeconds:.2});
  assert.equal(v.userData.beacons[1].material.emissiveIntensity, 2);
  animateVehicle(v, { emergencyActive:false });
  assert.ok(v.userData.beacons.every(b => b.material.emissiveIntensity === 0));
  const trailer=createVehicle('tractor-trailer');
  animateVehicle(trailer, {trailerAngle:2});
  assert.equal(trailer.userData.trailerPivot.rotation.y,.65);
  const other=createVehicle('police-car');
  assert.notEqual(v.getObjectByName('body').material,other.getObjectByName('body').material);
  [v,trailer,other].forEach(disposeVehicle);
});

test('city contains nine blocks and all three service buildings', () => {
  const city=createNeighborhoodMap();
  for (const name of ['hospital','fire-station','police-station','tree','crosswalk']) assert.ok(city.getObjectByName(name),name);
  assert.equal(city.children.filter(o=>o.name==='sidewalk-block').length,9);
  const size = new THREE.Box3().setFromObject(city).getSize(new THREE.Vector3());
  assert.equal(size.x,96);assert.equal(size.z,96);
  disposeNeighborhoodMap(city);
});

test('unknown IDs and invalid palette indexes produce useful errors', () => {
  assert.throws(()=>createVehicle('missing'),RangeError);
  assert.throws(()=>createVehicle('baleno',{colorIndex:6}),RangeError);
});
