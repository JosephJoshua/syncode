import '@testing-library/jest-dom/vitest';

// jsdom is missing PointerEvent APIs Radix UI relies on (Select, DropdownMenu, etc).
// Provide no-op implementations so component tests can interact with these primitives.
if (typeof window !== 'undefined') {
  if (!('PointerEvent' in window)) {
    // @ts-expect-error — polyfill PointerEvent onto jsdom window
    window.PointerEvent = class PointerEvent extends Event {};
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
