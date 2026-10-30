export default async function run(page) {
  const logs = [];
  page.on('console', m => logs.push(m.type() + '|' + m.text().slice(0, 80)));
  await page.goto('file:///C:/Users/eunso/Documents/doxxing.site/.qa/min.html');
  await page.waitForTimeout(600);
  const probe = await page.evaluate(() => window.__probe1 || null);
  return { logs, probe, same: await page.evaluate(() => 1 + 1) };
}
