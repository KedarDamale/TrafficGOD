import { kit } from '../core/primitives.js';
export function buildCar(root, s) {
  const k = kit(root, s.color), { box, cylinder, rod, wheel, occupant, beacon } = k;
  const L = s.length, W = s.width, H = s.height;
  const rugged = ['rugged', 'suv', 'boxy', 'tall', 'mpv'].includes(s.style);
  const base = rugged ? .68 : .58, roofY = H - .06;
  const back = s.style === 'sedan' ? -L * .23 : -L * .35;
  const front = L * .17, roofFront = L * (s.style === 'crossover' ? .06 : .09);
  box(root, '#26313d', [0, .38, 0], [W * .92, .2, L * .89], 'chassis');
  box(root, s.color, [0, base, 0], [W, .45, L * .96], 'body');
  box(root, s.color, [0, base + .27, L * .33], [W * .96, .14, L * .3], 'hood');
  if (s.style === 'sedan') box(root, s.color, [0, base + .24, -L * .38], [W * .94, .17, L * .22], 'boot');
  const cabinLength = roofFront - back;
  box(root, s.roof || s.color, [0, roofY, (roofFront + back) / 2], [W * .85, .12, cabinLength], 'roof');
  // Open interior with lightly tinted glazing makes the single occupant visible.
  for (const side of [-1, 1]) {
    const x = side * W * .43;
    rod(root, s.color, [x, base + .22, front], [x, roofY, roofFront], .055, 'A-pillar');
    rod(root, s.color, [x, base + .22, back - .07], [x, roofY, back], .055, 'C-pillar');
    box(root, s.color, [x, (base + .22 + roofY) / 2, -.22], [.07, roofY - base - .22, .07], 'B-pillar');
    box(root, '#87c9df', [x, (base + .25 + roofY) / 2, (front + back) / 2], [.02, roofY - base - .3, front - back], 'side-glass', true);
    box(root, '#d6dfe0', [side * (W / 2 + .09), base + .41, front * .75], [.18, .12, .22], 'mirror');
    box(root, '#d6dfe0', [side * (W / 2 + .005), base + .14, -.35], [.03, .045, .18], 'handle');
    for (const z of [-L * .29, L * .29]) wheel(root, side * (W / 2 - .035), z, rugged ? .34 : .3, .21);
    box(root, '#fff3c7', [side * W * .32, base + .13, L * .485], [W * .25, .13, .04], 'headlight');
    box(root, '#ed5350', [side * W * .35, base + .11, -L * .485], [.21, .22, .04], 'tail-light');
  }
  const windshield = box(root, '#87c9df', [0, (base + .22 + roofY) / 2, (front + roofFront) / 2], [W * .8, Math.hypot(roofY - base - .22, front - roofFront), .025], 'windshield', true);
  windshield.rotation.x = Math.atan2(front - roofFront, roofY - base - .22);
  box(root, '#87c9df', [0, (base + .22 + roofY) / 2, back - .04], [W * .78, roofY - base - .25, .02], 'rear-glass', true);
  box(root, '#28333e', [0, base - .08, L * .489], [W * .49, .18, .04], 'grille');
  box(root, '#e7ebdf', [0, base - .1, -L * .489], [.38, .11, .025], 'number-plate');
  box(root, '#28333e', [.32, base + .17, .1], [.35, .18, .38], 'driver-seat');
  occupant(root, [.32, base + .23, .08], false, !!s.emergency);
  cylinder(root, '#26313d', [.32, base + .4, .48], .12, .025, 'steering-wheel', 'z');
  if (rugged) for (const side of [-1, 1]) box(root, '#26313d', [side * W * .48, .44, 0], [.06, .13, L * .65], 'side-cladding');
  if (['suv', 'rugged', 'mpv'].includes(s.style)) for (const side of [-1, 1]) box(root, '#aab7bb', [side * W * .33, H + .06, -.35], [.055, .055, L * .42], 'roof-rail');
  if (s.spare) cylinder(root, '#26313d', [0, .95, -L * .5], .34, .16, 'spare-wheel', 'z');
  if (s.emergency) {
    beacon(root, H + .1);
    for (const side of [-1, 1]) {
      box(root, '#244b78', [side * (W / 2 + .01), base, 0], [.025, .16, L * .85], 'police-stripe');
      cylinder(root, '#e3bd56', [side * (W / 2 + .03), base + .22, .05], .13, .025, 'badge', 'x', 6);
    }
  }
}
