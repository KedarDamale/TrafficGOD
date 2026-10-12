import * as THREE from 'three';
import { getVehicleSpec } from './catalog.js';
import { buildCar } from './cars/build-car.js';
import { buildBike } from './bikes/build-bike.js';
import { buildTruck } from './vehicles/build-truck.js';
export { VEHICLES, VEHICLE_IDS, getVehicleSpec } from './catalog.js';
export const PAINT_COLORS = Object.freeze(['#27a6cf', '#e6534f', '#edbd49', '#f0eee2', '#43536a', '#68a486']);
const bikeStyles = new Set(['commuter', 'scooter', 'sport', 'classic', 'moped']);
const truckStyles = new Set(['box', 'tipper', 'tanker', 'semi-box', 'semi-flatbed', 'fire', 'ambulance']);
/** Y up, +Z forward; origin at road level, length centered around Z=0. Units: metres. */
export function createVehicle(id, options = {}) {
  const original = getVehicleSpec(id);
  if (options.colorIndex !== undefined && (!Number.isInteger(options.colorIndex) || options.colorIndex < 0 || options.colorIndex >= PAINT_COLORS.length)) throw new RangeError('colorIndex must be an integer from 0 to 5');
  const color = original.emergency ? original.color : options.color ?? (options.colorIndex !== undefined ? PAINT_COLORS[options.colorIndex] : original.color);
  const s = { ...original, color };
  const root = new THREE.Group(); root.name = id;
  root.userData = { id, label: s.name, category: s.category, emergency: s.emergency || null, occupants: [], wheels: [], beacons: [], dimensions: { length: s.length, width: s.width, height: s.height }, paint: color };
  if (bikeStyles.has(s.style)) buildBike(root, s);
  else if (truckStyles.has(s.style)) buildTruck(root, s);
  else buildCar(root, s);
  root.userData.wheelRadius ??= bikeStyles.has(s.style) ? (s.style === 'scooter' ? .23 : .3) : truckStyles.has(s.style) ? .42 : ['rugged', 'suv', 'boxy', 'tall', 'mpv'].includes(s.style) ? .34 : .3;
  return root;
}
/** deltaSeconds is frame duration; speed is m/s; timeSeconds is a monotonic clock. */
export function animateVehicle(vehicle, { deltaSeconds = 0, speed = 0, timeSeconds = 0, emergencyActive = true, trailerAngle = 0 } = {}) {
  const data = vehicle.userData;
  for (const wheel of data.wheels) wheel.rotation.x += speed * deltaSeconds / data.wheelRadius;
  data.beacons.forEach((mesh, i) => {
    const on = emergencyActive && (Math.floor(timeSeconds * 5) + i) % 2 === 0;
    mesh.material.emissive.copy(mesh.material.color); mesh.material.emissiveIntensity = on ? 2 : 0;
  });
  if (data.trailerPivot) data.trailerPivot.rotation.y = THREE.MathUtils.clamp(trailerAngle, -.65, .65);
}
/** Dispose instance-owned materials. Shared primitive geometry remains available for the fleet. */
export function disposeVehicle(vehicle) {
  const materials = new Set();
  vehicle.traverse(o => { if (o.isMesh) materials.add(o.material); });
  materials.forEach(m => m.dispose()); vehicle.removeFromParent();
}
