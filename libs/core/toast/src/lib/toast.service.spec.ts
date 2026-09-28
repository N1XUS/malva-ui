import {
  ApplicationRef,
  Component,
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  Injectable,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { vi } from 'vitest';
import type { MlvIAbstractToastComponent } from './abstract-toast-container';
import { MlvAbstractToastContainerComponent } from './abstract-toast-container';
import { MlvAbstractToastService } from './abstract-toast.service';
import { MlvToastItem } from './toast-item/toast-item';
import { MlvToastRef } from './toast-ref';
import { MlvToastService } from './toast.service';
import {
  TOAST_DATA,
  type MlvInternalToast,
  type MlvToastConfig,
  type MlvToastPoliteness,
  type MlvToastTemplateContext,
} from './toast.types';

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

/** A container of a subclass's own, which `MlvToastItem`s must not end up in. */
@Component({
  selector: 'test-other-toast-container',
  template: `
    @for (toast of toasts(); track toast.id) {
      <p class="test-other-toast">{{ toast.title }}</p>
    }
  `,
})
class OtherToastContainer extends MlvAbstractToastContainerComponent<MlvInternalToast> {
  override component = MlvToastItem;
}

/** A toast-like service rendering {@link OtherToastContainer}. */
@Injectable({ providedIn: 'root' })
class OtherContainerToastService extends MlvAbstractToastService<
  MlvToastConfig,
  MlvInternalToast,
  MlvIAbstractToastComponent<MlvInternalToast>
> {
  protected override readonly containerType = OtherToastContainer;
  protected override readonly toastItemType = MlvToastItem;

  protected override buildItem(
    id: string,
    config: MlvToastConfig,
  ): MlvInternalToast {
    return {
      id,
      title: config.title,
      description: '',
      position: config.position ?? 'top-right',
      tone: 'default',
      displayTime: 0,
      pauseOnHover: true,
      closable: true,
    };
  }

  protected override resolveAnnouncement(): {
    message: string;
    politeness: MlvToastPoliteness;
  } | null {
    return null;
  }
}

/** The single CDK live region every toast announces through. */
function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>(
    '.cdk-live-announcer-element',
  );
  if (!region) {
    throw new Error('LiveAnnouncer has not created its live region');
  }
  return region;
}

/**
 * Records every text written into the live region, in order — including one
 * replaced again before its task ends, which no screen reader could ever read.
 * A recorder alone therefore cannot prove an announcement; the specs pair it
 * with the region's settled `textContent`.
 */
function recordLiveRegionWrites(region: HTMLElement): {
  writes: string[];
  stop(): void;
} {
  const writes: string[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node.textContent) {
          writes.push(node.textContent);
        }
      }
    }
  });
  observer.observe(region, { childList: true, subtree: true });
  return { writes, stop: () => observer.disconnect() };
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

  describe('announcements pending together (#336)', () => {
    /** Waits past `LiveAnnouncer`'s 100 ms write delay. */
    function afterWrite(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 150));
    }

    it('announces an error and a success shown in the same tick, the assertive one first', async () => {
      const region = liveRegion();
      const recorder = recordLiveRegionWrites(region);

      service.error('Upload failed', { displayTime: 0 });
      service.success('Two files saved', { displayTime: 0 });
      await afterWrite();
      recorder.stop();

      expect(region.textContent).toBe('Upload failed. Two files saved');
      expect(region.getAttribute('aria-live')).toBe('assertive');
      expect(recorder.writes).toEqual(['Upload failed. Two files saved']);
    });

    it('leads with the assertive message when it was shown second', async () => {
      const region = liveRegion();

      service.success('Two files saved', { displayTime: 0 });
      service.error('Upload failed', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Upload failed. Two files saved');
      expect(region.getAttribute('aria-live')).toBe('assertive');
    });

    it('keeps a batch of polite messages polite, in the order shown', async () => {
      const region = liveRegion();

      service.info('Sync started', { displayTime: 0 });
      service.success('Two files saved', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Sync started. Two files saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
    });

    it('joins a message shown before the previous one was written', async () => {
      const region = liveRegion();

      service.error('Upload failed', { displayTime: 0 });
      await new Promise((resolve) => setTimeout(resolve, 50));
      service.success('Two files saved', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Upload failed. Two files saved');
      expect(region.getAttribute('aria-live')).toBe('assertive');
    });

    it('announces a message shown after the previous one was written on its own', async () => {
      const region = liveRegion();
      const recorder = recordLiveRegionWrites(region);

      service.error('Upload failed', { displayTime: 0 });
      await afterWrite();
      expect(region.textContent).toBe('Upload failed');

      service.success('Two files saved', { displayTime: 0 });
      await afterWrite();
      recorder.stop();

      expect(region.textContent).toBe('Two files saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(recorder.writes).toEqual(['Upload failed', 'Two files saved']);
    });

    it('leaves template content, which announces nothing, out of the batch', async () => {
      const fixture: ComponentFixture<ToastTemplateHost> =
        TestBed.createComponent(ToastTemplateHost);
      fixture.detectChanges();
      const region = liveRegion();

      service.success('Two files saved', { displayTime: 0 });
      service.open(fixture.componentInstance.content(), {
        data: { label: 'sync' },
        displayTime: 0,
      });
      await afterWrite();

      expect(region.textContent).toBe('Two files saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
    });

    it('still announces an item closed before the write, as part of the batch', async () => {
      const region = liveRegion();

      // Documented edge: closing never withdraws an announcement — a lone
      // item closed before the write was announced before #336 as well.
      const saving = service.info('Saving', { displayTime: 0 });
      saving.close();
      service.success('Saved', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Saving. Saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
    });

    it('closes the batch when another LiveAnnouncer caller writes first', async () => {
      // Tripwire for a CDK upgrade: the batch closes on the promise
      // `announce()` returns, which CDK 22 shares across every call in the
      // 100 ms window and resolves on whichever write lands. Were it to hand
      // out per-message promises left pending on cancel, the batch below
      // would never close and the next toast would repeat "Upload failed".
      const region = liveRegion();

      service.error('Upload failed', { displayTime: 0 });
      void TestBed.inject(LiveAnnouncer).announce('Route changed');
      await afterWrite();
      expect(region.textContent).toBe('Route changed');

      service.success('Two files saved', { displayTime: 0 });
      await afterWrite();

      expect(region.textContent).toBe('Two files saved');
      expect(region.getAttribute('aria-live')).toBe('polite');
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

  describe('shared stacks (#362)', () => {
    function panes(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>('.cdk-overlay-pane'),
      );
    }

    it('renders one service at one position exactly as before: one pane, the same classes', async () => {
      service.info('First', { displayTime: 0 });
      service.info('Second', { displayTime: 0 });
      await stabilize();

      expect(panes().length).toBe(1);
      expect(Array.from(panes()[0].classList)).toEqual([
        'cdk-overlay-pane',
        'mlv-toast-panel',
        'mlv-toast-panel--top-right',
      ]);
      expect(panes()[0].querySelectorAll('mlv-toast-item').length).toBe(2);
    });

    it('keeps its own pane for a subclass rendering another container', async () => {
      service.info('Toast', { displayTime: 0 });
      TestBed.inject(OtherContainerToastService).show({ title: 'Other' });
      await stabilize();

      // A container it did not write cannot be trusted to render a foreign
      // item, so the stack is keyed by container type as well as position.
      expect(panes().length).toBe(2);
      expect(
        document.querySelector('test-other-toast-container mlv-toast-item'),
      ).toBeNull();
      expect(
        document.querySelector('test-other-toast-container .test-other-toast')
          ?.textContent,
      ).toBe('Other');
    });

    it('keeps its own pane for a service from another environment injector, and disposes it with that injector', async () => {
      const child = createEnvironmentInjector(
        [MlvToastService],
        TestBed.inject(EnvironmentInjector),
      );
      const scoped = child.get(MlvToastService);
      expect(scoped).not.toBe(service);

      service.info('Root', { displayTime: 0 });
      const scopedRef = scoped.info('Scoped', { displayTime: 0 });
      await stabilize();
      expect(panes().length).toBe(2);

      child.destroy();

      // Removed at once, as a destroyed service's panes always were.
      expect(scopedRef.closed()).toBe(true);
      expect(panes().length).toBe(1);
      expect(panes()[0].textContent).toContain('Root');
    });
  });
});

describe('MlvToastService behind a LiveAnnouncer test double (#336)', () => {
  /** A consumer-style double: `announce()` returns `undefined`, not a promise. */
  const announce = vi.fn();
  let service: MlvToastService;

  beforeEach(() => {
    announce.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: LiveAnnouncer, useValue: { announce, clear: vi.fn() } },
      ],
    });
    service = TestBed.inject(MlvToastService);
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('still returns every ref and coalesces items shown in the same tick', () => {
    const ids: string[] = [];
    let thrown: string | null = null;
    try {
      ids.push(service.error('Upload failed', { displayTime: 0 }).id);
      ids.push(service.success('Two files saved', { displayTime: 0 }).id);
    } catch (error) {
      thrown = String(error);
    }

    expect(thrown).toBeNull();
    expect(ids).toEqual(['toast-1', 'toast-2']);
    expect(announce).toHaveBeenLastCalledWith(
      'Upload failed. Two files saved',
      'assertive',
    );
  });

  it('closes the batch on the next microtask', async () => {
    service.error('Upload failed', { displayTime: 0 });
    // The batch's close reaction was queued inside `show()`, so it runs before
    // this continuation does.
    await Promise.resolve();
    service.success('Two files saved', { displayTime: 0 });

    expect(announce).toHaveBeenLastCalledWith('Two files saved', 'polite');
  });
});
