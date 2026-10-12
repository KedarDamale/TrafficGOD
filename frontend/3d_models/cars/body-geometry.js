import * as THREE from 'three';
const cache = new Map();
/** An extruded side outline with real wheel-arch cutouts, not a box hiding the tires. */
export function bodyGeometry(s, d) {
  const key = s.id;
  if (cache.has(key)) return cache.get(key);
  const L = s.length, r = d.wheel + .045, axle = L * d.axle;
  const shape = new THREE.Shape();
  shape.moveTo(-L * .485, .36);
  shape.lineTo(-L * .485, d.tail - .06);
  shape.lineTo(-L * .40, d.tail);
  shape.lineTo(-L * .24, d.waist);
  shape.lineTo(L * .20, d.waist);
  shape.lineTo(L * .43, d.nose);
  shape.lineTo(L * .485, d.nose - .065);
  shape.lineTo(L * .485, .36);
  for (const z of [axle, -axle]) {
    shape.lineTo(z + r, .36);
    if (d.squareArches) {
      shape.lineTo(z + r, d.wheel + r * .68);
      shape.lineTo(z + r * .68, d.wheel + r);
      shape.lineTo(z - r * .68, d.wheel + r);
      shape.lineTo(z - r, d.wheel + r * .68);
    } else {
      for (let i = 0; i <= 10; i++) {
        const a = i * Math.PI / 10;
        shape.lineTo(z + Math.cos(a) * r, d.wheel + Math.sin(a) * r);
      }
    }
    shape.lineTo(z - r, .36);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: s.width - .10, steps: 1, bevelEnabled: true, bevelThickness: .05, bevelSize: Math.min(d.bevel, .045), bevelSegments: 1, curveSegments: 6 });
  g.rotateY(-Math.PI / 2); g.translate((s.width - .10) / 2, 0, 0);
  cache.set(key, g); return g;
}
/** Small flat polygons for trapezoidal glass, shaped lights, and roof panels. */
export function polygonGeometry(points) {
  const key = JSON.stringify(points);
  if (cache.has(key)) return cache.get(key);
  const vertices = [];
  for (let i = 1; i < points.length - 1; i++) vertices.push(...points[0], ...points[i], ...points[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
  cache.set(key, g); return g;
}
