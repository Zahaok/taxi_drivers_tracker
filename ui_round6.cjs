const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
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
  await p.locator('button, a').filter({ hasText: /^Отчёты$/ }).first().click();
  await p.waitForTimeout(800);
  await p.locator('button').filter({ hasText: 'Создать отчёт' }).first().click();
  await p.waitForTimeout(600);
  const inputs = p.locator('form input[type="number"]');
  // индексы из подписей: 0=Wheely gross, 4=Яндекс gross, 7=Аренда gross
  await inputs.nth(0).fill('999');   // 30% = 299.7 -> 300
  await inputs.nth(4).fill('1001');  // 35% = 350.35 -> 350; 65% = 650.65 -> 651
  await inputs.nth(7).fill('1005');  // 30% = 301.5 -> 302; 70% = 703.5 -> 704
  await p.waitForTimeout(600);
  const body = await p.textContent('body');
  const kopecks = body.match(/[\d\s\u00A0\u202F]+[.,]\d{2}\s?\u20BD/g);
  console.log('kopeck strings:', kopecks ? kopecks.slice(0,8) : 'NONE');
  for (const s of ['300','350','651','302','704']) {
    const re = new RegExp('(\\s|\\u00A0|\\u202F)'+s+'\\s?\\u20BD');
    console.log(`shows ${s} RUB:`, re.test(body));
  }
  // проверка "Итого к выплате" — целое без копеек
  const m = body.match(/(\S[\d\s\u00A0\u202F]*)\s?\u20BD/);
  await p.screenshot({ path: 'preview_rounding.png', fullPage: true });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})();
