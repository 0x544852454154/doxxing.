import fs from 'node:fs';
export default async function run(page) {
  const disk = fs.readFileSync('c:/Users/eunso/Documents/doxxing.site/index.html', 'utf8');
  const dom = await page.evaluate(() => document.documentElement.outerHTML);
  const domScript = await page.evaluate(() => [...document.scripts][1].textContent);
  const i = disk.indexOf('<script>', 2000);
  const diskScript = disk.slice(i + 8, disk.indexOf('</script>', i));
  const firstDiff = (a, b) => { for (let k = 0; k < Math.max(a.length, b.length); k++) if (a[k] !== b[k]) return { k, disk: a.slice(k - 80, k + 80), dom: b.slice(k - 80, k + 80) }; return 'identical'; };
  return { diskScriptLen: diskScript.length, domScriptLen: domScript.length, diff: firstDiff(diskScript, domScript) };
}
