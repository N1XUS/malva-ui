import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvToolbar } from './toolbar';
import { MlvToolbarRoving, MlvToolbarWidget } from './toolbar-widget';

/**
 * `@angular/aria`'s `Toolbar` (the host directive behind `mlvToolbarRoving`)
 * injects the CDK `Directionality` to decide which horizontal arrow key means
 * _next_. The root-provided one reports only the **document** direction, so
 * without the directive's scoped provider a `[dir="rtl"]` wrapper mirrors the
 * row but not the keys.
 *
 * No global-flip case: `MlvRtlService.setDirection()` also writes the root CDK
 * `Directionality`, so it passes with the provider removed
 * (`.claude/rules/rtl.md`).
 */
@Component({
  imports: [MlvToolbar, MlvToolbarRoving, MlvToolbarWidget],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-toolbar mlvToolbarRoving>
        <button mlvToolbarWidget>Save</button>
        <button mlvToolbarWidget>Print</button>
        <button mlvToolbarWidget>Share</button>
      </mlv-toolbar>
    </div>
  `,
})
class ScopedDirectionHost {
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

describe('MlvToolbarRoving — scoped [dir] keyboard', () => {
  let fixture: ComponentFixture<ScopedDirectionHost>;
  let host: ScopedDirectionHost;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirectionHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ScopedDirectionHost);
    host = fixture.componentInstance;
    rtl = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** Index of the widget holding the roving tab stop. */
  function rovingIndex(): number {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    return buttons.findIndex((b) => b.getAttribute('tabindex') === '0');
  }

  async function press(key: string): Promise<void> {
    const toolbar = fixture.nativeElement.querySelector(
      '[role="toolbar"]',
    ) as HTMLElement;
    toolbar.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('moves to the next widget on ArrowLeft under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');
    expect(rovingIndex()).toBe(0);

    await press('ArrowLeft');

    expect(rovingIndex()).toBe(1);
  });

  it('keeps LTR keys inside a [dir="ltr"] island of an RTL document', async () => {
    rtl.setDirection('rtl');
    host.scopeDir.set('ltr');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('rtl');

    await press('ArrowRight');

    expect(rovingIndex()).toBe(1);
  });
});
