import { TestBed } from '@angular/core/testing';
import { codeToHtml } from 'shiki';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShikiHighlightService } from './shiki-highlight.service';

vi.mock('shiki', () => ({ codeToHtml: vi.fn() }));

describe('ShikiHighlightService', () => {
  const codeToHtmlMock = vi.mocked(codeToHtml);

  beforeEach(() => {
    TestBed.resetTestingModule();
    codeToHtmlMock.mockReset();
    codeToHtmlMock.mockImplementation(async (code) => `<pre>${code}</pre>`);
  });

  it('reuses in-flight and completed work for the same source', async () => {
    const service = TestBed.inject(ShikiHighlightService);

    const first = service.highlight('const value = 1;', 'typescript', 'light');
    const second = service.highlight('const value = 1;', 'typescript', 'light');

    expect(second).toBe(first);
    await expect(first).resolves.toBe('<pre>const value = 1;</pre>');
    await expect(
      service.highlight('const value = 1;', 'typescript', 'light'),
    ).resolves.toBe('<pre>const value = 1;</pre>');
    expect(codeToHtmlMock).toHaveBeenCalledOnce();
  });

  it('keeps light and dark theme results separate', async () => {
    const service = TestBed.inject(ShikiHighlightService);

    await service.highlight('button {}', 'css', 'light');
    await service.highlight('button {}', 'css', 'dark');

    expect(codeToHtmlMock).toHaveBeenCalledTimes(2);
  });

  it('retries a key after a highlighting failure', async () => {
    const service = TestBed.inject(ShikiHighlightService);
    codeToHtmlMock.mockRejectedValueOnce(new Error('Shiki failed'));

    await expect(
      service.highlight('<button>', 'html', 'light'),
    ).rejects.toThrow('Shiki failed');
    await expect(service.highlight('<button>', 'html', 'light')).resolves.toBe(
      '<pre><button></pre>',
    );
    expect(codeToHtmlMock).toHaveBeenCalledTimes(2);
  });
});
