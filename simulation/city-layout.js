export const CITY_AREA_FRACTION = .08;
export const CITY_SCALE = Math.sqrt(CITY_AREA_FRACTION);
export const PENINSULA = [[-3500,-11500],[1300,-11500],[2000,-9300],[1600,-7000],[1400,-5300],[800,-3800],[1400,-2400],[900,-500],[1200,1200],[500,3000],[600,4300],[-100,5600],[100,6500],[-600,8600],[-1200,10700],[-2000,11200],[-2300,9500],[-2800,7200],[-2400,4800],[-3000,2900],[-3300,600],[-3700,-1200],[-3300,-3400],[-4000,-5800],[-3500,-7900],[-3900,-9300]].map(([x,z])=>[x*CITY_SCALE,z*CITY_SCALE]);
export const MAINLAND = [[2500,-11500],[5700,-11500],[5700,6000],[5200,6000],[4500,4000],[3800,2800],[3200,1000],[2800,-1400],[2100,-3700],[2600,-6100],[2000,-8800]].map(([x,z])=>[x*CITY_SCALE,z*CITY_SCALE]);
export function inside(x,z,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)result=!result;
  }
  return result;
}
export const isLand=(x,z)=>inside(x,z,PENINSULA)||inside(x,z,MAINLAND);
export const isLake=(x,z)=>((x-400*CITY_SCALE)/(650*CITY_SCALE))**2+((z+6100*CITY_SCALE)/(450*CITY_SCALE))**2<1;
export const isForest=(x,z)=>((x+1200*CITY_SCALE)/(1350*CITY_SCALE))**2+((z+8900*CITY_SCALE)/(2000*CITY_SCALE))**2<1;
export function seededRandom(seed=721){let v=seed>>>0;return()=>{v=(1664525*v+1013904223)>>>0;return v/4294967296;};}
