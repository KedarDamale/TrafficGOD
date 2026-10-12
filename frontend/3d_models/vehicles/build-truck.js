import * as THREE from 'three';
import { kit } from '../core/primitives.js';
export function buildTruck(root, s) {
  const { box, cylinder, rod, wheel, occupant, beacon } = kit(root, s.color);
  const L = s.length, W = s.width, cabZ = s.articulated ? L / 2 - 1.2 : L / 2 - 1.05;
  const cabH = s.style === 'ambulance' ? 1.95 : 2.25;
  box(root, '#2b3642', [0, .61, s.articulated ? cabZ - .7 : 0], [W * .87, .25, s.articulated ? 3.8 : L * .96], 'chassis');
  box(root, s.color, [0, 1, cabZ], [W, .65, 1.95], 'cab-base');
  box(root, s.color, [0, cabH, cabZ], [W, .13, 1.95], 'cab-roof');
  box(root, s.color, [0, 1.65, cabZ - .93], [W, 1.05, .12], 'cab-back');
  for (const side of [-1, 1]) {
    box(root, s.color, [side * (W / 2 - .07), 1.7, cabZ + .86], [.12, cabH - 1.26, .12], 'cab-pillar');
    box(root, '#8bcee0', [side * W / 2, 1.7, cabZ], [.022, cabH - 1.4, 1.5], 'side-glass', true);
    box(root, '#b6c8cd', [side * (W / 2 + .15), 1.7, cabZ + .6], [.17, .27, .12], 'mirror');
    box(root, '#fff2ca', [side * .78, 1.02, cabZ + .99], [.37, .17, .035], 'headlight');
    wheel(root, side * (W / 2 - .06), cabZ + .15, .42, .26);
    box(root, '#a8b6b9', [side * W / 2, .76, cabZ - .52], [.2, .09, .5], 'step');
  }
  box(root, '#8bcee0', [0, 1.7, cabZ + .92], [W * .85, cabH - 1.42, .03], 'windshield', true);
  box(root, '#2b3642', [0, .9, cabZ + 1], [.94, .26, .04], 'grille');
  box(root, '#c0c9ca', [0, .69, cabZ + 1.01], [W * .94, .13, .12], 'bumper');
  occupant(root, [.48, 1.35, cabZ + .05], false, !!s.emergency).scale.setScalar(s.style === 'ambulance' ? .65 : 1);
  cylinder(root, '#26313d', [.48, 1.53, cabZ + .5], .15, .03, 'steering-wheel', 'z');
  const cargo = new THREE.Group(); cargo.name = s.articulated ? 'trailer-pivot' : 'cargo';
  cargo.position.z = s.articulated ? cabZ - 1.9 : 0; root.add(cargo);
  if (s.articulated) root.userData.trailerPivot = cargo;
  const cargoL = s.articulated ? 8.9 : L - 2.2;
  const cargoZ = s.articulated ? -cargoL / 2 + .2 : -1;
  const cargoTop = s.height;
  box(cargo, '#35414b', [0, .76, cargoZ], [W, .18, cargoL], 'cargo-deck');
  if (s.style === 'tanker') {
    cylinder(cargo, '#b8c7cb', [0, 1.91, cargoZ], 1.05, cargoL * .91, 'tank', 'z', 12);
    for (const z of [cargoZ - cargoL * .28, cargoZ + cargoL * .28]) cylinder(cargo, s.color, [0, 1.91, z], 1.071, .1, 'tank-band', 'z', 12);
    box(cargo, '#434f59', [0, 3.03, cargoZ], [.65, .09, cargoL * .62], 'tank-walkway');
    cylinder(cargo, '#7c949e', [0, 3.13, cargoZ], .21, .12, 'fill-cap');
  } else if (s.style === 'tipper' || s.style === 'semi-flatbed') {
    const wallH = s.style === 'tipper' ? 1.13 : .2;
    for (const side of [-1, 1]) {
      box(cargo, s.color, [side * (W / 2 - .065), .9 + wallH / 2, cargoZ], [.13, wallH, cargoL], 'bed-side');
      for (let i = 0; i < 6; i++) box(cargo, '#cfc2a3', [side * (W / 2 + .01), .9 + wallH / 2, cargoZ - cargoL / 2 + .3 + i * cargoL / 6], [.035, wallH, .06], 'bed-rib');
    }
    for (const z of [cargoZ - cargoL / 2, cargoZ + cargoL / 2]) box(cargo, s.color, [0, .9 + wallH / 2, z], [W, wallH, .13], 'tailgate');
    if (s.style === 'tipper') for (let i = 0; i < 5; i++) {
      cylinder(cargo, '#8a7960', [(i % 2 ? -.45 : .4), 1.05, cargoZ - 1 + i * .5], .38, .4, 'aggregate', 'y', 5);
    } else for (const z of [cargoZ - 1.9, cargoZ + 1.5]) {
      box(cargo, '#b98c60', [0, 1.23, z], [1.55, .72, 1.8], 'cargo-crate');
      for (const x of [-.49, .49]) box(cargo, '#3a5155', [x, 1.6, z], [.07, .03, 1.83], 'cargo-strap');
    }
  } else {
    const cargoColor = s.style === 'fire' ? '#c53231' : s.style === 'ambulance' ? s.color : '#eee9d9';
    box(cargo, cargoColor, [0, (.9 + cargoTop) / 2, cargoZ], [W, cargoTop - .9, cargoL], 'cargo-body');
    for (const side of [-1, 1]) {
      if (s.style === 'fire') {
        for (let i = 0; i < 3; i++) {
          const z = cargoZ - cargoL * .32 + i * cargoL * .32;
          box(cargo, '#aebcbf', [side * (W / 2 + .015), 1.66, z], [.025, 1.27, cargoL * .27], 'equipment-shutter');
          for (let j = 0; j < 6; j++) box(cargo, '#71858e', [side * (W / 2 + .03), 1.12 + j * .2, z], [.02, .018, cargoL * .26], 'shutter-slat');
        }
      }
      if (s.style === 'ambulance') {
        box(cargo, '#df4d44', [side * (W / 2 + .02), 1.27, cargoZ], [.03, .21, cargoL], 'medical-stripe');
        box(cargo, '#5591a8', [side * (W / 2 + .025), 2.15, cargoZ - .55], [.025, .43, .85], 'medical-window');
        box(cargo, '#df4d44', [side * (W / 2 + .03), 2.13, cargoZ + .65], [.03, .57, .16], 'medical-cross');
        box(cargo, '#df4d44', [side * (W / 2 + .035), 2.13, cargoZ + .65], [.03, .16, .57], 'medical-cross');
      }
      if (!s.emergency) box(cargo, s.color, [side * (W / 2 + .02), 1.87, cargoZ], [.025, .33, cargoL * .7], 'fleet-stripe');
    }
    const tailZ = cargoZ - cargoL / 2 - .02;
    for (const side of [-1, 1]) {
      box(cargo, '#8e9da5', [side * W * .24, 1.88, tailZ], [W * .46, 1.8, .035], 'rear-door');
      rod(cargo, '#d7dedc', [side * W * .24, 1.12, tailZ - .03], [side * W * .24, 2.55, tailZ - .03], .025, 'door-lock');
    }
  }
  for (const side of [-1, 1]) {
    const axles = s.articulated ? [cargoZ - cargoL * .3, cargoZ - cargoL * .18, cargoZ - cargoL * .06] : s.style === 'ambulance' ? [-L * .31] : [-L * .32, -L * .18];
    for (const z of axles) wheel(cargo, side * (W / 2 - .06), z, .42, .26);
    if (s.articulated) wheel(root, side * (W / 2 - .06), cabZ - 1.75, .42, .26);
    box(cargo, '#ef5349', [side * .86, .86, cargoZ - cargoL / 2 - .04], [.25, .12, .035], 'tail-light');
  }
  if (s.style === 'fire') {
    for (const x of [-.44, .44]) rod(cargo, '#d9ded9', [x, cargoTop + .13, cargoZ - cargoL * .42], [x, cargoTop + .13, cargoZ + cargoL * .42], .045, 'ladder-rail');
    for (let i = 0; i < 12; i++) rod(cargo, '#d9ded9', [-.44, cargoTop + .13, cargoZ - cargoL * .4 + i * cargoL * .073], [.44, cargoTop + .13, cargoZ - cargoL * .4 + i * cargoL * .073], .03, 'ladder-rung');
    cylinder(cargo, '#e2b94a', [0, cargoTop + .08, cargoZ + .7], .35, .15, 'hose-reel');
  }
  if (s.emergency) beacon(root, cabH + .13, cabZ);
}
