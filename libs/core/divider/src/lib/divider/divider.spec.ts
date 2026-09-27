import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApplicationRef,
  Component,
  createComponent,
  EnvironmentInjector,
  signal,
} from '@angular/core';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvDivider } from './divider';

describe('MlvDivider', () => {
  @Component({
    template: `<mlv-divider
      [orientation]="orientation()"
      [dashed]="dashed()"
      [muted]="muted()"
      >{{ label() }}</mlv-divider
    >`,
    imports: [MlvDivider],
  })
  class TestHostComponent {
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
    dashed = signal(false);
    muted = signal(false);
    label = signal('');
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    el = fixture.nativeElement.querySelector('mlv-divider');
  });

  it('should create', () => {
    expect(el).toBeTruthy();
  });

  it('should have role="separator"', () => {
    expect(el.getAttribute('role')).toBe('separator');
  });

  it('should apply horizontal class by default', () => {
    expect(el.classList.contains('mlv-divider--horizontal')).toBe(true);
  });

  it('should apply aria-orientation="horizontal" by default', () => {
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('should apply vertical class when orientation is vertical', async () => {
    host.orientation.set('vertical');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--vertical')).toBe(true);
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('should apply dashed class when dashed=true', async () => {
    host.dashed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--dashed')).toBe(true);
  });

  it('should apply muted class when muted=true', async () => {
    host.muted.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--muted')).toBe(true);
  });

  it('should project label content', async () => {
    host.label.set('OR');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.textContent?.trim()).toBe('OR');
  });

  it('should have mlv-divider base class', () => {
    expect(el.classList.contains('mlv-divider')).toBe(true);
  });
});

/**
 * The accessible name as a screen reader resolves it for this markup:
 * `aria-labelledby` first (each IDREF's text content, space-joined), falling
 * through to `aria-label` when that text is empty (accname 1.2 step 2B; both
 * Chromium and Firefox do). `null` when neither is present. Hand-rolled because
 * no accessible-name library is a workspace dependency (mirrors
 * `progress.spec.ts`).
 */
function accessibleName(element: Element): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text;
  }
  return element.getAttribute('aria-label');
}

/**
 * A labelled divider is named by its label (#332).
 *
 * `role="separator"` has presentational children and takes its name from the
 * author only, so a projected "OR" was never the separator's name — and no
 * platform API exposes it as a child either: Chromium treats a separator as a
 * leaf (`AXNode::IsLeaf`, `kSplitter`), Firefox prunes a separator whose only
 * child is a text leaf (`nsAccUtils::MustPrune`). Measured natively on `main`:
 * name `""` in both engines. No axe rule asks a separator for a name, so the
 * sweep below stayed green over it; these specs assert the resolved name.
 */
describe('MlvDivider accessible name', () => {
  @Component({
    imports: [MlvDivider],
    template: `
      <mlv-divider id="labelled">OR</mlv-divider>
      <mlv-divider id="dynamic">{{ label() }}</mlv-divider>
      <mlv-divider id="vertical" orientation="vertical">or</mlv-divider>
      <mlv-divider id="rich"
        ><svg aria-hidden="true" width="8" height="8"></svg> Today,
        <strong>12 May</strong></mlv-divider
      >
      <mlv-divider id="bare" />
      <mlv-divider id="authored" aria-label="Sign-in options">OR</mlv-divider>
      <span id="external-name">Payment methods</span>
      <mlv-divider id="referenced" aria-labelledby="external-name"
        >OR</mlv-divider
      >
    `,
  })
  class DividerNameHost {
    readonly label = signal('');
  }

  let fixture: ComponentFixture<DividerNameHost>;

  const divider = (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DividerNameHost],
    }).compileComponents();
    fixture = TestBed.createComponent(DividerNameHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('names a labelled divider by its projected text', () => {
    expect(divider('labelled').getAttribute('role')).toBe('separator');
    expect(accessibleName(divider('labelled'))).toBe('OR');
  });

  it('names a vertical divider by its projected text', () => {
    expect(accessibleName(divider('vertical'))).toBe('or');
  });

  it('names a divider by the text of rich projected content', () => {
    expect(accessibleName(divider('rich'))).toBe('Today, 12 May');
  });

  it('follows a label that changes after the first render', async () => {
    expect(accessibleName(divider('dynamic')) ?? '').toBe('');

    fixture.componentInstance.label.set('AND');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(accessibleName(divider('dynamic'))).toBe('AND');

    fixture.componentInstance.label.set('');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(accessibleName(divider('dynamic')) ?? '').toBe('');
  });

  it('leaves a divider with no content unnamed', () => {
    expect(accessibleName(divider('bare')) ?? '').toBe('');
  });

  it('exposes the label once: the text the name reads is aria-hidden', () => {
    // The name comes through `aria-labelledby`, which reads a hidden
    // referenced node's text (accname step 2A). Left visible, the same text
    // is also a StaticText child of the separator in Chromium's tree (CDP).
    const el = divider('labelled');
    const target = el.ownerDocument.getElementById(
      el.getAttribute('aria-labelledby') ?? '',
    );
    expect(target?.textContent?.trim()).toBe('OR');
    expect(el.contains(target)).toBe(true);
    expect(target?.getAttribute('aria-hidden')).toBe('true');
  });

  it("keeps a consumer's static aria-label as the name", () => {
    const el = divider('authored');
    expect(el.hasAttribute('aria-labelledby')).toBe(false);
    expect(el.querySelector('.mlv-divider__label')?.hasAttribute('id')).toBe(
      false,
    );
    expect(accessibleName(el)).toBe('Sign-in options');
  });

  it("keeps a consumer's static aria-labelledby instead of overwriting it", () => {
    const el = divider('referenced');
    expect(el.getAttribute('aria-labelledby')).toBe('external-name');
    expect(accessibleName(el)).toBe('Payment methods');
  });

  it('gives every self-labelled divider its own label id', () => {
    const selfLabelled = ['labelled', 'dynamic', 'vertical', 'rich', 'bare'];
    const ids = selfLabelled.map((id) => {
      const el = divider(id);
      const labelledBy = el.getAttribute('aria-labelledby') ?? '';
      expect(el.querySelector('.mlv-divider__label')?.id).toBe(labelledBy);
      return labelledBy;
    });
    expect(ids.every((id) => id.startsWith('mlv-divider-label-'))).toBe(true);
    expect(new Set(ids).size).toBe(selfLabelled.length);
  });
});

/**
 * A bound name goes through the `ariaLabel` / `ariaLabelledBy` inputs (#332).
 *
 * `HostAttributeToken` sees only static attributes, and the host binds
 * `aria-labelledby` itself, winning the first render's tie against a
 * consumer's own `[attr.aria-labelledby]` — so a translated name or a per-row
 * reference needs an input. Rendered markup of every shape below measured
 * natively (Chromium 145 CDP, Firefox 146 BiDi) with the same names.
 */
describe('MlvDivider naming inputs', () => {
  @Component({
    imports: [MlvDivider],
    template: `
      <span id="input-external">Payment methods</span>
      <span id="heading-a">Shipping</span>
      <span id="heading-b">Billing</span>
      <mlv-divider id="input-label" [ariaLabel]="label()">OR</mlv-divider>
      <mlv-divider
        id="input-label-static"
        aria-label="Sign-in options"
        [ariaLabel]="label()"
        >OR</mlv-divider
      >
      <mlv-divider id="input-labelledby" [ariaLabelledBy]="labelledBy()"
        >OR</mlv-divider
      >
      <mlv-divider
        id="input-both"
        [ariaLabel]="'Sign-in options'"
        ariaLabelledBy="input-external"
        >OR</mlv-divider
      >
      <mlv-divider id="bound-attr-label" [attr.aria-label]="'Section break'" />
      @for (row of rows; track row) {
        <mlv-divider class="row-divider" [ariaLabelledBy]="'heading-' + row"
          >OR</mlv-divider
        >
      }
    `,
  })
  class DividerInputsHost {
    readonly label = signal<string | undefined>('Other sign-in options');
    readonly labelledBy = signal<string | undefined>('input-external');
    readonly rows = ['a', 'b'];
  }

  let fixture: ComponentFixture<DividerInputsHost>;

  const divider = (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DividerInputsHost],
    }).compileComponents();
    fixture = TestBed.createComponent(DividerInputsHost);
    await settle();
  });

  it('names the separator by a bound ariaLabel over its label, and follows it', async () => {
    const el = divider('input-label');
    expect(el.getAttribute('aria-label')).toBe('Other sign-in options');
    expect(el.hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(el)).toBe('Other sign-in options');

    fixture.componentInstance.label.set('More ways to sign in');
    await settle();
    expect(accessibleName(el)).toBe('More ways to sign in');

    // Cleared: the label names the separator again.
    fixture.componentInstance.label.set(undefined);
    await settle();
    expect(el.hasAttribute('aria-label')).toBe(false);
    expect(el.getAttribute('aria-labelledby')).toBe(
      el.querySelector('.mlv-divider__label')?.id,
    );
    expect(accessibleName(el)).toBe('OR');

    fixture.componentInstance.label.set('   ');
    await settle();
    expect(accessibleName(el)).toBe('OR');
  });

  it('restores a static aria-label when a bound ariaLabel is cleared', async () => {
    const el = divider('input-label-static');
    expect(accessibleName(el)).toBe('Other sign-in options');

    fixture.componentInstance.label.set(undefined);
    await settle();
    expect(el.getAttribute('aria-label')).toBe('Sign-in options');
    expect(el.hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(el)).toBe('Sign-in options');
  });

  it('names the separator by a bound ariaLabelledBy, and follows it', async () => {
    const el = divider('input-labelledby');
    expect(el.getAttribute('aria-labelledby')).toBe('input-external');
    expect(accessibleName(el)).toBe('Payment methods');

    fixture.componentInstance.labelledBy.set('heading-b');
    await settle();
    expect(accessibleName(el)).toBe('Billing');

    fixture.componentInstance.labelledBy.set(undefined);
    await settle();
    expect(el.getAttribute('aria-labelledby')).toBe(
      el.querySelector('.mlv-divider__label')?.id,
    );
    expect(accessibleName(el)).toBe('OR');
  });

  it('lands a per-row ariaLabelledBy in @for on the first render', () => {
    const rows = [
      ...fixture.nativeElement.querySelectorAll('.row-divider'),
    ] as HTMLElement[];
    expect(rows.map((el) => el.getAttribute('aria-labelledby'))).toEqual([
      'heading-a',
      'heading-b',
    ]);
    expect(rows.map((el) => accessibleName(el))).toEqual([
      'Shipping',
      'Billing',
    ]);
  });

  it('ranks ariaLabelledBy above ariaLabel, as accname does', () => {
    const el = divider('input-both');
    expect(el.getAttribute('aria-labelledby')).toBe('input-external');
    expect(accessibleName(el)).toBe('Payment methods');
  });

  it('leaves a bare divider named by a bound [attr.aria-label]', () => {
    // Why `ariaLabel` is written by an effect, not a host binding: a host
    // `[attr.aria-label]` writes `null` on the first render and wins the tie
    // against this binding, so the name would never land.
    const el = divider('bound-attr-label');
    expect(el.getAttribute('aria-label')).toBe('Section break');
    expect(accessibleName(el)).toBe('Section break');
  });

  it('names a createComponent root host through setInput, not its own attribute', async () => {
    // `HostAttributeToken` is always `null` for a root host, so the attribute
    // it came with is not read and the projected label wins.
    const hostElement = document.createElement('mlv-divider');
    hostElement.setAttribute('aria-label', 'Root name');
    document.body.appendChild(hostElement);
    const ref = createComponent(MlvDivider, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      hostElement,
      projectableNodes: [[document.createTextNode('OR')]],
    });
    const appRef = TestBed.inject(ApplicationRef);
    appRef.attachView(ref.hostView);
    try {
      ref.changeDetectorRef.detectChanges();
      await appRef.whenStable();
      expect(accessibleName(hostElement)).toBe('OR');

      ref.setInput('ariaLabel', 'Root name via input');
      ref.changeDetectorRef.detectChanges();
      await appRef.whenStable();
      expect(hostElement.hasAttribute('aria-labelledby')).toBe(false);
      expect(accessibleName(hostElement)).toBe('Root name via input');
    } finally {
      ref.destroy();
      hostElement.remove();
    }
  });
});

/**
 * Label spacing keys on the label, not on the host (#332).
 *
 * The label now sits in a `.mlv-divider__label` wrapper that is always
 * rendered, so the host is never `:empty` and a gap keyed on the host would
 * split every bare divider's line in two. Component styles are not injected
 * into the DOM under vitest/jsdom, so the compiled stylesheet is the
 * observable surface.
 */
describe('MlvDivider label spacing', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      join(dirname(fileURLToPath(import.meta.url)), 'divider.scss'),
      {
        style: 'expanded',
      },
    ).css,
  );

  it('does not key any rule on the host being empty', () => {
    expect(css).not.toMatch(
      /\.mlv-divider--(horizontal|vertical):not\(:empty\)/,
    );
    expect(css).not.toMatch(/\.mlv-divider:not\(:empty\)/);
  });

  it('spaces a non-empty label from the line segments on the inline axis', () => {
    expect(css).toMatch(
      /\.mlv-divider--horizontal > \.mlv-divider__label:not\(:empty\)\s*\{[^}]*margin-inline:\s*var\(--mlv-spacing-2\);/,
    );
  });

  it('spaces a non-empty label from the line segments on the block axis when vertical', () => {
    expect(css).toMatch(
      /\.mlv-divider--vertical > \.mlv-divider__label:not\(:empty\)\s*\{[^}]*margin-block:\s*var\(--mlv-spacing-1\);/,
    );
  });
});

/**
 * Accessibility sweep.
 *
 * The divider's entire contract is ARIA: a static `role="separator"` plus an
 * `aria-orientation` bound to the `orientation` input. Both orientations are
 * swept, and both the bare rule and the labelled variant — a separator with
 * projected text is the render where the role and the content have to agree.
 * Since #332 every self-labelled separator carries `aria-labelledby` onto its
 * `aria-hidden` label wrapper (empty on a bare one), and a consumer-named one
 * keeps its own `aria-label` / `aria-labelledby` or takes the `ariaLabel` /
 * `ariaLabelledBy` input's; all of those are swept.
 * The sweep cannot see the defect #332 fixed — no axe rule asks a separator
 * for a name — so `MlvDivider accessible name` above asserts the name itself.
 */
describe('MlvDivider accessibility', () => {
  @Component({
    imports: [MlvDivider],
    template: `
      <mlv-divider />
      <mlv-divider dashed muted />
      <mlv-divider>Section</mlv-divider>
      <mlv-divider orientation="vertical" />
      <mlv-divider orientation="vertical" dashed>or</mlv-divider>
      <mlv-divider aria-label="Sign-in options">OR</mlv-divider>
      <span id="a11y-external-name">Payment methods</span>
      <mlv-divider aria-labelledby="a11y-external-name">OR</mlv-divider>
      <mlv-divider ariaLabel="Other sign-in options">OR</mlv-divider>
      <mlv-divider ariaLabelledBy="a11y-external-name">OR</mlv-divider>
    `,
  })
  class DividerA11yHost {}

  it('has no axe violations in both orientations, bare, labelled and consumer-named', async () => {
    await TestBed.configureTestingModule({
      imports: [DividerA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(DividerA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: nine separators, each announcing its own orientation.
    const separators = [...host.querySelectorAll('[role="separator"]')];
    expect(separators).toHaveLength(9);
    expect(separators.map((el) => el.getAttribute('aria-orientation'))).toEqual(
      [
        'horizontal',
        'horizontal',
        'horizontal',
        'vertical',
        'vertical',
        'horizontal',
        'horizontal',
        'horizontal',
        'horizontal',
      ],
    );
    expect(separators.map((el) => accessibleName(el) ?? '')).toEqual([
      '',
      '',
      'Section',
      '',
      'or',
      'Sign-in options',
      'Payment methods',
      'Other sign-in options',
      'Payment methods',
    ]);

    await expectNoAxeViolations(host);
  });
});
