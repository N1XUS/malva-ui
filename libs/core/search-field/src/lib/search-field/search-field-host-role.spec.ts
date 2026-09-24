import {
  ApplicationRef,
  Component,
  createComponent,
  EnvironmentInjector,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvSearchFieldNavigateEvent } from './search-field';
import { MlvSearchField } from './search-field';

/**
 * #329. `role` is an input, and Angular hands a **static** template attribute
 * to the matching input *and* writes it to the host element. The field puts
 * the role on its native `<input>`, so a static `role="combobox"` — the shape
 * the README documents — used to leave a second, unnamed combobox with no
 * `aria-expanded` / `aria-controls` on the `<mlv-search-field>` host (axe
 * `aria-required-attr`), and a static `role="searchbox"` an unnamed searchbox
 * there (axe `aria-input-field-name`). The existing suite drives `role` only
 * through `setInput`, which never writes the attribute, so it could not see
 * either. The markup below is the README's combobox wiring verbatim.
 */
@Component({
  imports: [MlvSearchField],
  template: `
    <mlv-search-field
      role="combobox"
      ariaAutocomplete="list"
      ariaLabel="Search commands"
      [ariaControls]="listboxId"
      [ariaExpanded]="open()"
      [ariaActiveDescendant]="open() ? optionId : null"
      (navigate)="navigations.push($event)"
    />
    @if (open()) {
      <ul role="listbox" aria-label="Commands" [id]="listboxId">
        <li role="option" aria-selected="true" [id]="optionId">Copy</li>
      </ul>
    }
  `,
})
class StaticComboboxHost {
  readonly listboxId = 'command-listbox';
  readonly optionId = 'command-listbox-option-0';
  readonly open = signal(false);
  readonly navigations: MlvSearchFieldNavigateEvent[] = [];
}

@Component({
  imports: [MlvSearchField],
  template: `<mlv-search-field role="searchbox" ariaLabel="Search orders" />`,
})
class StaticSearchboxHost {}

@Component({
  imports: [MlvSearchField],
  template: `
    <mlv-search-field
      [role]="role()"
      ariaAutocomplete="list"
      ariaLabel="Search commands"
      ariaControls="bound-listbox"
      [ariaExpanded]="false"
    />
  `,
})
class BoundRoleHost {
  readonly role = signal<'combobox' | 'searchbox'>('combobox');
}

/**
 * A consumer that wants a `search` landmark around the field has no static
 * way to say so — `role` is the input, typed `'searchbox' | 'combobox'` — so it
 * binds the host attribute directly. That binding is the consumer's own and
 * must survive: a constant `'[attr.role]': 'null'` host binding would remove it
 * on the first change-detection pass (a same-pass tie the component's host
 * binding wins) and only give it back once its value changed.
 */
@Component({
  imports: [MlvSearchField],
  template: `
    <mlv-search-field [attr.role]="landmark()" ariaLabel="Search orders" />
  `,
})
class HostRoleAttributeHost {
  readonly landmark = signal('search');
}

describe('MlvSearchField — a static role attribute (#329)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
  });

  async function render<T>(type: new () => T): Promise<ComponentFixture<T>> {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const parts = (
    fixture: ComponentFixture<unknown>,
  ): { host: HTMLElement; input: HTMLInputElement } => {
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-search-field',
    ) as HTMLElement;
    return { host, input: host.querySelector('input') as HTMLInputElement };
  };

  it('puts a static role="combobox" on the native input only', async () => {
    const fixture = await render(StaticComboboxHost);
    const { host, input } = parts(fixture);

    expect(host.hasAttribute('role')).toBe(false);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toBe('command-listbox');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[role="combobox"]',
      ),
    ).toHaveLength(1);
  });

  it('has no axe violations with a static role="combobox", closed and open', async () => {
    const fixture = await render(StaticComboboxHost);
    const root = fixture.nativeElement as HTMLElement;

    await expectNoAxeViolations(root);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const { host, input } = parts(fixture);
    expect(host.hasAttribute('role')).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'command-listbox-option-0',
    );

    await expectNoAxeViolations(root);
  });

  it('still feeds a static role="combobox" to the input that drives navigate', async () => {
    const fixture = await render(StaticComboboxHost);
    const { input } = parts(fixture);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    fixture.detectChanges();

    expect(
      fixture.componentInstance.navigations.map((nav) => nav.direction),
    ).toEqual(['down']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders no role anywhere for a static role="searchbox"', async () => {
    const fixture = await render(StaticSearchboxHost);
    const { host, input } = parts(fixture);

    expect(host.hasAttribute('role')).toBe(false);
    expect(input.hasAttribute('role')).toBe(false);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('leaves a bound role off the host, in both values', async () => {
    const fixture = await render(BoundRoleHost);
    const { host, input } = parts(fixture);

    expect(host.hasAttribute('role')).toBe(false);
    expect(input.getAttribute('role')).toBe('combobox');
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    fixture.componentInstance.role.set('searchbox');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.hasAttribute('role')).toBe(false);
    expect(input.hasAttribute('role')).toBe(false);
  });

  it("keeps a consumer's own [attr.role] binding on the host", async () => {
    const fixture = await render(HostRoleAttributeHost);
    const { host, input } = parts(fixture);

    expect(host.getAttribute('role')).toBe('search');
    expect(input.hasAttribute('role')).toBe(false);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    fixture.componentInstance.landmark.set('region');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.getAttribute('role')).toBe('region');
  });

  it('leaves the role of a createComponent host element alone', async () => {
    // A root host's own attributes never reach an input — `HostAttributeToken`
    // reads the *template's* static attributes, and there is no template — so
    // a role already on the element is the consumer's, not a copy of `role`.
    const hostElement = document.createElement('div');
    hostElement.setAttribute('role', 'search');
    document.body.appendChild(hostElement);
    const ref = createComponent(MlvSearchField, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      hostElement,
    });
    const appRef = TestBed.inject(ApplicationRef);
    appRef.attachView(ref.hostView);
    ref.setInput('role', 'combobox');
    ref.changeDetectorRef.detectChanges();

    try {
      expect(hostElement.getAttribute('role')).toBe('search');
      expect(hostElement.querySelector('input')?.getAttribute('role')).toBe(
        'combobox',
      );
    } finally {
      appRef.detachView(ref.hostView);
      ref.destroy();
      hostElement.remove();
    }
  });
});
