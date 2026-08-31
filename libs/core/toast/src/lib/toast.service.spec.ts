import { ApplicationRef, Component, inject, viewChild } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { vi } from 'vitest';
import { MlvToastRef } from './toast-ref';
import { MlvToastService } from './toast.service';
import { TOAST_DATA, type MlvToastTemplateContext } from './toast.types';

interface ToastData {
  label: string;
}

@Component({
  selector: 'test-toast-component-content',
  template: `
    <span class="toast-component-ref-data">{{ ref.data.label }}</span>
    <span class="toast-component-token-data">{{ tokenData.label }}</span>
  `,
})
class ToastComponentContent {
  readonly ref = inject(MlvToastRef<ToastData>);
  readonly tokenData = inject(TOAST_DATA) as ToastData;
}

@Component({
  template: `
    <ng-template #content let-ref let-data="data">
      <span class="toast-template-ref-data">{{ ref.data.label }}</span>
      <span class="toast-template-context-data">{{ data.label }}</span>
      <button class="toast-template-close" (click)="ref.close()">Close</button>
    </ng-template>
  `,
})
class ToastTemplateHost {
  readonly content =
    viewChild.required<TemplateRef<MlvToastTemplateContext<ToastData>>>(
      'content',
    );
}

describe('MlvToastService', () => {
  let service: MlvToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvToastService);
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

  it('opens string content as escaped text', async () => {
    const content = '<img src=x onerror="alert(1)">Toast text';

    service.open(content, { displayTime: 0, closable: false });
    await stabilize();

    const title = document.querySelector('.mlv-toast-item__title');
    expect(title?.textContent).toBe(content);
    expect(title?.querySelector('img')).toBeNull();
  });

  describe('live-region announcement', () => {
    function announceSpy() {
      return vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');
    }

    it('announces title and description politely for a low-urgency tone', async () => {
      const announce = announceSpy();

      service.show({
        title: 'Changes saved',
        description: 'Your profile is up to date.',
        tone: 'success',
        displayTime: 0,
      });
      await stabilize();

      expect(announce).toHaveBeenCalledWith(
        'Changes saved. Your profile is up to date',
        'polite',
      );
    });

    it('announces assertively for danger and warning tones', async () => {
      const announce = announceSpy();

      service.show({ title: 'Upload failed', tone: 'danger', displayTime: 0 });
      await stabilize();

      expect(announce).toHaveBeenCalledWith('Upload failed', 'assertive');
    });

    it('honours an explicit politeness override', async () => {
      const announce = announceSpy();

      service.show({
        title: 'Upload failed',
        tone: 'danger',
        politeness: 'polite',
        displayTime: 0,
      });
      await stabilize();

      expect(announce).toHaveBeenCalledWith('Upload failed', 'polite');
    });

    it('omits an absent description rather than announcing a stray separator', async () => {
      const announce = announceSpy();

      service.show({ title: 'Saved', displayTime: 0 });
      await stabilize();

      expect(announce).toHaveBeenCalledWith('Saved', 'polite');
    });

    it('announces nothing for template content, which owns its own text', async () => {
      const fixture: ComponentFixture<ToastTemplateHost> =
        TestBed.createComponent(ToastTemplateHost);
      fixture.detectChanges();
      const announce = announceSpy();

      service.open(fixture.componentInstance.content(), {
        data: { label: 'sync' },
        displayTime: 0,
      });
      await stabilize();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  it('defaults to the rectangular shape and no icon', async () => {
    service.show({ title: 'Saved', tone: 'success', displayTime: 0 });
    await stabilize();

    const item = document.querySelector('.mlv-toast-item');
    expect(item?.classList.contains('mlv-toast-item--pill')).toBe(false);
    expect(document.querySelector('.mlv-toast-item__icon')).toBeNull();
  });

  it('renders the pill shape and the tone icon when requested', async () => {
    service.show({
      title: 'Saved',
      tone: 'success',
      shape: 'pill',
      icon: true,
      displayTime: 0,
    });
    await stabilize();

    const item = document.querySelector('.mlv-toast-item');
    expect(item?.classList.contains('mlv-toast-item--pill')).toBe(true);
    expect(document.querySelector('.mlv-toast-item__icon')).not.toBeNull();
  });

  it('suppresses the built-in icon for template content even when icon is true', async () => {
    const fixture: ComponentFixture<ToastTemplateHost> =
      TestBed.createComponent(ToastTemplateHost);
    fixture.detectChanges();

    service.open(fixture.componentInstance.content(), {
      data: { label: 'sync' },
      tone: 'success',
      icon: true,
      displayTime: 0,
    });
    await stabilize();

    expect(document.querySelector('.mlv-toast-item__icon')).toBeNull();
    expect(
      document.querySelector('.mlv-toast-item__dynamic-content'),
    ).not.toBeNull();
  });

  it('opens template content with its ref and data context', async () => {
    const fixture: ComponentFixture<ToastTemplateHost> =
      TestBed.createComponent(ToastTemplateHost);
    fixture.detectChanges();

    service.open(fixture.componentInstance.content(), {
      data: { label: 'Template toast' },
      displayTime: 0,
      closable: false,
    });
    await stabilize();

    expect(
      document.querySelector('.toast-template-ref-data')?.textContent?.trim(),
    ).toBe('Template toast');
    expect(
      document
        .querySelector('.toast-template-context-data')
        ?.textContent?.trim(),
    ).toBe('Template toast');
  });

  it('opens component content with MlvToastRef and TOAST_DATA', async () => {
    service.open(ToastComponentContent, {
      data: { label: 'Component toast' },
      displayTime: 0,
      closable: false,
    });
    await stabilize();

    expect(
      document.querySelector('.toast-component-ref-data')?.textContent?.trim(),
    ).toBe('Component toast');
    expect(
      document
        .querySelector('.toast-component-token-data')
        ?.textContent?.trim(),
    ).toBe('Component toast');
  });

  it('makes repeated ref close requests idempotent', () => {
    vi.useFakeTimers();
    const closeSpy = vi.spyOn(service, 'close');
    const ref = service.open('Idempotent toast', {
      displayTime: 0,
      closable: false,
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
    const ref = service.open('Closable toast', { displayTime: 0 });
    await stabilize();
    vi.useFakeTimers();

    (
      document.querySelector(
        '.mlv-toast-item button',
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
    const ref = service.open('Service-close toast', {
      displayTime: 0,
      closable: false,
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

  describe('sticky-chrome clearance', () => {
    function container(): HTMLElement {
      return document.querySelector('mlv-toast-container') as HTMLElement;
    }

    it('offsets a bottom stack by the sticky page dock height', async () => {
      service.open('Saved', { position: 'bottom-center', displayTime: 0 });
      await stabilize();

      // Bottom toasts render in the CDK overlay above a sticky
      // `mlv-page-dock`, which publishes `--mlv-page-dock-height` on the
      // document root. The block-end inset defaults to it, so Save/Discard is
      // never covered without the consumer wiring anything up.
      expect(
        container().style.getPropertyValue('--mlv-toast-panel-inset-block-end'),
      ).toBe(
        'var(--mlv-toast-inset-block-end, var(--mlv-page-dock-height, 0px))',
      );
      expect(
        container().style.getPropertyValue(
          '--mlv-toast-panel-inset-block-start',
        ),
      ).toBe('');
    });

    it('offsets a top stack by the block-start inset only', async () => {
      service.open('Saved', { position: 'top-right', displayTime: 0 });
      await stabilize();

      expect(
        container().style.getPropertyValue(
          '--mlv-toast-panel-inset-block-start',
        ),
      ).toBe('var(--mlv-toast-inset-block-start, 0px)');
      expect(
        container().style.getPropertyValue('--mlv-toast-panel-inset-block-end'),
      ).toBe('');
    });
  });
});
