'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { VEHICLES, PAINT_COLORS, createVehicle, animateVehicle, disposeVehicle } from '../3d_models/index.js';
import { createCityMap, disposeCityMap } from '../3d_models/maps/city-map.js';

function Scene({ selected, paint, view, moving, sirens, onStats, onReady, onError }) {
  const host = useRef(null), active = useRef(null), state = useRef({ selected, paint, view, moving, sirens });
  useEffect(() => { state.current = { selected, paint, view, moving, sirens }; }, [selected, paint, view, moving, sirens]);
  useEffect(() => {
    const el = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { onError('WebGL is unavailable. Enable hardware acceleration to open the 3D preview.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor('#e9edf2');
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive isometric city and vehicle preview');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-40, 40, 30, -30, .1, 350);
    camera.position.set(72, 78, 85);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * .47; controls.minPolarAngle = .12; controls.enablePan = true;
    controls.minZoom = .4; controls.maxZoom = 24;
    scene.add(new THREE.HemisphereLight('#ffffff', '#b4bdc9', 2.5));
    const sun = new THREE.DirectionalLight('#fff9ed', 3); sun.position.set(-45, 70, 35); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.far = 180;
    sun.shadow.normalBias = .07; scene.add(sun);
    const city = createCityMap(); scene.add(city);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 6.1, .2, 64), new THREE.MeshStandardMaterial({ color: '#e0e6ee', roughness: 1 }));
    pedestal.position.y = -.12; pedestal.receiveShadow = true; scene.add(pedestal);
    const traffic = [];
    const placements = [
      ['baleno', -29, 16, Math.PI / 2], ['nexon', -13, 16, Math.PI / 2], ['swift', 11, 16, Math.PI / 2],
      ['ertiga', 29, -16, -Math.PI / 2], ['wagon-r', -14, -16, -Math.PI / 2], ['creta', 18, -16, -Math.PI / 2],
      ['police-car', -16, 23, 0], ['ambulance', 16, -28, 0], ['fire-truck', 16, 20, 0],
      ['activa', -16, -22, Math.PI], ['classic-350', -16, 4, Math.PI], ['delivery-truck', -30, -16, -Math.PI / 2],
      ['pulsar', 16, -5, 0], ['punch', 29, 16, Math.PI / 2]
    ];
    placements.forEach(([id, x, z, angle], i) => { const v = createVehicle(id, { colorIndex: i % 6 }); v.position.set(x, .07, z); v.rotation.y = angle; scene.add(v); traffic.push(v); });
    let model, previousId = '', previousPaint = -1, previousView = '', frame;
    let last = performance.now();
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.left = -30 * w / h; camera.right = 30 * w / h; camera.top = 30; camera.bottom = -30; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const clock = new THREE.Clock();
    const tick = () => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
      const st = state.current;
      if (previousId !== st.selected || previousPaint !== st.paint) {
        if (model) disposeVehicle(model);
        model = createVehicle(st.selected, { colorIndex: st.paint }); scene.add(model); active.current = model;
        previousId = st.selected; previousPaint = st.paint;
        if (st.view === 'vehicle') previousView = '';
        let triangles = 0, meshes = 0; model.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
        onStats({ triangles, meshes, occupants: model.userData.occupants.length });
      }
      if (previousView !== st.view) {
        const map = st.view === 'city'; city.visible = map; traffic.forEach(v => v.visible = map); pedestal.visible = !map;
        if (map) { camera.position.set(72, 78, 85); controls.target.set(0, 0, 0); camera.zoom = 1; }
        else {
          const length = model.userData.dimensions.length;
          camera.position.set(13, 10, 17); controls.target.set(0, 1, 0);
          camera.zoom = Math.max(4.1, Math.min(12, 32 / length));
          pedestal.scale.setScalar(length < 3 ? .4 : length < 5 ? .64 : 1.1);
        }
        camera.updateProjectionMatrix(); controls.update(); previousView = st.view;
      }
      model.visible = st.view === 'vehicle';
      if (st.view === 'vehicle' && st.moving) model.rotation.y += dt * .22;
      animateVehicle(model, { deltaSeconds: dt, speed: st.moving ? 3 : 0, timeSeconds: clock.getElapsedTime(), emergencyActive: st.sirens, trailerAngle: model.userData.trailerPivot ? Math.sin(now / 3000) * .18 : 0 });
      traffic.forEach(v => {
        animateVehicle(v, { deltaSeconds: dt, speed: st.moving ? 2 : 0, timeSeconds: now / 1000, emergencyActive: st.sirens });
        if (st.moving) {
          v.position.x += Math.sin(v.rotation.y) * dt * 2; v.position.z += Math.cos(v.rotation.y) * dt * 2;
          if (v.position.x > 42) v.position.x = -42; if (v.position.x < -42) v.position.x = 42;
          if (v.position.z > 42) v.position.z = -42; if (v.position.z < -42) v.position.z = 42;
        }
      });
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick);
    };
    tick();
    const api = {
      zoom: amount => { camera.zoom = THREE.MathUtils.clamp(camera.zoom * amount, .4, 24); camera.updateProjectionMatrix(); },
      reset: () => { previousView = ''; },
      export: async () => {
        if (!active.current) return;
        // Clone without runtime Object3D references in userData for clean glTF serialization.
        const source = active.current;
        const data = source.userData; source.userData = { id: data.id, paint: data.paint };
        let clone; try { clone = source.clone(true); } finally { source.userData = data; }
        clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0); clone.visible = true;
        const glb = await new GLTFExporter().parseAsync(clone, { binary: true, onlyVisible: false });
        const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        const link = document.createElement('a'); link.href = url; link.download = `${source.name}.glb`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    };
    onReady(api);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); onReady(null);
      if (model) disposeVehicle(model); traffic.forEach(disposeVehicle); disposeCityMap(city);
      pedestal.geometry.dispose(); pedestal.material.dispose(); renderer.dispose(); renderer.domElement.remove(); active.current = null;
    };
  }, [onStats, onReady, onError]);
  return <div className="scene" ref={host} />;
}

export default function Studio() {
  const [selected, setSelected] = useState('baleno'), [paint, setPaint] = useState(0), [view, setView] = useState('city');
  const [category, setCategory] = useState('all'), [query, setQuery] = useState(''), [moving, setMoving] = useState(true), [sirens, setSirens] = useState(true);
  const [stats, setStats] = useState({}), [error, setError] = useState('');
  const api = useRef(null);
  // Stable callbacks prevent canvas reconstruction on every UI state change.
  const ready = useRef(v => { api.current = v; }).current;
  const report = useRef(v => setStats(v)).current, fail = useRef(v => setError(v)).current;
  const spec = VEHICLES.find(v => v.id === selected);
  const filtered = VEHICLES.filter(v => (category === 'all' || category === v.category) && v.name.toLowerCase().includes(query.toLowerCase()));
  const choose = id => { setSelected(id); setView('vehicle'); };
  return <main className="studio">
    <header><a className="brand" href="/" aria-label="TrafficGod home"><span className="brand-icon">✳</span> TrafficGod<span className="brand-sub">CITY STUDIO</span></a><nav><button className={view === 'city' ? 'nav-active' : ''} onClick={() => setView('city')}>Neighborhood</button><button className={view === 'vehicle' ? 'nav-active' : ''} onClick={() => setView('vehicle')}>Vehicle lab <span>29</span></button></nav><div className="header-right"><span className="status-dot"/>Local simulation preview<span className="avatar">TG</span></div></header>
    <div className="workspace"><Scene selected={selected} paint={paint} view={view} moving={moving} sirens={sirens} onStats={report} onReady={ready} onError={fail}/>
      <aside className="sidebar"><div className="eyebrow">YOUR URBAN PLAYGROUND</div><h1>A little city.<br/>Big possibilities.</h1><p className="intro">Explore the streets. Meet the fleet.<br/>Build a more responsive city.</p>
        <div className="overview"><div><strong>29</strong><span>Vehicle models</span></div><div><strong>6</strong><span>Paint options</span></div><div><strong>01</strong><span>Neighborhood</span></div></div>
        <div className="section-title"><h2>The fleet</h2><span>{filtered.length} models</span></div>
        <div className="tabs">{[['all','All'],['cars','Cars'],['bikes','Bikes'],['vehicles','Utility']].map(([id, text]) => <button key={id} className={category === id ? 'active' : ''} onClick={() => setCategory(id)}>{text}</button>)}</div>
        <input aria-label="Find a vehicle" placeholder="Search the fleet…" value={query} onChange={e => setQuery(e.target.value)}/>
        <div className="fleet-list">{filtered.map(v => <button key={v.id} onClick={() => choose(v.id)} className={`fleet-item ${selected === v.id ? 'selected' : ''}`}><span className={`mini-icon ${v.category === 'bikes' || v.id === 'police-bike' ? 'bike' : ''}`} style={{'--paint':v.color}}>▰</span><span><strong>{v.name}</strong><small>{v.emergency ? 'Emergency response' : v.articulated ? 'Articulated · 1 driver' : v.category === 'bikes' ? 'Two-wheeler · 1 rider' : 'Low-poly · 1 driver'}</small></span><span className="arrow">↗</span></button>)}{!filtered.length && <p className="empty">No models match that search.</p>}</div>
        <div className="sidebar-footer"><span className="status-dot"/>Procedural geometry · Made for the web</div>
      </aside>
      <div className="map-title"><span className="eyebrow">{view === 'city' ? 'NEIGHBORHOOD / 01' : 'FLEET / MODEL INSPECTOR'}</span><h2>{view === 'city' ? 'Ivory District' : spec.name}</h2><span>{view === 'city' ? 'A small world, ready for what’s next.' : 'Drag to orbit · Scroll to zoom'}</span></div>
      {view === 'city' && <div className="legend"><span><i style={{background:'#7285ee'}}/>Civic & commercial</span><span><i style={{background:'#e67577'}}/>Emergency services</span><span><i style={{background:'#b7c4c4'}}/>Residential</span></div>}
      <div className="view-controls"><button aria-label="Zoom in" onClick={() => api.current?.zoom(1.2)}>+</button><button aria-label="Zoom out" onClick={() => api.current?.zoom(1/1.2)}>−</button><button aria-label="Reset view" onClick={() => api.current?.reset()}>⌖</button></div>
      <div className="inspector"><div className="inspector-title"><span className="eyebrow">{view === 'city' ? 'CITY PREVIEW' : 'SELECTED VEHICLE'}</span><strong>{view === 'city' ? 'Life, in motion.' : spec.name}</strong><small>{view === 'city' ? '14 vehicles · 9 blocks · 3 service stations' : `${stats.occupants || 1} occupant · ${Number(stats.triangles || 0).toLocaleString()} triangles`}</small></div>
        <div className="paint-options"><span>{spec.emergency ? 'Service livery' : 'Choose a color'}</span><div>{spec.emergency ? <span className="livery">Fixed emergency colors</span> : PAINT_COLORS.map((c, i) => <button aria-label={`Paint ${i+1}`} key={c} className={paint === i ? 'chosen' : ''} style={{background:c}} onClick={() => {setPaint(i); setView('vehicle');}}/>)}</div></div>
        <div className="actions"><button className="toggle" aria-pressed={moving} onClick={() => setMoving(!moving)}>{moving ? 'Ⅱ Pause' : '▷ Play'}</button><button className="toggle" aria-pressed={sirens} onClick={() => setSirens(!sirens)}>Beacons {sirens ? 'on' : 'off'}</button><button className="primary" onClick={async () => { try { await api.current?.export(); } catch (e) { setError(`Export failed: ${e.message}`); } }}>Export GLB ↗</button></div>
      </div>
      <div className="hint">{view === 'city' ? 'Drag to explore · Scroll to zoom · Select a vehicle to inspect' : 'Y up · +Z forward · Metre scale · Ready for Three.js'}</div>
      {error && <div role="alert" className="error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    </div>
  </main>;
}
