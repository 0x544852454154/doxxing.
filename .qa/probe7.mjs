export default async function run(page) {
  await page.addInitScript(() => { window.__marker = 'init-script-ran'; });
  const all = [];
  page.on('console', m => all.push(m.type() + '|' + m.text().slice(0, 100)));
  await page.reload();
  await page.waitForTimeout(1500);
  return {
    all,
    marker: await page.evaluate(() => window.__marker || null),
    evalProbe: await page.evaluate(() => typeof window.__dbgProbe),
    firstNode: await page.evaluate(() => document.querySelector('.chip-node') && document.querySelector('.chip-node').id),
    canEval: await page.evaluate(() => 1 + 1),
  };
}
