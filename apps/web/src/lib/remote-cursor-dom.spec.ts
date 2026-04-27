import { describe, expect, it } from 'vitest';
import { clientIdFromElement, remoteCursorSelector } from './remote-cursor-dom.js';

const makeElement = (className: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = className;
  return el;
};

describe('clientIdFromElement', () => {
  it('GIVEN element with class yRemoteSelectionHead-123 WHEN parsing THEN returns 123', () => {
    expect(clientIdFromElement(makeElement('yRemoteSelectionHead-123'))).toBe(123);
  });

  it('GIVEN element with class foo yRemoteSelectionHead-456 bar WHEN parsing THEN returns 456', () => {
    expect(clientIdFromElement(makeElement('foo yRemoteSelectionHead-456 bar'))).toBe(456);
  });

  it('GIVEN element without the class WHEN parsing THEN returns null', () => {
    expect(clientIdFromElement(makeElement('foo bar baz'))).toBeNull();
  });

  it('GIVEN null element WHEN parsing THEN returns null', () => {
    expect(clientIdFromElement(null)).toBeNull();
  });

  it('GIVEN class yRemoteSelectionHead- (no number) WHEN parsing THEN returns null', () => {
    expect(clientIdFromElement(makeElement('yRemoteSelectionHead-'))).toBeNull();
  });

  it('GIVEN class with non-numeric id WHEN parsing THEN returns null', () => {
    expect(clientIdFromElement(makeElement('yRemoteSelectionHead-abc'))).toBeNull();
  });

  it('GIVEN multiple matching elements on the page WHEN querying with remoteCursorSelector THEN each can be parsed', () => {
    const container = document.createElement('div');
    const first = makeElement('yRemoteSelectionHead-1');
    const second = makeElement('foo yRemoteSelectionHead-42 bar');
    const third = makeElement('yRemoteSelectionHead-1000');
    container.appendChild(first);
    container.appendChild(second);
    container.appendChild(third);
    document.body.appendChild(container);
    try {
      const matches = Array.from(container.querySelectorAll(remoteCursorSelector()));
      expect(matches).toHaveLength(3);
      const ids = matches.map((el) => clientIdFromElement(el));
      expect(ids).toEqual([1, 42, 1000]);
    } finally {
      container.remove();
    }
  });
});
