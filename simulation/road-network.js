import { CITY_BOUNDS, inside, PENINSULA, isLand, isLake, isForest, seededRandom } from './city-layout.js';
export const ROAD_COUNT = 100;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function sampleRoad(road,along) {
  const d=Math.max(0,Math.min(road.length,along));
  let index=1;
  while(index<road.points.length-1 && road.points[index].distance<d)index++;
  const a=road.points[index-1],b=road.points[index],span=b.distance-a.distance,t=span?(d-a.distance)/span:0;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z),index};
}
export function nearestRoad(roads,x,z) {
  let best=null;
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length2)),px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.distance)best={road,x:px,z:pz,distance:d,along:a.distance+Math.sqrt(length2)*t,index:i};
  }
  return best;
}
function crosses(a,b,c,d) {
  const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  return cross(a,b,c)*cross(a,b,d)<-.01 && cross(c,d,a)*cross(c,d,b)<-.01;
}
function curvesCross(a,b){
  if(a.a.id===b.a.id||a.a.id===b.b.id||a.b.id===b.a.id||a.b.id===b.b.id)return false;
  for(let i=1;i<a.points.length;i++)for(let j=1;j<b.points.length;j++)if(crosses(a.points[i-1],a.points[i],b.points[j-1],b.points[j]))return true;
  return false;
}
function curve(a,b,bend){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
  const points=[];
  for(let i=0;i<=16;i++){
    const t=i/16,w=Math.sin(Math.PI*t)*bend;
    points.push({x:a.x+dx*t+nx*w,z:a.z+dz*t+nz*w});
  }
  return points;
}
function district(n) {
  if(n.zone==='mainland')return n.z<0?'Chembur':'Wadala';
  return n.z<-340?'Shivaji Nagar':n.z<-40?'Tilak Nagar':n.z<300?'Dadar':'Worli';
}
/** A physically compact neighborhood with exactly 100 connected, curved streets. */
export function createRoadNetwork() {
  const rand=seededRandom(832),nodes=[];
  for(let zone=0;zone<2;zone++) {
    const quota=zone?18:48;
    for(let attempts=0,count=0;count<quota&&attempts<30000;attempts++){
      const x=CITY_BOUNDS.minX+rand()*CITY_BOUNDS.width,z=CITY_BOUNDS.minZ+rand()*CITY_BOUNDS.length;
      if(!isLand(x,z)||isLake(x,z)||isForest(x,z))continue;
      const mainland=!inside(x,z,PENINSULA);
      if(mainland!==!!zone||nodes.some(n=>Math.hypot(n.x-x,n.z-z)<95))continue;
      const n={id:'J'+String(nodes.length+1).padStart(3,'0'),x,z,zone:zone?'mainland':'peninsula',neighbors:[],costs:{},signal:null};n.district=district(n);nodes.push(n);count++;
    }
  }
  if(nodes.length!==66)throw new Error('Could not place the road junctions');
  const candidates=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],length=distance(a,b);if(a.zone!==b.zone)continue;
    const magnitude=(.045+rand()*.105)*length;
    let points=curve(a,b,magnitude*(rand()<.5?-1:1));
    if(points.some(p=>!isLand(p.x,p.z)||isLake(p.x,p.z)))points=curve(a,b,-magnitude*.6);
    if(points.some(p=>!isLand(p.x,p.z)||isLake(p.x,p.z)))points=curve(a,b,magnitude*.2);
    if(points.some(p=>!isLand(p.x,p.z)||isLake(p.x,p.z)))continue;
    candidates.push({a,b,points,length,bridge:false});
  }
  candidates.sort((a,b)=>a.length-b.length);
  const parents=new Map(nodes.map(n=>[n.id,n.id]));
  const root=id=>{while(parents.get(id)!==id)id=parents.get(id);return id;};
  const selected=[];
  for(const c of candidates)if(root(c.a.id)!==root(c.b.id)){parents.set(root(c.a.id),root(c.b.id));selected.push(c);}
  // Join any coastal pockets, plus the mainland, with explicitly modelled bridges.
  while(new Set(nodes.map(n=>root(n.id))).size>1){
    let best;
    for(const a of nodes)for(const b of nodes)if(root(a.id)!==root(b.id)&&(!best||distance(a,b)<best.length))best={a,b,length:distance(a,b)};
    parents.set(root(best.a.id),root(best.b.id));selected.push({...best,bridge:true,points:curve(best.a,best.b,best.length*.035)});
  }
  const keys=new Set(selected.map(c=>[c.a.id,c.b.id].sort().join(':')));
  for(const c of candidates){
    const key=[c.a.id,c.b.id].sort().join(':');
    if(keys.has(key)||selected.some(r=>curvesCross(c,r)))continue;
    selected.push(c);keys.add(key);if(selected.length===ROAD_COUNT)break;
  }
  if(selected.length!==ROAD_COUNT)throw new Error('Could not create exactly 100 streets');
  const byLength=[...selected].sort((a,b)=>a.length-b.length);
  const names=['Lokmanya Tilak Marg','Chhatrapati Shivaji Maharaj Marg','Dr. Babasaheb Ambedkar Marg','Mahatma Phule Marg','Savitribai Phule Marg','Sant Dnyaneshwar Marg','Sant Tukaram Marg','Veer Savarkar Marg','Senapati Bapat Marg','Gokhale Marg','Agarkar Marg','Shahu Maharaj Marg','Jijamata Marg','Rajmata Jijau Marg','Samarth Ramdas Marg','Sant Namdev Marg','Vishnudas Bhave Marg','Pu. La. Deshpande Marg','Kusumagraj Marg','Yashwantrao Chavan Marg','Ganesh Mandir Path','Maruti Mandir Marg','Bazar Peth Road','Gaothan Galli','Saraswati Path','Vidya Mandir Marg','Matoshri Marg','Subhash Chowk Marg','Sane Guruji Marg','Karmaveer Bhaurao Patil Marg','Dadasaheb Phalke Marg','Vasantrao Naik Marg','Tulshibaug Galli','Vitthal Mandir Path','Shivneri Marg','Raigad Marg'];
  const areaCounts=new Map();
  const roads=selected.map((c,i)=>{
    const rank=byLength.indexOf(c),lanes=c.bridge?4:rank<26?1:rank>=76?4:2;
    let length=0;
    const points=c.points.map((p,j)=>{if(j)length+=distance(c.points[j-1],p);return {...p,distance:length,...(j===0?{node:c.a.id}:j===c.points.length-1?{node:c.b.id}:{})};});
    const character=c.bridge?'Harbor bridge':lanes===1?(i%2?'Bazaar lane':'Residential alley'):lanes===4?(i%2?'Tree-lined boulevard':'Urban arterial'):['Waterfront connector','School street','Garden crescent','Neighborhood link'][i%4];
    const number=areaCounts.get(c.a.district)||0;areaCounts.set(c.a.district,number+1);
    const road={id:'R'+String(i+1).padStart(3,'0'),name:names[number%names.length]+(number>=names.length?' '+(Math.floor(number/names.length)+1):'')+' · '+c.a.district,a:c.a.id,b:c.b.id,lanes,oneWay:false,width:lanes*3.5+2,length,points,bridge:c.bridge,character,district:c.a.district};
    c.a.neighbors.push(c.b.id);c.b.neighbors.push(c.a.id);c.a.costs[c.b.id]=length;c.b.costs[c.a.id]=length;
    return road;
  });
  // Only make an alley one-way when the remaining two-way network still connects
  // both ends. Every junction retains an exit; traffic never needs to respawn.
  for(const road of roads.filter(r=>r.lanes===1)){
    const seen=new Set([road.a]),queue=[road.a];
    for(let i=0;i<queue.length;i++)for(const r of roads){
      if(r===road||r.oneWay)continue;
      const next=r.a===queue[i]?r.b:r.b===queue[i]?r.a:null;
      if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
    }
    road.oneWay=seen.has(road.b);
  }
  return {nodes,roads};
}
export function expandRoute(map,nodes) {
  const lookup=new Map(map.roads.flatMap(r=>[[r.a+'>'+r.b,r],[r.b+'>'+r.a,r]])),points=[];
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],road=lookup.get(a.id+'>'+b.id),path=road.a===a.id?road.points:[...road.points].reverse();
    const expanded=path.map(p=>({x:p.x,z:p.z,...(p.node?{id:p.node}:{}),roadId:road.id,y:road.bridge?.5:.14}));
    if(points.length)points.pop();
    points.push(...expanded);
  }
  if(!points.length)points.push({...nodes[0]});
  return points;
}
