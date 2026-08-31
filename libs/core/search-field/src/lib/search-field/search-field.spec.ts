import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvSearchField } from './search-field';

describe('MlvSearchField', () => {
  let component: MlvSearchField;
  let fixture: ComponentFixture<MlvSearchField>;
  let host: HTMLElement;

  const nativeInput = (): HTMLInputElement =>
    host.querySelector('input') as HTMLInputElement;

  const type = (value: string): void => {
    const input = nativeInput();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSearchField],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSearchField);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a labelled, search-optimised input using i18n defaults', () => {
    const input = nativeInput();

    expect(host.classList.contains('mlv-search-field')).toBe(true);
    expect(input.type).toBe('search');
    expect(input.inputMode).toBe('search');
    expect(input.autocomplete).toBe('off');
    expect(input.placeholder).toBe('Search...');
    expect(input.getAttribute('aria-label')).toBe('Search');
    expect(host.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('allows explicit placeholder and accessible-label overrides', () => {
    fixture.componentRef.setInput('placeholder', 'Find customers');
    fixture.componentRef.setInput('ariaLabel', 'Search customers');
    fixture.detectChanges();

    expect(nativeInput().placeholder).toBe('Find customers');
    expect(nativeInput().getAttribute('aria-label')).toBe('Search customers');
  });

  it('debounces live searches and emits only the final query', () => {
    vi.useFakeTimers();
    const searches = vi.fn();
    component.search.subscribe(searches);

    type('c');
    type('cu');
    type('customers');

    vi.advanceTimersByTime(199);
    expect(searches).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(searches).toHaveBeenCalledTimes(1);
    expect(searches).toHaveBeenLastCalledWith('customers');
    expect(component.value()).toBe('customers');
  });

  it('deduplicates equal live queries and clamps a negative debounce to zero', () => {
    vi.useFakeTimers();
    const searches = vi.fn();
    component.search.subscribe(searches);

    type('orders');
    vi.advanceTimersByTime(200);
    expect(searches).toHaveBeenCalledTimes(1);

    // A transient edit is superseded before its debounce completes; the final
    // value equals the last committed live query and must not emit again.
    type('orders pending');
    type('orders');
    vi.advanceTimersByTime(200);
    expect(searches).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('debounce', -10);
    fixture.detectChanges();
    type('invoices');
    expect(component.debounce()).toBe(0);
    expect(searches).toHaveBeenLastCalledWith('invoices');
  });

  it('cancels stale debounce work and rebases deduplication after controlled value changes', () => {
    vi.useFakeTimers();
    const searches = vi.fn();
    component.search.subscribe(searches);

    type('alice');
    vi.advanceTimersByTime(200);
    expect(searches).toHaveBeenLastCalledWith('alice');

    component.value.set('');
    fixture.detectChanges();
    type('alice');
    vi.advanceTimersByTime(200);
    expect(searches).toHaveBeenCalledTimes(2);
    expect(searches).toHaveBeenLastCalledWith('alice');

    type('stale query');
    component.value.set('server query');
    fixture.detectChanges();
    vi.advanceTimersByTime(500);

    expect(component.value()).toBe('server query');
    expect(searches).toHaveBeenCalledTimes(2);
  });

  it('keeps submit mode silent while typing and submits from Enter or its button', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('trigger', 'submit');
    fixture.detectChanges();
    const searches = vi.fn();
    component.search.subscribe(searches);

    type('quarterly report');
    vi.advanceTimersByTime(1_000);
    expect(searches).not.toHaveBeenCalled();

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    nativeInput().dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(searches).toHaveBeenCalledTimes(1);
    expect(searches).toHaveBeenLastCalledWith('quarterly report');

    const submit = host.querySelector(
      'button[aria-label="Submit search"]',
    ) as HTMLButtonElement;
    expect(submit.type).toBe('button');
    submit.click();
    expect(searches).toHaveBeenCalledTimes(2);
  });

  it('ignores a composing Enter key so IME text is not submitted early', () => {
    fixture.componentRef.setInput('trigger', 'submit');
    fixture.detectChanges();
    const searches = vi.fn();
    component.search.subscribe(searches);
    type('検索');

    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        isComposing: true,
      }),
    );

    expect(searches).not.toHaveBeenCalled();
  });

  it('clears immediately, emits an empty query, and cancels pending live work', () => {
    vi.useFakeTimers();
    const searches = vi.fn();
    component.search.subscribe(searches);
    expect(component.commitOnClear()).toBe(true);
    type('pending query');

    const clear = host.querySelector(
      'button[aria-label="Clear search"]',
    ) as HTMLButtonElement;
    expect(clear).not.toBeNull();
    expect(clear.type).toBe('button');
    clear.click();
    fixture.detectChanges();

    expect(component.value()).toBe('');
    expect(searches).toHaveBeenCalledTimes(1);
    expect(searches).toHaveBeenLastCalledWith('');
    expect(host.querySelector('button[aria-label="Clear search"]')).toBeNull();

    vi.advanceTimersByTime(500);
    expect(searches).toHaveBeenCalledTimes(1);
  });

  it('keeps the clear action as one native button without moving input focus', async () => {
    const searches = vi.fn();
    component.search.subscribe(searches);
    component.value.set('clear me');
    fixture.detectChanges();

    const closeHost = host.querySelector('mlv-button-close') as HTMLElement;
    const clearButton = closeHost.querySelector('button') as HTMLButtonElement;
    expect(closeHost).not.toBeNull();
    expect(closeHost.getAttribute('role')).toBeNull();
    expect(closeHost.getAttribute('tabindex')).toBeNull();
    expect(closeHost.querySelectorAll('button')).toHaveLength(1);

    const results = await axe.run(host, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map(({ id }) => id)).not.toContain(
      'nested-interactive',
    );

    nativeInput().focus();
    clearButton.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(nativeInput());

    clearButton.click();
    fixture.detectChanges();
    expect(searches).toHaveBeenCalledTimes(1);
    expect(searches).toHaveBeenLastCalledWith('');
  });

  it('can clear its value without committing a search event', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('commitOnClear', 'false');
    fixture.detectChanges();
    const searches = vi.fn();
    const valueChanges = vi.fn();
    component.search.subscribe(searches);
    component.value.subscribe(valueChanges);
    type('composite draft');

    const clear = host.querySelector(
      'button[aria-label="Clear search"]',
    ) as HTMLButtonElement;
    clear.click();
    fixture.detectChanges();

    expect(component.commitOnClear()).toBe(false);
    expect(component.value()).toBe('');
    expect(nativeInput().value).toBe('');
    expect(valueChanges).toHaveBeenLastCalledWith('');
    expect(searches).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(searches).not.toHaveBeenCalled();
  });

  it('cancels a pending live search when destroyed', () => {
    vi.useFakeTimers();
    const searches = vi.fn();
    component.search.subscribe(searches);
    type('will be discarded');

    fixture.destroy();
    vi.advanceTimersByTime(500);

    expect(searches).not.toHaveBeenCalled();
  });

  it('blocks disabled interaction and removes the clear affordance', () => {
    component.value.set('fixed');
    fixture.componentRef.setInput('trigger', 'submit');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const searches = vi.fn();
    component.search.subscribe(searches);

    expect(nativeInput().disabled).toBe(true);
    expect(host.classList.contains('mlv-search-field--disabled')).toBe(true);
    expect(host.querySelector('button[aria-label="Clear search"]')).toBeNull();

    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    const submit = host.querySelector(
      'button[aria-label="Submit search"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    submit.click();
    expect(searches).not.toHaveBeenCalled();
  });

  it('shows loading state without freezing live refinement', () => {
    fixture.componentRef.setInput('debounce', 0);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const searches = vi.fn();
    component.search.subscribe(searches);

    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(nativeInput().disabled).toBe(false);
    expect(host.querySelector('mlv-loader')).not.toBeNull();

    type('newer query');
    expect(searches).toHaveBeenLastCalledWith('newer query');
  });

  it('blocks duplicate explicit submission while loading but remains editable', () => {
    fixture.componentRef.setInput('trigger', 'submit');
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const searches = vi.fn();
    component.search.subscribe(searches);

    type('editable query');
    expect(component.value()).toBe('editable query');
    expect(nativeInput().disabled).toBe(false);

    const submit = host.querySelector(
      'button[aria-label="Submit search"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(searches).not.toHaveBeenCalled();

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(searches).toHaveBeenLastCalledWith('editable query');
  });

  it('can drop the submit button and move the glyph to the leading edge', () => {
    fixture.componentRef.setInput('trigger', 'submit');
    fixture.componentRef.setInput('showSubmit', false);
    fixture.detectChanges();

    expect(host.querySelector('.mlv-search-field__submit')).toBeNull();
    expect(
      host.querySelector('.mlv-search-field__leading-icon'),
    ).not.toBeNull();

    const searches = vi.fn();
    component.search.subscribe(searches);
    type('still commits');
    nativeInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(searches).toHaveBeenCalledWith('still commits');
  });

  it('can suppress the clear action', () => {
    fixture.componentRef.setInput('clearable', false);
    component.value.set('not clearable');
    fixture.detectChanges();

    expect(host.querySelector('button[aria-label="Clear search"]')).toBeNull();
  });

  describe('combobox hooks', () => {
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      nativeInput().dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('leaves the input role and combobox attributes off by default', () => {
      const input = nativeInput();

      expect(component.role()).toBe('searchbox');
      expect(input.hasAttribute('role')).toBe(false);
      expect(input.hasAttribute('aria-expanded')).toBe(false);
      expect(input.hasAttribute('aria-controls')).toBe(false);
      expect(input.hasAttribute('aria-activedescendant')).toBe(false);
      expect(input.hasAttribute('aria-autocomplete')).toBe(false);
    });

    it('forwards the combobox role and aria wiring to the native input', () => {
      fixture.componentRef.setInput('role', 'combobox');
      fixture.componentRef.setInput('ariaControls', 'suggestion-listbox');
      fixture.componentRef.setInput(
        'ariaActiveDescendant',
        'suggestion-listbox-option-2',
      );
      fixture.componentRef.setInput('ariaAutocomplete', 'list');
      fixture.componentRef.setInput('ariaExpanded', true);
      fixture.detectChanges();

      const input = nativeInput();

      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-controls')).toBe('suggestion-listbox');
      expect(input.getAttribute('aria-activedescendant')).toBe(
        'suggestion-listbox-option-2',
      );
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
      expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('emits navigate for every option key and consumes only the caret stealers', () => {
      fixture.componentRef.setInput('role', 'combobox');
      fixture.detectChanges();
      const navigations = vi.fn();
      component.navigate.subscribe(navigations);

      const down = press('ArrowDown');
      expect(navigations).toHaveBeenCalledTimes(1);
      expect(navigations).toHaveBeenLastCalledWith({
        direction: 'down',
        event: down,
      });
      expect(down.defaultPrevented).toBe(true);

      expect(press('ArrowUp').defaultPrevented).toBe(true);
      expect(press('PageDown').defaultPrevented).toBe(true);
      expect(press('PageUp').defaultPrevented).toBe(true);

      // Home/End stay caret keys in an editable combobox, so they are reported
      // without being consumed.
      const home = press('Home');
      expect(home.defaultPrevented).toBe(false);
      const end = press('End');
      expect(end.defaultPrevented).toBe(false);

      expect(navigations.mock.calls.map(([e]) => e.direction)).toEqual([
        'down',
        'up',
        'pageDown',
        'pageUp',
        'home',
        'end',
      ]);
    });

    it('stays silent on navigation keys while the role is a plain searchbox', () => {
      const navigations = vi.fn();
      component.navigate.subscribe(navigations);

      const down = press('ArrowDown');

      expect(navigations).not.toHaveBeenCalled();
      expect(down.defaultPrevented).toBe(false);
    });

    it('emits commit from Enter in live mode without disturbing the debounce', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('role', 'combobox');
      fixture.detectChanges();
      const commits = vi.fn();
      const searches = vi.fn();
      component.commit.subscribe(commits);
      component.search.subscribe(searches);

      type('atl');
      const enter = press('Enter');

      expect(commits).toHaveBeenCalledTimes(1);
      expect(commits).toHaveBeenLastCalledWith({ value: 'atl', event: enter });
      // Live mode never committed from Enter and still does not.
      expect(enter.defaultPrevented).toBe(false);
      expect(searches).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(searches).toHaveBeenLastCalledWith('atl');
    });

    it('emits commit before a submit-mode search and from the submit action', () => {
      fixture.componentRef.setInput('trigger', 'submit');
      fixture.detectChanges();
      const order: string[] = [];
      const commits = vi.fn(() => order.push('commit'));
      component.commit.subscribe(commits);
      component.search.subscribe(() => order.push('search'));

      type('invoices');
      press('Enter');

      expect(order).toEqual(['commit', 'search']);

      const submit = host.querySelector(
        'button[aria-label="Submit search"]',
      ) as HTMLButtonElement;
      submit.click();
      fixture.detectChanges();

      expect(order).toEqual(['commit', 'search', 'commit', 'search']);
      const [payload] = commits.mock.lastCall as [
        { value: string; event: Event },
      ];
      expect(payload.value).toBe('invoices');
      expect(payload.event).toBeInstanceOf(MouseEvent);
    });

    it('lets a commit consumer take over by preventing the event', () => {
      fixture.componentRef.setInput('trigger', 'submit');
      fixture.componentRef.setInput('role', 'combobox');
      fixture.detectChanges();
      const searches = vi.fn();
      component.search.subscribe(searches);
      component.commit.subscribe(({ event }) => event.preventDefault());

      type('atlas');
      const enter = press('Enter');

      // The consumer resolved the active option; no plain search runs, and the
      // key is still consumed so a surrounding form is not submitted.
      expect(searches).not.toHaveBeenCalled();
      expect(enter.defaultPrevented).toBe(true);

      const submit = host.querySelector(
        'button[aria-label="Submit search"]',
      ) as HTMLButtonElement;
      submit.click();
      fixture.detectChanges();

      expect(searches).not.toHaveBeenCalled();
    });

    it('never offers a commit the field itself would ignore', async () => {
      const commits = vi.fn();
      component.commit.subscribe(commits);

      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      press('Enter');
      expect(commits).not.toHaveBeenCalled();

      fixture.componentRef.setInput('loading', false);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      press('Enter');
      expect(commits).not.toHaveBeenCalled();

      // An overlay trigger opens a dialog on Enter; there is nothing to commit.
      fixture.componentRef.setInput('disabled', false);
      fixture.componentRef.setInput('overlay', true);
      fixture.detectChanges();
      await fixture.whenStable();
      press('Enter');
      await fixture.whenStable();

      expect(commits).not.toHaveBeenCalled();
      expect(component.opened()).toBe(true);

      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((element) => element.remove());
    });
  });

  describe('overlay search', () => {
    const overlayPanel = (): HTMLElement | null =>
      document.querySelector('.mlv-search-field__overlay');

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((element) => element.remove());
    });

    async function open(inputs: Record<string, unknown>): Promise<void> {
      for (const [key, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(key, value);
      }
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('stays inline and editable by default', async () => {
      expect(nativeInput().readOnly).toBe(false);

      nativeInput().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.opened()).toBe(false);
      expect(overlayPanel()).toBeNull();
    });

    it('renders an icon-only trigger and no inline input', async () => {
      await open({ presentation: 'icon' });

      const trigger = host.querySelector(
        '.mlv-search-field__trigger-icon',
      ) as HTMLButtonElement;

      expect(trigger).not.toBeNull();
      expect(host.querySelector('input')).toBeNull();
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('opens a modal overlay from the icon trigger', async () => {
      await open({ presentation: 'icon' });

      (
        host.querySelector(
          '.mlv-search-field__trigger-icon',
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      const panel = overlayPanel();
      expect(component.opened()).toBe(true);
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute('role')).toBe('dialog');
      expect(panel?.getAttribute('aria-modal')).toBe('true');
    });

    it('makes the inline input a read-only trigger that opens on click', async () => {
      await open({ overlay: true });

      expect(nativeInput().readOnly).toBe(true);
      expect(nativeInput().getAttribute('aria-haspopup')).toBe('dialog');

      nativeInput().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.opened()).toBe(true);
      expect(overlayPanel()).not.toBeNull();
    });

    it('opens the inline trigger from Enter and Space, not from focus', async () => {
      await open({ overlay: true });

      // Focus alone must not open: a keyboard user tabbing past the field would
      // otherwise be dropped into a modal dialog.
      nativeInput().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.opened()).toBe(false);

      nativeInput().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.opened()).toBe(true);

      component.close();
      component.onAnimationEnd();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.opened()).toBe(false);

      const space = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      nativeInput().dispatchEvent(space);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.opened()).toBe(true);
      // Space on the trigger must not also scroll the page.
      expect(space.defaultPrevented).toBe(true);
    });

    it('traps focus inside the modal overlay', async () => {
      await open({ presentation: 'icon' });

      (
        host.querySelector(
          '.mlv-search-field__trigger-icon',
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      // `aria-modal="true"` is only truthful with a real focus trap, the same
      // guarantee mlv-dialog and mlv-drawer make. CDK inserts its anchors as
      // siblings of the trapped element, so assert on the containing pane.
      const panel = overlayPanel() as HTMLElement;
      expect(panel.getAttribute('aria-modal')).toBe('true');
      expect(
        panel.parentElement?.querySelectorAll('.cdk-focus-trap-anchor').length,
      ).toBe(2);
    });

    it('routes overlay typing through the same value model', async () => {
      await open({ overlay: true, trigger: 'live', debounce: 0 });
      const emitted: string[] = [];
      component.search.subscribe((query) => emitted.push(query));

      component.open();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlayInput = document.querySelector(
        '.mlv-search-field__overlay input',
      ) as HTMLInputElement;
      overlayInput.value = 'atlas';
      overlayInput.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      expect(component.value()).toBe('atlas');
      expect(emitted).toEqual(['atlas']);
    });

    it('stays closed when closing restores focus to the inline trigger', async () => {
      await open({ overlay: true });

      nativeInput().click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.opened()).toBe(true);

      component.close();
      fixture.detectChanges();
      // The overlay is disposed at the end of its leave animation, and disposal
      // is what restores focus to the trigger.
      component.onAnimationEnd();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.opened()).toBe(false);
      expect(overlayPanel()).toBeNull();
    });

    it('clears from the inline trigger without opening the overlay', async () => {
      await open({ overlay: true });
      component.value.set('beacon');
      fixture.detectChanges();

      // The clear button sits inside the input's own subtree, so its click
      // bubbles through the trigger handlers.
      (
        host.querySelector('mlv-button-close button') as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.value()).toBe('');
      expect(component.opened()).toBe(false);
      expect(overlayPanel()).toBeNull();
    });

    it('drops the submit action on an overlay trigger', async () => {
      await open({ overlay: true, trigger: 'submit' });

      expect(host.querySelector('.mlv-search-field__submit')).toBeNull();
      expect(
        host.querySelector('.mlv-search-field__leading-icon'),
      ).not.toBeNull();
    });

    it('fills the overlay with a nested search field and no submit button', async () => {
      await open({ overlay: true, trigger: 'submit' });

      component.open();
      fixture.detectChanges();
      await fixture.whenStable();

      const panel = overlayPanel() as HTMLElement;

      expect(panel.querySelector('mlv-search-field')).not.toBeNull();
      expect(panel.querySelector('.mlv-search-field__submit')).toBeNull();
      // No trailing submit action, so the glyph moves to the leading edge.
      expect(
        panel.querySelector('.mlv-search-field__leading-icon'),
      ).not.toBeNull();
    });

    it('commits and closes when Enter is pressed inside the overlay', async () => {
      await open({ overlay: true, trigger: 'submit' });
      const searches = vi.fn();
      component.search.subscribe(searches);

      component.open();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlayInput = document.querySelector(
        '.mlv-search-field__overlay input',
      ) as HTMLInputElement;
      overlayInput.value = 'atlas';
      overlayInput.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      overlayInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(searches).toHaveBeenCalledWith('atlas');
      expect(component.opened()).toBe(false);
    });

    it('presentation="icon" implies overlay without setting the input', async () => {
      await open({ presentation: 'icon' });

      expect(component.overlay()).toBe(false);

      (
        host.querySelector(
          '.mlv-search-field__trigger-icon',
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(overlayPanel()).not.toBeNull();
    });
  });
});
