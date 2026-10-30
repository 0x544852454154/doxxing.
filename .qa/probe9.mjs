export default async function run(page) {
  const p2 = await page.context().newPage();
  await p2.clock.install();
  await p2.clock.pauseAt(new Date('2026-10-30T12:00:00Z'));
  await p2.goto('file:///C:/Users/eunso/Documents/doxxing.site/index.html').catch(() => { });
  await p2.clock.runFor(1000);
  const r = await p2.evaluate(() => ({ probe: typeof window.__dbgProbe, nodes: document.querySelectorAll('.node').length }));
  return r;
}
