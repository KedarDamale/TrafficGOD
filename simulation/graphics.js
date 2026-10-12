import * as THREE from 'three';

// Let the browser choose its GPU first. Some integrated GPUs reject multisampling.
export function createSimulationRenderer() {
  for (const options of [
    { antialias: true, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power' }
  ]) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      ...options, alpha: false, depth: true, stencil: false,
      failIfMajorPerformanceCaveat: false
    });
    if (!context) continue;
    try {
      return new THREE.WebGLRenderer({ canvas, context, ...options, alpha: false });
    } catch {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
  throw new Error('Your browser could not start WebGL 2. In Chrome or Edge, open Settings → System, enable graphics acceleration, and relaunch. If you are using an embedded preview, open the site in a regular browser tab, then retry.');
}
