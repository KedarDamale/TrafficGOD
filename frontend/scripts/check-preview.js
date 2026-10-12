import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: 'Simulate', exact: true }).waitFor({ timeout: 90000 });
  if (await page.locator('header, nav, .fleet-list').count()) throw Error('Old gallery UI remains');
  await page.screenshot({ path: '/tmp/trafficgod-metropolis.png' });
  console.log('City loaded and captured.');
  await page.getByLabel('Disruption', { exact: true }).selectOption('fire');
  await page.getByLabel('Incident location', { exact: true }).selectOption({ label: 'Central city' });
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
