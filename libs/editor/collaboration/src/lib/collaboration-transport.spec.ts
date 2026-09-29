import {
  decodeMlvEditorCollaborationFrame,
  encodeMlvEditorCollaborationFrame,
  mlvEditorCollaborationFrameType,
} from './collaboration-transport';

describe('collaboration transport helpers', () => {
  const frame = (length: number): Uint8Array =>
    Uint8Array.from({ length }, (_, index) => (index * 37 + 11) % 256);

  afterEach(() => vi.restoreAllMocks());

  it('round-trips frames through base64 with the btoa / atob fallback', () => {
    // Runtimes with the ES2026 methods take the native path; hide them here.
    const toBase64 = Object.getOwnPropertyDescriptor(
      Uint8Array.prototype,
      'toBase64',
    );
    const fromBase64 = Object.getOwnPropertyDescriptor(
      Uint8Array,
      'fromBase64',
    );
    delete (Uint8Array.prototype as { toBase64?: unknown }).toBase64;
    delete (Uint8Array as { fromBase64?: unknown }).fromBase64;
    try {
      for (const length of [0, 1, 2, 3, 255, 0x8000, 0x8000 * 2 + 7]) {
        const bytes = frame(length);
        const text = encodeMlvEditorCollaborationFrame(bytes);
        expect(text).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
        expect(Array.from(decodeMlvEditorCollaborationFrame(text))).toEqual(
          Array.from(bytes),
        );
      }
    } finally {
      if (toBase64)
        Object.defineProperty(Uint8Array.prototype, 'toBase64', toBase64);
      if (fromBase64)
        Object.defineProperty(Uint8Array, 'fromBase64', fromBase64);
    }
  });

  it('matches Node base64 byte for byte', () => {
    const bytes = frame(1000);
    expect(encodeMlvEditorCollaborationFrame(bytes)).toBe(
      Buffer.from(bytes).toString('base64'),
    );
  });

  it('uses the native methods when the runtime has them', () => {
    const toBase64 = vi.fn(function (this: Uint8Array) {
      return `native:${this.length}`;
    });
    const fromBase64 = vi.fn(() => Uint8Array.of(9));
    const realTo = Object.getOwnPropertyDescriptor(
      Uint8Array.prototype,
      'toBase64',
    );
    const realFrom = Object.getOwnPropertyDescriptor(Uint8Array, 'fromBase64');
    Object.defineProperty(Uint8Array.prototype, 'toBase64', {
      value: toBase64,
      configurable: true,
    });
    Object.defineProperty(Uint8Array, 'fromBase64', {
      value: fromBase64,
      configurable: true,
    });
    try {
      expect(encodeMlvEditorCollaborationFrame(frame(4))).toBe('native:4');
      expect(Array.from(decodeMlvEditorCollaborationFrame('abc'))).toEqual([9]);
      expect(fromBase64).toHaveBeenCalledWith('abc');
    } finally {
      delete (Uint8Array.prototype as { toBase64?: unknown }).toBase64;
      delete (Uint8Array as { fromBase64?: unknown }).fromBase64;
      if (realTo)
        Object.defineProperty(Uint8Array.prototype, 'toBase64', realTo);
      if (realFrom) Object.defineProperty(Uint8Array, 'fromBase64', realFrom);
    }
  });

  it('throws on text that is not base64', () => {
    expect(() => decodeMlvEditorCollaborationFrame('%%%')).toThrow();
  });

  it('reads the outer frame type', () => {
    expect(mlvEditorCollaborationFrameType(Uint8Array.of(0, 0, 1))).toBe(
      'sync',
    );
    expect(mlvEditorCollaborationFrameType(Uint8Array.of(1, 2))).toBe(
      'awareness',
    );
    expect(mlvEditorCollaborationFrameType(Uint8Array.of(3))).toBe(
      'query-awareness',
    );
    expect(mlvEditorCollaborationFrameType(Uint8Array.of(2))).toBe('unknown');
    expect(mlvEditorCollaborationFrameType(new Uint8Array())).toBe('unknown');
  });
});
