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
  console.log('logged in:', !(await p.locator('input[type="password"]').count()));
  // навигация через боковое меню — клик по ссылке "Отчёты"
  const navLink = p.locator('nav a, aside a').filter({ hasText: 'Отчёт' }).first();
  if (await navLink.count()) await navLink.click(); else await p.click('text=Отчёты');
  await p.waitForTimeout(800);
  console.log('url:', p.url());
  // кнопка "Новый отчёт"
  await p.locator('button').filter({ hasText: 'Новый отчёт' }).first().click();
  await p.waitForTimeout(600);
  const inputs = p.locator('form input[type="number"]');
  const cnt = await inputs.count();
  console.log('numeric inputs:', cnt);
  if (cnt >= 3) {
    await inputs.nth(0).fill('1234');   // Wheely общий доход
    await inputs.nth(3).fill('1001');   // Яндекс общий доход (после агентского/парковки/бонусов)
    await inputs.nth(6).fill('1005');   // Собственная аренда
    await p.waitForTimeout(600);
    const body = await p.textContent('body');
    const kopecks = body.match(/[\d\s\u00A0\u202F]+[.,]\d{2}\s?\u20BD/g);
    console.log('kopeck strings:', kopecks ? kopecks.slice(0,8) : 'NONE');
    for (const s of ['370','245','350','651','302','704']) {
      const re = new RegExp('(\\s|\\u00A0|\\u202F)'+s+'(\\s?\\u20BD|\\s?₽)');
      console.log(`shows ${s} ₽:`, re.test(body));
    }
    await p.screenshot({ path: 'preview_rounding.png', fullPage: true });
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})();
