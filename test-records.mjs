import fs from 'node:fs';
const html = fs.readFileSync('v1.html', 'utf8');
const start = html.indexOf('var data = [');
const end = html.indexOf('];', start) + 2;
const src = html.slice(start + 'var data = '.length, end);
const data = new Function('return ' + src)();
const esc = s => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\r?\n/g, '\\n');
const out = data.map(r => `  { alias: '${esc(r[0])}', group: '${esc(r[1])}', legal: '${esc(r[2])}', location: '${esc(r[3])}', contact: '${esc(r[4])}', country: '${esc(r[5])}', source: '${esc(r[6])}', platform: '${esc(r[7])}', verified: ${r[8]}, mirror: '${esc(r[9])}', locationFull: '${esc(r[10])}', details: '${esc(r[11])}' }`).join(',\n');
fs.writeFileSync('records-body.js', out);
console.log(JSON.stringify({ n: data.length, lens: data.map(r => [r[0], (r[11] || '').split('\n').length]) }));
