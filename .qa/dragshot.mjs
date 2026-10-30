// node .qa/dragshot.mjs
// Takes a screenshot MID-DRAG (mouse still held) so the drag state, wire routing and
// pinned highlight can be inspected visually, not just asserted.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\sn-dshot-${Date.now()}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result?.value;
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
  const data = r.result && r.result.data;
  if (!data) throw new Error('screenshot failed: ' + JSON.stringify(r).slice(0, 160));
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
await ev(`localStorage.clear(); window.__mb.state.nodes = {}; window.__mb.layoutNodes(); window.__mb.drawWires(); 1`);

// drag the category-rows node down into the free area under the chain
const g = await ev(`(function(){ var n = document.getElementById('n-daniell-a-0-cats');
  var r = n.getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + 20), left: n.offsetLeft, top: n.offsetTop }; })()`);
await mouse('mousePressed', g.x, g.y);
await sleep(420);
for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', g.x - i * 6, g.y + i * 30); await sleep(20); }
await shot('qa-drag-mid.png');          // still holding the button

const mid = await ev(`(function(){ var n = document.getElementById('n-daniell-a-0-cats');
  return { left: n.offsetLeft, top: n.offsetTop, dragging: n.classList.contains('dragging'),
           pinned: !!window.__mb.state.nodes[n.id] }; })()`);
await mouse('mouseReleased', g.x - 60, g.y + 300);
await sleep(250);
await shot('qa-drag-after.png');

const after = await ev(`(function(){ var n = document.getElementById('n-daniell-a-0-cats');
  var s = JSON.parse(localStorage.getItem('mb-memory-v1') || '{}');
  return { left: n.offsetLeft, top: n.offsetTop, pinned: !!window.__mb.state.nodes[n.id],
           stored: (s.nodes || {})[n.id] || null }; })()`);
console.log(JSON.stringify({ start: g, mid, after, moved: after.top - g.top, bootError: await ev(`document.querySelector('.boot-error') && document.querySelector('.boot-error').textContent`) || null }, null, 1));
ws.close(); try { proc.kill(); } catch { } process.exit(0);
