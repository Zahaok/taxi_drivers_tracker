const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  // вход демо-аккаунтом админа
  const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="@"]';
  await p.fill(emailSel, 'admin@taxi.ru');
  await p.fill('input[type="password"]', 'admin123').catch(()=>{});
  // подсказка с паролем на странице — пробуем частые пароли
  let loggedIn = false;
  for (const pass of ['admin123','password123','demo123','123456']) {
    await p.fill('input[type="password"]', pass).catch(()=>{});
    await p.click('button[type="submit"]').catch(()=>{});
    await p.waitForTimeout(700);
    if (!p.url().includes('login') && await p.locator('text=/Дашборд|Отчёт|Аналитика/').first().isVisible().catch(()=>false)) { loggedIn = true; break; }
  }
  console.log('login:', loggedIn);
  if (loggedIn) {
    // открыть форму отчёта и ввести некруглые суммы
    await p.click('text=/Новый отчёт|Добавить отчёт/i').catch(async()=>{ await p.click('a:has-text("Отчеты"), a:has-text("Отчёты")').catch(()=>{}); });
    await p.waitForTimeout(500);
    const numInputs = p.locator('form input[type="number"], form input[inputmode="decimal"], form input[inputmode="numeric"]');
    const cnt = await numInputs.count();
    console.log('numeric inputs in form:', cnt);
    if (cnt >= 3) {
      await numInputs.nth(0).fill('1234');   // wheely gross
      await numInputs.nth(1).fill('1001');   // yandex gross
      await numInputs.nth(2).fill('1005');   // own rent gross
      await p.waitForTimeout(600);
      const body = await p.textContent('body');
      // ищем копейки в тексте формы
      const kopecks = body.match(/\d[\s\u00A0]?\d{2}[.,]\d{2}\s?₽/g);
      console.log('strings with kopecks:', kopecks ? kopecks.slice(0,5) : 'NONE');
      const has370 = /\u2009?\s?370\s?₽/.test(body), has350=/350\s?₽/.test(body), has302=/302\s?₽/.test(body);
      console.log('Wheely base 370₽:', has370, '| Yandex base 350₽:', has350, '| OwnRent 302₽:', has302);
      await p.screenshot({ path: '/workspace/preview_rounding.png', fullPage: false });
    }
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})();
