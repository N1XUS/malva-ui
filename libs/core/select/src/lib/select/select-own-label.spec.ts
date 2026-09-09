import { Component, signal, type WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvSelect } from './select';

@Component({
  imports: [MlvSelect],
  template: `<mlv-select
    label="Country"
    [native]="native()"
    [options]="['Austria', 'Belgium']"
  />`,
})
class OwnLabelHost {
  readonly native = signal(false);
}

/**
 * `mlv-select` has two interaction surfaces and only one of them is labelable.
 * Its own `<mlv-label>` bound `[for]="id()"` unconditionally, so behind the
 * custom trigger the attribute pointed at a `div[role="combobox"]` — an element
 * `<label for>` cannot name (#216). The native `<select>` carries the same id
 * and *is* labelable, so there the association is real and must survive.
 */
describe('MlvSelect — its own label (#216)', () => {
  interface Rendered {
    fixture: ComponentFixture<OwnLabelHost>;
    root: HTMLElement;
    labelHost: HTMLElement;
    label: HTMLLabelElement;
  }

  async function render(native = false): Promise<Rendered> {
    await TestBed.configureTestingModule({
      imports: [OwnLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(OwnLabelHost);
    fixture.componentInstance.native.set(native);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root,
      labelHost: root.querySelector('mlv-label') as HTMLElement,
      label: root.querySelector('mlv-label label') as HTMLLabelElement,
    };
  }

  it('emits no `for` behind the custom trigger, rather than one that names a div', async () => {
    const { root, label } = await render();
    const trigger = root.querySelector('.mlv-select__trigger') as HTMLElement;

    expect(trigger.tagName).toBe('DIV');
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('still names the custom trigger through aria-labelledby', async () => {
    const { root, labelHost } = await render();
    const trigger = root.querySelector('.mlv-select__trigger') as HTMLElement;

    expect(trigger.getAttribute('aria-labelledby')).toBe(labelHost.id);
    expect(root.querySelector(`#${labelHost.id}`)?.textContent?.trim()).toBe(
      'Country',
    );
  });

  it('keeps the real `for` while the native <select> is the live surface', async () => {
    const { root, label } = await render(true);
    const nativeSelect = root.querySelector(
      'select.mlv-select__native',
    ) as HTMLSelectElement;

    expect(label.getAttribute('for')).toBe(nativeSelect.id);
    expect(nativeSelect.labels?.length).toBe(1);
  });

  it('has no axe violations in either surface', async () => {
    const { root: custom } = await render();
    await expectNoAxeViolations(custom);

    TestBed.resetTestingModule();

    const { root: native } = await render(true);
    await expectNoAxeViolations(native);
  });
});

/**
 * Stubs the breakpoint service so `native="auto"` can be crossed inside one
 * fixture. jsdom's `matchMedia` never matches a `min-width` query, so the real
 * service is pinned to `'sm'` and `isDown('md')` is stuck `true` — an `'auto'`
 * select would be permanently native and the flip would never happen.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

@Component({
  imports: [MlvSelect],
  template: `<mlv-select
    label="Country"
    [native]="native()"
    [options]="['Austria', 'Belgium']"
  />`,
})
class AutoHost {
  readonly native = signal<'auto' | boolean>('auto');
}

/**
 * `_ownLabelFor()` is a signal rather than a constant precisely because
 * `mlv-select` changes which surface is live **while mounted**: `native="auto"`
 * hands the interaction to a real `<select>` below `md` and takes it back
 * above. The `for` has to follow, in both directions.
 *
 * The two static-endpoint assertions above (`[native]="false"` / `"true"`)
 * cannot see that: a `_ownLabelFor` re-derived once at construction, or an
 * `_externalLabelStrategy()` that stopped reading `_nativeActive()`
 * reactively, would keep both of them green. This is the flip itself.
 */
describe('MlvSelect — its own label follows native="auto" (#216)', () => {
  let breakpoint: FakeBreakpointService;
  let fixture: ComponentFixture<AutoHost>;

  const label = (): HTMLLabelElement =>
    fixture.nativeElement.querySelector('mlv-label label') as HTMLLabelElement;
  const nativeSelect = (): HTMLSelectElement | null =>
    fixture.nativeElement.querySelector('select.mlv-select__native');

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;
    fixture = TestBed.createComponent(AutoHost);
    await settle();
  });

  it('drops and restores the `for` as the viewport crosses md', async () => {
    // Above md: the custom trigger is the live surface, and it is a div.
    expect(nativeSelect()).toBeNull();
    expect(label().hasAttribute('for')).toBe(false);

    // Below md: the native <select> takes over and is labelable.
    breakpoint.down.set(true);
    await settle();
    const live = nativeSelect();
    expect(live).not.toBeNull();
    expect(label().getAttribute('for')).toBe((live as HTMLSelectElement).id);
    expect((live as HTMLSelectElement).labels?.length).toBe(1);

    // Back above md: the attribute goes away again rather than dangling on the
    // id of an element that no longer exists.
    breakpoint.down.set(false);
    await settle();
    expect(nativeSelect()).toBeNull();
    expect(label().hasAttribute('for')).toBe(false);
  });
});
