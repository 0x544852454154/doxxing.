export default async function run(page) {
  const r = await page.evaluate(() => {
    const s = [...document.scripts][1].textContent;
    return { wrapped: s.slice(0, 40), isIife: /\(function\(\)\{/.test(s), markers: (s.match(/__dbg\(/g) || []).length, tail: s.slice(-400) };
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.reload();
  await page.waitForTimeout(600);
  return { r, errs, stage: await page.evaluate(() => window.__mbStage || null) };
}
