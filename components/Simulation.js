'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCityMap, disposeCityMap, CITY_SCALE } from '../3d_models/maps/city-map.js';
import { createVehicle, animateVehicle, disposeVehicle } from '../3d_models/index.js';
import { AmbulanceDemoController, CivilianTraffic, chooseLocations } from '../simulation/demo-controller.js';
import { nearestRoad } from '../simulation/road-network.js';
import { FleetRenderer } from '../simulation/fleet-renderer.js';

function SimulationCanvas({ onReady, onState, onError }) {
  const host = useRef(null);
  useEffect(() => {
    const element = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { onError('WebGL is unavailable. Enable hardware acceleration to view the simulation.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor('#cddfe8');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive coastal city traffic simulation');
    const scene = new THREE.Scene();
    const viewHeight=9500*CITY_SCALE;
    const camera = new THREE.OrthographicCamera(-viewHeight*1.6,viewHeight*1.6,viewHeight,-viewHeight,1,40000);
    const homeTarget = new THREE.Vector3(700, 0, -600).multiplyScalar(CITY_SCALE);
    const homeOffset = new THREE.Vector3(22000, 30000, 23000).multiplyScalar(CITY_SCALE);
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
    const controller = new AmbulanceDemoController(map);
    const locations = chooseLocations(map);
    let target = controller.nodes.get(locations[0].node);
    let follow = false, ambulance = null, frame, incident=null,clickedName=null;
    const roadLookup=new Map(map.roads.map(r=>[r.id,r]));
    const traffic=new CivilianTraffic(map,[],3600);traffic.tick(0,controller);
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
        targetName: clickedName||locations.find(l => l.node === target.id)?.name || 'Selected road', target: target.id
      });
    }
    function setTarget(id,point=null) {
      if (!['idle', 'completed'].includes(controller.phase)) return;
      const node = controller.nodes.get(id); if (!node) return;
      target = node;incident=point;clickedName=point?roadLookup.get(point.roadId).name:null;marker.position.set(point?.x??node.x,.3,point?.z??node.z);publish();
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
        const near=nearestRoad(map.roads,hit.x,hit.z);
        if(near.distance<35){const id=near.along<near.road.length/2?near.road.a:near.road.b;setTarget(id,{x:near.x,z:near.z,along:near.along,roadId:near.road.id});}
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
          camera.zoom = THREE.MathUtils.lerp(camera.zoom, 18, Math.min(1, dt * 1.8)); camera.updateProjectionMatrix();
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
      controls.update(); city.setDetail(camera.zoom); renderer.render(scene, camera);
      if (now - lastReport > 250) { publish(); lastReport = now; }
      frame = requestAnimationFrame(tick);
    }
    controls.update(); onReady(api); publish(); tick();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener('start', interruptFollow); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
      clearEmergency(); fleet.dispose(); disposeCityMap(city);
      boxGeometry.dispose(); blueMaterial.dispose(); greenMaterial.dispose();
      marker.geometry.dispose(); marker.material.dispose(); markerPin.geometry.dispose(); markerPin.material.dispose();
      renderer.dispose(); renderer.domElement.remove(); onReady(null);
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
  const receive = useCallback(snapshot => setState(snapshot), []);
  const reportError = useCallback(message => setError(message), []);
  const receiveApi = useCallback(api => { runtime.current = api; setReady(!!api); }, []);
  const active = ['outbound', 'at-incident', 'returning'].includes(state.phase);
  return <main className="simulation">
    <SimulationCanvas onReady={receiveApi} onState={receive} onError={reportError} />
    <section className="simulation-controls" aria-label="Disruption simulation controls">
      <div className="control-title"><span className="live-dot" />TrafficGod <small>SIMULATION</small></div>
      <p className="traffic-count">{state.trafficCount?state.trafficCount.toLocaleString()+' vehicles · 150 distinct streets':'Preparing city traffic…'}</p>
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
      <button className="simulate-button" disabled={!ready || active} onClick={() => { setError(''); runtime.current?.simulate(event); }}>
        {!ready ? 'Building city…' : active ? 'Simulation running' : 'Simulate'}
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
    </section>
    <button className="overview-button" aria-label="Show whole city" title="Show whole city" onClick={() => runtime.current?.overview()}>⌖</button>
  </main>;
}
