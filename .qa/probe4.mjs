export default async function run(page) {
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  await page.reload();
  await page.waitForTimeout(1200);
  return { logs: logs.filter(l => /MB-BUILD|PAGEERROR|error/i.test(l)), url: page.url(), stage: await page.evaluate(() => window.__mbStage) };
}
