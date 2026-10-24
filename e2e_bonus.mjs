import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:3000/');
await p.waitForTimeout(600);
await p.locator('input[placeholder="Email"]').fill('admin@taxi.ru');
await p.locator('input[type="password"]').fill('admin123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForTimeout(1500);

await p.locator('text=Отчёты').first().click();
await p.waitForTimeout(600);
// выбрать водителя в списке, если есть селектор
const sel = p.locator('select').first();
if (await sel.count()) {
  const opts = await sel.locator('option').allTextContents();
  console.log('SELECT OPTIONS:', JSON.stringify(opts));
}
const addBtn = p.locator('button:has-text("Добавить")').first();
if (await addBtn.count()) { await addBtn.click(); await p.waitForTimeout(700); }
console.log('FORM PRESENT:', await p.locator('form').count());

const inputsInfo = await p.evaluate(() => Array.from(document.querySelectorAll('form input')).map(i => i.placeholder)));
