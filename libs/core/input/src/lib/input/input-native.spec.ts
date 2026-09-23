import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from './input';
import { MlvInputNative } from './input-native';

@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input bare projectControl>
      <input mlvInputNative data-testid="projected" />
    </mlv-input>
  `,
})
class ProjectedHostComponent {
  readonly input = viewChild.required(MlvInput);
}

@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input bare>
      <input mlvInputNative data-testid="ignored" />
    </mlv-input>
  `,
})
class InternalHostComponent {
  readonly input = viewChild.required(MlvInput);
}

describe('MlvInputNative / projectControl', () => {
  function project(el: HTMLElement): HTMLInputElement | null {
    return el.querySelector<HTMLInputElement>('input[data-testid="projected"]');
  }

  let fixture: ComponentFixture<ProjectedHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the projected native input instead of an internal one', () => {
    const host = fixture.nativeElement as HTMLElement;
    const projected = project(host);
    expect(projected).toBeTruthy();
    // Only the projected input exists — no internally-rendered #native input.
    expect(host.querySelectorAll('input').length).toBe(1);
  });

  it('applies the mlv-input__native styling hook to the projected input', () => {
    const projected = project(fixture.nativeElement as HTMLElement);
    expect(projected?.classList.contains('mlv-input__native')).toBe(true);
  });

  it('resolves nativeElement / focus() to the projected input', () => {
    const projected = project(fixture.nativeElement as HTMLElement);
    const input = fixture.componentInstance.input();
    expect(input.nativeElement).toBe(projected);

    input.focus();
    expect(document.activeElement).toBe(projected);
  });

  it('renders its own internal input when projectControl is not set', async () => {
    const internalFixture = TestBed.createComponent(InternalHostComponent);
    internalFixture.detectChanges();
    await internalFixture.whenStable();

    const host = internalFixture.nativeElement as HTMLElement;
    // The mlvInputNative candidate is not projected; mlv-input renders its own.
    const projectedCandidate = host.querySelector(
      'input[data-testid="ignored"]',
    );
    expect(projectedCandidate).toBeNull();

    const internal = host.querySelector('input.mlv-input__native');
    expect(internal).toBeTruthy();
    expect(internalFixture.componentInstance.input().nativeElement).toBe(
      internal,
    );
  });
});

/**
 * `projectControl` without `bare` — the wrapped shape, where `mlv-input` draws
 * the full `mlv-form-control-wrapper` chrome around the consumer's own input.
 */
@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input projectControl label="Search">
      <input mlvInputNative data-testid="projected" id="wrapped-native" />
    </mlv-input>
  `,
})
class WrappedProjectedHostComponent {
  readonly input = viewChild.required(MlvInput);
}

/** `bare` flipped at runtime, with the same projected input throughout. */
@Component({
  imports: [MlvInput, MlvInputNative],
  template: `
    <mlv-input [bare]="bare()" projectControl label="Search">
      <input mlvInputNative data-testid="projected" id="toggle-native" />
    </mlv-input>
  `,
})
class ToggleBareHostComponent {
  readonly bare = signal(true);
  readonly input = viewChild.required(MlvInput);
}

/**
 * `input.html` may hold exactly ONE `<ng-content select="input[mlvInputNative]" />`.
 *
 * Angular buckets projectable content once per usage site, in
 * `ɵɵprojectionDef` (it caches onto the host TNode, shared by every instance
 * stamped at that template location), against the compiled selector list;
 * `matchingProjectionSlotIndex` returns on the FIRST selector that matches. A
 * second `<ng-content>` carrying the same selector therefore owns a bucket that
 * is `null` for the site's whole lifetime, and renders nothing — regardless
 * of which branch is live. That is what these tests pin: the wrapped branch used
 * to declare its own duplicate slot and rendered no control at all (#256).
 *
 * These have to be DOM assertions, and no axe sweep could stand in for them:
 * every rule asks something about a control that is PRESENT, so a control that
 * is missing entirely violates none of them. Measured on the pre-fix template —
 * a full sweep over the broken wrapped markup, zero `<input>` elements in it,
 * reported zero violations. Axe cannot fault what is not there (the same blind
 * spot as #216 and #258), so the guarantee has to be asserted structurally.
 */
describe('MlvInputNative / projectControl — the single projection slot', () => {
  function projected(el: HTMLElement): HTMLInputElement[] {
    return [
      ...el.querySelectorAll<HTMLInputElement>(
        'input[data-testid="projected"]',
      ),
    ];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('renders the projected input exactly once in bare mode', async () => {
    const fixture = TestBed.createComponent(ProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(projected(host).length).toBe(1);
    // No internal input alongside it.
    expect(host.querySelectorAll('input').length).toBe(1);
    expect(fixture.componentInstance.input().nativeElement).toBe(
      projected(host)[0],
    );
  });

  it('renders the projected input exactly once in wrapped mode, inside the control row', async () => {
    const fixture = TestBed.createComponent(WrappedProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const inputs = projected(host);
    expect(inputs.length).toBe(1);
    expect(host.querySelectorAll('input').length).toBe(1);

    // The wrapper chrome is drawn...
    const row = host.querySelector<HTMLElement>(
      '.mlv-form-control-wrapper__control-row',
    );
    expect(row).not.toBeNull();
    // ...and the projected node is INSIDE the control row, not beside it. The
    // slot is stamped through `ngTemplateOutlet` into a view the wrapper owns,
    // so landing in the right box is a real property, not a given.
    expect(row?.contains(inputs[0])).toBe(true);

    expect(fixture.componentInstance.input().nativeElement).toBe(inputs[0]);
  });

  it('keeps exactly one projected input across a bare() flip in both directions', async () => {
    const fixture = TestBed.createComponent(ToggleBareHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const row = () =>
      host.querySelector<HTMLElement>('.mlv-form-control-wrapper__control-row');

    expect(projected(host).length).toBe(1);
    expect(row()).toBeNull();

    fixture.componentInstance.bare.set(false);
    await fixture.whenStable();
    // Neither orphaned (0) nor duplicated (2).
    expect(projected(host).length).toBe(1);
    expect(row()?.contains(projected(host)[0])).toBe(true);

    fixture.componentInstance.bare.set(true);
    await fixture.whenStable();
    expect(projected(host).length).toBe(1);
    expect(row()).toBeNull();
    expect(fixture.componentInstance.input().nativeElement).toBe(
      projected(host)[0],
    );
  });
});

/**
 * Pins what still does NOT name the projected control — NOT clean, deferred.
 *
 * Making the wrapped shape render at all (#256) is what made any of this
 * reachable: before it the branch rendered no control, so there was nothing to
 * name and nothing to point a `for` at. Two defects became visible then, and
 * one of them is now fixed:
 *
 * 1. FIXED by #216. `input.html` bound `<mlv-label [for]="id()">`
 *    unconditionally, and `MlvLabel._resolvedFor` returns an explicit `for`
 *    before it consults the `labelTarget` machinery — so the attribute was
 *    emitted even though, under `projectControl`, nothing carries `id()`: the
 *    internal `<input [id]>` is not rendered and `MlvInputNative` assigns no id
 *    of its own. It now binds `[for]="_ownLabelFor()"`, which reads
 *    `labelTarget()` — `null` here, because `_externalLabelStrategy()` is
 *    `'none'` under `projectControl` — so no attribute is emitted at all. The
 *    assertion below is the inverse of the one it replaces, deliberately: a
 *    `for` that resolves to nothing must stay absent, not come back empty.
 * 2. STILL OPEN, #259. `mlv-input` emits no accessible name for the consumer's
 *    input, so it has one only if the consumer writes `aria-label` /
 *    `aria-labelledby`. The visible `<mlv-label>` is now honestly unassociated
 *    rather than dishonestly associated — better, but still not a name.
 *
 * Deliberately asserted with plain DOM reads rather than a narrowed axe sweep.
 * Axe raises `label` for (2) but had no rule at all for (1), so a sweep could
 * only ever pin half of this, and would pin that half by DISABLING the rule
 * that sees it — i.e. by asserting nothing. `core-input` now carries sweeps
 * elsewhere (#301's `input-clear.spec.ts`), and the `projectControl` state is
 * listed in its `owes` entry in `scripts/check-axe-coverage.mjs` until #259
 * gives it a name a sweep can assert.
 *
 * EXPECTED TO GO RED when #259 lands: the last two expectations become a
 * resolved name. Update it there, do not delete it.
 */
describe('MlvInputNative / projectControl — the projected control is still unnamed (#259)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('emits no `for` at all, and nothing else names the projected input', async () => {
    const fixture = TestBed.createComponent(WrappedProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // The control #256 restored, so the gap below is reachable at all.
    const control = host.querySelector<HTMLInputElement>('input');
    expect(control?.id).toBe('wrapped-native');

    // (1) #216 — the label is rendered, and carries no `for`. Not `for=""`,
    // and not a `for` naming some other element: no attribute.
    const label = host.querySelector('label');
    expect(label).not.toBeNull();
    expect(label?.hasAttribute('for')).toBe(false);

    // (2) #259 — so nothing names the control at all.
    expect(control?.getAttribute('aria-label')).toBeNull();
    expect(control?.getAttribute('aria-labelledby')).toBeNull();
  });
});
