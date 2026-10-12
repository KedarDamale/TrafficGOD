export const CITY_BOUNDS = { minX: -690, maxX: 690, minZ: -760, maxZ: 760, width: 1380, length: 1520 };
export const CITY_AREA_FRACTION = CITY_BOUNDS.width * CITY_BOUNDS.length / (10700 * 23000);
export const CITY_SCALE = Math.sqrt(CITY_AREA_FRACTION);
export const PENINSULA = [[-610,-760],[210,-760],[275,-610],[250,-370],[295,-180],[275,80],[240,340],[180,580],[80,760],[-380,730],[-570,580],[-640,310],[-610,80],[-690,-180],[-660,-490]];
export const MAINLAND = [[350,-720],[660,-680],[690,-360],[670,100],[640,530],[410,640],[330,400],[360,90],[340,-200]];
export const CITY_PARK = { x: -440, z: -560, rx: 65, rz: 85 };
export const CITY_LAKE = { x: -390, z: -510, rx: 26, rz: 34 };
export function inside(x,z,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)result=!result;
  }
  return result;
}
export const isLand=(x,z)=>inside(x,z,PENINSULA)||inside(x,z,MAINLAND);
export const isLake=(x,z)=>((x-CITY_LAKE.x)/CITY_LAKE.rx)**2+((z-CITY_LAKE.z)/CITY_LAKE.rz)**2<1;
export const isForest=(x,z)=>((x-CITY_PARK.x)/CITY_PARK.rx)**2+((z-CITY_PARK.z)/CITY_PARK.rz)**2<1;
export function seededRandom(seed=721){let v=seed>>>0;return()=>{v=(1664525*v+1013904223)>>>0;return v/4294967296;};}
