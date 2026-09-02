import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCS_CODE_HIGHLIGHTER,
  ShikiHighlightService,
  type DocsCodeHighlighter,
} from './shiki-highlight.service';

describe('ShikiHighlightService', () => {
  let codeToHtmlMock: ReturnType<typeof vi.fn<DocsCodeHighlighter>>;

  beforeEach(() => {
    // A provider override rather than `vi.mock('shiki')`: Shiki is externalised,
    // so once any other spec in the same worker has imported the real package
    // the module mock stops applying and these assertions read real Shiki HTML.
    // That made the file pass or fail on worker scheduling alone.
    codeToHtmlMock = vi.fn<DocsCodeHighlighter>(
      async (code) => `<pre>${code}</pre>`,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCS_CODE_HIGHLIGHTER, useValue: codeToHtmlMock }],
    });
  });

  it('resolves the real Shiki entry point when nothing overrides it', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(DOCS_CODE_HIGHLIGHTER)).toBeTypeOf('function');
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
    expect(
      codeToHtmlMock.mock.calls.map(([, options]) => options.theme),
    ).toEqual(['github-light', 'github-dark']);
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
