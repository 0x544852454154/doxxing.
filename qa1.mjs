export default async function run(page, ui) {
  const wait = ms => page.waitForTimeout(ms);
  await wait(700);
  const out = {};
  out.initial = await page.evaluate(() => {
    const b = document.getElementById('board');
    return {
      nodes: b.querySelectorAll('.node').length,
      chips: b.querySelectorAll('.chip-node').length,
      roots: b.querySelectorAll('.identity').length,
      rows: b.querySelectorAll('.cat-group .row').length,
      cards: document.querySelectorAll('#inspector .xcard').length,
      visibleCards: [...document.querySelectorAll('#inspector .xcard')].filter(c => !c.hidden).length,
      paths: document.querySelectorAll('#wires path').length,
      hot: document.querySelectorAll('#wires path.hot').length,
      svgW: document.getElementById('wires').getAttribute('width'),
      svgH: document.getElementById('wires').getAttribute('height'),
      minW: b.style.minWidth, minH: b.style.minHeight,
      overflow: getComputedStyle(document.getElementById('canvas')).overflow,
      boardPos: getComputedStyle(b).position,
      crumb: document.getElementById('crumb').textContent,
      badge: document.getElementById('badge-board').textContent,
      activeRails: [...document.querySelectorAll('.rail-list a.active')].map(a => a.dataset.view),
      samplePaths: [...document.querySelectorAll('#wires path')].slice(0, 6).map(p => p.getAttribute('d')),
    };
  });

  // did every visual card land on a whole multiple of 180 (deterministic layout)?
  out.cardStride = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#inspector .xcard')];
    return cards.slice(0, 4).map(c => c.offsetTop);
  });

  // zoom then verify wires are unchanged in board space and aligned to nodes
  out.zoom = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: r.left + 400, clientY: r.top + 300, bubbles: true, cancelable: true }));
    const root = document.querySelector('.identity');
    const path = document.querySelector('#wires path[class="hot"]') || document.querySelector('#wires path');
    return { zoom: window.__mb.state.zoom, transform: document.getElementById('board').style.transform, rootLeft: root.offsetLeft };
  });
  await wait(200);
  await page.screenshot({ path: 'shot-zoom.png' });

  // reset zoom
  await page.evaluate(() => { window.__mb.state.zoom = 1; const b = document.getElementById('board'); b.style.transform = ''; window.__mb.drawWires(); });
  await wait(100);

  // nav to a placeholder view
  await page.click('a[data-view="intelx"]');
  await wait(200);
  out.intelx = await page.evaluate(() => ({
    crumb: document.getElementById('crumb').textContent,
    ph: document.getElementById('placeholder').innerText,
    canvasHidden: document.getElementById('canvas').hidden,
    inspHidden: document.getElementById('inspector').hidden,
    phHidden: document.getElementById('placeholder').hidden,
    active: [...document.querySelectorAll('.rail-list a.active')].map(a => a.dataset.view),
    hash: location.hash,
  }));
  await page.screenshot({ path: 'shot-intelx.png' });

  // back to board
  await page.click('a[data-view="board"]');
  await wait(300);
  out.back = await page.evaluate(() => ({
    canvasHidden: document.getElementById('canvas').hidden,
    inspHidden: document.getElementById('inspector').hidden,
    phHidden: document.getElementById('placeholder').hidden,
    paths: document.querySelectorAll('#wires path').length,
  }));

  // filter island via '/'
  await page.keyboard.press('/');
  await wait(300);
  out.islandOpen = await page.evaluate(() => ({ ready: document.getElementById('island').classList.contains('ready'), focused: document.activeElement && document.activeElement.id }));
  await page.keyboard.type('malolos');
  await wait(200);
  out.filtered = await page.evaluate(() => ({
    q: window.__mb.state.q,
    visibleCards: [...document.querySelectorAll('#inspector .xcard')].filter(c => !c.hidden).length,
    paths: document.querySelectorAll('#wires path').length,
    dim: document.querySelectorAll('.node.dim').length,
  }));
  await page.keyboard.press('Escape');
  await wait(300);
  out.islandClosed = await page.evaluate(() => ({
    ready: document.getElementById('island').classList.contains('ready'),
    q: window.__mb.state.q,
    visibleCards: [...document.querySelectorAll('#inspector .xcard')].filter(c => !c.hidden).length,
  }));

  // category toggle
  await page.click('.cat-group .row[data-cat="evidence"]');
  await wait(200);
  out.cat = await page.evaluate(() => ({
    cat: window.__mb.state.cat,
    bodyCat: document.body.dataset.cat,
    hot: document.querySelectorAll('#wires path.hot').length,
    activeRows: [...document.querySelectorAll('.cat-group .row.active')].length,
    dimRows: [...document.querySelectorAll('.cat-group .row.dim')].length,
    visibleCards: [...document.querySelectorAll('#inspector .xcard')].filter(c => !c.hidden).length,
    total: document.querySelectorAll('#inspector .xcard').length,
  }));
  await page.screenshot({ path: 'shot-cat.png' });
  await page.click('.cat-group .row[data-cat="evidence"]');
  await wait(150);
  out.catCleared = await page.evaluate(() => ({ cat: window.__mb.state.cat, visible: [...document.querySelectorAll('#inspector .xcard')].filter(c => !c.hidden).length }));

  // note + image
  await page.click('#btn-note');
  await wait(150);
  await page.click('#btn-image');
  await wait(500);
  out.overlays = await page.evaluate(() => ({
    notes: document.querySelectorAll('.note-node').length,
    images: document.querySelectorAll('.img-node').length,
    linesInNote: !!document.querySelector('.note-node .nb'),
    minH: document.getElementById('board').style.minHeight,
  }));

  // drag a chip and check the wire follows
  const chip = page.locator('.chip-node').first();
  const bb = await chip.boundingBox();
  const before = await page.evaluate(() => document.querySelector('#wires path').getAttribute('d'));
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await wait(150);
  const after = await page.evaluate(() => document.querySelector('#wires path').getAttribute('d'));
  out.drag = { before, after, changed: before !== after };

  // export
  const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
  await page.click('#btn-export');
  const d = await dl;
  out.export = d ? { name: d.suggestedFilename() } : { error: 'no download event' };

  // save + reload persistence
  await page.click('#btn-save');
  await wait(150);
  out.saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mb-state-v2')));
  await page.reload();
  await wait(900);
  out.afterReload = await page.evaluate(() => ({
    notes: document.querySelectorAll('.note-node').length,
    images: document.querySelectorAll('.img-node').length,
    chipLeft: document.querySelector('.chip-node').style.left,
    paths: document.querySelectorAll('#wires path').length,
    view: document.body.dataset.view,
  }));
  await page.screenshot({ path: 'shot-final.png' });
  return out;
}
