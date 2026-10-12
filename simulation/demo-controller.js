import { nearestNode,findRoute,routeLength } from './graph.js';
/** Replace this controller with RL actions later. Routing/scene rendering do not depend on an RL framework. */
export class AmbulanceDemoController {
  constructor(map) {this.map=map;this.nodes=new Map(map.nodes.map(n=>[n.id,n]));this.timeScale=6;this.speed=12;this.reset();}
  reset(){this.phase='idle';this.paused=false;this.clock=0;this.segment=0;this.distance=0;this.travelled=0;this.priorities=new Map();this.route=[];this.outbound=[];this.pose=null;this.hospital=null;this.hold=0;this.eventType='ambulance';}
  start(targetId,eventType='ambulance') {
    if(!['idle','completed'].includes(this.phase))return false;
    const target=this.nodes.get(targetId);if(!target)throw new RangeError('Choose a valid incident road');
    const hospitals=this.map.services.filter(s=>s.type==='hospital').sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));
    let route,hospital;
    for(const candidate of hospitals){route=findRoute(this.map.nodes,candidate.roadNode,targetId);if(route){hospital=candidate;break;}}
    if(!route)throw new Error('The incident is not reachable from a hospital');
    this.reset();this.hospital=hospital;this.eventType=eventType;this.target=target;
    this.outbound=[{...hospital.entrance},...route];this.route=this.outbound;this.totalDistance=routeLength(this.outbound)*2;
    this.phase='outbound';this.pose={...this.route[0],heading:0};this.updatePriorities();return true;
  }
  updatePriorities() {
    this.priorities.clear();
    if(!['outbound','returning'].includes(this.phase))return;
    for(let i=Math.max(0,this.segment-1);i<Math.min(this.route.length,this.segment+6);i++){
      const p=this.route[i],next=this.route[i+1]||this.route[i-1];if(!p.id||!next)continue;
      this.priorities.set(p.id,{axis:Math.abs(next.x-p.x)>Math.abs(next.z-p.z)?'x':'z',ahead:i>=this.segment});
    }
  }
  tick(realDelta) {
    if(this.paused||this.phase==='idle')return;
    if(this.phase==='completed'){this.clock+=Math.max(0,realDelta)*this.timeScale;return;}
    const delta=Math.max(0,realDelta)*this.timeScale;this.clock+=delta;
    if(this.phase==='at-incident') {
      this.hold+=delta;
      if(this.hold>=24){this.route=[...this.outbound].reverse();this.segment=0;this.distance=0;this.phase='returning';this.updatePriorities();}
      return;
    }
    let step=this.speed*delta;
    while(step>0 && this.segment<this.route.length-1) {
      const a=this.route[this.segment],b=this.route[this.segment+1],length=Math.hypot(b.x-a.x,b.z-a.z),remaining=length-this.distance;
      if(step>=remaining){this.travelled+=remaining;step-=remaining;this.segment++;this.distance=0;}
      else{this.distance+=step;this.travelled+=step;step=0;}
    }
    if(this.segment>=this.route.length-1){this.pose={...this.route.at(-1),heading:this.pose.heading};this.phase=this.phase==='outbound'?'at-incident':'completed';this.updatePriorities();return;}
    const a=this.route[this.segment],b=this.route[this.segment+1],length=Math.hypot(b.x-a.x,b.z-a.z),t=length?this.distance/length:1;
    this.pose={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)};this.updatePriorities();
  }
  snapshot(){return{phase:this.phase,paused:this.paused,eventType:this.eventType,progress:this.totalDistance?Math.min(1,this.travelled/this.totalDistance):0,prioritySignals:this.priorities.size,remainingSeconds:this.totalDistance?Math.max(0,(this.totalDistance-this.travelled)/this.speed):0,hospital:this.hospital?.id||null};}
}
export function chooseLocations(map) {
  return [['Southern peninsula',-1900,7800],['Central city',-1500,-1200],['Northern suburbs',-1800,-6800],['Eastern district',4200,-1500],['Harbor approach',4300,3500]].map(([name,x,z])=>({name,node:nearestNode(map.nodes,x,z).id}));
}
/** Deterministic civilian behavior: normal signal stops, preemption, queue spacing, and roadside yielding. */
export class CivilianTraffic {
  constructor(map,route,count=100) {
    this.nodes=new Map(map.nodes.map(n=>[n.id,n]));this.agents=[];this.seed=912;this.yielding=0;
    const nearby=map.roads.filter(r=>route.some(p=>Math.hypot(this.nodes.get(r.a).x-p.x,this.nodes.get(r.a).z-p.z)<700));
    const candidates=nearby.length?nearby:map.roads;
    for(let i=0;i<count;i++){const road=candidates[Math.floor(this.random()*candidates.length)],reverse=this.random()>.5;this.agents.push({id:i,a:reverse?road.b:road.a,b:reverse?road.a:road.b,t:this.random()*.8,speed:7+this.random()*4,offset:3.2,stopped:false,pose:null});}
  }
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  tick(dt,controller) {
    const delta=dt*controller.timeScale;this.yielding=0;
    for(const agent of this.agents) {
      let a=this.nodes.get(agent.a),b=this.nodes.get(agent.b),length=Math.hypot(b.x-a.x,b.z-a.z),axis=Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?'x':'z';
      const x=a.x+(b.x-a.x)*agent.t,z=a.z+(b.z-a.z)*agent.t;
      const priority=controller.priorities.get(b.id),normalGreen=(Math.floor(controller.clock/12)%2===0?'x':'z');
      const red=b.signal!==null && (priority?priority.axis:normalGreen)!==axis;
      const close=controller.pose && Math.hypot(controller.pose.x-x,controller.pose.z-z)<65 && ['outbound','returning'].includes(controller.phase);
      const queued=this.agents.some(other=>other!==agent&&other.a===agent.a&&other.b===agent.b&&other.t>agent.t&&(other.t-agent.t)*length<11);
      agent.stopped=!!close||queued||(red&&(1-agent.t)*length<20);
      if(agent.stopped)this.yielding++;
      const desiredOffset=close?6:3.2;agent.offset+=(desiredOffset-agent.offset)*Math.min(1,dt*4);
      if(!agent.stopped)agent.t+=agent.speed*delta/length;
      if(agent.t>=1){const choices=b.neighbors.filter(id=>id!==a.id),next=choices.length?choices[Math.floor(this.random()*choices.length)]:a.id;agent.a=b.id;agent.b=next;agent.t=0;a=b;b=this.nodes.get(next);length=Math.hypot(b.x-a.x,b.z-a.z);}
      const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
      agent.pose={x:a.x+(b.x-a.x)*agent.t+dz*agent.offset,z:a.z+(b.z-a.z)*agent.t-dx*agent.offset,heading:Math.atan2(dx,dz)};
    }
  }
}
