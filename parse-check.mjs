import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>', html.indexOf('ld+json'));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => {
  try {
    new vm.Script(s, { filename: 'script' + i + '.js' });
    console.log('script', i, 'OK', s.length);
  } catch (e) {
    console.log('script', i, 'FAIL', e.message);
    const m = /script\d+\.js:(\d+)/.exec(e.stack || '');
    if (m) {
      const n = +m[1];
      const lines = s.split('\n');
      console.log(lines.slice(Math.max(0, n - 6), n + 2).map((l, k) => (n - 5 + k) + ': ' + l).join('\n'));
    }
  }
});
