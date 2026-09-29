import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { LucideFile, LucideFolder, provideLucideIcons } from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvTree } from './tree';
import type { MlvTreeNode } from './tree-node';

/**
 * `@angular/aria`'s `Tree` injects the CDK `Directionality` to decide which
 * horizontal arrow key **expands** and which **collapses** a vertical tree
 * (ArrowRight / ArrowLeft in LTR, swapped in RTL). The root-provided one
 * reports only the **document** direction, so without the tree's scoped
 * provider a `[dir="rtl"]` wrapper mirrors the indentation but not the keys.
 *
 * No global-flip case: `MlvRtlService.setDirection()` also writes the root CDK
 * `Directionality`, so it passes with the provider removed
 * (`.claude/rules/rtl.md`).
 */
const NODES: MlvTreeNode<unknown>[] = [
  {
    id: 'a',
    label: 'Node A',
    data: {},
    children: [
      { id: 'a1', label: 'Node A1', data: {} },
      { id: 'a2', label: 'Node A2', data: {} },
    ],
  },
  { id: 'b', label: 'Node B', data: {} },
];

@Component({
  imports: [MlvTree],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-tree [nodes]="nodes" />
    </div>
  `,
})
class ScopedDirectionHost {
  readonly nodes = NODES;
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

describe('MlvTree — scoped [dir] keyboard', () => {
  let fixture: ComponentFixture<ScopedDirectionHost>;
  let host: ScopedDirectionHost;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirectionHost],
      providers: [
        provideMlvI18nTesting(),
        provideLucideIcons(LucideFolder, LucideFile),
      ],
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

  function rowCount(): number {
    return fixture.nativeElement.querySelectorAll('.mlv-tree__item').length;
  }

  async function press(key: string): Promise<void> {
    const tree = fixture.nativeElement.querySelector(
      '.mlv-tree__root',
    ) as HTMLElement;
    tree.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('expands on ArrowLeft under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');
    expect(rowCount()).toBe(2);

    await press('ArrowLeft');

    expect(rowCount()).toBe(4);
  });

  it('does not expand on ArrowRight under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    await press('ArrowRight');

    expect(rowCount()).toBe(2);
  });

  it('keeps LTR keys inside a [dir="ltr"] island of an RTL document', async () => {
    rtl.setDirection('rtl');
    host.scopeDir.set('ltr');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('rtl');

    await press('ArrowRight');

    expect(rowCount()).toBe(4);
  });
});
