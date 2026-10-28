// Verify editable files are used by the running game; route edits stay in the test browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SAM_HEROS_PLAYWRIGHT || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8156';
const browser = await chromium.launch({ headless:true, ...(process.env.SAM_HEROS_CHROMIUM ? {executablePath:process.env.SAM_HEROS_CHROMIUM} : fs.existsSync(chromium.executablePath()) ? {} : {channel:'msedge'}), args:['--use-angle=swiftshader','--enable-webgl'] });
try {
  for (const mode of ['training','settings']) {
    const page = await browser.newPage();
    const seen = new Set(), errors = [];
    page.on('response', r => {if(r.ok())seen.add(new URL(r.url()).pathname);});
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/art/ui/chapter1/training.css', async route => {
      const original = fs.readFileSync(new URL('../art/ui/chapter1/training.css',import.meta.url),'utf8');
      await route.fulfill({contentType:'text/css',body:original+'\n#c1 .win[data-screen="training"] .box {outline:7px solid rgb(1,2,3)}'});
    });
    await page.goto(base+'/web/ui-review.html?view='+mode);
    await page.waitForSelector('body[data-ready="'+mode+'"]',{timeout:90000});
    const frame = page.frames().find(f=>f.url().includes('/web/index.html'));
    if(mode==='training') {
      await frame.waitForSelector('#c1 .win[data-screen="training"] .box');
      assert.equal(await frame.locator('#c1 .win .box').evaluate(el=>getComputedStyle(el).outlineWidth),'7px');
    } else {
      await frame.waitForFunction(()=>window.__optionPreviewReady,{timeout:60000});
      assert(seen.has('/samguk/art/ui/settings/layout.json'));
      assert([...seen].some(p=>p.startsWith('/samguk/art/ui/settings/sprites/')));
    }
    assert(seen.has('/samguk/art/ui/manifest.json'));
    assert.deepEqual(errors,[]);
    console.log('PASS editable UI runtime:',mode);
    await page.close();
  }
} finally {await browser.close();}
