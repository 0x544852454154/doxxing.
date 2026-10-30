export default async function run(page) {
  // brand new page in the same context
  const p2 = await page.context().newPage();
  const logs = [];
  p2.on('console', m => logs.push(m.type() + '|' + m.text().slice(0, 80)));
  p2.on('pageerror', e => logs.push('ERR|' + String(e).slice(0, 160)));
  await p2.goto('file:///C:/Users/eunso/Documents/doxxing.site/index.html');
  await p2.waitForTimeout(1500);
  const r2 = {
    probe: await p2.evaluate(() => typeof window.__dbgProbe),
    stage: await p2.evaluate(() => window.__mbStage),
    logs: logs.slice(0, 6),
    nodes: await p2.evaluate(() => document.querySelectorAll('.node').length),
  };
  return { r2, samePageProbe: await page.evaluate(() => typeof window.__dbgProbe) };
}
