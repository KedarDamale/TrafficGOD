import * as THREE from 'three';
// Geometry is shared across the fleet. Materials belong to each vehicle instance.
const shapes = new Map();
function geometry(key, build) { if (!shapes.has(key)) shapes.set(key, build()); return shapes.get(key); }
export function kit(root, color) {
  const materials = new Map();
  const mat = (c, glass = false) => {
    const key = `${c}:${glass}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: .78, flatShading: true, transparent: glass, opacity: glass ? .24 : 1, depthWrite: !glass, side: glass ? THREE.DoubleSide : THREE.FrontSide }));
    return materials.get(key);
  };
  function mesh(parent, g, c, position, size, name, glass = false) {
    const m = new THREE.Mesh(g, mat(c, glass));
    m.position.set(...position); m.scale.set(...size); m.name = name;
    m.castShadow = !glass; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (p, c, pos, size, name = 'panel', glass = false) => mesh(p, geometry('box', () => new THREE.BoxGeometry(1, 1, 1)), c, pos, size, name, glass);
  const cylinder = (p, c, pos, radius, height, name = 'cylinder', axis = 'y', segments = 10) => {
    const m = mesh(p, geometry(`cylinder-${segments}`, () => new THREE.CylinderGeometry(1, 1, 1, segments)), c, pos, [radius, height, radius], name);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  };
  function rod(p, c, a, b, radius = .04, name = 'rod') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const m = cylinder(p, c, start.clone().add(end).multiplyScalar(.5).toArray(), radius, start.distanceTo(end), name, 'y', 6);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return m;
  }
  function wheel(p, x, z, radius, width) {
    const w = new THREE.Group(); w.name = 'wheel'; w.position.set(x, radius, z); p.add(w);
    cylinder(w, '#202632', [0, 0, 0], radius, width, 'tire', 'x', 12);
    cylinder(w, '#acb9bc', [0, 0, 0], radius * .57, width + .014, 'rim', 'x', 8);
    cylinder(w, '#3b4652', [0, 0, 0], radius * .22, width + .026, 'hub', 'x', 8);
    root.userData.wheels.push(w); return w;
  }
  function occupant(p, pos, rider = false, uniform = false) {
    const person = new THREE.Group(); person.name = rider ? 'rider' : 'occupant'; person.position.set(...pos); p.add(person);
    const shirt = uniform ? '#334961' : '#ee9a46';
    box(person, shirt, [0, .25, 0], [.28, .4, .23], 'torso');
    cylinder(person, '#d79d73', [0, .59, 0], .13, .24, 'head', 'y', 8);
    if (rider) {
      cylinder(person, uniform ? '#e8ecee' : '#ebc245', [0, .69, 0], .16, .17, 'helmet', 'y', 8);
      box(person, '#253b4a', [0, .66, .135], [.23, .08, .04], 'visor');
    } else box(person, '#493d35', [0, .73, -.015], [.23, .055, .22], 'hair');
    for (const s of [-1, 1]) {
      rod(person, shirt, [s * .16, .4, .04], [s * .22, .2, .35], .065, 'arm');
      rod(person, '#334961', [s * .09, .06, 0], [s * .18, -.25, .26], .075, 'leg');
      box(person, '#202632', [s * .18, -.29, .3], [.12, .1, .23], 'shoe');
    }
    root.userData.occupants.push(person); return person;
  }
  function beacon(p, y, z = 0) {
    box(p, '#273341', [0, y, z], [.85, .08, .24], 'lightbar');
    for (const s of [-1, 1]) {
      const m = box(p, s < 0 ? '#ff4549' : '#428aff', [s * .25, y + .09, z], [.32, .13, .23], 'beacon');
      root.userData.beacons.push(m);
    }
  }
  return { box, cylinder, rod, wheel, occupant, beacon, mat, color };
}
