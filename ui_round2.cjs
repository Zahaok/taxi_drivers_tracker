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
  // переход на Отчёты
  await p.click('text=Отчёты').catch(()=>p.click('text=Отчеты'));
  await p.waitForTimeout(600);
  // открыть форму нового отчёта
  const addBtn = p.locator('button:has-text("Новый"), a:has-text("Новый"), button:has-text("Добавить")').first();
  await addBtn.click().catch(e=>console.log('add btn fail'));
  await p.waitForTimeout(600);
  const inputs = p.locator('form input[inputmode], form input[type="number"], form input[type="text"]');
  console.log('form inputs:', await inputs.count());
  if (await inputs.count() >= 4) {
    await inputs.nth(0).fill('1234');
    await inputs.nth(1).fill('1001');
    await inputs.nth(2).fill('1005');
    await p.waitForTimeout(600);
    const body = await p.textContent('body');
    const kopecks = body.match(/[\d\s\u00A0\u202F]+[.,]\d{2}\s?₽/g);
    console.log('kopeck strings in UI:', kopecks ? kopecks.slice(0,8) : 'NONE');
    for (const s of ['370','350','302','651','704','245']) {
      const re = new RegExp('[\\s\\u00A0\\u202F]'+s+'\\s?₽');
      console.log(`shows ${s}₽:`, re.test(body));
    }
    await p.screenshot({ path: 'preview_rounding.png', fullPage: true });
  } else {
    await p.screenshot({ path: 'preview_rounding.png', fullPage: true });
    console.log('inputs not found, screenshot saved');
  }
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})();
