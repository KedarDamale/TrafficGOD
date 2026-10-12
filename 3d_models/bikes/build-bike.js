import { kit } from '../core/primitives.js';
export function buildBike(root, s) {
  const { box, cylinder, rod, wheel, occupant, beacon } = kit(root, s.color);
  const scooter = s.style === 'scooter', classic = s.style === 'classic', moped = s.style === 'moped';
  const r = scooter ? .23 : .3, rear = -s.length * .32, front = s.length * .32;
  wheel(root, 0, rear, r, .14); wheel(root, 0, front, r, .14);
  rod(root, '#a5b5bd', [-.13, .9, front - .16], [-.13, r, front], .04, 'fork');
  rod(root, '#a5b5bd', [.13, .9, front - .16], [.13, r, front], .04, 'fork');
  rod(root, '#293844', [0, .53, rear], [0, .63, front - .14], .07, 'frame');
  box(root, '#27313a', [0, .79, -.23], [.38, .12, .67], 'saddle');
  if (scooter) {
    box(root, s.color, [0, .52, -.46], [.52, .43, .59], 'rear-cowl');
    box(root, s.color, [0, .33, .07], [.48, .12, .69], 'footboard');
    const apron = box(root, s.color, [0, .67, .44], [.48, .68, .16], 'leg-shield'); apron.rotation.x = -.14;
    box(root, s.color, [0, 1.04, .5], [.5, .17, .2], 'handle-cowl');
  } else {
    if (!moped) {
      const tank = cylinder(root, s.color, [0, .76, .14], classic ? .24 : .23, .46, 'fuel-tank', 'z', 6); tank.scale.x *= .82;
      box(root, '#87969c', [0, .49, .04], [.29, .3, .37], 'engine');
      for (let i = 0; i < 4; i++) box(root, '#384651', [0, .39 + i * .06, .04], [.32, .021, .39], 'cooling-fin');
    } else {
      rod(root, s.color, [0, .4, -.15], [0, .79, .42], .07, 'step-through');
      box(root, '#929b9b', [0, .35, -.11], [.23, .21, .29], 'engine');
      box(root, '#a5b5bd', [0, .73, -.75], [.42, .045, .29], 'cargo-rack');
    }
    box(root, s.color, [0, .61, -.4], [.34, .22, .36], 'side-panel');
    cylinder(root, '#acb9bd', [.21, .35, -.39], .065, .77, 'exhaust', 'z', 8);
    if (s.style === 'sport') {
      const fairing = box(root, s.accent || s.color, [0, .97, .48], [.42, .3, .2], 'sport-fairing'); fairing.rotation.x = -.25;
      box(root, '#506d81', [0, 1.13, .43], [.3, .19, .035], 'flyscreen', true);
    }
  }
  box(root, s.color, [0, r + .27, front], [.24, .06, .43], 'front-fender');
  box(root, s.color, [0, r + .25, rear], [.27, .06, .42], 'rear-fender');
  rod(root, '#a5b5bd', [-.35, 1.01, .43], [.35, 1.01, .43], .035, 'handlebar');
  for (const side of [-1, 1]) {
    box(root, '#26333b', [side * .3, 1.01, .43], [.14, .07, .09], 'grip');
    rod(root, '#a5b5bd', [side * .28, 1.02, .44], [side * .36, 1.22, .48], .018, 'mirror-stem');
    box(root, '#b4d6df', [side * .36, 1.23, .48], [.13, .08, .04], 'mirror');
    box(root, '#efb73a', [side * .2, .91, .63], [.075, .065, .04], 'indicator');
  }
  if (classic || s.roundLight) cylinder(root, '#fff0bb', [0, 1, .6], .125, .08, 'headlight', 'z', 10);
  else box(root, '#fff0bb', [0, 1, .61], [.25, .12, .07], 'headlight');
  box(root, '#e24a49', [0, .72, rear - .17], [.18, .09, .04], 'tail-light');
  box(root, '#e5e9dc', [0, .57, rear - .18], [.17, .1, .025], 'number-plate');
  occupant(root, [0, .82, -.12], true, !!s.emergency);
  if (s.emergency) {
    for (const side of [-1, 1]) box(root, '#f1f0e5', [side * .3, .65, -.55], [.23, .33, .4], 'police-pannier');
    rod(root, '#a5b5bd', [.28, .71, -.65], [.28, 1.36, -.65], .024, 'beacon-pole');
    beacon(root, 1.36, -.65);
    box(root, '#a1cbdc', [0, 1.22, .55], [.44, .32, .03], 'patrol-windscreen', true);
  }
}
