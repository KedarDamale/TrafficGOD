export function nearestNode(nodes,x,z) {
  return nodes.reduce((best,n)=>!best||Math.hypot(n.x-x,n.z-z)<Math.hypot(best.x-x,best.z-z)?n:best,null);
}
export function findRoute(nodes,startId,endId) {
  const lookup=new Map(nodes.map(n=>[n.id,n])),start=lookup.get(startId),end=lookup.get(endId);
  if(!start||!end)throw new RangeError('Route endpoints must be road nodes');
  const open=[startId],cost=new Map([[startId,0]]),previous=new Map(),closed=new Set();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  while(open.length) {
    let best=0;
    for(let i=1;i<open.length;i++)if(cost.get(open[i])+distance(lookup.get(open[i]),end)<cost.get(open[best])+distance(lookup.get(open[best]),end))best=i;
    const id=open.splice(best,1)[0];
    if(id===endId){const path=[id];while(previous.has(path[0]))path.unshift(previous.get(path[0]));return path.map(id=>lookup.get(id));}
    closed.add(id);
    for(const neighbor of lookup.get(id).neighbors) {
      if(closed.has(neighbor))continue;
      const nextCost=cost.get(id)+distance(lookup.get(id),lookup.get(neighbor));
      if(!cost.has(neighbor)||nextCost<cost.get(neighbor)){previous.set(neighbor,id);cost.set(neighbor,nextCost);if(!open.includes(neighbor))open.push(neighbor);}
    }
  }
  return null;
}
export const routeLength=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
