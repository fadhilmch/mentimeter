import { chromium } from 'playwright';
const b=await chromium.launch();
const log=(...a)=>console.log('[walk]',...a);
// --- LENS: phone participant ---
const phone=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await phone.newPage();
await p.goto('http://localhost:5173/',{waitUntil:'networkidle'});
await p.screenshot({path:'/tmp/shots/w-landing.png'});
const codeInput=p.locator('input').first();
log('landing inputs:',await p.locator('input').count(),'heading:',(await p.locator('h1,h2').first().textContent().catch(()=>'?')));
await codeInput.fill('123456');
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
log('after code url:',p.url());
await p.screenshot({path:'/tmp/shots/w-after-code.png'});
// nickname step?
const nickBtn=p.locator('button:has-text("Generate nickname")');
if(await nickBtn.count()) { log('nickname screen shown'); await p.screenshot({path:'/tmp/shots/w-nickname.png'}); }
const joinBtn=p.locator('button:has-text("Join"),button[type=submit]').first();
if(await joinBtn.count()){ await joinBtn.click().catch(()=>{}); await p.waitForTimeout(1500); }
log('audience url:',p.url());
await p.screenshot({path:'/tmp/shots/w-audience.png'});
const audText=await p.locator('body').innerText();
log('audience sees:',audText.slice(0,300).replace(/\n/g,' | '));
// answer first option if quiz
const opt=p.locator('button:has-text("Mars"), [role=radio], .option, label:has-text("Mars")').first();
if(await opt.count()){ await opt.click(); await p.waitForTimeout(1200); await p.screenshot({path:'/tmp/shots/w-answered.png'}); log('answered Mars'); }
else { log('no quiz option found; body:',audText.slice(0,150)); }
await phone.close();
await b.close();
