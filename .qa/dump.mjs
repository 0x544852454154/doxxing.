export default async function run(page) {
  const info = await page.evaluate(() => {
    const s = [...document.scripts][1].textContent;
    const lines = s.split('\n');
    return {
      total: lines.length,
      markers: lines.map((l, i) => [i + 1, l]).filter(([, l]) => /__dbg|BOOT|buildBoard\(\)/.test(l)).slice(0, 20),
      bootArea: lines.slice(0, 40).map((l, i) => (i + 1) + ': ' + l),
      countBuildBoard: (s.match(/buildBoard\(\)/g) || []).length,
    };
  });
  return info;
}
