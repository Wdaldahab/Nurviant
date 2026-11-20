// Regenerates the icons and the link-preview image. Re-run it, and commit the output, whenever the
// logo mark or the home page headline or illustration changes.
//
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright node tools/render-assets.cjs
//
// Needs Playwright and installed Chrome, like tests/browser.cjs. Writes to the repository root:
//   favicon.svg, favicon.ico (16/32/48 px), apple-touch-icon.png (180 px), og-image.png (1200x630 px)
// The preview image reads its headline and illustration from index.html, so it follows the page.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = name => path.join(__dirname, '..', name);

const GREEN = '#176950', LIME = '#d9e9b1';
const mark = radius => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="' + radius + '" fill="' + GREEN + '"/><path d="M32 17v30M17 32h30" stroke="' + LIME + '" stroke-width="9" stroke-linecap="round"/></svg>';

// ICO container holding PNG images, which every current browser and OS accepts.
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(([size, png], i) => {
    const entry = 6 + 16 * i;
    head[entry] = size; head[entry + 1] = size; // width, height
    head.writeUInt16LE(1, entry + 4); // colour planes
    head.writeUInt16LE(32, entry + 6); // bits per pixel
    head.writeUInt32LE(png.length, entry + 8);
    head.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map(([, png]) => png)]);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const shoot = async (html, width, height, transparent) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    const png = await page.screenshot({ omitBackground: transparent });
    await page.close();
    return png;
  };
  const icon = (svg, size, transparent) => shoot('<style>html,body{margin:0;background:transparent}img{display:block}</style><img width="' + size + '" height="' + size + '" src="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '">', size, size, transparent);

  fs.writeFileSync(out('favicon.svg'), mark(14) + '\n');
  fs.writeFileSync(out('favicon.ico'), ico(await Promise.all([16, 32, 48].map(async size => [size, await icon(mark(14), size, true)]))));
  fs.writeFileSync(out('apple-touch-icon.png'), await icon(mark(0), 180, false)); // iOS rounds the corners itself

  const home = await browser.newPage();
  await home.goto('file://' + out('index.html'));
  const { headline, art } = await home.evaluate(() => ({ headline: document.querySelector('h1').innerHTML, art: document.querySelector('.scene svg').outerHTML }));
  await home.close();
  const card = '<!doctype html><meta charset="utf-8"><style>' +
    '*{box-sizing:border-box;margin:0}' +
    'body{width:1200px;height:630px;position:relative;overflow:hidden;background:#f6f5ee;color:#173b36;font:16px/1.6 Arial,sans-serif}' +
    '.logo{position:absolute;left:72px;top:54px;display:flex;align-items:center;font-size:38px;font-weight:700;letter-spacing:-1.5px}' +
    '.logo b{background:#d9e9b1;border-radius:12px;padding:3px 14px;margin-right:12px}' +
    'h1{position:absolute;left:72px;top:146px;font:normal 80px/1.06 Georgia,serif;letter-spacing:-.04em}h1 em{color:#176950}' +
    '.url{position:absolute;left:72px;bottom:50px;font-size:26px;letter-spacing:.5px;color:#566b62}' +
    '.scene{position:absolute;right:72px;top:54px;width:420px;height:522px;background:#d8e5d6;border-radius:210px 210px 20px 20px;overflow:hidden}' +
    '.scene svg{position:absolute;bottom:0;left:50%;height:522px;width:auto;transform:translateX(-50%)}' +
    '</style><div class="logo"><b>+</b>Nurviant</div><h1>' + headline + '</h1><div class="url">nurviant.com</div><div class="scene">' + art + '</div>';
  fs.writeFileSync(out('og-image.png'), await shoot(card, 1200, 630, false));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
