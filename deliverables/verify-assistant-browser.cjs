const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Farghally/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((request, response) => {
 const filename = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
 if (!filename.startsWith(root + path.sep)) {response.writeHead(403).end();return;}
 const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp4':'video/mp4'};
 fs.readFile(filename, (error, data) => {
  if(error){response.writeHead(404).end();return;}
  response.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream'}).end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],report=[];
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const page=await browser.newPage({viewport,reducedMotion:viewport.width>1000?'no-preference':'reduce'});
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api.open-meteo.com/**',route=>route.abort());
   await page.goto('http://127.0.0.1:'+server.address().port+'/ai-assistance.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.message.bot'));
   assert.equal(await page.locator('input[type=file]').count(),0);
   await page.locator('[data-answer=name] [data-next-question]').click();
   assert.equal(await page.locator('[data-answer=name]').isVisible(),true);
   await page.locator('#traveler-name').fill('QA Traveler');
   await page.locator('#traveler-code').fill('20');
   await page.locator('#traveler-phone').fill('abc 0000000000');
   assert.equal(await page.locator('#traveler-phone').inputValue(),'0000000000');
   await page.locator('[data-answer=name] [data-next-question]').click();
   await page.locator('[data-answer=travelers] [data-next-question]').click();
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'});
   const date=days=>new Date(Date.parse(today)+days*86400000).toISOString().slice(0,10);
   await page.locator('#arrival').fill(date(2));
   await page.locator('#departure').fill(date(12));
   await page.locator('[data-answer=dates] [data-next-question]').click();
   await page.locator('[data-answer=interests] [data-next-question]').click();
   assert.match(await page.locator('[name=city][value=cairo]').locator('..').innerText(),/2 tours/);
   await page.locator('[data-answer=cities] [data-next-question]').click();
   assert.equal(await page.locator('#requests-field').isVisible(),false);
   await page.locator('#has-requests').check();
   await page.locator('[data-answer=contact] [name=message]').fill('Quiet room');
   await page.locator('[data-answer=contact] [data-next-question]').click();
   await page.waitForTimeout(800);
   console.log('Intro media',await page.locator('#intro-video').evaluate(video=>({width:video.videoWidth,height:video.videoHeight,rect:video.getBoundingClientRect().toJSON()})));
   await page.screenshot({path:path.join(__dirname,'assistant-v3-tablet-'+viewport.width+'.png')});
   await page.locator('#explore-map').evaluate(button=>{button.click();button.click();});
   await page.waitForFunction(()=>document.body.dataset.stage==='map');
   await page.locator('.tablet-expansion').waitFor({state:'detached'});
   assert.equal(await page.locator('.tablet-expansion').count(),0);
   await page.waitForFunction(()=>!!window.L);
   assert.equal(await page.locator('.map-heading').count(),0);
   assert.equal(await page.locator('.leaflet-tile').count(),0);
   assert.match(await page.locator('.leaflet-image-layer').getAttribute('src'),/egypt-illustrated-v2.png/);
   const imageBefore=await page.locator('.leaflet-image-layer').boundingBox();
   await page.locator('.leaflet-control-zoom-in').click();
   await page.waitForTimeout(400);
   const imageAfter=await page.locator('.leaflet-image-layer').boundingBox();
   assert(imageAfter.width>imageBefore.width);
   await page.locator('.leaflet-control-zoom-out').click();
   await page.locator('#return-tablet').click();
   await page.locator('#explore-map').click();
   if(viewport.width>1000){
    await page.waitForTimeout(100);
    await page.locator('#restart').click();
    assert.equal(await page.locator('[data-answer=name]').isVisible(),true);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.tablet-expansion').count(),0);
    await page.locator('#traveler-name').fill('QA Traveler');
    await page.locator('#traveler-code').fill('20');
    await page.locator('#traveler-phone').fill('0000000000');
    await page.locator('[data-answer=name] [data-next-question]').click();
    await page.locator('[data-answer=travelers] [data-next-question]').click();
    await page.locator('#arrival').fill(date(2));
    await page.locator('#departure').fill(date(12));
    await page.locator('[data-answer=dates] [data-next-question]').click();
    await page.locator('[data-answer=interests] [data-next-question]').click();
    await page.locator('[data-answer=cities] [data-next-question]').click();
    await page.locator('#has-requests').check();
    await page.locator('[data-answer=contact] [name=message]').fill('Quiet room');
    await page.locator('[data-answer=contact] [data-next-question]').click();
    await page.locator('#explore-map').click();
   }
   await page.waitForFunction(()=>document.body.dataset.stage==='map');
   await page.locator('.tablet-expansion').waitFor({state:'detached'});
   await page.locator('[data-tour=nile-cruise-8-days] .select-tour').click();
   await page.waitForTimeout(1500);
   assert.equal(await page.locator('.route-number').count(),13);
   assert.equal(await page.locator('[data-stop=giza] .attraction-story').isVisible(),true);
   if(viewport.width>1000)assert((await page.locator('.tour-dock').boundingBox()).width<viewport.width-100);
   await page.screenshot({path:path.join(__dirname,'assistant-v3-map-'+viewport.width+'.png')});
   await page.locator('[data-tour=nile-cruise-8-days] .confirm-trip').click();
   assert.equal(await page.locator('#assistant-confirm-form [name=phone]').inputValue(),'0000000000');
   assert.equal(await page.locator('#assistant-confirm-form [name=message]').inputValue(),'Quiet room');
   await page.locator('#assistant-confirm-form [name=consent]').check();
   await page.locator('#assistant-confirm-form [type=submit]').click();
   await page.waitForURL('**/assistant-confirmation.html');
   assert.equal(await page.locator('#confirmation-details').isVisible(),true);
   assert.match(await page.locator('.preview-notice').innerText(),/not been sent/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#clear-preview').click();
   assert.equal(await page.locator('#confirmation-details').isVisible(),false);
   report.push({viewport,passed:true});
   await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({report,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
