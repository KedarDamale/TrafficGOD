import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: 'Simulate', exact: true }).waitFor({ timeout: 90000 });
  if (await page.locator('header, nav, .fleet-list').count()) throw Error('Old gallery UI remains');
  const canvas=page.locator('.simulation-canvas canvas');
  const cameraView=async()=>({target:JSON.parse(await canvas.getAttribute('data-camera-target')),position:JSON.parse(await canvas.getAttribute('data-camera-position')),zoom:Number(await canvas.getAttribute('data-camera-zoom'))});
  const beforePan=await cameraView();
  await page.mouse.move(1000,500);await page.mouse.down();await page.mouse.move(820,610,{steps:12});await page.mouse.up();
  await page.waitForTimeout(900);
  const afterPan=await cameraView();
  if(Math.hypot(afterPan.target[0]-beforePan.target[0],afterPan.target[2]-beforePan.target[2])<10)throw Error('Left drag did not pan across the city');
  const oldDirection=beforePan.position.map((n,i)=>n-beforePan.target[i]),newDirection=afterPan.position.map((n,i)=>n-afterPan.target[i]);
  if(Math.hypot(...oldDirection.map((n,i)=>n-newDirection[i]))>1)throw Error('Left drag rotated instead of panning');
  await canvas.press('ArrowRight');await page.waitForTimeout(800);
  const afterKey=await cameraView();
  if(Math.hypot(afterKey.target[0]-afterPan.target[0],afterKey.target[2]-afterPan.target[2])<1)throw Error('Arrow key did not move the view');
  await page.mouse.move(1000,500);await page.mouse.wheel(0,-200);await page.waitForTimeout(800);
  if((await cameraView()).zoom<=afterKey.zoom)throw Error('Scroll did not zoom in');
  console.log('Drag pans without orbiting; arrow keys pan; scroll zooms.');
  await page.screenshot({ path: '/tmp/trafficgod-metropolis.png' });
  console.log('City loaded and captured.');
  for(const point of [{x:720,y:500},{x:820,y:420},{x:620,y:520},{x:910,y:600},{x:530,y:350}]){
    await page.locator('.simulation-canvas canvas').click({position:point,force:true});
    await page.waitForTimeout(300);
    if(await page.locator('.selected-building').count())break;
  }
  if(!await page.locator('.selected-building strong').count())throw Error('Building click did not show its name');
  await page.screenshot({ path: '/tmp/trafficgod-building.png' });
  await page.getByLabel('Disruption', { exact: true }).selectOption('fire');
  await page.getByLabel('Incident location', { exact: true }).selectOption({ label: 'Dadar' });
  await page.getByRole('button', { name: 'Simulate', exact: true }).click({force:true});
  await page.getByText('Ambulance → incident', { exact: true }).waitFor({ timeout: 30000 });
  console.log('Ambulance dispatched.');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/trafficgod-ambulance.png' });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByText('Paused', { exact: true }).waitFor();
  const progressBefore = await page.locator('.progress-track > div').getAttribute('style');
  await page.waitForTimeout(600);
  if (progressBefore !== await page.locator('.progress-track > div').getAttribute('style')) throw Error('Pause did not stop simulation');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByText('Attending the incident', { exact: true }).waitFor({ timeout: 90000 });
  await page.getByText('Ambulance → hospital', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Returned to hospital', { exact: true }).waitFor({ timeout: 90000 });
  const metrics = await page.locator('.run-metrics').textContent();
  if (!metrics.includes('0 signals prioritised')) throw Error('Preemption was not cleared after return');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate', exact: true }).waitFor();
  if (await page.locator('.run-status').count()) throw Error('Reset did not clear the episode');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/trafficgod-simulation-mobile.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw Error('Mobile layout overflows');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Simulation-only UI; disruption/location selectors; outbound, incident, return; pause/resume, reset, and mobile layout passed.');
} finally { await browser.close(); }
