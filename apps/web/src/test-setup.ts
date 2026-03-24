import '@testing-library/jest-dom';

class MemoryStorage implements Storage {
  readonly #store = new Map<string, string>();

  get length() {
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }

  getItem(key: string) {
    return this.#store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.#store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.#store.delete(key);
  }

  setItem(key: string, value: string) {
    this.#store.set(key, String(value));
  }
}

const localStorageMock = new MemoryStorage();
const sessionStorageMock = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
});

if ('window' in globalThis && globalThis.window) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });

  Object.defineProperty(globalThis.window, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
  });
}
