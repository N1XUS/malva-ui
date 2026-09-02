import { ElementRef, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import CompareChartExampleComponent from './index';

/**
 * Records what the example hands to the shared resize observer instead of
 * asking jsdom to lay anything out. The real service forwards the target to
 * `ResizeObserver.observe`, which throws `parameter 1 is not of type 'Element'`
 * for anything that is not a DOM element — the failure this spec pins down.
 */
class RecordingResizeObserverService {
  readonly targets: unknown[] = [];
  private readonly _entries = new Subject<ResizeObserverEntry[]>();

  observe(target: unknown): Subject<ResizeObserverEntry[]> {
    this.targets.push(target);
    return this._entries;
  }
}

describe('CompareChartExampleComponent', () => {
  beforeEach(() => {
    // MlvThemeService reads the dark-scheme media query at construction; jsdom
    // has no matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });
  });

  it('observes the compare surface element, not the component instance', async () => {
    const resize = new RecordingResizeObserverService();
    const errors: unknown[] = [];
    TestBed.configureTestingModule({
      imports: [CompareChartExampleComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvResizeObserverService, useValue: resize },
        {
          provide: ErrorHandler,
          useValue: { handleError: (error: unknown) => errors.push(error) },
        },
      ],
    });
    const fixture = TestBed.createComponent(CompareChartExampleComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(errors).toEqual([]);
    expect(resize.targets).toHaveLength(1);
    // Compare a description rather than the value itself: printing a failed
    // match against a component instance walks Angular's whole view graph.
    expect(describeTarget(resize.targets[0])).toBe('element <mlv-compare>');
  });
});

function describeTarget(target: unknown): string {
  const value = target instanceof ElementRef ? target.nativeElement : target;
  return value instanceof HTMLElement
    ? `element <${value.tagName.toLowerCase()}>`
    : `not an element: ${(value as object)?.constructor?.name ?? typeof value}`;
}
