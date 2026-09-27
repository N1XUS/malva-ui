import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvTabGroup } from './tabs';
import { MlvTab } from '../tab/tab';
import { MlvTabDef } from '../tab-def';
import { MlvTabContentDef } from '../tab-content-def';

/**
 * The tab list's arrow keys are owned by `@angular/aria`'s `TabList`, which
 * injects the CDK `Directionality` to decide which horizontal key means
 * _next_. The root-provided one reports only the **document** direction, so
 * without the tab group's scoped provider a `[dir]` wrapper mirrors the layout
 * (and the indicator, which re-measures on the scoped direction) but not the
 * keys.
 *
 * A global flip is deliberately absent here: `MlvRtlService.setDirection()`
 * also writes the root CDK `Directionality`, so a global case passes with the
 * provider removed and proves nothing about it (`.claude/rules/rtl.md`).
 */
@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  template: `
    <section [attr.dir]="scopeDir()">
      <mlv-tab-group [(activeTab)]="activeTab">
        @for (value of tabs; track value) {
          <mlv-tab [value]="value">
            <ng-template mlvTabDef>{{ value }}</ng-template>
            <ng-template mlvTabContent
              ><p>Content {{ value }}</p></ng-template
            >
          </mlv-tab>
        }
      </mlv-tab-group>
    </section>
  `,
})
class ScopedDirectionHost {
  readonly tabs = ['tab1', 'tab2', 'tab3'];
  readonly activeTab = signal('tab2');
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

/**
 * A **static** `dir="rtl"` scope around a tab group rendered inside an `@if`.
 * An embedded view's nodes are constructed detached and inserted afterwards,
 * and no `dir` attribute changes later, so a direction read at construction
 * would stay on the document's LTR for good.
 */
@Component({
  imports: [MlvTabGroup, MlvTab, MlvTabDef],
  template: `
    <section dir="rtl">
      @if (shown()) {
        <mlv-tab-group [(activeTab)]="activeTab">
          @for (value of tabs; track value) {
            <mlv-tab [value]="value">
              <ng-template mlvTabDef>{{ value }}</ng-template>
            </mlv-tab>
          }
        </mlv-tab-group>
      }
    </section>
  `,
})
class StaticScopeEmbeddedHost {
  readonly tabs = ['tab1', 'tab2', 'tab3'];
  readonly activeTab = signal('tab2');
  readonly shown = signal(true);
}

describe('MlvTabGroup — scoped [dir] keyboard', () => {
  let fixture: ComponentFixture<ScopedDirectionHost>;
  let host: ScopedDirectionHost;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirectionHost],
      providers: [provideMlvI18nTesting()],
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

  async function press(key: string): Promise<void> {
    const tablist = fixture.nativeElement.querySelector(
      '[role="tablist"]',
    ) as HTMLElement;
    tablist.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('moves to the previous tab on ArrowRight under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');

    await press('ArrowRight');

    expect(host.activeTab()).toBe('tab1');
  });

  it('moves to the next tab on ArrowLeft under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    await press('ArrowLeft');

    expect(host.activeTab()).toBe('tab3');
  });

  it('keeps LTR keys inside a [dir="ltr"] island of an RTL document', async () => {
    rtl.setDirection('rtl');
    host.scopeDir.set('ltr');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('rtl');

    await press('ArrowRight');

    expect(host.activeTab()).toBe('tab3');
  });

  it('follows a live flip of the scoped [dir]', async () => {
    await press('ArrowRight');
    expect(host.activeTab()).toBe('tab3');

    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    await press('ArrowRight');
    expect(host.activeTab()).toBe('tab2');
  });
});

describe('MlvTabGroup — static [dir] scope, embedded view', () => {
  afterEach(() => {
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('moves to the previous tab on ArrowRight when rendered inside an @if', async () => {
    await TestBed.configureTestingModule({
      imports: [StaticScopeEmbeddedHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(StaticScopeEmbeddedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    const tablist = fixture.nativeElement.querySelector(
      '[role="tablist"]',
    ) as HTMLElement;
    tablist.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.activeTab()).toBe('tab1');
  });
});
