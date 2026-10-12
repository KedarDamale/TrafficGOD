# Scripted ambulance simulation

The frontend opens a full-screen procedural coastal city. Its only panel contains disruption/location selectors and episode controls. The map starts without vehicles. Simulate creates one ambulance and 96 civilian cars around its route.

Every disruption option intentionally runs the same demonstration:

1. Find a reachable hospital near the incident road.
2. Route its ambulance from the hospital entrance to that road using A*.
3. Give up to five intersections ahead priority along the ambulance's direction.
4. Stop crossing approaches, let corridor vehicles flow, and pull nearby cars to the roadside.
5. Wait at the incident for 24 simulated seconds.
6. Return along the route to the hospital entrance.
7. Clear priority and restore the normal alternating signal cycle.

Only one episode can run at a time. Pause freezes vehicle progress and signal timing; reset removes vehicles and returns to the car-free overview. Users can choose a preset area or click a road while no episode is running.

## Controller boundary

- graph.js: nearest-road lookup, A* routing, and route distance.
- demo-controller.js: ambulance lifecycle, route progress, anticipated signal priorities, and civilian queue/yield behavior.
- ../components/Simulation.js: Three.js rendering and simulation controls.
- ../3d_models/maps/city-map.js: deterministic city generation, road graph, service distribution, batched geometry, and zoom-dependent detail.

AmbulanceDemoController exposes start(targetId, eventType), tick(realDeltaSeconds), reset(), and snapshot(). The renderer reads its pose, route, segment, and priorities. A priority maps a road-node ID to an axis, either x or z. Civilian cars and signal colors both use it.

Replace updatePriorities() with trained policy actions, or supply a controller with the same interface. Observation inputs can include road queues, ambulance route/distance, episode phase, and event type. There is no training dependency or backend required for this demo.

CivilianTraffic uses the signal priorities, basic spacing on each directed road, normal signal stops, and roadside yielding near the ambulance. It is simple browser animation rather than vehicle physics.

## Map and timing

The city has a fictional Mumbai-inspired coastline and gridded streets, rather than imported OSM geography. A peninsula and mainland are joined by bridges; every inhabited district receives all three emergency services. Road and building geometry are spatially batched, and small details are hidden in the overview.

Graph coordinates use metres; the demo advances at six simulated seconds per real second. Vehicles are enlarged in the scene for readability while their reusable source models retain metre scale. A trained policy and calibrated simulator can replace these demo choices later.
