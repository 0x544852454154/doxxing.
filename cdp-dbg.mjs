import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const port = await new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}\\d-${Date.now()}`, '--headless=new', '--no-sandbox', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 100; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); } }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (m, p = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method: m, params: p })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300); return r.result.result.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'file:///C:/Users/eunso/Documents/doxxing.site/index.html' });
await sleep(1800);
const q = process.argv.slice(2).join(' ');
await sleep(Number(process.env.WAIT || 0));
console.log(JSON.stringify(await ev(q), null, 1));
ws.close(); proc.kill(); process.exit(0);
