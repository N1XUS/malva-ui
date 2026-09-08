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
 * Pins the naming gap this PR knowingly ships — NOT clean, deferred.
 *
 * Making the wrapped shape render at all is what exposes it: before #256 the
 * branch rendered no control, so there was nothing to name and nothing to point
 * a `for` at. Now there is, and two separate defects are reachable:
 *
 * 1. `input.html`'s own `<mlv-label [for]="id()">` binds explicitly, and
 *    `MlvLabel._resolvedFor` returns an explicit `for` before it consults the
 *    `labelTarget` machinery — so the attribute is emitted even though, under
 *    `projectControl`, nothing carries `id()`: the internal `<input [id]>` is
 *    not rendered and `MlvInputNative` assigns no id of its own. A `for` naming
 *    nothing. Owned by #216, which converts all eight such bindings at once.
 * 2. `mlv-input` emits no accessible name for the consumer's input, so it has
 *    one only if the consumer writes `aria-label` / `aria-labelledby`. Owned by
 *    #259, which will name it from the component's own `<mlv-label>`.
 *
 * Deliberately asserted with plain DOM reads rather than a narrowed axe sweep:
 * axe raises `label` for (2) but has no rule at all for (1), so a sweep could
 * only pin half the state and would pin that half by DISABLING the rule that
 * sees it — i.e. by asserting nothing. These reads assert both halves
 * positively. (A sweep would also cost `core-input`'s `ROLLOUT_PENDING` line in
 * `scripts/check-axe-coverage.mjs`, which one `hasAxe` boolean ties to both the
 * `uncovered` and `stale-rollout` rules; that list only ever shrinks, so the
 * first sweep commits the project to full-state coverage — a bigger promise
 * than a projection-slot fix should be making.)
 *
 * EXPECTED TO GO RED when either issue lands. That is the point: #216 flips the
 * first expectation to `hasAttribute('for') === false`, #259 the second to a
 * resolved name. Update it there, do not delete it.
 */
describe('MlvInputNative / projectControl — the known naming gap (#216, #259)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('still emits a dangling `for` and leaves the projected input unnamed', async () => {
    const fixture = TestBed.createComponent(WrappedProjectedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // The control the fix restored, so the gap below is reachable at all.
    const control = host.querySelector<HTMLInputElement>('input');
    expect(control?.id).toBe('wrapped-native');

    // (1) #216 — the label points at an id no element in the tree carries.
    const label = host.querySelector('label');
    const forAttr = label?.getAttribute('for') ?? null;
    expect(forAttr).not.toBeNull();
    expect(forAttr).not.toBe('wrapped-native');
    expect(host.querySelector(`[id="${forAttr}"]`)).toBeNull();

    // (2) #259 — and nothing else names the control either.
    expect(control?.getAttribute('aria-label')).toBeNull();
    expect(control?.getAttribute('aria-labelledby')).toBeNull();
  });
});
