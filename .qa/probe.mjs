export default async function run(page) {
  const out = {};
  out.stage = await page.evaluate(() => window.__mbStage || null);
  out.errors = [];
  page.on('pageerror', e => out.errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') out.errors.push('[console] ' + m.text().slice(0, 300)); });
  await page.waitForTimeout(800);
  out.mb = await page.evaluate(() => !!window.__mb);
  out.stage2 = await page.evaluate(() => window.__mbStage || null);
  out.details = await page.evaluate(() => ({
    boardErr: window.__mbBoardErr, inspErr: window.__mbInspErr, restoreErr: window.__mbRestoreErr,
    cards: document.querySelectorAll('#inspector .xcard').length,
    nodes: document.querySelectorAll('.node').length,
    paths: document.querySelectorAll('#wires path').length,
    who: document.querySelector('.identity .who div') ? document.querySelector('.identity .who div').textContent : null,
  }));
  return out;
}
