import * as THREE from 'three';
import { getBuildingSpec } from './catalog.js';
export { BUILDINGS, getBuildingSpec } from './catalog.js';
const GLYPHS = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'], E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'], H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'], L:['10000','10000','10000','10000','10000','10000','11111'],
  N:['10001','11001','11001','10101','10011','10011','10001'], O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'], R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110']
};
/** Self-contained, texture-free building group. Ground at Y=0; entrance faces +Z. */
export function createBuilding(id, options={}) {
  const s=getBuildingSpec(id), root=new THREE.Group();root.name=id;
  const color=options.color || s.color, geometries=new Map(), materials=new Map();
  root.userData={id,label:s.name,category:'buildings',assetType:'building',role:s.role,dimensions:{width:s.width,length:s.depth,height:s.height},occupants:[],paint:color};
  const mat=c=>{if(!materials.has(c)) materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.92,flatShading:true}));return materials.get(c);};
  const geometry=(key,fn)=>{if(!geometries.has(key))geometries.set(key,fn());return geometries.get(key);};
  function mesh(g,c,pos,size,name){const m=new THREE.Mesh(g,mat(c));m.name=name;m.position.set(...pos);m.scale.set(...size);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
  const box=(c,pos,size,name='panel')=>mesh(geometry('box',()=>new THREE.BoxGeometry(1,1,1)),c,pos,size,name);
  const cylinder=(c,pos,r,h,name,n=10)=>mesh(geometry(`cyl${n}`,()=>new THREE.CylinderGeometry(1,1,1,n)),c,pos,[r,h,r],name);
  const base=.22;
  box('#eef0ed',[0,.11,0],[s.width,.22,s.depth],'foundation');
  function volume(x,z,w,d,h,c=color,y=base){box(c,[x,y+h/2,z],[w,h,d],'building-body');box('#f1f2ed',[x,y+h+.09,z],[w+.18,.18,d+.18],'roof-coping');}
  function windows(x,z,w,d,floors,columns,spacing=2.15,start=1.45) {
    for(let floor=0;floor<floors;floor++)for(let column=0;column<columns;column++)for(const side of [-1,1]){
      const xx=x+(column-(columns-1)/2)*w/(columns+.4), y=base+start+floor*spacing;
      box('#b6cbd6',[xx,y,z+side*(d/2+.025)],[Math.min(1.35,w/columns*.55),.95,.035],'window');
      box('#d8e1e5',[xx,y-.52,z+side*(d/2+.06)],[Math.min(1.5,w/columns*.65),.08,.12],'window-sill');
    }
    for(let floor=0;floor<floors;floor++)for(const side of [-1,1])for(const zz of [-d*.25,d*.25])box('#b6cbd6',[x+side*(w/2+.025),base+start+floor*spacing,z+zz],[.035,.95,1.05],'side-window');
  }
  function entrance(x,z,w=2.3,y=base) {
    box('#8faab9',[x,y+1.15,z],[w,2.3,.045],'glass-entry');
    box('#ecf0eb',[x,y+1.15,z+.025],[.045,2.3,.05],'door-mullion');
    box('#f4f5ee',[x,y+2.45,z+.5],[w+1.1,.17,1.45],'entrance-canopy');
    for(let i=0;i<3;i++)box('#d7dfe3',[x,y-.02+i*.075,z+.38-i*.12],[w+1,.12+i*.12,.9-i*.19],'entrance-step');
  }
  function sign(text,x,y,z,width=4.5,bg='#677faf') {
    box(bg,[x,y,z],[width,.95,.075],'sign-board');
    const pixel=Math.min(.1,width/(text.length*6+1)),verts=[];
    for(let c=0;c<text.length;c++) (GLYPHS[text[c]]||[]).forEach((row,j)=>[...row].forEach((bit,i)=>{
      if(bit!=='1')return;
      const left=(c*6+i-text.length*3)*pixel, top=(3.5-j)*pixel;
      verts.push(left,top,0,left,top-pixel*.9,0,left+pixel*.9,top-pixel*.9,0,left,top,0,left+pixel*.9,top-pixel*.9,0,left+pixel*.9,top,0);
    }));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();
    mesh(g,'#fffdf3',[x,y,z+.05],[1,1,1],'sign-text');
  }
  function cross(x,y,z,size=1.5) {box('#d98280',[x,y,z],[size*.27,size,.065],'medical-cross');box('#d98280',[x,y,z+.006],[size,size*.27,.065],'medical-cross');}
  function shutter(x,y,z,w,h) {
    box('#94a7b1',[x,y+h/2,z],[w,h,.055],'garage-shutter');
    for(let i=0;i<h/.28;i++)box('#c2cdd2',[x,y+.15+i*.28,z+.04],[w,.025,.025],'shutter-slat');
  }
  function hedge(x,z,w=2) {box('#b9cac2',[x,.65,z],[w,.8,.7],'garden-hedge');}
  function roof(x,z,w,d,h,y,c='#a2afbb') {
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,h);shape.lineTo(w/2,0);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);
    mesh(g,c,[x,y,z],[1,1,1],'pitched-roof');
  }
  if(id==='police-station') {
    volume(0,-1.5,12,9,5.7);windows(0,-1.5,12,9,2,4,2.2);
    volume(-5.5,-3.5,3.6,4.5,7.3,'#7086bc');
    box('#7086bc',[0,3.2,3.07],[12,.33,.075],'police-facade-band');
    entrance(0,3.1,2.8);sign('POLICE',0,4.9,3.13,5.3,'#5d78ad');
    for(const x of [-2.1,2.1]) box('#f2f2e9',[x,1.3,4.1],[.28,2.6,.28],'portico-column');
    const star=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.35:.7;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)star.moveTo(x,y);else star.lineTo(x,y);}star.closePath();
    const badge=new THREE.ExtrudeGeometry(star,{depth:.05,bevelEnabled:false});mesh(badge,'#e1c184',[-5.5,5.8,-1.2],[1,1,1],'police-badge');
    cylinder('#8598a5',[-5.5,8.9,-3.5],.05,3,'radio-mast');box('#93a7b4',[-5.5,9.55,-3.5],[1.5,.05,.05],'antenna');
    for(const x of [-5,5]) hedge(x,5.5,2.5);
    box('#e7ebe7',[6.8,.7,4.5],[1.3,1.1,1.5],'security-booth');
    box('#d2b1a5',[3,.75,5.7],[4.8,.12,.12],'parking-barrier');
  } else if(id==='fire-station') {
    volume(1,-1,15,10,4.5);volume(-7,-2,3,5,8.7,'#c67570');
    for(const x of [-4,1,6]) {shutter(x,base,4.05,3.9,3.2);box('#e0a397',[x,3.9,4.06],[4.1,.18,.07],'bay-header');}
    sign('FIRE',1,4.25,4.16,3.3,'#b55f5c');
    for(let i=0;i<5;i++)box('#eac0ab',[-7,1.2+i*1.4,.56],[1.25,.55,.045],'drill-tower-window');
    box('#bc6e68',[-7,9.02,-2],[3.5,.25,5.5],'tower-cap');
    cylinder('#849da5',[6,5.1,-3],.45,.9,'roof-vent');
    for(const x of [-4,1,6]) {box('#e9dfcc',[x,.25,6],[.10,.025,3.3],'apron-lane');box('#efefdf',[x,.25,6.7],[2.3,.025,.12],'apron-stop-line');}
  } else if(id==='hospital') {
    volume(0,-3,10,9,10.8);windows(0,-3,10,9,5,3,1.9);
    volume(-6,0,4.6,11,4.4,'#dce6e5');volume(6,0,4.6,11,4.4,'#dce6e5');
    windows(-6,0,4.6,11,2,2,1.9);windows(6,0,4.6,11,2,2,1.9);
    volume(0,3,8,5,3.4,'#e6ece8');entrance(0,5.55,3.5);
    box('#d5837f',[0,3.8,5.6],[8,.17,.08],'hospital-red-band');sign('HOSPITAL',0,4.4,1.55,6,'#b87678');cross(0,9.2,1.55,1.8);
    box('#f7f3ea',[6,2.9,6.8],[5.5,.18,3],'ambulance-canopy');
    for(const x of [3.5,8.5])box('#b9c9d0',[x,1.52,7.6],[.13,2.6,.13],'ambulance-canopy-column');
    cross(6,3.02,8.34,1.0);
    cylinder('#d5e1dd',[0,11.17,-3],3.25,.08,'helipad',20);
    cylinder('#edf0e4',[0,11.23,-3],2.75,.035,'helipad-ring',20);
    cylinder('#d5e1dd',[0,11.26,-3],2.55,.035,'helipad-centre',20);
    for(const x of [-.8,.8])box('#f8faf2',[x,11.29,-3],[.24,.02,2.3],'helipad-H');box('#f8faf2',[0,11.29,-3],[1.6,.02,.24],'helipad-H');
    box('#c4d2d8',[-3,12,-5],[1.2,1.2,1.2],'hospital-roof-plant');
  } else if(id==='clinic') {
    volume(0,-1,7.5,6.5,3.4);windows(0,-1,7.5,6.5,1,3);entrance(0,2.3,2);
    sign('CLINIC',0,3,2.35,4.5,'#8fb9b3');cross(0,4.2,2.35,1.15);
    volume(-2.7,-1.2,1.3,3,4.3,'#9ebdb6');hedge(-3.5,3.8,2);hedge(3.5,3.8,2);
  } else if(id==='bungalow') {
    volume(0,-1,7.5,6,2.8);windows(0,-1,7.5,6,1,2,2,1.5);
    roof(0,-1,8.2,6.8,1.7,3.15,'#a7b6c0');
    box('#f0eee4',[0,1.2,2.1],[1.3,2,.05],'front-door');
    box('#d7dfde',[0,.35,3.2],[6.4,.18,2.4],'veranda');
    box('#e6ece9',[0,2.55,3.1],[6.7,.18,2.7],'porch-roof');
    for(const x of [-2.8,2.8])box('#eeeade',[x,1.45,4],[.19,2.2,.19],'porch-column');
    box('#c8c6b7',[-2.2,4.65,-2.3],[.6,1.35,.65],'chimney');
    for(const x of [-4.4,4.4]) {hedge(x,0,1);hedge(x,3,1);}
    box('#d6dcca',[0,.25,4.6],[1.3,.06,1.5],'garden-path');
    for(let i=0;i<10;i++)box('#e6e7db',[-4.5+i,.66,5],[.065,.8,.065],'picket-fence');
    box('#e6e7db',[0,.88,5],[9.2,.07,.07],'fence-rail');
  } else if(id==='villa') {
    volume(-2,-2.5,9,8,6.4);volume(4,0,4.5,7,3.1);windows(-2,-2.5,9,8,3,3,1.85,1.15);
    box('#ddd9ca',[-1,3.6,2.5],[6,.19,2.2],'balcony');
    for(const x of [-3.5,1.5])box('#b7c6ce',[x,4.1,3.4],[.06,.95,.06],'balcony-post');
    box('#b7c6ce',[-1,4.58,3.4],[5,.05,.05],'balcony-rail');
    entrance(-2,1.55,2.5);box('#a1c9d0',[4,.27,4.8],[4.4,.05,3],'swimming-pool');
    box('#d9ded5',[4,.31,6.45],[4.8,.1,.3],'pool-coping');
    for(const x of [-6,-1])box('#b2bba9',[x,2.1,4.2],[.12,3.6,.12],'pergola-post');
    for(let i=0;i<8;i++)box('#c7ceba',[-3.5,3.93,2.8+i*.4],[5.3,.12,.09],'pergola-slat');
    for(const x of [-7.5,7.5])hedge(x,-1,1);
  } else if(id==='low-rise-apartment'||id==='mid-rise-apartment') {
    const floors=id==='low-rise-apartment'?4:8,w=s.width-1.4,d=s.depth-1.4,h=floors*2.15;
    volume(0,0,w,d,h);windows(0,0,w,d,floors,3,2.15);
    for(let f=0;f<floors;f++)for(const x of [-w*.28,w*.28]){
      box('#d8e1e3',[x,base+.77+f*2.15,d/2+.55],[2,.12,1.1],'balcony-floor');
      box('#b5c5cc',[x,base+1.24+f*2.15,d/2+1],[2,.5,.08],'balcony-rail');
    }
    entrance(0,d/2+.06,1.6);
    cylinder('#b5c3cd',[-2,h+.85,-1],.6,1.2,'water-tank');
    box('#cfd8dc',[2,h+.75,-1],[2,1,2],'stairwell-roof');
  } else if(id==='office-tower') {
    const h=23;volume(0,0,8.5,8.5,h,color);
    for(let f=0;f<12;f++) {
      box('#e8edef',[0,.9+f*1.85,0],[8.7,.14,8.7],'floor-band');
      for(const side of [-1,1]) {
        box('#bfd3de',[side*4.28,1.6+f*1.85,0],[.03,1.3,8.1],'curtain-wall');
        box('#bfd3de',[0,1.6+f*1.85,side*4.28],[8.1,1.3,.03],'curtain-wall');
      }
    }
    for(const x of [-2.4,0,2.4])box('#93aabc',[x,11.7,4.31],[.06,23,.035],'facade-mullion');
    volume(0,0,10,10,2.8,'#d9e2e7');entrance(0,5.03,3.2);
    volume(0,-1,5,5,1.3,'#e9ece9',23.3);
  } else if(id==='corner-shop') {
    volume(0,-1,8,6,2.9);box('#a7c3d0',[0,1.3,2.03],[6.8,2,.04],'shopfront');entrance(0,2.08,1.5);
    sign('SHOP',0,2.9,2.1,3.4,'#a4bca8');
    for(let i=0;i<10;i++){const canopy=box(i%2?'#edece0':'#a4bca8',[-3.6+i*.8,2.55,2.7],[.8,.12,1.3],'striped-awning');canopy.rotation.x=.12;}
    for(const x of [-3.7,3.7])box('#a9bca9',[x,.72,3.6],[.6,.9,.6],'shop-planter');
  } else if(id==='warehouse') {
    volume(0,-1,15,10,4.4);roof(0,-1,15.5,10.5,1,4.65,'#adbdc7');
    for(const x of [-4.2,1])shutter(x,.65,4.1,3.8,3.4);
    box('#9db0bb',[6,1.9,4.1],[1.2,2.4,.04],'warehouse-door');
    box('#d5dedf',[0,.48,5.3],[14,.35,2],'loading-dock');
    for(const x of [-7,7])cylinder('#d0b984',[x,.95,5.7],.1,1.4,'safety-bollard');
    for(let i=0;i<6;i++)box('#bfcbd1',[-6.5+i*2.6,2.45,-6.03],[.10,4.3,.05],'warehouse-rib');
  }
  return root;
}
export function disposeBuilding(building) {
  const geometries=new Set(),materials=new Set();
  building.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());building.removeFromParent();
}
