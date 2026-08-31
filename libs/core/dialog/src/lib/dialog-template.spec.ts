import { ApplicationRef, Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';

import { MlvDialog } from './dialog/dialog';
import { MlvDialogBody } from './dialog-body';
import { MlvDialogClose } from './dialog-close';
import type { MlvDialogRestoreFocus } from './dialog-config';
import { MlvDialogFooter } from './dialog-footer';
import { MlvDialogHeader } from './dialog-header';
import { MlvDialogTemplate } from './dialog-template';
import { MlvDialogService } from './dialog.service';

@Component({
  imports: [
    MlvDialogTemplate,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  template: `
    <button class="trigger" (click)="open.set(true)">Open</button>
    <button class="sugar-open" (click)="sugar.open()">Open via sugar</button>
    <button class="sugar-close" (click)="sugar.close()">Close via sugar</button>
    <ng-template
      #sugar="mlvDialog"
      [(mlvDialog)]="open"
      [mlvDialogOptions]="{
        size: 's',
        panelClass: 'from-template',
        restoreFocus: restoreFocus(),
      }"
      (mlvDialogOpened)="openedCount = openedCount + 1"
      (mlvDialogClosed)="lastResult = $event"
      let-dialog
    >
      <mlv-dialog>
        <mlv-dialog-header title="Sugar" />
        <mlv-dialog-body
          ><p class="instance">{{ dialog.id }}</p></mlv-dialog-body
        >
        <mlv-dialog-footer>
          <button class="done" mlvDialogClose="done">Done</button>
        </mlv-dialog-footer>
      </mlv-dialog>
    </ng-template>
  `,
})
class SugarHost {
  readonly open = signal(false);
  readonly restoreFocus = signal<MlvDialogRestoreFocus>(true);
  readonly sugar = viewChild.required(MlvDialogTemplate);
  openedCount = 0;
  lastResult: unknown = 'unset';
}

describe('MlvDialogTemplate (ng-template[mlvDialog])', () => {
  let fixture: ComponentFixture<SugarHost>;
  let host: SugarHost;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SugarHost],
      providers: [provideMlvI18nTesting()],
    });
    fixture = TestBed.createComponent(SugarHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
    TestBed.resetTestingModule();
  });

  const stabilize = async () => {
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
  };
  const surface = () => document.querySelector<HTMLElement>('.mlv-dialog');
  const finishClose = () => surface()?.dispatchEvent(new Event('animationend'));

  it('opens when the model becomes true, applies the options and emits mlvDialogOpened', async () => {
    expect(surface()).toBeNull();
    host.open.set(true);
    await stabilize();
    expect(surface()).not.toBeNull();
    expect(
      document
        .querySelector('.cdk-overlay-pane')
        ?.classList.contains('from-template'),
    ).toBe(true);
    expect(
      (document.querySelector('.cdk-overlay-pane') as HTMLElement).style.width,
    ).toBe('400px');
    expect(host.openedCount).toBe(1);
    expect(document.querySelector('.instance')?.textContent?.trim()).toBe(
      document.querySelector('.mlv-dialog-container')?.id,
    );
  });

  it('closes from inside with mlvDialogClose: model flips to false and mlvDialogClosed carries the result', async () => {
    host.open.set(true);
    await stabilize();
    document.querySelector<HTMLButtonElement>('.done')?.click();
    finishClose();
    await stabilize();
    expect(host.open()).toBe(false);
    expect(host.lastResult).toBe('done');
    expect(surface()).toBeNull();
  });

  it('closes when the model is set to false and reports an undefined result', async () => {
    host.open.set(true);
    await stabilize();
    host.open.set(false);
    await stabilize();
    expect(surface()?.classList.contains('mlv-dialog--leave')).toBe(true);
    finishClose();
    await stabilize();
    expect(surface()).toBeNull();
    expect(host.lastResult).toBeUndefined();
  });

  it('re-opening creates a fresh dialog instance', async () => {
    host.open.set(true);
    await stabilize();
    const first = document.querySelector('.instance')?.textContent?.trim();
    host.open.set(false);
    await stabilize();
    finishClose();
    await stabilize();
    host.open.set(true);
    await stabilize();
    expect(document.querySelector('.instance')?.textContent?.trim()).not.toBe(
      first,
    );
    expect(host.openedCount).toBe(2);
  });

  it('closes an open dialog when the host is destroyed', async () => {
    host.open.set(true);
    await stabilize();
    fixture.destroy();
    // The overlay view is attached to ApplicationRef, not the fixture — let a tick run.
    await TestBed.inject(ApplicationRef).whenStable();
    expect(surface()?.classList.contains('mlv-dialog--leave')).toBe(true);
    finishClose();
    expect(document.querySelector('.mlv-dialog-container')).toBeNull();
  });

  it('emits nothing and leaves the model alone after the host is destroyed', async () => {
    host.open.set(true);
    await stabilize();
    const sugar = host.sugar();
    fixture.destroy();
    await TestBed.inject(ApplicationRef).whenStable();
    finishClose();

    expect(host.lastResult).toBe('unset');
    expect(host.open()).toBe(true);
    // Nothing clears `_ref` after destroy, so the destroy handler does it.
    expect(sugar.ref).toBeNull();
  });

  it('honours a re-open requested while the previous instance is still leaving', async () => {
    host.open.set(true);
    await stabilize();
    const first = document.querySelector('.instance')?.textContent?.trim();

    host.open.set(false);
    await stabilize();
    expect(surface()?.classList.contains('mlv-dialog--leave')).toBe(true);

    // Re-opened mid-leave: the intent is remembered, not dropped.
    host.open.set(true);
    await stabilize();
    finishClose();
    await stabilize();

    expect(host.openedCount).toBe(2);
    // The old instance still reported its (dismissed) result.
    expect(host.lastResult).toBeUndefined();
    expect(host.open()).toBe(true);
    expect(surface()).not.toBeNull();
    expect(document.querySelector('.instance')?.textContent?.trim()).not.toBe(
      first,
    );
  });

  it('exposes open()/close()/ref through exportAs', async () => {
    const sugar = host.sugar();
    const root = fixture.nativeElement as HTMLElement;
    expect(sugar.ref).toBeNull();

    root.querySelector<HTMLButtonElement>('.sugar-open')?.click();
    await stabilize();
    expect(host.open()).toBe(true);
    expect(sugar.ref?.id).toBe(
      document.querySelector('.mlv-dialog-container')?.id,
    );

    root.querySelector<HTMLButtonElement>('.sugar-close')?.click();
    await stabilize();
    expect(host.open()).toBe(false);
    // Held until the leave animation completes.
    expect(sugar.ref).not.toBeNull();

    finishClose();
    await stabilize();
    expect(sugar.ref).toBeNull();
  });

  it('settles declarative state when a restore-focus resolver throws during disposal', async () => {
    const resolver = vi.fn((): never => {
      throw new Error('Consumer restore-focus failure');
    });
    host.restoreFocus.set(resolver);
    host.open.set(true);
    await stabilize();
    const dialogs = TestBed.inject(MlvDialogService);
    const sugar = host.sugar();

    document.querySelector<HTMLButtonElement>('.done')?.click();
    expect(sugar.ref).not.toBeNull();
    expect(() => sugar.ref?._onSurfaceAnimationEnd()).not.toThrow();
    await stabilize();

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(host.open()).toBe(false);
    expect(host.lastResult).toBe('done');
    expect(sugar.ref).toBeNull();
    expect(dialogs.openDialogs).toEqual([]);
    expect(
      document.querySelector('.cdk-overlay-container')?.children,
    ).toHaveLength(0);
  });
});
