# Scripted ambulance simulation

The frontend opens a full-screen procedural coastal city. Its only panel contains disruption/location selectors and episode controls. The compact map starts with 5,000 civilian vehicles across all 100 roads. Most are two-wheelers, alongside cars and trucks. Simulate adds one ambulance; existing city traffic responds to its journey.

Every disruption option intentionally runs the same demonstration:

1. Find a reachable hospital near the incident road.
2. Route its ambulance from the hospital entrance to that road using A*.
3. Give up to five intersections ahead priority along the ambulance's direction.
4. Stop crossing approaches at their stop lines and let corridor vehicles keep moving in their lanes. Reserve junction space and check the exit road before releasing a vehicle.
5. Wait at the incident for 24 simulated seconds.
6. Return along the route to the hospital entrance.
7. Clear priority and restore the normal alternating signal cycle.

Only one episode can run at a time. Pause freezes vehicle progress and signal timing; reset removes the ambulance and its corridor, returns to the overview, and keeps ambient traffic running. Users can choose a preset area or click a road while no episode is running.

## Controller boundary

- road-network.js: exactly 100 curved roads with Marathi names, lane profiles, arc-length samples, and road-point lookup.
- fleet-renderer.js: instanced civilian models, detailed near the camera and simplified in the overview.
- graphics.js: WebGL 2 initialization with browser-selected GPU and reduced graphics settings on retry; context recovery is handled by Simulation.js.
- city-layout.js: physically compact coastline, a small neighborhood park, and deterministic random seeds.
- building-selection.js: picking named building volumes, including rotated roofs.
- graph.js: nearest-road lookup, A* routing, and route distance.
- demo-controller.js: ambulance lifecycle, route progress, anticipated signal priorities, and civilian queue/yield behavior.
- ../components/Simulation.js: Three.js rendering and simulation controls.
- ../3d_models/maps/city-map.js: deterministic city generation, road graph, service distribution, batched geometry, and zoom-dependent detail.

AmbulanceDemoController exposes start(targetId, eventType, incidentPoint), tick(realDeltaSeconds), reset(), and snapshot(). The renderer reads its pose, route, segment, and priorities. A priority maps a junction ID to its allowed incoming/outgoing road IDs, plus a fallback axis. Cars and the ambulance follow the same sampled curves. A clicked point adds the partial final road to the route. Civilian cars and signal colors both use it.

Replace updatePriorities() with trained policy actions, or supply a controller with the same interface. Observation inputs can include road queues, ambulance route/distance, episode phase, and event type. There is no training dependency or backend required for this demo.

CivilianTraffic uses lane queues, gradual acceleration, signal stops, downstream space checks, and curved junction turns. The ambulance corridor accelerates traffic ahead and holds crossing approaches; proximity to the ambulance never shifts a vehicle off the road or stops the corridor. A junction reservation prevents crossing traffic from entering during a turn. One-way alleys preserve a connected two-way network, so vehicles can circulate without teleporting to a random road. This remains a deterministic browser demo rather than calibrated traffic physics.

## Map and timing

The city has a fictional Mumbai-inspired coastline and irregular, curved streets, rather than imported OSM geography. A peninsula and mainland are joined by bridges; every inhabited district receives all three emergency services. The entire footprint is 1.38 × 1.52 km, approximately 89% smaller than the previous 150-road map. Buildings occupy both street frontages and block interiors. Roads vary among one, two, and four lanes; narrow streets, market awnings, bus shelters, tree-lined boulevards, and a harbor bridge distinguish their appearances. The six areas have Marathi names; every road and building is named. Service campuses carry area-specific names, such as Tilak Nagar Rugnalaya, Dadar Police Thane, and Wadala Agnishaman Kendra. Area labels appear in the wider view, service labels at closer zoom, and building clicks display the selected name and street. Geometry is batched for rendering.

Graph coordinates use metres; the demo advances at six simulated seconds per real second. Vehicles are enlarged in the scene for readability while their reusable source models retain metre scale. A trained policy and calibrated simulator can replace these demo choices later.
