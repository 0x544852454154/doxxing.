// Renders a probe page that loads index.html in an iframe at a chosen scroll/zoom and screenshots it.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const prof = process.env.TEMP + '\\v-' + Date.now();
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result;
await send('Page.enable'); await send('Runtime.enable');
const url = 'file:///C:/Users/eunso/Documents/doxxing.site/index.html';
await send('Page.navigate', { url });
await sleep(2000);
if (process.argv[2]) await ev(process.argv[2]);
await sleep(800);
const r = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(process.argv[3] || 'qa-view.png', Buffer.from(r.result.data, 'base64'));
console.log('saved', process.argv[3] || 'qa-view.png', JSON.stringify(await ev('({w:innerWidth,h:innerHeight})')).slice(0, 80));
ws.close(); proc.kill(); process.exit(0);
