export const BUILDINGS = Object.freeze([
  {id:'police-station',name:'Police Station',color:'#8799cc',width:17,depth:15,height:8,role:'Emergency service'},
  {id:'fire-station',name:'Fire Station',color:'#d7817d',width:19,depth:16,height:10,role:'Emergency service'},
  {id:'hospital',name:'City Hospital',color:'#ebece8',width:20,depth:18,height:13,role:'Emergency service'},
  {id:'clinic',name:'Neighborhood Clinic',color:'#c1d9d7',width:10,depth:10,height:5,role:'Healthcare'},
  {id:'bungalow',name:'Garden Bungalow',color:'#eeeadf',width:11,depth:11,height:5.5,role:'Single storey home'},
  {id:'villa',name:'Courtyard Villa',color:'#ece8dd',width:17,depth:15,height:7.8,role:'Two storey home'},
  {id:'low-rise-apartment',name:'Low-rise Apartments',color:'#e8e9e6',width:11,depth:10,height:10,role:'Four storeys'},
  {id:'mid-rise-apartment',name:'Mid-rise Apartments',color:'#e2e6e8',width:12,depth:11,height:19,role:'Eight storeys'},
  {id:'office-tower',name:'Office Tower',color:'#a9bdce',width:11,depth:11,height:25,role:'Twelve storeys'},
  {id:'corner-shop',name:'Corner Shop',color:'#f0e8da',width:10,depth:9,height:4,role:'Small commercial'},
  {id:'warehouse',name:'Warehouse',color:'#d8dfe2',width:18,depth:14,height:6,role:'Large industrial'}
].map(s=>Object.freeze({...s,category:'buildings',length:s.depth})));
export function getBuildingSpec(id) {
  const spec=BUILDINGS.find(s=>s.id===id);
  if(!spec) throw new RangeError(`Unknown building "${id}"`);
  return spec;
}
