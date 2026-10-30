import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\s-${Date.now()}`, '--headless=new', '--no-sandbox', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result ? r.result.result.value : r.result; };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
await ev('localStorage.clear(); 1');
const step = Number(process.argv[2] || 0);
if (step) await ev(`(function(){var c=document.getElementById('canvas'); c.scrollLeft=${step}; window.__mb.drawWires(); return [c.scrollLeft,c.scrollTop]})()`);
await sleep(400);
const out = process.argv[3] || 'qa-shot.png';
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
const info = await ev(`(function(){
  var c=document.getElementById('canvas');
  var chip=document.querySelector('.chip-node'), p=document.querySelector('#wires path');
  var m=/^M([-\\d.]+),([-\\d.]+)/.exec(p.getAttribute('d'));
  var cr=chip.getBoundingClientRect();
  return {scroll:[c.scrollLeft,c.scrollTop], wireStartBoard:[m[1],m[2]], chipRightBoardX:(cr.right-c.getBoundingClientRect().left+c.scrollLeft), chipMidBoardY:(cr.top+cr.height/2-c.getBoundingClientRect().top+c.scrollTop)};
})()`);
console.log(out, JSON.stringify(info));
ws.close(); proc.kill(); process.exit(0);
