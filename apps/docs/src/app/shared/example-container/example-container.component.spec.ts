import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { ExampleContainerComponent } from './example-container.component';
import { ShikiHighlightService } from '../shiki-highlight.service';

@Component({ template: '<p>Live example</p>' })
class PreviewComponent {}

describe('ExampleContainerComponent', () => {
  const createFixture = (highlight = vi.fn().mockResolvedValue('<pre />')) => {
    const fixture = TestBed.configureTestingModule({
      imports: [ExampleContainerComponent],
      providers: [
        provideRouter([]),
        provideMlvI18nTesting(),
        {
          provide: MlvThemeService,
          useValue: { currentTheme: signal('light') },
        },
        {
          provide: ShikiHighlightService,
          useValue: { highlight },
        },
      ],
    }).createComponent(ExampleContainerComponent);
    fixture.componentRef.setInput('component', PreviewComponent);
    return { fixture, highlight };
  };

  it('renders no expansion control without a registered route', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('.example-container__open-full'),
    ).toBeNull();
  });

  it('renders a normal router link for a registered full example', async () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput(
      'fullExampleRoute',
      '/showcases/data-operations',
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector(
      '.example-container__open-full',
    ) as HTMLAnchorElement;

    expect(link.textContent).toContain('Open full example');
    expect(link.getAttribute('href')).toContain('/showcases/data-operations');
  });

  it('contains no native fullscreen API usage', () => {
    // Resolved from this spec's own location, not `process.cwd()`: the target
    // runs from the workspace root, so a cwd-relative path misses the file.
    // `join(dirname(fileURLToPath(import.meta.url)), …)` rather than
    // `new URL(…, import.meta.url)`, which Vite rewrites into an asset URL.
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        'example-container.component.ts',
      ),
      'utf8',
    );

    expect(source).not.toContain('requestFullscreen');
    expect(source).not.toContain('exitFullscreen');
    expect(source).not.toContain('fullscreenchange');
  });

  it('does not highlight source files until a code tab becomes active', async () => {
    const { fixture, highlight } = createFixture();
    fixture.componentRef.setInput('content', {
      TypeScript: 'const ready = true;',
      HTML: '<button>Ready</button>',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.activeTab()).toBe('preview');
    await vi.waitFor(() =>
      expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
    );
    expect(highlight).not.toHaveBeenCalled();

    fixture.componentInstance.activeTab.set('TypeScript');
    fixture.detectChanges();
    await vi.waitFor(() => expect(highlight).toHaveBeenCalledOnce());

    expect(highlight).toHaveBeenCalledWith(
      'const ready = true;',
      'typescript',
      'light',
    );
  });
});
