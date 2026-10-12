import { nearestNode,findRoute,routeLength } from './graph.js';
import { expandRoute,sampleRoad } from './road-network.js';
export const TRAFFIC_COUNT = 5000;

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
/** Lane queues and coordinated junction release; vehicles never leave the asphalt to yield. */
export class CivilianTraffic {
  constructor(map,route=[],count=TRAFFIC_COUNT){
    this.nodes=new Map(map.nodes.map(n=>[n.id,n]));this.agents=[];this.seed=912;this.yielding=0;this.junctionLocks=new Map();
    this.roads=map.roads.map((r,i)=>{
      if(r.points)return r;
      const a=this.nodes.get(r.a),b=this.nodes.get(r.b),length=Math.hypot(b.x-a.x,b.z-a.z);
      return {...r,id:r.id||'R'+i,lanes:r.lanes||2,width:r.width||9,length,points:[{...a,distance:0},{...b,distance:length}]};
    });
    this.lookup=new Map(this.roads.map(r=>[r.id,r]));this.outgoing=new Map();
    for(const n of map.nodes)this.outgoing.set(n.id,this.roads.filter(r=>r.a===n.id||(!r.oneWay&&r.b===n.id)));
    const schedule=[];
    if(count>=this.roads.length){
      const weights=this.roads.map(r=>r.length*(r.oneWay?1:r.lanes===1?1.4:r.lanes)),total=weights.reduce((s,w)=>s+w,0);
      const quotas=weights.map(w=>1+Math.floor((count-this.roads.length)*w/total));
      for(let i=quotas.reduce((s,n)=>s+n,0);i<count;i++)quotas[i%quotas.length]++;
      for(let layer=0;schedule.length<count;layer++)this.roads.forEach((r,i)=>{if(layer<quotas[i])schedule.push(r);});
    }
    const roadCounts=new Map();
    for(let i=0;i<count;i++){
      const road=schedule[i]||this.roads[i%this.roads.length],layer=roadCounts.get(road.id)||0,reverse=!road.oneWay&&layer%2===1;
      roadCounts.set(road.id,layer+1);
      const mix=(i+layer*7)%20;
      let kind=mix<12?'bike':mix<19?'car':'truck';if(road.lanes===1&&kind==='truck')kind='car';
      const model=kind==='bike'?BIKES[(i+layer)%BIKES.length]:kind==='car'?CARS[(i+layer)%CARS.length]:TRUCKS[(i+layer)%TRUCKS.length];
      const speed=kind==='bike'?8+this.random()*3:6+this.random()*3;
      const agent={id:i,road:road.id,a:reverse?road.b:road.a,b:reverse?road.a:road.b,t:0,speed,velocity:speed,kind,model,colorIndex:(i+layer)%6,lane:Math.floor(layer/2)%2,offset:0,stopped:false,pose:null,turn:null,nextRoad:null};
      agent.offset=this.laneOffset(agent,road);this.agents.push(agent);
    }
    // Separate vehicles within each lane rather than randomly spawning overlaps.
    const lanes=new Map();
    for(const a of this.agents){const key=this.laneKey(a);if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(a);}
    for(const list of lanes.values())list.forEach((a,i)=>{a.t=(i+.25)/list.length*.88;});
  }
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  laneOffset(agent,road){
    if(road.lanes===1)return agent.kind==='bike'?(agent.id%2?-1.6:1.6):0;
    if(agent.kind==='bike')return road.lanes===4?(agent.lane?7.1:3.3):3.5;
    return road.lanes===4?(agent.lane?5.25:1.75):1.75;
  }
  laneKey(agent,road=this.lookup.get(agent.road)){
    const lane=road.lanes===4?agent.lane:road.lanes===1&&agent.kind==='bike'?Math.sign(agent.offset):0;
    return agent.a+'>'+agent.b+':'+(agent.kind==='bike'?'bike':'motor')+':'+lane;
  }
  roadPose(road,a,along,offset){
    const reverse=a!==road.a,p=sampleRoad(road,reverse?road.length-along:along),heading=p.heading+(reverse?Math.PI:0);
    return {x:p.x+Math.cos(heading)*offset,z:p.z-Math.sin(heading)*offset,y:road.bridge?.5:.16,heading};
  }
  planExit(agent,controller){
    const exits=this.outgoing.get(agent.b)||[],alternatives=exits.filter(r=>r.id!==agent.road);
    let choices=alternatives.length?alternatives:exits;
    const priority=controller.priorities.get(agent.b);
    const corridor=choices.filter(r=>priority?.roads?.includes(r.id));
    if(corridor.length)choices=corridor;
    if(!choices.some(r=>r.id===agent.nextRoad))agent.nextRoad=choices[Math.floor(this.random()*choices.length)]?.id||null;
    return this.lookup.get(agent.nextRoad);
  }
  startTurn(agent,road,next,turnDistance){
    const start=this.roadPose(road,agent.a,road.length-turnDistance,agent.offset),node=agent.b;
    const nextB=next.a===node?next.b:next.a,endAlong=Math.min(12,next.length*.2);
    const endOffset=this.laneOffset(agent,next),end=this.roadPose(next,node,endAlong,endOffset);
    const handle=Math.max(6,Math.hypot(end.x-start.x,end.z-start.z)*.5);
    const c1={x:start.x+Math.sin(start.heading)*handle,z:start.z+Math.cos(start.heading)*handle};
    const c2={x:end.x-Math.sin(end.heading)*handle,z:end.z-Math.cos(end.heading)*handle};
    const points=[];let length=0;
    for(let i=0;i<=24;i++){
      const t=i/24,u=1-t;
      const p={x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,z:u*u*u*start.z+3*u*u*t*c1.z+3*u*t*t*c2.z+t*t*t*end.z};
      if(i)length+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);
      points.push({...p,distance:length});
    }
    agent.turn={node,path:{points,length},along:0,startY:start.y,endY:end.y,endHeading:end.heading};
    this.junctionLocks.set(node,agent.id);
    agent.a=node;agent.b=nextB;agent.road=next.id;agent.t=endAlong/next.length;agent.offset=endOffset;agent.nextRoad=null;
  }
  advanceTurn(agent,delta){
    const turn=agent.turn;turn.along=Math.min(turn.path.length,turn.along+Math.max(3,agent.velocity)*delta);
    const p=sampleRoad(turn.path,turn.along),fraction=turn.path.length?turn.along/turn.path.length:1;
    agent.pose={x:p.x,z:p.z,y:turn.startY+(turn.endY-turn.startY)*fraction,heading:p.heading};agent.stopped=false;
    if(turn.along>=turn.path.length){agent.pose.heading=turn.endHeading;this.junctionLocks.delete(turn.node);agent.turn=null;}
  }
  tick(dt,controller){
    const delta=dt*controller.timeScale;this.yielding=0;
    const buckets=new Map(),leaders=new Map(),entries=new Map();
    for(const a of this.agents){
      const key=this.laneKey(a);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(a);
      const distance=a.t*this.lookup.get(a.road).length;
      entries.set(key,Math.min(entries.get(key)??Infinity,distance));
    }
    for(const list of buckets.values()){
      list.sort((a,b)=>b.t-a.t);
      for(let i=1;i<list.length;i++)leaders.set(list[i].id,list[i-1]);
    }
    for(const agent of this.agents){
      if(agent.turn){this.advanceTurn(agent,delta);continue;}
      const road=this.lookup.get(agent.road),b=this.nodes.get(agent.b),pose=this.roadPose(road,agent.a,agent.t*road.length,agent.offset);
      const priority=controller.priorities.get(b.id),axis=Math.abs(Math.sin(pose.heading))>Math.abs(Math.cos(pose.heading))?'x':'z',normal=Math.floor(controller.clock/12)%2?'z':'x';
      const green=priority?(priority.roads?priority.roads.includes(road.id):priority.axis===axis):normal===axis;
      // Preemption also stops crossing traffic at junctions without a normal signal.
      const red=(!!priority||b.signal!=null)&&!green;
      const gap=agent.kind==='bike'?4:agent.kind==='truck'?11:7.5,stopDistance=agent.kind==='bike'?14:18;
      const turnDistance=Math.min(12,road.length*.2),next=this.planExit(agent,controller);
      const nextAgent=next?{...agent,a:agent.b,b:next.a===agent.b?next.b:next.a,offset:this.laneOffset(agent,next)}:null;
      const entryGap=next?entries.get(this.laneKey(nextAgent,next))??Infinity:0;
      const blocked=!next||entryGap<Math.min(12,next.length*.2)+gap||this.junctionLocks.has(agent.b);
      const distanceToEnd=(1-agent.t)*road.length,leader=leaders.get(agent.id);
      const queued=leader&&leader.road===agent.road&&leader.a===agent.a&&leader.b===agent.b&&(leader.t-agent.t)*road.length<gap+.5;
      agent.stopped=!!queued||((red||blocked)&&distanceToEnd<=stopDistance+.1);
      const targetSpeed=agent.stopped?0:priority&&green?Math.max(agent.speed,agent.kind==='truck'?11:14):agent.speed;
      agent.velocity+=Math.max(-5*delta,Math.min(2*delta,targetSpeed-agent.velocity));
      const weave=agent.kind==='bike'?Math.sin(controller.clock*.4+agent.id)*.08:0;
      const margin=agent.kind==='bike'?.65:agent.kind==='truck'?1.6:1.3,maxOffset=Math.max(0,road.width/2-margin);
      const desired=Math.max(-maxOffset,Math.min(maxOffset,this.laneOffset(agent,road)+weave));
      agent.offset+=(desired-agent.offset)*Math.min(1,dt*4);
      let along=agent.t*road.length+(agent.stopped?0:agent.velocity*delta);
      if(red||blocked)along=Math.min(along,Math.max(agent.t*road.length,road.length-stopDistance));
      if(leader&&leader.road===agent.road&&leader.a===agent.a&&leader.b===agent.b&&leader.t>agent.t)along=Math.min(along,Math.max(agent.t*road.length,leader.t*road.length-gap));
      agent.t=Math.min(1,along/road.length);
      if(agent.stopped)this.yielding++;
      if(!red&&!blocked&&next&&along>=road.length-turnDistance){
        this.startTurn(agent,road,next,turnDistance);
        // Reserve room in the exit before another vehicle enters the junction.
        entries.set(this.laneKey(agent,next),agent.t*next.length);
        this.advanceTurn(agent,0);
      }else agent.pose=this.roadPose(road,agent.a,agent.t*road.length,agent.offset);
    }
  }
}
