export default async function run(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[c] ' + m.text().slice(0, 200)); });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(1000);
  return {
    errs,
    stage: await page.evaluate(() => window.__mbStage === undefined ? 'UNDEF' : window.__mbStage),
    hasFn: await page.evaluate(() => typeof window.__dbgProbe),
    view: await page.evaluate(() => document.body.dataset.view),
    paths: await page.evaluate(() => document.querySelectorAll('#wires path').length),
  };
}
