import { nearestNode,findRoute,routeLength } from './graph.js';
import { expandRoute,sampleRoad } from './road-network.js';
export const TRAFFIC_COUNT = 2000;

export class AmbulanceDemoController {
  constructor(map){this.map=map;this.nodes=new Map(map.nodes.map(n=>[n.id,n]));this.timeScale=6;this.speed=12;this.reset();}
  reset(){this.phase='idle';this.paused=false;this.clock=0;this.segment=0;this.distance=0;this.travelled=0;this.priorities=new Map();this.route=[];this.outbound=[];this.pose=null;this.hospital=null;this.hold=0;this.eventType='ambulance';}
  start(targetId,eventType='ambulance',incident=null){
    if(!['idle','completed'].includes(this.phase))return false;
    const target=this.nodes.get(targetId);if(!target)throw new RangeError('Choose a valid incident road');
    const destination=incident||target;
    const hospitals=this.map.services.filter(s=>s.type==='hospital').sort((a,b)=>Math.hypot(a.x-destination.x,a.z-destination.z)-Math.hypot(b.x-destination.x,b.z-destination.z));
    let route,hospital;
    for(const candidate of hospitals){route=findRoute(this.map.nodes,candidate.roadNode,targetId);if(route){hospital=candidate;break;}}
    if(!route)throw new Error('The incident is not reachable from a hospital');
    this.reset();this.hospital=hospital;this.eventType=eventType;this.target=target;
    this.outbound=[...(hospital.connector||[hospital.entrance]),...expandRoute(this.map,route)];
    if(incident){
      const road=this.map.roads.find(r=>r.id===incident.roadId),fromA=road.a===targetId;
      const tail=fromA?road.points.filter(p=>p.distance>0&&p.distance<incident.along):road.points.filter(p=>p.distance<road.length&&p.distance>incident.along).reverse();
      this.outbound.push(...tail.map(p=>({x:p.x,z:p.z,roadId:road.id,y:road.bridge?.5:.14})),{x:incident.x,z:incident.z,roadId:road.id,y:road.bridge?.5:.14});
    }
    this.route=this.outbound;this.totalDistance=routeLength(this.outbound)*2;this.phase='outbound';this.pose={...this.route[0],heading:0};this.updatePriorities();return true;
  }
  updatePriorities(){
    this.priorities.clear();
    if(!['outbound','returning'].includes(this.phase))return;
    const seen=new Set();
    for(let i=Math.max(0,this.segment-16);i<this.route.length;i++){
      const p=this.route[i],next=this.route[i+1]||this.route[i-1],previous=this.route[i-1];
      if(!p.id||!next)continue;
      if(i<this.segment&&this.segment-i>16)continue;
      const roadIds=[previous?.roadId,p.roadId,next.roadId].filter(Boolean);
      this.priorities.set(p.id,{axis:Math.abs(next.x-p.x)>Math.abs(next.z-p.z)?'x':'z',roads:[...new Set(roadIds)]});
      if(i>=this.segment)seen.add(p.id);
      if(seen.size===5)break;
    }
  }
  corridorEnd(){
    let count=0;
    for(let i=this.segment+1;i<this.route.length;i++)if(this.route[i].id&&++count===5)return i;
    return this.route.length-1;
  }
  tick(realDelta){
    if(this.paused)return;
    const delta=Math.max(0,realDelta)*this.timeScale;this.clock+=delta;
    if(['idle','completed'].includes(this.phase))return;
    if(this.phase==='at-incident'){
      this.hold+=delta;
      if(this.hold>=24){this.route=[...this.outbound].reverse();this.segment=0;this.distance=0;this.phase='returning';this.updatePriorities();}
      return;
    }
    let step=this.speed*delta;
    while(step>0&&this.segment<this.route.length-1){
      const a=this.route[this.segment],b=this.route[this.segment+1],length=Math.hypot(b.x-a.x,b.z-a.z),remaining=length-this.distance;
      if(step>=remaining){this.travelled+=remaining;step-=remaining;this.segment++;this.distance=0;}
      else{this.distance+=step;this.travelled+=step;step=0;}
    }
    if(this.segment>=this.route.length-1){this.pose={...this.route.at(-1),heading:this.pose.heading};this.phase=this.phase==='outbound'?'at-incident':'completed';this.updatePriorities();return;}
    const a=this.route[this.segment],b=this.route[this.segment+1],length=Math.hypot(b.x-a.x,b.z-a.z),t=length?this.distance/length:1;
    this.pose={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y??.14,heading:Math.atan2(b.x-a.x,b.z-a.z)};this.updatePriorities();
  }
  snapshot(){return{phase:this.phase,paused:this.paused,eventType:this.eventType,progress:this.phase==='completed'?1:this.totalDistance?Math.min(1,this.travelled/this.totalDistance):0,prioritySignals:this.priorities.size,remainingSeconds:this.totalDistance?Math.max(0,(this.totalDistance-this.travelled)/this.speed):0,hospital:this.hospital?.id||null};}
}
export function chooseLocations(map){
  return [['Worli',-220,520],['Dadar',-220,100],['Tilak Nagar',-230,-180],['Shivaji Nagar',-240,-550],['Chembur',510,-350],['Wadala',510,330]].map(([name,x,z])=>({name,node:nearestNode(map.nodes,x,z).id}));
}
const CARS=['baleno','nexon','punch','fronx','wagon-r','dzire','creta','swift','scorpio','ertiga'];
const BIKES=['splendor-plus','activa','jupiter','shine','pulsar','apache','hf-deluxe','classic-350','access-125','xl100'];
const TRUCKS=['delivery-truck','tipper-truck','tanker-truck'];
/** Persistent citywide mixed traffic. Vehicles follow curved centerlines and stop/yield by road approach. */
export class CivilianTraffic {
  constructor(map,route=[],count=3600){
    this.nodes=new Map(map.nodes.map(n=>[n.id,n]));this.agents=[];this.seed=912;this.yielding=0;
    this.roads=map.roads.map((r,i)=>{
      if(r.points)return r;
      const a=this.nodes.get(r.a),b=this.nodes.get(r.b),length=Math.hypot(b.x-a.x,b.z-a.z);
      return {...r,id:r.id||'R'+i,lanes:r.lanes||2,width:r.width||9,length,points:[{...a,distance:0},{...b,distance:length}]};
    });
    this.lookup=new Map(this.roads.map(r=>[r.id,r]));this.outgoing=new Map();
    for(const n of map.nodes)this.outgoing.set(n.id,this.roads.filter(r=>r.a===n.id||(!r.oneWay&&r.b===n.id)));
    for(let i=0;i<count;i++){
      const road=this.roads[i%this.roads.length],reverse=!road.oneWay&&Math.floor(i/this.roads.length)%2===1;
      let kind=i%20<12?'bike':i%20<19?'car':'truck';if(road.lanes===1&&kind==='truck')kind='car';
      const model=kind==='bike'?BIKES[i%BIKES.length]:kind==='car'?CARS[(i+Math.floor(i/20))%CARS.length]:TRUCKS[i%TRUCKS.length];
      const agent={id:i,road:road.id,a:reverse?road.b:road.a,b:reverse?road.a:road.b,t:this.random()*.95,speed:kind==='bike'?7+this.random()*4:5+this.random()*4,kind,model,colorIndex:(i+Math.floor(i/this.roads.length))%6,lane:i%2,offset:0,stopped:false,pose:null};
      agent.offset=this.laneOffset(agent,road);this.agents.push(agent);
    }
  }
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  laneOffset(agent,road){
    if(road.lanes===1)return agent.kind==='bike'?(agent.id%2?-1.85:1.85):0;
    if(agent.kind==='bike')return road.lanes===4?(agent.id%2?3.5:7.3):3.8;
    return road.lanes===4?(agent.lane?5.25:1.75):1.9;
  }
  tick(dt,controller){
    const delta=dt*controller.timeScale;this.yielding=0;
    const buckets=new Map(),leaders=new Map();
    for(const a of this.agents){
      const road=this.lookup.get(a.road),lane=road.lanes===4?a.lane:road.lanes===1&&a.kind==='bike'?Math.sign(a.offset):0;
      const key=a.a+'>'+a.b+':'+(a.kind==='bike'?'bike':'motor')+':'+lane;
      if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(a);
    }
    for(const list of buckets.values()){
      list.sort((a,b)=>b.t-a.t);
      for(let i=1;i<list.length;i++)leaders.set(list[i].id,list[i-1]);
    }
    for(const agent of this.agents){
      let road=this.lookup.get(agent.road),reverse=agent.a!==road.a;
      const sample=sampleRoad(road,(reverse?1-agent.t:agent.t)*road.length),heading=sample.heading+(reverse?Math.PI:0),b=this.nodes.get(agent.b);
      const priority=controller.priorities.get(b.id),axis=Math.abs(Math.sin(heading))>Math.abs(Math.cos(heading))?'x':'z',normal=Math.floor(controller.clock/12)%2?'z':'x';
      const green=priority?(priority.roads?priority.roads.includes(road.id):priority.axis===axis):normal===axis;
      const red=b.signal!==null&&!green,close=controller.pose&&Math.hypot(controller.pose.x-sample.x,controller.pose.z-sample.z)<55&&['outbound','returning'].includes(controller.phase);
      const leader=leaders.get(agent.id),gap=agent.kind==='bike'?3.8:agent.kind==='truck'?10:7;
      const queued=leader&&leader.a===agent.a&&leader.b===agent.b&&(leader.t-agent.t)*road.length<gap;
      const stopDistance=agent.kind==='bike'?12:18;
      agent.stopped=!!close||!!queued||(red&&(1-agent.t)*road.length<stopDistance+2);
      if(agent.stopped)this.yielding++;
      const weave=agent.kind==='bike'?Math.sin(controller.clock*.4+agent.id)*.10:0;
      const desiredOffset=close?(road.width/2+1.4)*(agent.offset<0?-1:1):this.laneOffset(agent,road)+weave;
      agent.offset+=(desiredOffset-agent.offset)*Math.min(1,dt*5);
      if(!agent.stopped){
        let next=agent.t+agent.speed*delta/road.length;
        if(red)next=Math.min(next,Math.max(0,1-stopDistance/road.length));
        if(leader&&leader.a===agent.a&&leader.b===agent.b&&leader.t>agent.t)next=Math.min(next,Math.max(agent.t,leader.t-gap/road.length));
        agent.t=next;
      }
      if(agent.t>=1){
        const outgoing=this.outgoing.get(agent.b),choices=outgoing.filter(r=>r.id!==road.id);
        const next=(choices.length?choices:outgoing)[Math.floor(this.random()*(choices.length||outgoing.length))];
        if(next){agent.a=agent.b;agent.b=next.a===agent.a?next.b:next.a;agent.road=next.id;}
        else{const departure=this.roads[Math.floor(this.random()*this.roads.length)];agent.a=departure.a;agent.b=departure.b;agent.road=departure.id;}
        agent.t=0;road=this.lookup.get(agent.road);reverse=agent.a!==road.a;
      }
      const p=sampleRoad(road,(reverse?1-agent.t:agent.t)*road.length),angle=p.heading+(reverse?Math.PI:0);
      agent.pose={x:p.x+Math.cos(angle)*agent.offset,z:p.z-Math.sin(angle)*agent.offset,y:road.bridge?.5:.16,heading:angle};
    }
  }
}
