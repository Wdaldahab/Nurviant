const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({headless:true, channel:"chrome"});
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror', e=>errors.push(e.message));
 const failed=[];page.on('response', r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url())});
 await page.goto('http://localhost:8765');
 await page.screenshot({path:process.env.OUTPUT_DIR+'/desktop.png',fullPage:true});
 const tops=await page.locator('.card button').evaluateAll(buttons=>buttons.map(b=>Math.round(b.getBoundingClientRect().top)));
 assert.equal(new Set(tops).size,1,'role card buttons are not aligned: '+tops);
 const lowContrast=await page.evaluate(()=>{ // text needs 4.5:1, field borders 3:1 (WCAG AA), measured against the real background
  const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b};
  const bg=e=>{for(;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(!/rgba\(.*,\s*0\)|transparent/.test(c))return c}return 'rgb(255,255,255)'};
  const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)];return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const text=[...document.querySelectorAll('.muted,#deliveryNote')].filter(e=>e.offsetParent).map(e=>[e.id||e.textContent.trim().slice(0,30),ratio(getComputedStyle(e).color,bg(e)),4.5]);
  const fields=[...document.querySelectorAll('.filters input,.filters select,#intake input:not([type=checkbox]),#intake select,#intake textarea')].filter(e=>e.offsetParent).map(e=>['field '+(e.name||e.id),ratio(getComputedStyle(e).borderTopColor,'rgb(255,255,255)'),3]);
  return [...text,...fields].filter(([,r,need])=>r<need).map(([name,r,need])=>name+' '+r.toFixed(2)+' < '+need);
 });
 assert.deepEqual(lowContrast,[],'insufficient contrast');
 await page.locator('#search').fill('nonexistent');assert.equal(await page.locator('#empty').isVisible(),true);
 await page.locator('#search').fill('');await page.locator('.card button').first().click();
 assert.equal(await page.locator('[name=specialty]').inputValue(),'Critical care');
 await page.locator('#hospitalTab').click();
 assert.equal(await page.locator('[name=license]').isDisabled(),true);
 assert.equal(await page.locator('[name=organization]').isVisible(),true);
 await page.locator('[name=name]').fill('Test Person');await page.locator('[name=email]').fill('test@example.com');
 await page.locator('[name=location]').fill('Chicago, IL');await page.locator('[name=organization]').fill('Test hospital');
 await page.locator('[name=consent]').check();
 assert.equal(await page.evaluate(()=>form.checkValidity()),true);
 assert.equal(await page.evaluate(()=>Object.hasOwn(inquiryData(),'authorization')),false);
 const source=fs.readFileSync('app.js','utf8').replace('const ONLINE_INTAKE_ENABLED = false','const ONLINE_INTAKE_ENABLED = true');
 for (const scenario of ['rejected','malformed','network','accepted']) {
   await page.route('**/app.js',route=>route.fulfill({body:source,contentType:'text/javascript'}));
   await page.reload();
   await page.route('https://formsubmit.co/**',route=> scenario==='network' ? route.abort() : route.fulfill({status:200,contentType:'application/json',body:scenario==='malformed'?'invalid':JSON.stringify({success:scenario==='accepted'?'true':'false'})}));
   await page.locator('[name=name]').fill('Test Person');await page.locator('[name=email]').fill('test@example.com');await page.locator('[name=location]').fill('Chicago');await page.locator('[name=specialty]').selectOption('Critical care');await page.locator('[name=license]').selectOption('Registered Nurse (RN)');await page.locator('[name=authorization]').selectOption('Prefer to discuss');await page.locator('[name=consent]').check();
   await page.locator('#submit').click();
   await page.waitForFunction(()=>!document.getElementById('submit').disabled);
   assert.match(await page.locator('#status').innerText(),scenario==='accepted'?/service accepted/:/could not be confirmed/);
   assert.equal(await page.locator('[name=name]').inputValue(),scenario==='accepted'?'':'Test Person');
   await page.unroute('https://formsubmit.co/**');
 }
 await page.unroute('**/app.js');await page.reload();
 for (const width of [320,375,768]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
 }
 await page.setViewportSize({width:375,height:812});await page.locator('.menu-toggle').click();
 assert.equal(await page.locator('#navigation').isVisible(),true);await page.locator('#navigation a').first().click();
 assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 await page.screenshot({path:process.env.OUTPUT_DIR+'/mobile.png',fullPage:true});
  for (const selector of ['.consent a','footer a[href*=privacy]']) {
    await page.evaluate(()=>{document.getElementById('privacy').open=false});
    await page.locator(selector).click();
    assert.equal(await page.evaluate(()=>document.getElementById('privacy').open),true,'privacy notice did not open from '+selector);
  }
 // The icons, link preview and crawler files named by the page exist. Tags point at https://nurviant.com, so request the same paths locally.
 const head=await page.evaluate(()=>({icons:[...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')].map(l=>l.href),image:document.querySelector('meta[property="og:image"]')?.content,card:document.querySelector('meta[name="twitter:card"]')?.content,canonical:document.querySelector('link[rel=canonical]').href}));
 const get=async url=>{const r=await page.request.get('http://localhost:8765'+new URL(url,'http://localhost:8765').pathname);assert.equal(r.status(),200,'missing '+url);return r};
 assert.equal(head.icons.length,3,'expected the .ico, .svg and apple-touch icons in <head>');for (const url of head.icons) await get(url);
 assert.ok(head.image,'og:image is missing');
 const image=await (await get(head.image)).body();
 assert.equal(image.readUInt32BE(16)+'x'+image.readUInt32BE(20),'1200x630','og:image size');
 assert.equal(head.card,'summary_large_image');
 const sitemap=await (await get('/sitemap.xml')).text();
 assert.ok(sitemap.includes('<loc>'+head.canonical+'</loc>'),'sitemap lacks the canonical home page');
 for (const [,loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) await get(loc);
 assert.match(await (await get('/robots.txt')).text(),/^Sitemap: https:\/\/nurviant\.com\/sitemap\.xml$/m);
 assert.deepEqual(errors,[]);
 assert.deepEqual(failed,[]);
 await browser.close();console.log('PASS: filtering, role selection, separate form payloads, mocked delivery failures/success, responsive widths, mobile navigation, privacy notice links, contrast, card alignment, icon/link-preview/sitemap files, no browser errors or failed requests. No inquiries sent.');
})().catch(e=>{console.error(e);process.exit(1)});
