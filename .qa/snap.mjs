// node .qa/snap.mjs <out.png> <expression-to-run-first>
// default: 1440x900 viewport clip (viewport-only screenshot via Emulation metrics,
// which also makes visibility:hidden work — body:has() otherwise hides the rail).
// env SNAP_FULL=1 captures the whole scroll area instead.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\sn-${Date.now()}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result;
const [out, expr] = process.argv.slice(2);
const full = process.env.SNAP_FULL === '1';
await send('Page.enable'); await send('Runtime.enable');
if (!full) await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
if (expr) { const r = await ev(expr); console.log('eval:', JSON.stringify(r.result && r.result.value)); }
await sleep(600);
const shot = await send('Page.captureScreenshot', full ? { format: 'png' } : { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close(); proc.kill(); process.exit(0);
