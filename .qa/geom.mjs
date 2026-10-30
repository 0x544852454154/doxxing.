export default async function run(page) {
  return await page.evaluate(() => {
    const c = document.getElementById('canvas'), card = document.querySelector('#inspector .xcard'), insp = document.getElementById('inspector');
    return {
      canvas: [c.offsetLeft, c.offsetTop, c.offsetWidth, c.clientWidth, c.scrollLeft],
      inspRect: [insp.offsetLeft, insp.offsetTop, insp.offsetWidth, insp.clientWidth, insp.scrollWidth],
      cardRect: [card.offsetLeft, card.offsetTop, card.offsetWidth, card.offsetHeight],
      cardPos: getComputedStyle(card).position,
      inspPos: getComputedStyle(insp).position,
      firstPathOfCard: [...document.querySelectorAll('#wires path')].length,
    };
  });
}
