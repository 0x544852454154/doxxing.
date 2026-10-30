// node .qa/wirefollow.mjs
// Real drag of the category-rows node; after release, check that every wire endpoint
// that belongs to that node uses its NEW board-local position.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\sn-wf-${Date.now()}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (e) => {
  const m = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (m.result && m.result.exceptionDetails) {
    const d = m.result.exceptionDetails;
    throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text);
  }
  if (!m.result) throw new Error('no result: ' + JSON.stringify(m).slice(0, 300));
  return m.result.result.value;
};
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
await ev(`localStorage.clear(); window.__mb.state.nodes = {}; window.__mb.drawWires(); 1`);

const probe = `(function(){
  var g = document.getElementById('n-daniell-a-0-cats');
  var rows = [].slice.call(g.children).map(function(r, k){
    return { k: k, cy: g.offsetTop + r.offsetTop + r.offsetHeight/2, r: g.offsetLeft + g.offsetWidth };
  });
  var starts = [].slice.call(document.querySelectorAll('#wires path')).map(function(p){
    var dd = p.getAttribute('d') || ''; var m = /^M([0-9.\-]+),([0-9.\-]+)/.exec(dd);
    return m ? [+m[1], +m[2]] : null;
  }).filter(Boolean);
  return { g: [g.offsetLeft, g.offsetTop], rows: rows,
           starts: starts, dPrototype: Object.prototype.hasOwnProperty.call(g, 'offsetTop') };
})()`;

const g = await ev(`(function(){ var n = document.getElementById('n-daniell-a-0-cats');
  var r = n.getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + 20) }; })()`);
await mouse('mousePressed', g.x, g.y);
await sleep(420);
for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', g.x - i * 6, g.y + i * 30); await sleep(20); }
const mid = await ev(probe);
await mouse('mouseReleased', g.x - 60, g.y + 300);
await sleep(300);
const after = await ev(probe);

// does any wire start on one of the row centres of the NEW node position?
const onNew = after.starts.filter(s => after.rows.some(r => Math.abs(s[1] - r.cy) < 1 && Math.abs(s[0] - r.r) < 40)).length;
const onOld = after.starts.filter(s => mid.rows.some(r => Math.abs(s[1] - r.cy) < 1)).length;

console.log(JSON.stringify({
  start: g, midPos: mid.g, afterPos: after.g,
  rowCentsAfter: after.rows.map(r => Math.round(r.cy)),
  wireStarts: after.starts.map(s => s.map(Math.round)).slice(0, 12),
  wiresStartingAtNewRowEdge: onNew, wiresStillAtOldRowEdge: onOld
}, null, 1));
ws.close(); try { proc.kill(); } catch { } process.exit(0);
