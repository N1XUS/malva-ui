import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvViewVariantStatus, type MlvViewVariant } from '../../index';

type ViewState = Readonly<{ search: string }>;

const lockedSystemVariant: MlvViewVariant<ViewState> = {
  id: 'system',
  name: 'System risk',
  scope: 'system',
  state: { search: 'risk' },
  locked: true,
  capabilities: {
    clone: true,
    update: false,
    rename: false,
    delete: false,
    share: false,
  },
};

const editablePersonalVariant: MlvViewVariant<ViewState> = {
  id: 'personal',
  name: 'My accounts',
  scope: 'personal',
  state: { search: 'accounts' },
  capabilities: {
    clone: true,
    update: true,
    rename: true,
    delete: true,
    share: true,
  },
};

describe('MlvViewVariantStatus', () => {
  let fixture: ComponentFixture<MlvViewVariantStatus<ViewState>>;
  let host: HTMLElement;

  const actionLabels = (): string[] =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].map(
      (button) => button.textContent?.trim() ?? '',
    );

  const buttonNamed = (name: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvViewVariantStatus],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvViewVariantStatus<ViewState>);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows only actions allowed by the active locked variant', () => {
    fixture.componentRef.setInput('variant', lockedSystemVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.detectChanges();

    expect(actionLabels()).toEqual(['Reset changes', 'Duplicate view']);
  });

  it('keeps its BEM block class on an empty host for a clean editable variant', () => {
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', false);
    fixture.detectChanges();

    expect(host.classList.contains('mlv-view-variant-status')).toBe(true);
    expect(host.querySelector('.mlv-view-variant-status__surface')).toBeNull();
  });

  it('renders reset, update, and save-as-new only for a dirty editable view', () => {
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput('canCreate', true);
    fixture.detectChanges();

    expect(actionLabels()).toEqual([
      'Reset changes',
      'Update view',
      'Save as new',
    ]);
  });

  it('isolates busy state to the matching operation', () => {
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput('canCreate', true);
    fixture.componentRef.setInput('busyAction', {
      action: 'update',
      variantId: 'personal',
    });
    fixture.detectChanges();

    const updated = vi.fn();
    fixture.componentInstance.updateRequest.subscribe(updated);
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    // A loading mlvButton is announced inert but stays focusable (#324): no
    // native `disabled`, so a button focused when its action starts keeps
    // focus. `aria-disabled` is what isolates the busy one.
    expect(
      buttons.map((button) => button.getAttribute('aria-disabled')),
    ).toEqual([null, 'true', null]);
    expect(buttons.map((button) => button.disabled)).toEqual([
      false,
      false,
      false,
    ]);
    expect(
      host.querySelector('button:nth-of-type(2) mlv-loader'),
    ).not.toBeNull();
    expect(
      host
        .querySelector('.mlv-view-variant-status__surface')
        ?.getAttribute('aria-busy'),
    ).toBe('true');
    buttonNamed('Update view')?.click();
    expect(updated).not.toHaveBeenCalled();
  });

  it('emits reset even while the separate update operation is busy', () => {
    const reset = vi.fn();
    fixture.componentInstance.resetRequest.subscribe(reset);
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput('busyAction', {
      action: 'update',
      variantId: 'personal',
    });
    fixture.detectChanges();

    buttonNamed('Reset changes')?.click();

    expect(reset).toHaveBeenCalledOnce();
  });

  it('does not mark the status surface busy for an unrelated row operation', () => {
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput('busyAction', {
      action: 'rename',
      variantId: 'personal',
    });
    fixture.detectChanges();

    expect(
      host
        .querySelector('.mlv-view-variant-status__surface')
        ?.getAttribute('aria-busy'),
    ).toBeNull();
  });

  it('renders failures as a polite status with retry and dismiss actions', () => {
    fixture.componentRef.setInput('errorMessage', 'Could not save this view');
    fixture.detectChanges();

    const error = host.querySelector('.mlv-view-variant-status__error');
    expect(error?.getAttribute('role')).toBe('status');
    expect(error?.getAttribute('aria-live')).toBe('polite');
    expect(actionLabels()).toEqual(['Retry', 'Dismiss']);
  });

  it('emits clone for a permitted locked view and never emits a denied update', () => {
    const cloned = vi.fn();
    const updated = vi.fn();
    fixture.componentInstance.cloneRequest.subscribe(cloned);
    fixture.componentInstance.updateRequest.subscribe(updated);
    fixture.componentRef.setInput('variant', lockedSystemVariant);
    fixture.componentRef.setInput('dirty', false);
    fixture.detectChanges();

    buttonNamed('Duplicate view')?.click();

    expect(cloned).toHaveBeenCalledWith(lockedSystemVariant);
    expect(buttonNamed('Update view')).toBeUndefined();
    expect(updated).not.toHaveBeenCalled();
  });

  it('emits update and save-as-new from a dirty editable view', () => {
    const updated = vi.fn();
    const created = vi.fn();
    fixture.componentInstance.updateRequest.subscribe(updated);
    fixture.componentInstance.createRequest.subscribe(created);
    fixture.componentRef.setInput('variant', editablePersonalVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput('canCreate', true);
    fixture.detectChanges();

    buttonNamed('Update view')?.click();
    buttonNamed('Save as new')?.click();

    expect(updated).toHaveBeenCalledWith(editablePersonalVariant);
    expect(created).toHaveBeenCalledOnce();
  });

  it('emits retry and dismiss from the visible error controls', () => {
    const retried = vi.fn();
    const dismissed = vi.fn();
    fixture.componentInstance.retryRequest.subscribe(retried);
    fixture.componentInstance.dismissError.subscribe(dismissed);
    fixture.componentRef.setInput('errorMessage', 'Could not save this view');
    fixture.detectChanges();

    buttonNamed('Retry')?.click();
    buttonNamed('Dismiss')?.click();

    expect(retried).toHaveBeenCalledOnce();
    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations for locked dirty and error states', async () => {
    fixture.componentRef.setInput('variant', lockedSystemVariant);
    fixture.componentRef.setInput('dirty', true);
    fixture.componentRef.setInput(
      'errorMessage',
      'Could not duplicate this view',
    );
    fixture.detectChanges();

    await expectNoAxeViolations(host);
  });
});
