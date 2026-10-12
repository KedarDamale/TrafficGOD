import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Reproduce a browser where WebGL is disabled, without depending on its GPU.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.graphicsAvailable = false;
    window.rejectMultisampling = false;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
      if (type === 'webgl2' && (!window.graphicsAvailable || (window.rejectMultisampling && options?.antialias))) return null;
      return original.call(this, type, options);
    };
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Retry graphics', exact: true }).waitFor();
  assert.match(await page.locator('.error[role=alert]').textContent(), /WebGL 2.*graphics acceleration/);
  assert.equal(await page.getByRole('button', { name: 'Graphics unavailable', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('.simulation-canvas canvas').count(), 0);

  // Once graphics is re-enabled, retry must work even if antialiasing is rejected.
  await page.evaluate(() => { window.graphicsAvailable = true; window.rejectMultisampling = true; });
  await page.getByRole('button', { name: 'Retry graphics', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate', exact: true }).waitFor({ timeout: 90000 });
  assert.equal(await page.locator('.simulation-canvas canvas').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getContextAttributes().antialias), false);
  assert.equal(await page.locator('.error[role=alert]').count(), 0);

  await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    window.graphicsRecovery = gl.getExtension('WEBGL_lose_context');
    window.graphicsRecovery.loseContext();
  });
  await page.locator('.error[role=alert]').filter({ hasText: 'interrupted' }).waitFor();
  await page.evaluate(() => window.graphicsRecovery.restoreContext());
  await page.getByRole('button', { name: 'Simulate', exact: true }).waitFor({ timeout: 90000 });
  assert.equal(await page.locator('.error[role=alert]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Unavailable WebGL guidance, retry, antialiasing fallback, and automatic context recovery passed.');
} finally { await browser.close(); }
