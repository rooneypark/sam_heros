// Render existing UI code in an isolated browser context; never uses the player's browser/save.
// npm install && npx playwright install chromium
// node tools/render_ui_review.mjs http://127.0.0.1:8156
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SAM_HEROS_PLAYWRIGHT || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8156';
const out = path.resolve('docs/ui-review-2026-10-28');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SAM_HEROS_CHROMIUM ? {executablePath:process.env.SAM_HEROS_CHROMIUM} : fs.existsSync(chromium.executablePath()) ? {executablePath:chromium.executablePath()} : {channel:'msedge'}), args: ['--use-angle=swiftshader', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 });
const oldManifest=path.join(out,'manifest.json');
const results=process.env.SAM_HEROS_UI_MODES && fs.existsSync(oldManifest)?JSON.parse(fs.readFileSync(oldManifest,'utf8')).screens:[];
try {
  for (const [i, mode] of ['intro','hud','dialog','training','locked','rest','bridge','boss','complete','settings','controls'].entries()) {
    if(process.env.SAM_HEROS_UI_MODES && !process.env.SAM_HEROS_UI_MODES.split(',').includes(mode))continue;
    const page = await browser.newPage({viewport:{width:1280,height:1100},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/web/ui-review.html?view=${mode}`);
    await page.waitForSelector(`body[data-ready="${mode}"]`, { timeout: 90000 }).catch(async e=>{console.log("CAPTURE DIAGNOSTIC",mode,await page.locator("#status").innerText(),errors);throw e;});
    const frame = page.frames().find(f => f.url().includes('/web/index.html'));
    if (mode === 'settings') await frame.waitForFunction(() => window.__optionPreviewReady, { timeout: 60000 });
    if (['training','rest','bridge'].includes(mode)) await frame.waitForSelector('#c1 .win', { state: 'visible' });
    if (['dialog','locked'].includes(mode)) await frame.waitForSelector('#c1 .dlg', { state: 'visible' });
    if (mode === 'intro') await frame.waitForSelector('.sgi .logo.on');
    await page.screenshot({ path: path.join(out, `${String(i+1).padStart(2,'0')}-${mode}-context.png`) });
    await page.locator('#game').screenshot({ path: path.join(out, `${String(i+1).padStart(2,'0')}-${mode}.png`) });
    const entry = { mode, file: `${String(i+1).padStart(2,'0')}-${mode}.png`, url: `/web/ui-review.html?view=${mode}`, fixture: true, errors };
    const old=results.findIndex(x=>x.mode===mode);if(old>=0)results.splice(old,1);results.push(entry);
    console.log(JSON.stringify(entry));
    if (errors.length) throw new Error(`UI preview errors: ${mode}`);
    await page.close();
  }
  // Capture the actual maker and real-tree checker, without saving a map or editing user data.
  for (const [mode, url] of [
    ['map-maker','/web/maker.html?samgukMap='+encodeURIComponent('1장_황건소탕')],
    ['motion-checker','/web/motion.html?units=SG_U0002&test=gather'],
  ]) {
    if(process.env.SAM_HEROS_UI_MODES && !process.env.SAM_HEROS_UI_MODES.split(',').includes(mode))continue;
    const page = await browser.newPage({viewport:{width:1280,height:1100},deviceScaleFactor:1});
    await page.setViewportSize({ width:1280, height:800 });
    await page.goto(base+url);
    await page.waitForFunction(() => !!window.__G, { timeout:120000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path:path.join(out,mode+'.png') });
    results.push({mode,file:mode+'.png',url,fixture:false});
    console.log(mode+' captured');
    await page.close();
  }
} finally {
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({date:'2026-10-28',description:'Existing UI review fixtures, not chapter-clear or art approval evidence',screens:results},null,2));
  await browser.close();
}
