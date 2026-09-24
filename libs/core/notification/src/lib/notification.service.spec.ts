import { ApplicationRef, Component, inject, viewChild } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MlvToastService } from '@malva-ui/core/toast';
import { vi } from 'vitest';
import { MlvNotificationRef } from './notification-ref';
import { MlvNotificationService } from './notification.service';
import {
  NOTIFICATION_DATA,
  type MlvNotificationTemplateContext,
} from './notification.types';

interface NotificationData {
  label: string;
}

@Component({
  selector: 'test-notification-component-content',
  template: `
    <span class="notification-component-ref-data">{{ ref.data.label }}</span>
    <span class="notification-component-token-data">{{ tokenData.label }}</span>
  `,
})
class NotificationComponentContent {
  readonly ref = inject(MlvNotificationRef<NotificationData>);
  readonly tokenData = inject(NOTIFICATION_DATA) as NotificationData;
}

@Component({
  template: `
    <ng-template #content let-ref let-data="data">
      <span class="notification-template-ref-data">{{ ref.data.label }}</span>
      <span class="notification-template-context-data">{{ data.label }}</span>
      <button class="notification-template-close" (click)="ref.close()">
        Close
      </button>
    </ng-template>
  `,
})
class NotificationTemplateHost {
  readonly content =
    viewChild.required<
      TemplateRef<MlvNotificationTemplateContext<NotificationData>>
    >('content');
}

describe('MlvNotificationService', () => {
  let service: MlvNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvNotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  async function stabilize(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  describe('live-region announcement', () => {
    it('announces title, description, and action labels', async () => {
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

      service.show({
        title: 'Deployment finished',
        description: 'Build 4821 is live.',
        tone: 'success',
        actions: [{ label: 'View log', action: () => undefined }],
        displayTime: 0,
      });
      await stabilize();

      // The action label matters: notifications never take focus, so a
      // screen-reader user has to be told an action exists.
      expect(announce).toHaveBeenCalledWith(
        'Deployment finished. Build 4821 is live. View log',
        'polite',
      );
    });

    it('announces assertively for the danger tone', async () => {
      const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

      service.show({ title: 'Deploy failed', tone: 'danger', displayTime: 0 });
      await stabilize();

      expect(announce).toHaveBeenCalledWith('Deploy failed', 'assertive');
    });
  });

  describe('announcements pending together (#336)', () => {
    /** The single CDK live region every notification and toast announces through. */
    function liveRegion(): HTMLElement {
      const region = document.querySelector<HTMLElement>(
        '.cdk-live-announcer-element',
      );
      if (!region) {
        throw new Error('LiveAnnouncer has not created its live region');
      }
      return region;
    }

    /** Waits past `LiveAnnouncer`'s 100 ms write delay. */
    function afterWrite(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 150));
    }

    it('announces two notifications shown in the same tick, the assertive one first', async () => {
      const region = liveRegion();

      service.success('Build 4821 is live', { displayTime: 0 });
      service.error('Deploy failed', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Deploy failed. Build 4821 is live');
      expect(region.getAttribute('aria-live')).toBe('assertive');
    });

    it('shares one announcement with a toast shown in the same tick', async () => {
      const region = liveRegion();

      TestBed.inject(MlvToastService).success('Two files saved', {
        displayTime: 0,
      });
      service.error('Deploy failed', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Deploy failed. Two files saved');
      expect(region.getAttribute('aria-live')).toBe('assertive');
    });
  });

  it('opens string content as escaped text', async () => {
    const content = '<img src=x onerror="alert(1)">Notification text';

    service.open(content, {
      displayTime: 0,
      closable: false,
      showIcon: false,
    });
    await stabilize();

    const title = document.querySelector('.mlv-notification-item__title');
    expect(title?.textContent).toBe(content);
    expect(title?.querySelector('img')).toBeNull();
  });

  it('opens template content with its ref and data context', async () => {
    const fixture: ComponentFixture<NotificationTemplateHost> =
      TestBed.createComponent(NotificationTemplateHost);
    fixture.detectChanges();

    service.open(fixture.componentInstance.content(), {
      data: { label: 'Template notification' },
      displayTime: 0,
      closable: false,
      showIcon: false,
    });
    await stabilize();

    expect(
      document
        .querySelector('.notification-template-ref-data')
        ?.textContent?.trim(),
    ).toBe('Template notification');
    expect(
      document
        .querySelector('.notification-template-context-data')
        ?.textContent?.trim(),
    ).toBe('Template notification');
  });

  it('opens component content with MlvNotificationRef and NOTIFICATION_DATA', async () => {
    service.open(NotificationComponentContent, {
      data: { label: 'Component notification' },
      displayTime: 0,
      closable: false,
      showIcon: false,
    });
    await stabilize();

    expect(
      document
        .querySelector('.notification-component-ref-data')
        ?.textContent?.trim(),
    ).toBe('Component notification');
    expect(
      document
        .querySelector('.notification-component-token-data')
        ?.textContent?.trim(),
    ).toBe('Component notification');
  });

  it('makes repeated ref close requests idempotent', () => {
    vi.useFakeTimers();
    const closeSpy = vi.spyOn(service, 'close');
    const ref = service.open('Idempotent notification', {
      displayTime: 0,
      closable: false,
      showIcon: false,
    });
    const afterClosed = vi.fn();
    ref.afterClosed().subscribe(afterClosed);

    ref.close();
    ref.close();

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(afterClosed).toHaveBeenCalledOnce();
    expect(ref.closed()).toBe(true);
    vi.advanceTimersByTime(200);
  });

  it('keeps the final overlay through the leave delay when the item closes itself', async () => {
    const ref = service.open('Closable notification', {
      displayTime: 0,
      showIcon: false,
    });
    await stabilize();
    vi.useFakeTimers();

    (
      document.querySelector(
        '.mlv-notification-item button',
      ) as HTMLButtonElement | null
    )?.click();

    expect(ref.closed()).toBe(true);
    expect(document.querySelector('.mlv-toast-panel')).not.toBeNull();
    vi.advanceTimersByTime(199);
    expect(document.querySelector('.mlv-toast-panel')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('.mlv-toast-panel')).toBeNull();
  });

  it('keeps the final overlay through the leave delay when closed by the service', () => {
    vi.useFakeTimers();
    const ref = service.open('Service-close notification', {
      displayTime: 0,
      closable: false,
      showIcon: false,
    });

    service.close(ref.id);

    expect(ref.closed()).toBe(true);
    expect(document.querySelector('.mlv-toast-panel')).not.toBeNull();
    vi.advanceTimersByTime(199);
    expect(document.querySelector('.mlv-toast-panel')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('.mlv-toast-panel')).toBeNull();
    expect(document.querySelector('.cdk-overlay-pane')).toBeNull();
  });
});
