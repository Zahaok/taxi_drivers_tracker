import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
// login
await pg.fill('input[type="email"], input#email, input[placeholder*="почт"], input[placeholder*="mail"]', 'admin@taxi.ru').catch(()=>{});
const inputs = await pg.$$('input');
if (inputs.length >= 2) { await inputs[0].fill('admin@taxi.ru'); await inputs[1].fill('admin123'); }
await pg.click('button[type="submit"]').catch(()=>{});
await pg.waitForTimeout(1500);
const bodyText = await pg.textContent('body');
// checks
const hasPeriodLine = /— \d{4}, \d{4} г\./.test(bodyText || '');
const hasParens = /(Wheely 70%|70% от общего дохода|65% от общего дохода)/.test(bodyText || '');
console.log('period line present:', hasPeriodLine);
console.log('old parentheticals present:', hasParens);
console.log('title:', await pg.title());
const font = await pg.evaluate(() => getComputedStyle(document.body).fontFamily);
console.log('font:', font);
await pg.screenshot({ path: 'verify_light.png' });
// open report form if exists
const newBtn = await pg.$('text=/Новый отчёт|Добавить/');
if (newBtn) { await newBtn.click(); await pg.waitForTimeout(800); const t2 = await pg.textContent('body'); console.log('form period line:', /— \d{4}, \d{4} г\./.test(t2||'')); console.log('form "Подлежит переводу:" present:', (t2||'').includes('Подлежит переводу')); await pg.screenshot({ path: 'verify_form.png', fullPage: true }); }
console.log('JS errors:', errs.length ? errs : 'none');
await b.close();
