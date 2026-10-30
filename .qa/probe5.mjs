import fs from 'node:fs';
export default async function run(page) {
  const disk = fs.readFileSync('c:/Users/eunso/Documents/doxxing.site/index.html', 'utf8');
  const fetched = await page.evaluate(async () => (await fetch(location.href)).text());
  const domScript = await page.evaluate(() => [...document.scripts][1].textContent);
  const firstDiff = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return { i, a: a.slice(i - 60, i + 60), b: b.slice(i - 60, i + 60) }; return null; };
  // pull the IIFE body out of both for comparison
  const body = s => { const i = s.indexOf("(function(){"); return i < 0 ? null : s.slice(i, s.lastIndexOf('})();') + 5); };
  return {
    diskLen: disk.length, fetchedLen: fetched.length, domLen: domScript.length,
    diskVsFetched: firstDiff(disk, fetched) ? 'DIFF' : 'same',
    bodyInDisk: disk.includes('MB-BUILD-7'),
    bodyInFetched: fetched.includes('MB-BUILD-7'),
    bodyInDom: domScript.includes('MB-BUILD-7'),
    diskScriptVsDom: disk.includes(domScript.slice(0, 200)) ? 'dom is in disk' : 'dom NOT in disk',
    resType: await page.evaluate(() => document.contentType),
  };
}
