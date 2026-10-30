export default async function run(page) {
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  await page.reload();
  await page.waitForTimeout(1200);
  const src = await page.evaluate(() => [...document.scripts][1].textContent);
  return {
    firstLog: logs.slice(0, 5),
    hasProbeInSrc: src.includes('__dbgProbe'),
    srcHead30: src.split('\n').slice(22, 30).join(' || '),
  };
}
