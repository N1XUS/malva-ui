import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvList } from './list/list';
import { MlvListItem } from './list-item/list-item';
import { MlvListItemSelectable, MlvListSelectable } from './list-selectable';

/**
 * `@angular/aria`'s `Listbox` (the host directive behind
 * `mlv-list[selectable]`) injects the CDK `Directionality` to decide which
 * horizontal arrow key means _next_ in a `orientation="horizontal"` listbox.
 * The root-provided one reports only the **document** direction, so without
 * the directive's scoped provider a `[dir="rtl"]` wrapper mirrors the row but
 * not the keys.
 *
 * No global-flip case: `MlvRtlService.setDirection()` also writes the root CDK
 * `Directionality`, so it passes with the provider removed
 * (`.claude/rules/rtl.md`).
 */
@Component({
  imports: [MlvList, MlvListItem, MlvListSelectable, MlvListItemSelectable],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-list
        selectable
        listRole="listbox"
        aria-label="Fruit"
        orientation="horizontal"
      >
        <mlv-list-item itemRole="option" [value]="'apple'" label="Apple"
          >Apple</mlv-list-item
        >
        <mlv-list-item itemRole="option" [value]="'banana'" label="Banana"
          >Banana</mlv-list-item
        >
        <mlv-list-item itemRole="option" [value]="'cherry'" label="Cherry"
          >Cherry</mlv-list-item
        >
      </mlv-list>
    </div>
  `,
})
class ScopedDirectionHost {
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

describe('MlvListSelectable — scoped [dir] keyboard', () => {
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

  /** Index of the option holding the roving tab stop. */
  function rovingIndex(): number {
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('mlv-list-item'),
    ) as HTMLElement[];
    return options.findIndex((o) => o.getAttribute('tabindex') === '0');
  }

  async function press(key: string): Promise<void> {
    const list = fixture.nativeElement.querySelector(
      '[role="listbox"]',
    ) as HTMLElement;
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('moves to the next option on ArrowLeft under a scoped [dir="rtl"] ancestor', async () => {
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
