// node .qa/drag.mjs
// Verifies long-press-to-drag on the multiboard with REAL input events (not JS calls):
//  1. a quick click on an identity node must NOT move it and must NOT arm a drag
//  2. press-hold 400ms then move must drag that node and redraw its wire
//  3. the dragged node stays pinned across a view switch + reload (saveMemory)
//  4. right-click on a dragged node returns it to its computed slot
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\sn-drag-${Date.now()}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (e) => {
  const m = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (m.error) throw new Error(JSON.stringify(m.error));
  const r = m.result || {};
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
};
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
// start from a clean slate: no pins from an earlier run
await ev(`localStorage.clear(); window.__mb.state.nodes = {}; window.__mb.drawWires(); 1`);
await sleep(200);

const out = {};
const target = `(function(){
  var n = document.querySelector('#board .identity');   // previously NOT draggable
  var r = n.getBoundingClientRect();
  return { id: n.id, x: Math.round(r.left + r.width/2), y: Math.round(r.top + 40),
           left: n.offsetLeft, top: n.offsetTop, classes: n.className };
})()`;
const t0 = await ev(target);
out.node = t0;

// 1. quick click: press + release well under the long-press threshold
await mouse('mousePressed', t0.x, t0.y);
await sleep(60);
await mouse('mouseReleased', t0.x, t0.y);
await sleep(120);
const t1 = await ev(`(function(){ var n = document.getElementById(${JSON.stringify(t0.id)});
  return { left: n.offsetLeft, top: n.offsetTop, dragging: n.classList.contains('dragging'),
           pinned: !!window.__mb.state.nodes[n.id] }; })()`);
out.quickClick = t1;
out.quickClickMoved = t1.left !== t0.left || t1.top !== t0.top;

// 2. long press (past the 280ms threshold), then move in steps and release
const wiresBefore = await ev(`document.querySelector('#wires path').getAttribute('d')`);
await mouse('mousePressed', t0.x, t0.y);
await sleep(420);
out.armedClass = await ev(`document.getElementById(${JSON.stringify(t0.id)}).classList.contains('dragging')`);
for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', t0.x + i * 12, t0.y + i * 9); await sleep(25); }
await mouse('mouseReleased', t0.x + 96, t0.y + 72);
await sleep(250);
const t2 = await ev(`(function(){ var n = document.getElementById(${JSON.stringify(t0.id)});
  var s = JSON.parse(localStorage.getItem('mb-memory-v1') || '{}');
  return { left: n.offsetLeft, top: n.offsetTop, pinned: !!window.__mb.state.nodes[n.id],
           stored: (s.nodes || {})[n.id] || null }; })()`);
out.longPress = t2;
out.movedForReal = Math.abs(t2.left - t0.left) > 40 && Math.abs(t2.top - t0.top) > 30;
out.wireRedrawn = (await ev(`document.querySelector('#wires path').getAttribute('d')`)) !== wiresBefore;
out.placedOnTop = await ev(`document.getElementById(${JSON.stringify(t0.id)}).classList.contains('hl')`);

// 3. pin survives a view switch and a reload
await ev(`window.__mb.showView('forum'); window.__mb.showView('board'); 1`);
await sleep(400);
await send('Page.reload');
await sleep(1800);
const t3 = await ev(`(function(){ var n = document.getElementById(${JSON.stringify(t0.id)});
  return { left: n.offsetLeft, top: n.offsetTop, exists: !!n }; })()`);
out.afterReload = t3;
out.pinSurvived = Math.abs(t3.left - t2.left) <= 2 && Math.abs(t3.top - t2.top) <= 2;

// 4. right-click returns it to the chain
const r4 = await ev(`(function(){ var n = document.getElementById(${JSON.stringify(t0.id)});
  var r = n.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + 40) }; })()`);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r4.x, y: r4.y, button: 'right', buttons: 2, clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r4.x, y: r4.y, button: 'right', buttons: 0, clickCount: 1 });
await sleep(250);
const t5 = await ev(`(function(){ var n = document.getElementById(${JSON.stringify(t0.id)});
  return { left: n.offsetLeft, top: n.offsetTop, pinned: !!window.__mb.state.nodes[n.id] }; })()`);
out.afterRightClick = t5;
out.unpinned = !t5.pinned && (t5.left !== t2.left || t5.top !== t2.top);

const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
if (shot.data) fs.writeFileSync('qa-drag.png', Buffer.from(shot.data, 'base64'));
else out.shotError = JSON.stringify(shot).slice(0, 200);

const errs = await ev(`document.querySelector('.boot-error') && document.querySelector('.boot-error').textContent`);
out.bootError = errs || null;
console.log(JSON.stringify(out, null, 1));
ws.close(); try { proc.kill(); } catch { } process.exit(0);
