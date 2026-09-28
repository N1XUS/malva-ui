import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvToastService } from '@malva-ui/core/toast';
import { vi } from 'vitest';
import { MlvNotificationService } from './notification.service';

/**
 * A toast service scoped to one component: destroyed with it, while the root
 * notification service lives on beside it in the same stack.
 */
@Component({
  selector: 'test-scoped-toast-host',
  template: '',
  providers: [MlvToastService],
})
class ScopedToastHost {
  readonly toast = inject(MlvToastService);
}

/** Every CDK overlay pane in the document. */
function panes(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.cdk-overlay-pane'),
  );
}

/** Waits past the 200 ms leave delay before an empty stack's pane is disposed. */
function afterLeaveDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

describe('toast and notification share one stack per position (#362)', () => {
  let toast: MlvToastService;
  let notification: MlvNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    toast = TestBed.inject(MlvToastService);
    notification = TestBed.inject(MlvNotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  async function stabilize(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('renders a toast and a notification at the default position as siblings in one pane', async () => {
    toast.info('Two files saved', { displayTime: 0 });
    notification.info('Release ready', { displayTime: 0 });
    await stabilize();

    // One pane, so neither item sits under the other's pane: both are
    // wrappers in one flex column, which lays them out one below the other.
    expect(panes().length).toBe(1);
    expect(
      document.querySelectorAll('.mlv-toast-panel--top-right').length,
    ).toBe(1);
    expect(document.querySelectorAll('mlv-toast-container').length).toBe(1);

    const [pane] = panes();
    const toastWrapper = pane
      .querySelector('mlv-toast-item')
      ?.closest('.mlv-toast-item-wrapper');
    const notificationWrapper = pane
      .querySelector('mlv-notification-item')
      ?.closest('.mlv-toast-item-wrapper');
    expect(toastWrapper).toBeTruthy();
    expect(notificationWrapper).toBeTruthy();
    expect(toastWrapper?.parentElement).toBe(
      notificationWrapper?.parentElement,
    );
    expect(toastWrapper?.parentElement?.tagName).toBe('MLV-TOAST-CONTAINER');
  });

  it('keeps the pane classes a single service stamps', async () => {
    toast.info('Two files saved', { displayTime: 0 });
    notification.info('Release ready', { displayTime: 0 });
    await stabilize();

    expect(Array.from(panes()[0].classList)).toEqual([
      'cdk-overlay-pane',
      'mlv-toast-panel',
      'mlv-toast-panel--top-right',
    ]);
  });

  it('orders a top stack newest first across both services', async () => {
    toast.info('First', { displayTime: 0 });
    notification.info('Second', { displayTime: 0 });
    toast.info('Third', { displayTime: 0 });
    await stabilize();

    const tags = Array.from(
      document.querySelectorAll('.mlv-toast-item-wrapper > *'),
    ).map((item) => item.tagName.toLowerCase());
    expect(tags).toEqual([
      'mlv-toast-item',
      'mlv-notification-item',
      'mlv-toast-item',
    ]);
    expect(
      document.querySelector('.mlv-toast-item-wrapper')?.textContent,
    ).toContain('Third');
  });

  it('orders a bottom stack newest last across both services', async () => {
    notification.info('First', { position: 'bottom-right', displayTime: 0 });
    toast.info('Second', { position: 'bottom-right', displayTime: 0 });
    await stabilize();

    const tags = Array.from(
      document.querySelectorAll('.mlv-toast-item-wrapper > *'),
    ).map((item) => item.tagName.toLowerCase());
    expect(tags).toEqual(['mlv-notification-item', 'mlv-toast-item']);
    expect(panes().length).toBe(1);
  });

  it('gives every item in a shared stack its own id', () => {
    const toastRef = toast.info('Two files saved', { displayTime: 0 });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });

    expect(toastRef.id).toBe('toast-1');
    expect(notificationRef.id).toBe('toast-2');
  });

  it("does not close another service's item by its id", async () => {
    const toastRef = toast.info('Two files saved', { displayTime: 0 });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });

    toast.close(notificationRef.id);
    notification.close(toastRef.id);
    await stabilize();

    expect(toastRef.closed()).toBe(false);
    expect(notificationRef.closed()).toBe(false);
    expect(document.querySelector('mlv-toast-item')).not.toBeNull();
    expect(document.querySelector('mlv-notification-item')).not.toBeNull();
  });

  it('routes each dismiss button to the service that owns the item', async () => {
    const toastRef = toast.info('Two files saved', { displayTime: 0 });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });
    await stabilize();

    document
      .querySelector<HTMLButtonElement>('mlv-notification-item button')
      ?.click();
    expect(notificationRef.closed()).toBe(true);
    expect(toastRef.closed()).toBe(false);

    document.querySelector<HTMLButtonElement>('mlv-toast-item button')?.click();
    expect(toastRef.closed()).toBe(true);
  });

  it("closing one service's item leaves the other's, and the pane goes once both are empty", async () => {
    const toastRef = toast.info('Two files saved', { displayTime: 0 });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });
    await stabilize();

    toastRef.close();
    await afterLeaveDelay();
    await stabilize();

    expect(notificationRef.closed()).toBe(false);
    expect(panes().length).toBe(1);
    expect(panes()[0].querySelector('mlv-notification-item')).not.toBeNull();
    expect(panes()[0].querySelector('mlv-toast-item')).toBeNull();

    notificationRef.close();
    await afterLeaveDelay();

    expect(panes().length).toBe(0);
    expect(document.querySelector('.mlv-toast-panel')).toBeNull();
  });

  it('keeps the shared pane when the other service shows during the leave delay', async () => {
    const toastRef = toast.info('Two files saved', { displayTime: 0 });
    await stabilize();
    const [pane] = panes();
    vi.useFakeTimers();

    // t0: the toast leaves the stack empty, so its disposal is due at t200.
    toastRef.close();
    vi.advanceTimersByTime(100);
    // t100: the notification joins, which must cancel that disposal ...
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });
    vi.advanceTimersByTime(50);
    // t150: ... because once it leaves, its own disposal is due at t350.
    notificationRef.close();
    vi.advanceTimersByTime(100);

    // t250: the same pane, still up for the notification's leave animation.
    // A disposal left pending from t0 would have fired at t200 and found the
    // stack empty again — the check at fire time cannot tell the two leaves
    // apart, so only the cancel on join keeps the pane here.
    expect(panes()).toEqual([pane]);
    expect(pane.isConnected).toBe(true);

    // t400: past the notification's own delay, the pane is gone.
    vi.advanceTimersByTime(150);
    expect(pane.isConnected).toBe(false);
    expect(panes()).toEqual([]);
  });

  it('removes only its own items when a component-scoped service is destroyed', async () => {
    const fixture = TestBed.createComponent(ScopedToastHost);
    const scopedRef = fixture.componentInstance.toast.info('Scoped toast', {
      displayTime: 0,
    });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });
    await stabilize();
    expect(panes().length).toBe(1);

    fixture.destroy();
    await afterLeaveDelay();
    await stabilize();

    expect(scopedRef.closed()).toBe(true);
    expect(notificationRef.closed()).toBe(false);
    expect(panes().length).toBe(1);
    expect(panes()[0].querySelector('mlv-notification-item')).not.toBeNull();
    expect(panes()[0].querySelector('mlv-toast-item')).toBeNull();
  });

  it("keeps a root pane through another service's leave when a scoped service is destroyed", async () => {
    const fixture = TestBed.createComponent(ScopedToastHost);
    fixture.componentInstance.toast.info('Scoped toast', { displayTime: 0 });
    const notificationRef = notification.info('Release ready', {
      displayTime: 0,
    });
    await stabilize();
    const [pane] = panes();
    vi.useFakeTimers();

    // t0: the notification leaves; the scoped toast still holds the stack,
    // so nothing is scheduled yet.
    notificationRef.close();
    vi.advanceTimersByTime(50);
    // t50: the scope goes while the notification is still fading out. The
    // stack is root-keyed, so emptying it schedules the disposal rather than
    // cutting the notification's leave animation short.
    fixture.destroy();
    vi.advanceTimersByTime(100);

    // t150: still up.
    expect(pane.isConnected).toBe(true);

    // t300: past the delay the destroy scheduled, the pane is gone.
    vi.advanceTimersByTime(150);
    expect(pane.isConnected).toBe(false);
    expect(panes()).toEqual([]);
  });

  it('keeps items at different positions in separate panes', async () => {
    toast.info('Two files saved', { displayTime: 0 });
    notification.info('Release ready', {
      position: 'bottom-left',
      displayTime: 0,
    });
    await stabilize();

    expect(panes().length).toBe(2);
    expect(
      document.querySelector('.mlv-toast-panel--top-right mlv-toast-item'),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '.mlv-toast-panel--bottom-left mlv-notification-item',
      ),
    ).not.toBeNull();
  });

  it('mirrors a shared pane under a document-level RTL direction', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    toast.info('Two files saved', { displayTime: 0 });
    notification.info('Release ready', { displayTime: 0 });
    await stabilize();

    expect(panes().length).toBe(1);
    // CDK writes the config's direction on the overlay's host element, the
    // pane's parent's parent under a global position strategy.
    expect(panes()[0].closest('[dir]')?.getAttribute('dir')).toBe('rtl');
  });

  it('has no axe violations with a toast and a notification in one pane', async () => {
    toast.success('Two files saved', { displayTime: 0 });
    notification.show({
      title: 'Release ready',
      description: 'Version 4.2.0 passed all checks.',
      tone: 'success',
      actions: [{ label: 'Open release', action: () => undefined }],
      displayTime: 0,
    });
    await stabilize();

    await expectNoAxeViolations(document.body);
  });
});
