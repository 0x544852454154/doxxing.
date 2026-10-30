import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync('index.html', 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const xeon = s => s.replace(/[ㄱ-ㅣ가-힣]/g, ch => null);

const el = (id) => {
  const node = {
    id, style: { cssText: '', setProperty() { }, removeProperty() { } },
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    dataset: {}, children: [], innerHTML: '', textContent: '',
    appended: [], offsetLeft: 0, offsetTop: 0, offsetWidth: 300, offsetHeight: 240,
    getAttribute() { return null; }, setAttribute() { }, addEventListener() { }, removeEventListener() { },
    appendChild(c) { node.appended.push(c); node.children.push(c); }, remove() { }, querySelector() { return null; },
    querySelectorAll() { return []; }, closest() { return null; }, setPointerCapture() { },
    scrollTo() { }, scrollIntoView() { }, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 700 }; },
    contains() { return false; }, focus() { }, blur() { }, select() { }, click() { },
  };
  Object.defineProperty(node, 'firstChild', { get() { return node.children[0] || null; } });
  return node;
};
const nodes = {};
const document = {
  getElementById(id) { return nodes[id] || (nodes[id] = el(id)); },
  querySelector() { return null; }, querySelectorAll() { return []; },
  createElement(tag) { return el(tag + '-' + Math.random().toString(36).slice(2, 6)); },
  addEventListener() { }, body: el('body'), documentElement: el('html'), fonts: { ready: { then() { } } },
  activeElement: null,
};
const window = {
  addEventListener() { }, matchMedia() { return { matches: false }; },
  requestAnimationFrame(fn) { return 0; }, setTimeout() { return 0; },
  localStorage: { getItem() { return null; }, setItem() { }, removeItem() { } },
};
const ctx = vm.createContext({
  window, document, URL, Blob, console, requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() { }, getComputedStyle() { return {}; }
});
window.window = window; window.document = document;
try {
  vm.runInContext(src, ctx, { filename: 'index.js' });
  console.log('RUN OK, __mb =', !!window.__mb, 'boardErr', window.__mbBoardErr, 'inspErr', window.__mbInspErr);
} catch (e) {
  console.log('THROW:', e.message);
  console.log(String(e.stack).split('\n').slice(0, 8).join('\n'));
}
