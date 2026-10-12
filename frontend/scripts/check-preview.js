import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000',{waitUntil:'networkidle'});
  await page.waitForSelector('canvas');
  await page.getByRole('button',{name:'Ⅱ Pause'}).click();
  await page.screenshot({path:'/tmp/trafficgod-city.png'});
  await page.getByRole('button',{name:/Maruti Suzuki Baleno/}).click();
  await page.screenshot({path:'/tmp/trafficgod-baleno.png'});
  await page.getByRole('button',{name:'Paint 3',exact:true}).click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export GLB'}).click();
  const glb=await download; await glb.saveAs('/tmp/trafficgod-baleno.glb');
  const buf=await fs.readFile('/tmp/trafficgod-baleno.glb');
  if(buf.toString('utf8',0,4)!=='glTF') throw Error('Invalid GLB header');
  await page.getByRole('button',{name:'Utility',exact:true}).click();
  await page.getByRole('button',{name:/Box Semi Trailer/}).click();
  await page.screenshot({path:'/tmp/trafficgod-trailer.png'});
  await page.getByRole('button',{name:/Police Patrol/}).click();
  if(await page.getByRole('button',{name:'Paint 1',exact:true}).count()) throw Error('Emergency paint should be fixed');
  await page.getByRole('button',{name:'Bikes',exact:true}).click();
  await page.getByRole('button',{name:/Royal Enfield Classic 350/}).click();
  await page.screenshot({path:'/tmp/trafficgod-bike.png'});
  // Verify every model selection can render without JavaScript exceptions.
  await page.getByRole('button',{name:'All',exact:true}).click();
  const {VEHICLES}=await import('../3d_models/catalog.js');
  for(const v of VEHICLES) {
    await page.getByRole('button',{name:v.name,exact:false}).click();
    await page.waitForTimeout(45);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Neighborhood',exact:true}).click();
  await page.screenshot({path:'/tmp/trafficgod-mobile.png'});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)) throw Error('Mobile page overflows');
  if(errors.length) throw Error(errors.join('\n'));
  console.log('29 models render; GLB export, palette, fixed liveries, city, and mobile layout passed.');
} finally {await browser.close();}
