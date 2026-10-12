import * as THREE from 'three';
import { kit } from '../core/primitives.js';
import { CAR_DESIGNS } from './designs.js';
import { bodyGeometry, polygonGeometry } from './body-geometry.js';

export function buildCar(root, s) {
  const { box, cylinder, rod, wheel, occupant, beacon, mat } = kit(root, s.color);
  const d = CAR_DESIGNS[s.id], L = s.length, W = s.width;
  const roofY = s.height - .055, rearRoofY = roofY - d.roofDrop;
  const front = L * d.glassFront, back = L * d.glassBack;
  const roofFront = L * d.roofFront, roofBack = L * d.roofBack;
  const halfRoof = W * d.roofWidth / 2, halfGlass = W * .455;
  const minRoof = rearRoofY - .07;
  root.userData.wheelRadius = d.wheel;
  function surface(color, points, name, glass = false) {
    const m = new THREE.Mesh(polygonGeometry(points), mat(color, glass));
    m.name = name; m.castShadow = !glass; m.receiveShadow = true; root.add(m); return m;
  }
  const body = new THREE.Mesh(bodyGeometry(s, d), mat(s.color));
  body.name = 'body'; body.castShadow = true; body.receiveShadow = true; root.add(body);
  box(root, '#293541', [0, .43, 0], [W * .64, .16, L * .84], 'chassis');
  // Tapered roof and sloped trapezoidal windows define the cabin silhouette.
  const roofColor = s.roof || s.color;
  const roof = surface(roofColor, [[-halfRoof, rearRoofY, roofBack], [halfRoof, rearRoofY, roofBack], [halfRoof, roofY, roofFront], [-halfRoof, roofY, roofFront]], 'roof');
  roof.material.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const x = side * halfGlass, rx = side * halfRoof;
    surface('#84bacd', [[x, d.waist, front], [rx, roofY - .065, roofFront], [rx, rearRoofY - .065, roofBack], [x, d.waist, back]], 'side-glass', true);
    rod(root, roofColor, [x, d.waist, front], [rx, roofY, roofFront], .047, 'A-pillar');
    rod(root, roofColor, [x, d.waist, back], [rx, rearRoofY, roofBack], s.id === 'swift' ? .08 : .055, 'C-pillar');
    rod(root, roofColor, [rx, rearRoofY, roofBack], [rx, roofY, roofFront], .045, 'roof-edge');
    const partitions = d.doors === 3 ? [-.055, -.245] : [-.06];
    for (const fraction of partitions) {
      const z = fraction * L;
      rod(root, '#253746', [x, d.waist + .02, z], [rx, rearRoofY - .025, z], .043, 'window-divider');
    }
    const mirror = box(root, d.cladding || s.roof ? '#283643' : s.color, [side * (W / 2 + .065), d.waist + .11, front - .12], [.16, .10, .24], 'mirror');
    mirror.rotation.y = side * -.15;
    for (const z of [-L * .21, L * .06]) {
      box(root, '#c5d3d8', [side * (W / 2 + .004), d.waist - .09, z], [.022, .035, .16], 'door-handle');
      rod(root, '#53636b', [side * W * .49, .43, z - .24], [side * W * .49, d.waist - .06, z - .24], .009, 'door-seam');
    }
    for (const z of [-L * d.axle, L * d.axle]) wheel(root, side * (W / 2 - .04), z, d.wheel, .21);
    if (d.cladding) {
      // Follow each model's wheel opening with a faceted black arch trim.
      for (const z of [-L * d.axle, L * d.axle]) {
        const r = d.wheel + .075;
        const points = d.squareArches ? [[z+r,.36],[z+r,d.wheel+r*.68],[z+r*.68,d.wheel+r],[z-r*.68,d.wheel+r],[z-r,d.wheel+r*.68],[z-r,.36]] : Array.from({length:11},(_,i)=>[z+Math.cos(i*Math.PI/10)*r,d.wheel+Math.sin(i*Math.PI/10)*r]);
        for (let i=1;i<points.length;i++) rod(root, '#293744', [side*W*.505,points[i-1][1],points[i-1][0]], [side*W*.505,points[i][1],points[i][0]], .033, 'arch-cladding');
      }
      box(root, '#293744', [side * W * .485, .39, 0], [.055, .10, L * .40], 'side-cladding');
    }
    if (d.step) box(root, '#a7b5b9', [side * (W / 2 + .055), .34, -.15], [.17, .07, L * .53], 'running-board');
    if (d.rails) rod(root, '#a7b5b9', [side * halfRoof * .8, rearRoofY + .12, roofBack], [side * halfRoof * .8, roofY + .12, roofFront], .032, 'roof-rail');
  }
  surface('#84bacd', [[-halfGlass,d.waist,front],[halfGlass,d.waist,front],[halfRoof,roofY-.065,roofFront],[-halfRoof,roofY-.065,roofFront]], 'windshield', true);
  surface('#84bacd', [[halfGlass,d.waist,back],[-halfGlass,d.waist,back],[-halfRoof,rearRoofY-.065,roofBack],[halfRoof,rearRoofY-.065,roofBack]], 'rear-glass', true);
  if (d.boot) {
    box(root, s.color, [0, d.tail + .035, -L * .40], [W * .91, .075, L * .19], 'sedan-boot');
    rod(root, '#a8b4b7', [-W*.4,d.tail,-L*.475], [W*.4,d.tail,-L*.475], .025, 'boot-chrome');
  }
  if (d.spoiler) box(root, s.roof || '#263643', [0, rearRoofY + .025, roofBack - .07], [W * d.roofWidth + .08, .055, .19], 'rear-spoiler');
  // One right-hand-drive occupant, fitted below the lowest part of the roof.
  const seatY = minRoof - .69, driverZ = L * .015;
  box(root, '#34434f', [.32, seatY + .03, driverZ], [.32, .12, .39], 'driver-seat');
  occupant(root, [.32, minRoof - .63, driverZ], false, !!s.emergency).scale.setScalar(.76);
  cylinder(root, '#26313d', [.32, minRoof - .37, driverZ + .34], .105, .025, 'steering-wheel', 'z');
  const noseZ = L * .491, lampY = d.nose - .06, tailZ = -L * .491;
  function light(side, type) {
    const x = side * W * .33;
    if (type === 'round-pair') {
      for (const dx of [-.09,.09]) cylinder(root, '#fff1c6', [x+dx,lampY,noseZ], .085, .035, 'round-headlight', 'z', 10);
    } else if (type === 'h') {
      box(root,'#fff1c6',[x,lampY,noseZ],[.29,.055,.035],'H-headlight');
      for(const dx of [-.13,.13]) box(root,'#fff1c6',[x+dx,lampY,noseZ],[.055,.25,.035],'H-headlight');
    } else if (type === 'vertical') box(root,'#fff1c6',[x,lampY-.04,noseZ],[.18,.27,.035],'vertical-headlight');
    else if (['split','split-square','triple'].includes(type)) {
      box(root,'#fff1c6',[x,d.nose+.035,noseZ],[.30,.035,.04],'daylight-strip');
      if(type==='triple') for(let i=0;i<3;i++) box(root,'#fff1c6',[x+(i-1)*.075,lampY-.17,noseZ],[.045,.065,.035],'triple-headlight');
      else box(root,'#fff1c6',[x,lampY-.18,noseZ],[type==='split-square'?.20:.24,.14,.04],'lower-headlight');
    } else {
      const w=type==='swept-long'?.41:type==='eyes'?.28:.34, h=type==='eyes'?.19:.10;
      const pts=[[x-w/2,lampY-h/2,noseZ],[x+w/2,lampY-h/2,noseZ],[x+w*.40,lampY+h/2+.05,noseZ],[x-w*.40,lampY+h/2,noseZ]];
      const m=surface('#fff1c6',pts,`${type}-headlight`);m.material.side=THREE.DoubleSide;
    }
  }
  for(const side of [-1,1]) {
    light(side,d.lamps);
    const x = side * W * .36, y = d.tail - .045;
    if (d.rear.includes('tower') || d.rear === 'hook-tall') {
      box(root,'#e5605a',[x,(d.waist+rearRoofY)/2,tailZ],[.10,rearRoofY-d.waist+.18,.04],'vertical-tail-light');
      if(d.rear==='hook-tall') box(root,'#e5605a',[x-side*.09,rearRoofY-.06,tailZ],[.23,.065,.04],'tail-hook');
    } else if (d.rear === 'oval') cylinder(root,'#e5605a',[x,y,tailZ],.105,.035,'oval-tail-light','z',8);
    else {
      box(root,'#e5605a',[x,y,tailZ],[d.rear==='sedan'?.32:.27,.095,.04],'tail-light');
      if(d.rear==='hook') box(root,'#e5605a',[x+side*.09,y+.08,tailZ],[.065,.19,.04],'tail-hook');
    }
    if (['mouth','chrome','slim'].includes(d.grille)) cylinder(root,'#dfedee',[side*W*.36,.48,noseZ],.055,.04,'fog-light','z',8);
  }
  if(d.rear==='connected') box(root,'#e5605a',[0,d.tail,tailZ],[W*.75,.035,.025],'rear-lightbar');
  const wide = ['wide','chrome-wide'].includes(d.grille), mouth=d.grille==='mouth';
  const grilleW = W * (wide?.67:mouth?.55:d.grille==='block'?.48:.43);
  const grilleH = d.grille==='slim'?.09:mouth?.25:d.grille==='vertical-bars'?.32:.19;
  const grilleY = d.grille==='slim'? d.nose-.12 : .57;
  box(root,'#25333f',[0,grilleY,noseZ],[grilleW,grilleH,.04],`${d.grille}-grille`);
  if(d.grille.includes('chrome')) for(let i=0;i<3;i++) box(root,'#c4cfd0',[0,grilleY-.06+i*.06,noseZ+.025],[grilleW*.93,.022,.025],'chrome-grille-bar');
  if(d.grille==='vertical-bars') for(let i=0;i<6;i++) box(root,'#b3c1c5',[(i-2.5)*grilleW/6,grilleY,noseZ+.03],[.045,grilleH*.88,.03],'vertical-grille-bar');
  if(d.grille==='ev') box(root,'#b3c1c5',[0,d.nose-.08,noseZ+.02],[W*.57,.026,.02],'nose-chrome');
  box(root,d.cladding?'#abb8bd':s.color,[0,.365,noseZ],[W*.73,.10,.055],'front-bumper');
  box(root,'#e7ebdf',[0,.445,tailZ-.01],[.32,.08,.025],'number-plate');
  if(s.spare) {
    cylinder(root,'#26313d',[0,1.05,-L*.505],.34,.19,'spare-wheel','z');
    cylinder(root,'#a7b5b9',[0,1.05,-L*.53],.19,.025,'spare-rim','z',8);
  }
  if(s.emergency) {
    beacon(root,roofY+.11);
    for(const side of [-1,1]) {
      box(root,'#244b78',[side*(W/2+.014),d.waist-.18,0],[.025,.13,L*.75],'police-stripe');
      cylinder(root,'#e3bd56',[side*(W/2+.03),d.waist-.01,.08],.11,.025,'badge','x',6);
    }
  }
}
