import * as THREE from 'three';

// Test the building volumes, so clicking a roof selects that building rather
// than the ground behind it. Rotation matters on the curved street frontages.
export function createBuildingPicker(buildings) {
  const volumes=buildings.map(building=>{
    const transform=new THREE.Matrix4().compose(
      new THREE.Vector3(building.x,.15,building.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),building.yaw||0),
      new THREE.Vector3(1,1,1)
    );
    const box=new THREE.Box3(new THREE.Vector3(-building.width/2,0,-building.depth/2),new THREE.Vector3(building.width/2,building.height+3,building.depth/2));
    return {building,box,inverse:transform.invert()};
  });
  const ray=new THREE.Ray(),hit=new THREE.Vector3();
  return input=>{
    let result=null,distance=Infinity;
    for(const volume of volumes){
      ray.copy(input).applyMatrix4(volume.inverse);
      if(ray.intersectBox(volume.box,hit)){
        const d=hit.distanceTo(ray.origin);
        if(d<distance){distance=d;result=volume.building;}
      }
    }
    return result;
  };
}
