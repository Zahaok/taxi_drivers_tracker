const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', 'admin@taxi.ru');
  for (const pass of ['admin123','password123','demo123','123456']) {
    await p.fill('input[type="password"]', pass);
    await p.click('button[type="submit"]');
    await p.waitForTimeout(700);
    if (!(await p.locator('input[type="password"]').count())) break;
  }
  // навигация — кнопка в шапке/меню с текстом Отчёты
  await p.locator('button, a').filter({ hasText: /^Отчёты$/ }).first().click();
  await p.waitForTimeout(800);
  await p.locator('button').filter({ hasText: 'Создать отчёт' }).first().click();
  await p.waitForTimeout(600);
  const inputs = p.locator('form input[type="number"]');
  const cnt = await inputs.count();
  console.log('numeric inputs:', cnt);
  await inputs.nth(0).fill('1234');   // Wheely общий доход
  await inputs.nth(3).fill('1001');   // Яндекс общий доход
  await inputs.nth(6).fill('1005');   // Собственная аренда
  await p.waitForTimeout(600);
  const body = await p.textContent('body');
  const kopecks = body.match(/[\d\s\u00A0\u202F]+[.,]\d{2}\s?\u20BD/g);
  console.log('kopeck strings:', kopecks ? kopecks.slice(0,8) : 'NONE');
  for (const s of ['370','350','651','302','704']) {
    const re = new RegExp('(\\s|\\u00A0|\\u202F)'+s+'\\s?\\u20BD');
    console.log(`shows ${s} \u20BD:`, re.test(body));
  }
  await p.screenshot({ path: 'preview_rounding.png', fullPage: true });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})();
