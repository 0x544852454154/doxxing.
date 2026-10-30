// CDP-driven QA: attaches to a headless chromium over --remote-debugging-port and
// drives it with Runtime.evaluate / Input / Page.captureScreenshot. Used because
// the automation driver in this environment does not execute page scripts.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';

const chromePath = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const url = 'file:///C:/Users/eunso/Documents/doxxing.site/index.html';
const profile = os.tmpdir() + '\\cdp-qa-profile-' + Date.now();

const freePort = () => new Promise((res) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const port = await freePort();
const proc = spawn(chromePath, [
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new',
  '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--allow-file-access-from-files',
  `--window-size=1440,900`, 'about:blank',
], { stdio: 'ignore', detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 100; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(100); }
}

// connect to the page target (create one if only browser target exists)
let pageT = targets.find((t) => t.type === 'page');
if (!pageT) {
  pageT = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
}
const ws = new WebSocket(pageT.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
});
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function shot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
}
async function mouse(type, x, y, extra = {}) {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url });
await sleep(1500);

const out = {};
const results = {};

// ── 1. initial state ──
out.initial = await evalJs(`(function(){
  var b=document.getElementById('board');
  var cards=[].slice.call(document.querySelectorAll('#inspector .xcard'));
  return {
    mb: typeof window.__mb,
    records: window.__mb && window.__mb.RECORDS.length,
    nodes: b.querySelectorAll('.node').length,
    chips: b.querySelectorAll('.chip-node').length,
    roots: b.querySelectorAll('.identity').length,
    catRows: b.querySelectorAll('.cat-group .row').length,
    cards: cards.length,
    visibleCards: cards.filter(function(c){return !c.hidden}).length,
    cardTops: cards.slice(0,4).map(function(c){return c.offsetTop}),
    paths: document.querySelectorAll('#wires path').length,
    svgW: document.getElementById('wires').getAttribute('width'),
    svgH: document.getElementById('wires').getAttribute('height'),
    minW: b.style.minWidth, minH: b.style.minHeight,
    crumb: document.getElementById('crumb').textContent,
    badge: document.getElementById('badge-board').textContent,
    active: [].map.call(document.querySelectorAll('.rail-list a.active'), function(a){return a.dataset.view}),
    svgBox: (function(){var r=document.getElementById('wires').getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width)]})(),
    rootBox: (function(){var r=document.querySelector('.identity').getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width)]})(),
  };
})()`);

// ── 2. wire alignment: first wire path starts at the chip's right-edge mid ──
out.wireAlign = await evalJs(`(function(){
  var chip=document.querySelector('.chip-node'), root=document.querySelector('.identity');
  var d=document.querySelector('#wires path').getAttribute('d');
  var m=/^M([-\\d.]+),([-\\d.]+)/.exec(d);
  var cr=chip.getBoundingClientRect(), br=document.getElementById('board').getBoundingClientRect();
  var scale=br.width/document.getElementById('board').offsetWidth;
  return { d0:d.slice(0,60), expectX:Math.round((cr.right-br.left)/scale), gotX:Math.round(+m[1]),
           expectY:Math.round((cr.top+cr.height/2-br.top)/scale), gotY:Math.round(+m[2]), scale:scale };
})()`);

// ── 3. nav to a placeholder view ──
out.nav = await evalJs(`(function(){ var a=document.querySelector('a[data-view="intelx"]'); a.click(); return 1 })()`);
await sleep(300);
out.intelx = await evalJs(`({crumb:document.getElementById('crumb').textContent, ph:document.getElementById('placeholder').innerText,
  canvasHidden:document.getElementById('canvas').hidden, inspHidden:document.getElementById('inspector').hidden,
  phHidden:document.getElementById('placeholder').hidden,
  active:[].map.call(document.querySelectorAll('.rail-list a.active'),function(a){return a.dataset.view}),
  hash:location.hash, bodyView:document.body.dataset.view})`);
await shot('qa-intelx.png');

out.back = await evalJs(`(function(){ document.querySelector('a[data-view="board"]').click(); return 1 })()`);
await sleep(400);
out.boardAgain = await evalJs(`({canvasHidden:document.getElementById('canvas').hidden, inspHidden:document.getElementById('inspector').hidden,
  phHidden:document.getElementById('placeholder').hidden, paths:document.querySelectorAll('#wires path').length})`);

// every view renders
out.allViews = await evalJs(`(function(){
  var out=[];
  [].forEach.call(document.querySelectorAll('.rail-list a[data-view]'), function(a){
    a.click();
    out.push(a.dataset.view+':'+(a.dataset.view==='board'?'board':document.getElementById('placeholder').innerText.replace(/\\s+/g,' '))+':'+document.getElementById('crumb').textContent);
  });
  document.querySelector('a[data-view="board"]').click();
  return out;
})()`);
await sleep(300);

// ── 4. island: '/' opens, focus, filter, Esc clears ──
await evalJs(`document.querySelector('#canvas').focus ? document.querySelector('#canvas').focus() : 0`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '/', code: 'Slash', text: '/' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '/', code: 'Slash' });
await sleep(300);
out.islandOpen = await evalJs(`({ready:document.getElementById('island').classList.contains('ready'), focus:document.activeElement&&document.activeElement.id})`);
await send('Input.insertText', { text: 'malolos' });
await sleep(300);
out.filtered = await evalJs(`({q:window.__mb.state.q, visible:[].filter.call(document.querySelectorAll('#inspector .xcard'),function(c){return !c.hidden}).length,
  paths:document.querySelectorAll('#wires path').length, dim:document.querySelectorAll('.node.dim').length})`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(400);
out.islandClosed = await evalJs(`({ready:document.getElementById('island').classList.contains('ready'), q:window.__mb.state.q,
  visible:[].filter.call(document.querySelectorAll('#inspector .xcard'),function(c){return !c.hidden}).length})`);

// ── 5. category toggle ──
out.cat = await evalJs(`(function(){
  document.querySelector('.cat-group .row[data-cat="evidence"]').click();
  return {cat:window.__mb.state.cat, bodyCat:document.body.dataset.cat, hot:document.querySelectorAll('#wires path.hot').length,
    activeRows:document.querySelectorAll('.cat-group .row.active').length, dimRows:document.querySelectorAll('.cat-group .row.dim').length,
    visible:[].filter.call(document.querySelectorAll('#inspector .xcard'),function(c){return !c.hidden}).length,
    total:document.querySelectorAll('#inspector .xcard').length};
})()`);
await sleep(200);
await shot('qa-cat.png');
out.catCleared = await evalJs(`(function(){ document.querySelector('.cat-group .row[data-cat="evidence"]').click();
  return {cat:window.__mb.state.cat, visible:[].filter.call(document.querySelectorAll('#inspector .xcard'),function(c){return !c.hidden}).length}; })()`);

// category via root link too
out.catRoot = await evalJs(`(function(){ document.querySelector('.identity .cats a[data-cat="locations"]').click();
  var r={cat:window.__mb.state.cat, hot:document.querySelectorAll('#wires path.hot').length};
  document.querySelector('.identity .cats a[data-cat="locations"]').click(); return r; })()`);

// ── 6. note + image ──
out.overlays = await evalJs(`(function(){
  document.getElementById('btn-note').click(); document.getElementById('btn-image').click();
  return {notes:document.querySelectorAll('.note-node').length, images:document.querySelectorAll('.img-node').length,
    editable:!!document.querySelector('.note-node [contenteditable="true"]'), imgSrc:document.querySelector('.img-node img') && document.querySelector('.img-node img').src,
    minH:document.getElementById('board').style.minHeight, imgOverflow:document.querySelector('.img-node').style.overflow};
})()`);
await sleep(600);
out.imgLoaded = await evalJs(`(function(){var i=document.querySelector('.img-node img'); return i?{w:i.naturalWidth,complete:i.complete}:null})()`);

// ── 7. drag a chip ──
out.dragBefore = await evalJs(`(function(){var c=document.querySelector('.chip-node').getBoundingClientRect();
  return {x:Math.round(c.left+c.width/2), y:Math.round(c.top+c.height/2), d:document.querySelector('#wires path').getAttribute('d')}})()`);
await mouse('mousePressed', out.dragBefore.x, out.dragBefore.y);
for (let i = 1; i <= 6; i++) await mouse('mouseMoved', out.dragBefore.x + 10 * i, out.dragBefore.y + 6 * i);
await mouse('mouseReleased', out.dragBefore.x + 60, out.dragBefore.y + 36);
await sleep(200);
out.dragAfter = await evalJs(`({d:document.querySelector('#wires path').getAttribute('d'),
  chipLeft:document.querySelector('.chip-node').style.left, chipTop:document.querySelector('.chip-node').style.top})`);
out.dragChanged = out.dragBefore.d !== out.dragAfter.d;

// ── 8. zoom ──
out.zoom = await evalJs(`(function(){
  var c=document.getElementById('canvas'); var r=c.getBoundingClientRect();
  var d0=document.querySelector('#wires path').getAttribute('d');
  c.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,ctrlKey:true,clientX:r.left+400,clientY:r.top+300,bubbles:true,cancelable:true}));
  return {zoom:window.__mb.state.zoom, transform:document.getElementById('board').style.transform,
          dSame: d0===document.querySelector('#wires path').getAttribute('d')};
})()`);
await sleep(200);
await shot('qa-zoom.png');
out.zoomReset = await evalJs(`(function(){ window.__mb.state.zoom=1; document.getElementById('board').style.transform=''; window.__mb.drawWires(); return window.__mb.state.zoom })()`);

// ── 9. export (intercept download via DataTransfer-less check: hook Blob/URL) ──
out.export = await evalJs(`(function(){
  var got=null; var orig=URL.createObjectURL;
  URL.createObjectURL=function(b){ got=b; return 'blob:x'; };
  var clickA=HTMLAnchorElement.prototype.click; var dl=null;
  HTMLAnchorElement.prototype.click=function(){ dl={download:this.download, href:this.getAttribute('href')}; };
  document.getElementById('btn-export').click();
  URL.createObjectURL=orig; HTMLAnchorElement.prototype.click=clickA;
  return got ? got.text().then(function(t){ var j=JSON.parse(t); return {dl:dl, keys:Object.keys(j), zoom:j.zoom, view:j.view, notes:j.notes.length, images:j.images.length}; }) : {error:'no blob'};
})()`);

// ── 10. save + reload ──
out.saved = await evalJs(`(function(){ document.getElementById('btn-save').click();
  var s=JSON.parse(localStorage.getItem('mb-state-v2')); return {keys:Object.keys(s), notes:s.notes.length, images:s.images.length, nodes:Object.keys(s.nodes).length, zoom:s.zoom, view:s.view, chip:s.nodes['g-0']}; })()`);
await send('Page.reload');
await sleep(1800);
out.afterReload = await evalJs(`({notes:document.querySelectorAll('.note-node').length, images:document.querySelectorAll('.img-node').length,
  chipLeft:document.querySelector('.chip-node').style.left, chipTop:document.querySelector('.chip-node').style.top,
  paths:document.querySelectorAll('#wires path').length, view:document.body.dataset.view,
  source: window.__mb.restoredFrom(), hot:document.querySelectorAll('#wires path.hot').length,
  noteText: document.querySelector('.note-node .nb') && document.querySelector('.note-node .nb').textContent})`);

// ── 11. scroll restore across a view switch + card wire endpoints at scroll ──
out.scroll = await evalJs(`(function(){
  var c=document.getElementById('canvas');
  c.scrollLeft=600; c.scrollTop=300;
  window.__mb.drawWires();
  var d=document.querySelector('#wires path').getAttribute('d');
  window.__mb.showView('forum');
  return {before:[c.scrollLeft,c.scrollTop], pathStartsWithLeft600:d.slice(0,20)};
})()`);
await sleep(400);
out.scrollBack = await evalJs(`(function(){ window.__mb.showView('board'); return 1 })()`);
await sleep(500);
out.scrollRestored = await evalJs(`(function(){var c=document.getElementById('canvas'); return [c.scrollLeft,c.scrollTop, document.querySelectorAll('#wires path').length]})()`);

// ── 12. card-wire endpoint matches the real card rect (board space, scale 1) ──
// Wire c) ends at the card's left edge in BOARD space: board x = cardLeft + scrollLeft
// (the inspector sits at the same containing block the board scrolls inside).
out.cardAlign = await evalJs(`(function(){
  var c=document.getElementById('canvas'); c.scrollLeft=0; c.scrollTop=0; window.__mb.drawWires();
  var i=document.getElementById('inspector');
  var card=i.children[0];
  var cr=card.getBoundingClientRect();
  var wantX=i.offsetLeft+i.clientLeft+c.scrollLeft;
  var wantY=16+0*180+84;
  var paths=[].slice.call(document.querySelectorAll('#wires path'));
  var ends=paths.map(function(p){var m=/(-?[\\d.]+),(-?[\\d.]+)$/.exec(p.getAttribute('d'));return m?[+m[1],+m[2]]:null}).filter(Boolean);
  var hit=ends.filter(function(e){ return Math.abs(e[0]-wantX)<2 && Math.abs(e[1]-wantY)<2; });
  return {want:[wantX,wantY], cardRect:[Math.round(cr.left),Math.round(cr.top+cr.height/2)], matches:hit.length, sampleEnds:ends.slice(-3), total:paths.length};
})()`);

// image node: box exists, transparent CSS overflow restored, wire bound grows
out.imgNode = await evalJs(`(function(){
  var n=document.querySelector('.img-node'), img=n.querySelector('img');
  return {overflow:getComputedStyle(n).overflow, hasImage:!!img, loaded:img.complete && img.naturalWidth>0, h:n.offsetHeight, left:n.offsetLeft};
})()`);

// Esc with no island open clears the category, not the view
out.escCat = await evalJs(`(function(){
  document.querySelector('.cat-group .row[data-cat="devices"]').click();
  var before=window.__mb.state.cat;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  return {before:before, after:window.__mb.state.cat, view:document.body.dataset.view};
})()`);

// resize keeps the chain anchored left of the inspector
out.resize = await evalJs(`(function(){
  var g=document.querySelector('.cat-group');
  return {inspLeft:document.getElementById('inspector').offsetLeft, rowsRight:g.offsetLeft+g.offsetWidth, nodeCount:document.querySelectorAll('.node').length};
})()`);
await shot('qa-final.png');

// console errors
const consoleErrors = events.filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
out.consoleErrors = consoleErrors.map(e => JSON.stringify(e.params).slice(0, 200));

// ── 13. double-click Save reloads the last explicit save; clearOverlays resets ──
out.loadSaved = await evalJs(`(function(){ window.__mb.clearOverlays(); window.__mb.loadSaved();
  return {notes:document.querySelectorAll('.note-node').length, images:document.querySelectorAll('.img-node').length, chip:document.querySelector('.chip-node').style.left}; })()`);

// ── 14. Ctrl+S saves, rail hash is prevented, no unstyled defaults left ──
out.misc = await evalJs(`(function(){
  var a=document.querySelector('a[data-view="sources"]'); a.click();
  var hash=location.hash;
  document.querySelector('a[data-view="board"]').click();
  var body=[].slice.call(document.body.children).filter(function(e){return !/SCRIPT/.test(e.tagName) && !['DIV','HEADER','NAV','SECTION','ASIDE'].includes(e.tagName)}).length;
  return {hashAfterClick:hash, strayBodyChildren:body, catRows:document.querySelectorAll('.cat-group .row').length,
          emptyState:!!document.getElementById('empty-state'), noteNodes:document.querySelectorAll('.note-node').length};
})()`);

console.log(JSON.stringify(out, null, 1));
ws.close();
try { proc.kill(); } catch { }
process.exit(0);
