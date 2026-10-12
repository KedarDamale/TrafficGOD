import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVehicle,disposeVehicle,PAINT_COLORS,getVehicleSpec } from '../3d_models/index.js';
import { CAR_DESIGNS } from '../3d_models/cars/designs.js';

const PROXY_PARTS=new Set(['body','roof-slab','windshield','side-glass','cab-base','cab-roof','cab-back','cargo-body','fuel-tank','saddle','rear-cowl','leg-shield','side-panel','frame','step-through','tire','head','torso','helmet']);
function simpleBody(spec){
  const d=CAR_DESIGNS[spec.id],L=spec.length,shape=new THREE.Shape();
  shape.moveTo(-L*.485,.35);shape.lineTo(-L*.485,d.tail);shape.lineTo(-L*.24,d.waist);shape.lineTo(L*.20,d.waist);shape.lineTo(L*.485,d.nose);shape.lineTo(L*.485,.35);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:spec.width,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(spec.width/2,0,0);return g;
}
function partsFor(id,detailed){
  const source=createVehicle(id,{color:'#ffffff'}),bins=new Map(),wheel=new THREE.CylinderGeometry(1,1,1,6);
  source.updateMatrixWorld(true);
  source.traverse(o=>{
    if(!o.isMesh||(!detailed&&!PROXY_PARTS.has(o.name)))return;
    let g=!detailed&&o.name==='body'?simpleBody(getVehicleSpec(id)):!detailed&&o.name==='tire'?wheel.clone():o.geometry.clone();
    if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
    for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
    g.applyMatrix4(o.matrixWorld);
    const paint=o.material.color.getHex()===0xffffff,key=o.material.color.getHexString()+':'+o.material.transparent;
    if(!bins.has(key)){
      const material=detailed?o.material.clone():new THREE.MeshBasicMaterial({color:o.material.color,transparent:o.material.transparent,opacity:o.material.opacity,depthWrite:o.material.depthWrite,side:o.material.side});
      bins.set(key,{paint,material,geometry:[]});
    }
    bins.get(key).geometry.push(g);
  });
  wheel.dispose();disposeVehicle(source);
  return [...bins.values()].map(bin=>{const geometry=mergeGeometries(bin.geometry,false);bin.geometry.forEach(g=>g.dispose());return{paint:bin.paint,material:bin.material,geometry};});
}
/** Instanced civilian fleet: cheap silhouettes in the overview; full models around the camera. */
export class FleetRenderer {
  constructor(agents){
    this.root=new THREE.Group();this.root.name='citywide-civilian-traffic';this.records=[];
    const models=[...new Set(agents.map(a=>a.model))];
    for(const id of models){
      const members=agents.filter(a=>a.model===id),scale=members[0].kind==='bike'?1.45:members[0].kind==='truck'?1.1:1.2;
      const variants=[false,true].map(detailed=>{
        const group=new THREE.Group();this.root.add(group);
        const meshes=partsFor(id,detailed).map(part=>{
          const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);
          return{mesh,paint:part.paint};
        });
        return{group,meshes};
      });
      this.records.push({members,scale,variants});
    }
    this.transform=new THREE.Object3D();this.colors=PAINT_COLORS.map(c=>new THREE.Color(c));this.visibleCount=agents.length;
  }
  update({detailed=false,center={x:0,z:0},radius=Infinity}={}){
    const matrix=this.transform;
    let total=0;
    for(const record of this.records){
      record.variants[0].group.visible=!detailed;record.variants[1].group.visible=detailed;
      const variant=record.variants[detailed?1:0];let index=0;
      for(const a of record.members){
        if(!a.pose||(detailed&&Math.hypot(a.pose.x-center.x,a.pose.z-center.z)>radius))continue;
        matrix.position.set(a.pose.x,a.pose.y??.16,a.pose.z);matrix.rotation.set(0,a.pose.heading,0);matrix.scale.setScalar(record.scale);matrix.updateMatrix();
        for(const {mesh,paint} of variant.meshes){mesh.setMatrixAt(index,matrix.matrix);if(paint)mesh.setColorAt(index,this.colors[a.colorIndex]);}
        index++;
      }
      for(const {mesh,paint} of variant.meshes){mesh.count=index;mesh.instanceMatrix.needsUpdate=true;if(paint&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
      total+=index;
    }
    this.visibleCount=total;
  }
  dispose(){
    for(const record of this.records)for(const variant of record.variants)for(const {mesh} of variant.meshes){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}
    this.root.removeFromParent();
  }
}
