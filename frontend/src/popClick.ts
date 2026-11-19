/**
 * A small "pop" whenever a control is clicked, everywhere in the app: the control squeezes slightly and springs back.
 * It uses the CSS `scale` property (see .pop-anim in styles.css), so it never disturbs an element's own transform.
 * Respects "reduce motion" (the global rule in styles.css shortens every animation to nothing).
 */
const TARGETS = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="menuitem"], summary, input[type="checkbox"], input[type="radio"], select, label:has(input[type="checkbox"]), label:has(input[type="radio"])';

export function installPopClick() {
  if (typeof document === 'undefined' || (window as unknown as { __popInstalled?: boolean }).__popInstalled) return;
  (window as unknown as { __popInstalled?: boolean }).__popInstalled = true;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      if (!t || t.closest('canvas, [data-no-pop]')) return;
      let el = t.closest(TARGETS) as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      // a zero-size anchor (the study-map nodes) pops its first child instead
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 4 && el.firstElementChild) el = el.firstElementChild as HTMLElement;
      // a very large block (a whole card that is a link) would look like the page lurching: skip it
      const big = el.getBoundingClientRect();
      if (big.width * big.height > 120000) return;
      el.classList.remove('pop-anim');
      void el.offsetWidth; // restart the animation on rapid clicks
      el.classList.add('pop-anim');
      el.addEventListener('animationend', () => el!.classList.remove('pop-anim'), { once: true });
    },
    true,
  );
}
