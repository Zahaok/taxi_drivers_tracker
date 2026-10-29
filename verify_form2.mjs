import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
const inputs = await pg.$$('input');
await inputs[0].fill('admin@taxi.ru'); await inputs[1].fill('admin123');
await pg.click('button[type="submit"]'); await pg.waitForTimeout(1500);
// navigate to Reports page
const link = await pg.$('text=/Отчёт/'); if (link) { await link.click(); await pg.waitForTimeout(1000); }
const btns = await pg.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t=>t));
console.log('buttons:', JSON.stringify(btns.slice(0,15)));
const addBtn = await pg.$('button:has-text("Создать отчёт"');
if (addBtn) {
  await addBtn.click(); await pg.waitForTimeout(800);
  const t = await pg.textContent('body');
  console.log('PERIOD_LINE_REMOVED:', !/— \d{4}, \d{4} г\./.test(t||''));
  console.log('PARENS_REMOVED:', !/(Wheely 70%|70% от общего дохода|65% от общего дохода|\(70%\))/.test(t||''));
  console.log('HAS_PODLEZIT:', (t||'').includes('Подлежит переводу'));
  await pg.screenshot({ path: 'verify_form.png', fullPage: true });
} else console.log('no add button found');
await b.close();
