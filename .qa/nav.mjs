export default async function run(page) {
  const results = {};
  const navs = [
    ['megacorp-one.invalid', 'http://megacorp-one.invalid/'],
    ['example.com (offline)', 'http://example.invalid/'],
  ];
  for (const [name, url] of navs) {
    await page.goto(url).catch(e => { results[name] = String(e).slice(0, 120); });
    await page.waitForTimeout(400);
    results[name] = results[name] || await page.evaluate(() => location.href + ' | ' + document.body.innerText.slice(0, 60));
  }
  await page.goto('file:///C:/Users/eunso/Documents/doxxing.site/index.html');
  await page.waitForTimeout(1200);
  results.mbFile = await page.evaluate(() => ({ probe: typeof window.__dbgProbe, nodes: document.querySelectorAll('.node').length, href: location.href }));
  return results;
}
