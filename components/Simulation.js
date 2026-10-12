'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCityMap, disposeCityMap } from '../3d_models/maps/city-map.js';
import { createVehicle, animateVehicle, disposeVehicle } from '../3d_models/index.js';
import { AmbulanceDemoController, CivilianTraffic, chooseLocations, TRAFFIC_COUNT } from '../simulation/demo-controller.js';
import { nearestRoad } from '../simulation/road-network.js';
import { FleetRenderer } from '../simulation/fleet-renderer.js';
import { createSimulationRenderer } from '../simulation/graphics.js';
import { createBuildingPicker } from '../simulation/building-selection.js';

function SimulationCanvas({ onReady, onState, onError }) {
  const host = useRef(null);
  useEffect(() => {
    const element = host.current;
    let renderer;
    try { renderer = createSimulationRenderer(); }
    catch (error) { onReady(null); onError(error.message, 'graphics'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor('#cddfe8');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive coastal city traffic simulation');
    const scene = new THREE.Scene();
    const viewHeight=620;
    const camera = new THREE.OrthographicCamera(-viewHeight*1.6,viewHeight*1.6,viewHeight,-viewHeight,1,40000);
    const homeTarget = new THREE.Vector3(-200, 0, 30);
    const homeOffset = new THREE.Vector3(1800, 2300, 1900);
    camera.zoom = 1.8;
    camera.position.copy(homeTarget).add(homeOffset);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = .12;
    controls.minZoom = .65;
    controls.maxZoom = 120;
    controls.maxPolarAngle = Math.PI * .47;
    controls.minPolarAngle = .15;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight('#ffffff', '#b5c5d1', 1.6));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.3);
    sun.position.set(-10000, 25000, 12000);
    scene.add(sun);
    const city = createCityMap();
    scene.add(city);
    const map = city.userData;
    const pickBuilding=createBuildingPicker([...map.services,...map.buildingPlots]);
    const controller = new AmbulanceDemoController(map);
    const locations = chooseLocations(map);
    let target = controller.nodes.get(locations[0].node);
    let follow = false, ambulance = null, frame, incident=null,clickedName=null,selectedBuilding=null;
    const roadLookup=new Map(map.roads.map(r=>[r.id,r]));
    const traffic=new CivilianTraffic(map,[],TRAFFIC_COUNT);traffic.tick(0,controller);
    const fleet=new FleetRenderer(traffic.agents);scene.add(fleet.root);
    let last = performance.now(), lastReport = 0, lastSignal = -1, lastCorridor = '';
    const sceneObjects = new THREE.Group(), routeObjects = new THREE.Group(), corridor = new THREE.Group();
    scene.add(sceneObjects, routeObjects, corridor);
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blueMaterial = new THREE.MeshBasicMaterial({ color: '#659bd8', transparent: true, opacity: .5, depthWrite: false });
    const greenMaterial = new THREE.MeshBasicMaterial({ color: '#64ba9e', transparent: true, opacity: .48, depthWrite: false });
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .03, 24), new THREE.MeshBasicMaterial({ color: '#df8d79', transparent: true, opacity: .65, depthWrite: false }));
    marker.position.set(target.x, .3, target.z);
    scene.add(marker);
    const markerPin = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#df8d79', roughness: .65 }));
    scene.add(markerPin);
    const green = new THREE.Color('#63b191'), red = new THREE.Color('#da807b');
    const labelResources=[];
    function mapLabel(text,x,z,y,width,color){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;
      const context=canvas.getContext('2d');
      if(!context)return null;
      context.fillStyle='rgba(255,255,255,.92)';context.fillRect(0,0,768,96);
      context.font='600 42px Arial';context.fillStyle=color;context.textAlign='center';context.textBaseline='middle';context.fillText(text,384,48,730);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true});
      const sprite=new THREE.Sprite(material);sprite.position.set(x,y,z);sprite.scale.set(width,width/8,1);scene.add(sprite);labelResources.push({sprite,texture,material});return sprite;
    }
    const areaLabels=[...new Set(map.nodes.map(n=>n.district))].map(name=>{
      const members=map.nodes.filter(n=>n.district===name),x=members.reduce((s,n)=>s+n.x,0)/members.length,z=members.reduce((s,n)=>s+n.z,0)/members.length;
      return mapLabel(name,x,z,65,180,'#55717d');
    }).filter(Boolean);
    const serviceLabels=map.services.map(s=>mapLabel(s.name,s.x,s.z,s.height+7,110,s.type==='police-station'?'#597aae':'#a36563')).filter(Boolean);
    const selectedLabel=mapLabel('',0,0,40,105,'#4c6373');if(selectedLabel)selectedLabel.visible=false;
    function strip(group, a, b, width, material) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const mesh = new THREE.Mesh(boxGeometry, material);
      const road=roadLookup.get(a.roadId||b.roadId);
      mesh.position.set((a.x + b.x) / 2, road?.bridge?.53:.22, (a.z + b.z) / 2);
      width=Math.min(width,road?.width*.9||width);
      mesh.scale.set(width, .025, Math.hypot(dx, dz));
      mesh.rotation.y = Math.atan2(dx, dz);
      group.add(mesh);
    }
    function clearEmergency(){
      if(ambulance)disposeVehicle(ambulance);
      ambulance=null;sceneObjects.clear();routeObjects.clear();corridor.clear();lastCorridor='';
    }
    function overview() {
      follow = false;
      camera.position.copy(homeTarget).add(homeOffset);
      controls.target.copy(homeTarget);
      camera.zoom = 1;
      camera.updateProjectionMatrix(); controls.update();
    }
    function publish() {
      onState({
        ...controller.snapshot(), yielding: traffic.yielding, trafficCount:traffic.agents.length, stats: map.stats, locations, customTarget:!!incident,
        targetName: clickedName||locations.find(l => l.node === target.id)?.name || 'Selected road', target: target.id,selectedBuilding
      });
    }
    function setTarget(id,point=null,building=null) {
      if (!['idle', 'completed'].includes(controller.phase)) return;
      const node = controller.nodes.get(id); if (!node) return;
      target = node;incident=point;selectedBuilding=building;clickedName=point?roadLookup.get(point.roadId).name:null;marker.position.set(point?.x??node.x,.3,point?.z??node.z);
      if(selectedLabel){
        selectedLabel.visible=!!building;
        if(building){
          const texture=selectedLabel.material.map,ctx=texture.image.getContext('2d');
          ctx.clearRect(0,0,768,96);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(0,0,768,96);ctx.fillStyle='#4c6373';ctx.fillText(building.name,384,48,730);texture.needsUpdate=true;
          selectedLabel.position.set(building.x,(building.height||20)+8,building.z);
        }
      }
      publish();
    }
    const api = {
      setTarget,
      simulate: event => {
        if (!['idle', 'completed'].includes(controller.phase)) return;
        try {
          clearEmergency(); controller.start(target.id,event,incident);
          ambulance = createVehicle('ambulance'); ambulance.scale.setScalar(1.5); sceneObjects.add(ambulance);
          for (let i = 1; i < controller.outbound.length; i++) strip(routeObjects, controller.outbound[i - 1], controller.outbound[i], 2.8, blueMaterial);
          follow = true; publish();
        } catch (error) { controller.reset(); clearEmergency(); onError(error.message); publish(); }
      },
      pause: () => { controller.paused = !controller.paused; publish(); },
      reset: () => { clearEmergency(); controller.reset(); lastSignal = -1; overview(); publish(); },
      overview,
      follow: () => { follow = true; }
    };
    const resize = () => {
      const w = element.clientWidth, h = element.clientHeight;
      renderer.setSize(w, h);
      camera.left = -viewHeight * w / h; camera.right = viewHeight * w / h;
      camera.top = viewHeight; camera.bottom = -viewHeight; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let pointerStart = null;
    const down = event => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const up = event => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      if (!['idle', 'completed'].includes(controller.phase)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      const hit = new THREE.Vector3(); raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(ground, hit)) {
        const building=pickBuilding(raycaster.ray);
        const near=nearestRoad(map.roads,building?.x??hit.x,building?.z??hit.z);
        if(near.distance<35||building){const id=near.along<near.road.length/2?near.road.a:near.road.b;setTarget(id,{x:near.x,z:near.z,along:near.along,roadId:near.road.id},building?{id:building.id,name:building.name,district:building.district,roadName:building.roadName,x:building.x,z:building.z,height:building.height}:null);}
      }
    };
    const interruptFollow = () => { follow = false; };
    controls.addEventListener('start', interruptFollow);
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
    function tick() {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .25); last = now;
      controller.tick(dt);
      if (ambulance && controller.pose) {
        ambulance.position.set(controller.pose.x,controller.pose.y??.16,controller.pose.z);
        const angle = Math.atan2(Math.sin(controller.pose.heading - ambulance.rotation.y), Math.cos(controller.pose.heading - ambulance.rotation.y));
        ambulance.rotation.y += angle * Math.min(1, dt * 7);
        animateVehicle(ambulance, {
          deltaSeconds: controller.paused ? 0 : dt,
          speed: ['outbound', 'returning'].includes(controller.phase) ? controller.speed * controller.timeScale / 1.5 : 0,
          timeSeconds: now / 1000, emergencyActive: ['outbound', 'returning'].includes(controller.phase)
        });
        if (follow) {
          const desired = new THREE.Vector3(controller.pose.x, 0, controller.pose.z);
          controls.target.lerp(desired, Math.min(1, dt * 3));
          camera.position.copy(controls.target).add(homeOffset);
          camera.zoom = THREE.MathUtils.lerp(camera.zoom, 6.5, Math.min(1, dt * 1.8)); camera.updateProjectionMatrix();
        }
      }
      if(!controller.paused)traffic.tick(dt,controller);
      fleet.update({detailed:camera.zoom>3.5,center:controls.target,radius:Math.hypot(viewHeight,camera.right)/camera.zoom*2});
      const signalTime = Math.floor(now / 180);
      if (signalTime !== lastSignal) {
        const normal = Math.floor(controller.clock / 12) % 2 ? 'z' : 'x';
        map.signalNodes.forEach((signal, i) => {
          const priority = controller.priorities.get(signal.node);
          const allowed=priority?(priority.roads?priority.roads.includes(signal.road):priority.axis===signal.axis):normal===signal.axis;
          city.signals.setColorAt(i,allowed?green:red);
        });
        city.signals.instanceColor.needsUpdate = true; lastSignal = signalTime;
      }
      const key = controller.phase + ':' + controller.segment;
      if (key !== lastCorridor) {
        corridor.clear();
        if (['outbound', 'returning'].includes(controller.phase)) {
          for (let i = controller.segment; i < controller.corridorEnd(); i++) strip(corridor, controller.route[i], controller.route[i + 1], 17, greenMaterial);
        }
        lastCorridor = key;
      }
      const markerSize = Math.max(4,30/camera.zoom);
      marker.scale.set(markerSize, 1, markerSize); markerPin.position.set(marker.position.x,markerSize*1.5,marker.position.z); markerPin.scale.setScalar(markerSize * .5);
      areaLabels.forEach(label=>{label.visible=camera.zoom<3;});
      serviceLabels.forEach(label=>{label.visible=camera.zoom>=2.5;label.scale.set(300/camera.zoom,37.5/camera.zoom,1);});
      if(selectedLabel)selectedLabel.scale.set(340/camera.zoom,42.5/camera.zoom,1);
      controls.update(); city.setDetail(camera.zoom); renderer.render(scene, camera);
      if (now - lastReport > 250) { publish(); lastReport = now; }
      frame = requestAnimationFrame(tick);
    }
    let pausedBeforeLoss = false;
    const contextLost = event => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      pausedBeforeLoss = controller.paused;
      controller.paused = true;
      onReady(null);
      onError('The graphics connection was interrupted. The simulation is paused while your browser restores it. You can also retry graphics.', 'graphics');
    };
    const contextRestored = () => {
      controller.paused = pausedBeforeLoss;
      last = performance.now();
      lastSignal = -1;
      onError(''); onReady(api); resize(); tick();
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    controls.update(); onReady(api); publish(); tick();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener('start', interruptFollow); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      clearEmergency(); fleet.dispose(); disposeCityMap(city);
      boxGeometry.dispose(); blueMaterial.dispose(); greenMaterial.dispose();
      marker.geometry.dispose(); marker.material.dispose(); markerPin.geometry.dispose(); markerPin.material.dispose();
      labelResources.forEach(({texture,material})=>{texture.dispose();material.dispose();});
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); onReady(null);
    };
  }, [onReady, onState, onError]);
  return <div className="simulation-canvas" ref={host} />;
}
const EVENTS = [
  ['ambulance', 'Medical emergency'], ['accident', 'Accident'], ['fire', 'Fire'], ['closure', 'Road closure'],
  ['flood', 'Flooding'], ['signal', 'Signal failure'], ['congestion', 'Heavy congestion']
];
const PHASES = {
  idle: 'Ready to dispatch', outbound: 'Ambulance → incident', 'at-incident': 'Attending the incident',
  returning: 'Ambulance → hospital', completed: 'Returned to hospital'
};
export default function Simulation() {
  const runtime = useRef(null);
  const [ready, setReady] = useState(false), [event, setEvent] = useState('ambulance');
  const [state, setState] = useState({ phase: 'idle', locations: [], stats: {} }), [error, setError] = useState('');
  const [graphicsFailed, setGraphicsFailed] = useState(false), [graphicsAttempt, setGraphicsAttempt] = useState(0);
  const receive = useCallback(snapshot => setState(snapshot), []);
  const reportError = useCallback((message, kind) => { setError(message); setGraphicsFailed(kind === 'graphics'); }, []);
  const receiveApi = useCallback(api => { runtime.current = api; setReady(!!api); }, []);
  const active = ['outbound', 'at-incident', 'returning'].includes(state.phase);
  return <main className="simulation">
    <SimulationCanvas key={graphicsAttempt} onReady={receiveApi} onState={receive} onError={reportError} />
    <section className="simulation-controls" aria-label="Disruption simulation controls">
      <div className="control-title"><span className="live-dot" />TrafficGod <small>SIMULATION</small></div>
      <p className="traffic-count">{graphicsFailed?'Graphics unavailable':state.trafficCount?state.trafficCount.toLocaleString()+' vehicles · '+state.stats.roads+' streets':'Preparing city traffic…'}</p>
      <label htmlFor="event">Disruption</label>
      <select id="event" value={event} disabled={active} onChange={e => setEvent(e.target.value)}>
        {EVENTS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <label htmlFor="location">Incident location</label>
      <select id="location" value={state.customTarget?'custom-road':state.target||''} disabled={!ready || active} onChange={e => runtime.current?.setTarget(e.target.value)}>
        {state.locations.map(location => <option key={location.node} value={location.node}>{location.name}</option>)}
        {state.customTarget&&<option value="custom-road">{state.targetName}</option>}
        {state.target&&!state.customTarget&&!state.locations.some(l=>l.node===state.target)&&<option value={state.target}>{state.targetName}</option>}
      </select>
      <p className="location-hint">Or click a road on the map. Drag to pan; scroll to zoom.</p>
      {state.selectedBuilding&&<div className="selected-building"><strong>{state.selectedBuilding.name}</strong><span>{state.selectedBuilding.district} · {state.selectedBuilding.id}</span><span>{state.selectedBuilding.roadName}</span></div>}
      <button className="simulate-button" disabled={!ready || active} onClick={() => { setError(''); runtime.current?.simulate(event); }}>
        {graphicsFailed ? 'Graphics unavailable' : !ready ? 'Building city…' : active ? 'Simulation running' : 'Simulate'}
      </button>
      <p className="demo-note">All disruptions currently run the same ambulance demo.</p>
      {state.phase !== 'idle' && <div className="run-status">
        <strong>{state.paused ? 'Paused' : PHASES[state.phase]}</strong>
        <div className="progress-track"><div style={{ width: ((state.progress || 0) * 100) + '%' }} /></div>
        <div className="run-metrics"><span>{state.prioritySignals || 0} signals prioritised</span><span>{state.yielding || 0} vehicles waiting / yielding</span></div>
        <div className="run-actions">
          {active && <button onClick={() => runtime.current?.pause()}>{state.paused ? 'Resume' : 'Pause'}</button>}
          <button onClick={() => runtime.current?.reset()}>Reset</button>
          <button onClick={() => runtime.current?.follow()}>Follow ambulance</button>
        </div>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      {graphicsFailed && <button className="graphics-retry" onClick={() => {
        setError(''); setGraphicsFailed(false); setState({ phase: 'idle', locations: [], stats: {} });
        setGraphicsAttempt(attempt => attempt + 1);
      }}>Retry graphics</button>}
    </section>
    <button className="overview-button" aria-label="Show whole city" title="Show whole city" onClick={() => runtime.current?.overview()}>⌖</button>
  </main>;
}
