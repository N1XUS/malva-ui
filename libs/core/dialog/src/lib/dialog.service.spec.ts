import {
  Dialog,
  DIALOG_DATA as CDK_DIALOG_DATA,
  DialogRef,
} from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ApplicationRef, Component, inject, viewChild } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';

import {
  DIALOG_CONFIG,
  DIALOG_DATA,
  type MlvDialogConfig,
  type MlvDialogTemplateContext,
} from './dialog-config';
import { MlvDialog } from './dialog/dialog';
import { MlvDialogBody } from './dialog-body';
import { MlvDialogClose } from './dialog-close';
import { MlvDialogFooter } from './dialog-footer';
import { MlvDialogHeader } from './dialog-header';
import { MlvDialogRef } from './dialog-ref';
import { MlvDialogService } from './dialog.service';

interface Data {
  label: string;
}

@Component({
  selector: 'test-component-content',
  imports: [
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  template: `
    <mlv-dialog>
      <mlv-dialog-header title="Component title" />
      <mlv-dialog-body>
        <p class="ref-data">{{ ref.data.label }}</p>
        <p class="token-data">{{ tokenData.label }}</p>
        <p class="cdk-token-data">{{ cdkTokenData.label }}</p>
        <p class="config-size">{{ config.size }}</p>
        <p class="cdk-ref-id">{{ cdkRef.id }}</p>
        <button class="inside">Inside</button>
      </mlv-dialog-body>
      <mlv-dialog-footer>
        <button class="component-close" mlvDialogClose="component-result">
          Close
        </button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
class ComponentContent {
  readonly ref = inject<MlvDialogRef<string, Data>>(MlvDialogRef);
  readonly tokenData = inject(DIALOG_DATA) as Data;
  readonly cdkTokenData = inject(CDK_DIALOG_DATA) as Data;
  readonly config = inject(DIALOG_CONFIG);
  readonly cdkRef = inject(DialogRef);
}

@Component({
  imports: [
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  template: `
    <ng-template
      #content
      let-ref
      let-data="data"
      let-config="config"
      let-named="ref"
    >
      <mlv-dialog>
        <mlv-dialog-header><h3>Template title</h3></mlv-dialog-header>
        <mlv-dialog-body>
          <p class="template-data">{{ data.label }}</p>
          <p class="template-same-ref">{{ ref === named }}</p>
          <p class="template-config-size">{{ config.size }}</p>
          <button class="inside">Inside</button>
        </mlv-dialog-body>
        <mlv-dialog-footer>
          <button class="template-close" (click)="ref.close('template-result')">
            Close
          </button>
        </mlv-dialog-footer>
      </mlv-dialog>
    </ng-template>

    <ng-template #headless><div class="headless">No surface</div></ng-template>

    <ng-template #configHeader>
      <mlv-dialog>
        <mlv-dialog-header />
        <mlv-dialog-body
          ><button class="inside">Inside</button></mlv-dialog-body
        >
      </mlv-dialog>
    </ng-template>

    <ng-template #noHeader>
      <mlv-dialog>
        <mlv-dialog-body
          ><button class="inside">Inside</button></mlv-dialog-body
        >
      </mlv-dialog>
    </ng-template>
  `,
})
class TemplateHost {
  readonly content =
    viewChild.required<TemplateRef<MlvDialogTemplateContext<string, Data>>>(
      'content',
    );
  readonly headless = viewChild.required<TemplateRef<unknown>>('headless');
  readonly configHeader =
    viewChild.required<TemplateRef<unknown>>('configHeader');
  readonly noHeader = viewChild.required<TemplateRef<unknown>>('noHeader');
}

/** Content of the bare CDK overlay the stacking specs stack on top of a dialog. */
@Component({ template: '<div class="popup">Popup</div>' })
class PopupContent {}

const q = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);
const qa = (sel: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(sel));

/** Shared by both describes; assigned by each `beforeEach`. */
let service: MlvDialogService;

const stabilize = () => TestBed.inject(ApplicationRef).whenStable();
/** Ends every open surface's leave animation, so the refs dispose now. */
const finishClose = () =>
  qa('.mlv-dialog').forEach((s) => s.dispatchEvent(new Event('animationend')));
const container = () => q('.mlv-dialog-container');
const pane = () => q('.cdk-overlay-pane');
const backdrop = () => q('.cdk-overlay-backdrop');
const pressEscape = () =>
  (container() ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );

afterEach(() => {
  service?.closeAll();
  finishClose();
  document
    .querySelectorAll('.cdk-overlay-container')
    .forEach((el) => el.remove());
  TestBed.resetTestingModule();
});

describe('MlvDialogService', () => {
  let host: TemplateHost;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TemplateHost],
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvDialogService);
    const fixture = TestBed.createComponent(TemplateHost);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  // ---- content kinds ------------------------------------------------------

  it('opens template content with the ref as $implicit/ref and data/config in context', async () => {
    const ref = service.open<string, Data>(host.content(), {
      data: { label: 'T' },
      size: 's',
    });
    await stabilize();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);

    expect(q('.template-data')?.textContent?.trim()).toBe('T');
    expect(q('.template-same-ref')?.textContent?.trim()).toBe('true');
    expect(q('.template-config-size')?.textContent?.trim()).toBe('s');

    q<HTMLButtonElement>('.template-close')?.click();
    expect(closed).not.toHaveBeenCalled(); // waits for the leave animation
    finishClose();
    expect(closed).toHaveBeenCalledExactlyOnceWith('template-result');
  });

  it('opens component content and provides MlvDialogRef, DIALOG_CONFIG, DIALOG_DATA (both tokens) and the CDK DialogRef', async () => {
    const ref = service.open<string, Data>(ComponentContent, {
      data: { label: 'C' },
      size: 'l',
    });
    await stabilize();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);

    expect(q('.ref-data')?.textContent?.trim()).toBe('C');
    expect(q('.token-data')?.textContent?.trim()).toBe('C');
    expect(q('.cdk-token-data')?.textContent?.trim()).toBe('C');
    expect(q('.config-size')?.textContent?.trim()).toBe('l');
    expect(q('.cdk-ref-id')?.textContent?.trim()).toBe(ref.id);

    q<HTMLButtonElement>('.component-close')?.click();
    finishClose();
    expect(closed).toHaveBeenCalledExactlyOnceWith('component-result');
  });

  it('renders string content as escaped text inside a surface with header and body', async () => {
    const content = '<img src=x onerror="alert(1)">Safe text';
    service.open(content, { title: 'Saved' });
    await stabilize();

    const text = q('.mlv-dialog .mlv-dialog__body .mlv-dialog__text');
    expect(text?.textContent).toBe(content);
    expect(text?.querySelector('img')).toBeNull();
    expect(q('.mlv-dialog__title')?.textContent?.trim()).toBe('Saved');
    expect(q('.mlv-dialog__close')).not.toBeNull();
  });

  it('string content without title and closable=false renders no header at all', async () => {
    service.open('Just text', { closable: false });
    await stabilize();
    expect(q('.mlv-dialog__header')).toBeNull();
    expect(q('.mlv-dialog__text')?.textContent).toBe('Just text');
  });

  it("titleless string content with appearance 'confirm' renders no header at all", async () => {
    // 'confirm' forces the close button off, so a header would be an empty bar.
    service.open('Delete this?', { appearance: 'confirm' });
    await stabilize();
    expect(q('.mlv-dialog__header')).toBeNull();
    expect(q('.mlv-dialog__text')?.textContent).toBe('Delete this?');
    expect(container()?.getAttribute('aria-label')).toBe('Delete this?');
  });

  // ---- a11y name ----------------------------------------------------------

  it('names the dialog after the header title (input) and the projected heading', async () => {
    service.open(ComponentContent, { data: { label: 'x' } });
    await stabilize();
    let id = container()?.getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent?.trim()).toBe(
      'Component title',
    );
    service.closeAll();
    finishClose();

    service.open(host.content(), { data: { label: 'x' } });
    await stabilize();
    id = container()?.getAttribute('aria-labelledby');
    expect(document.getElementById(id as string)?.textContent?.trim()).toBe(
      'Template title',
    );
    expect(container()?.getAttribute('role')).toBe('dialog');
  });

  it('lets ariaLabelledBy win over the header title, and ariaLabel suppress aria-labelledby', async () => {
    service.open(ComponentContent, {
      data: { label: 'x' },
      ariaLabelledBy: 'external-id',
    });
    await stabilize();
    expect(container()?.getAttribute('aria-labelledby')).toBe('external-id');
    service.closeAll();
    finishClose();

    service.open(ComponentContent, {
      data: { label: 'x' },
      ariaLabel: 'Spoken name',
    });
    await stabilize();
    expect(container()?.getAttribute('aria-label')).toBe('Spoken name');
    expect(container()?.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('names a titleless string dialog after its text', async () => {
    service.open('Body text only');
    await stabilize();
    expect(container()?.getAttribute('aria-label')).toBe('Body text only');
  });

  it('honours role and ariaDescribedBy', async () => {
    service.open(host.noHeader(), {
      role: 'alertdialog',
      ariaDescribedBy: 'desc',
    });
    await stabilize();
    expect(container()?.getAttribute('role')).toBe('alertdialog');
    expect(container()?.getAttribute('aria-describedby')).toBe('desc');
  });

  // ---- config mapping -----------------------------------------------------

  it('applies size presets and explicit sizes to the pane', async () => {
    service.open(host.noHeader());
    await stabilize();
    expect(pane()?.style.width).toBe('560px');
    expect(pane()?.style.maxHeight).toBe('90vh');
    service.closeAll();
    finishClose();

    service.open(host.noHeader(), { size: 's' });
    await stabilize();
    expect(pane()?.style.width).toBe('400px');
    service.closeAll();
    finishClose();

    service.open(host.noHeader(), { size: { width: 700, height: '20rem' } });
    await stabilize();
    expect(pane()?.style.width).toBe('700px');
    expect(pane()?.style.height).toBe('20rem');
  });

  it("falls back to the 'm' preset for an unregistered size name", async () => {
    service.open(host.noHeader(), { size: 'nope' });
    await stabilize();
    expect(pane()?.style.width).toBe('560px');
    expect(pane()?.style.maxHeight).toBe('90vh');
  });

  it("marks the pane fullscreen only for the 'fullscreen' preset", async () => {
    // The modifier is what drops the surface's desktop radius/border and its
    // `calc(100dvh - 2rem)` cap, so `fullscreen` is really edge-to-edge.
    service.open(host.noHeader(), { size: 'fullscreen' });
    await stabilize();
    expect(pane()?.classList.contains('mlv-dialog-pane--fullscreen')).toBe(
      true,
    );
    expect(pane()?.style.width).toBe('100vw');
    service.closeAll();
    finishClose();

    service.open(host.noHeader(), { size: 's' });
    await stabilize();
    expect(pane()?.classList.contains('mlv-dialog-pane--fullscreen')).toBe(
      false,
    );
  });

  it('adds mlv-dialog-pane / mlv-dialog-backdrop plus consumer classes', async () => {
    service.open(host.noHeader(), {
      panelClass: 'user-editor',
      backdropClass: ['dim', 'blur'],
    });
    await stabilize();
    expect(pane()?.classList.contains('mlv-dialog-pane')).toBe(true);
    expect(pane()?.classList.contains('user-editor')).toBe(true);
    expect(backdrop()?.classList.contains('mlv-dialog-backdrop')).toBe(true);
    expect(backdrop()?.classList.contains('dim')).toBe(true);
    expect(backdrop()?.classList.contains('blur')).toBe(true);
  });

  it('exposes DIALOG_CONFIG to the header so the config title is the fallback and closable=false hides the X', async () => {
    service.open(host.configHeader(), {
      title: 'From config',
      closable: false,
    });
    await stabilize();
    expect(q('.mlv-dialog__title')?.textContent?.trim()).toBe('From config');
    expect(q('.mlv-dialog__close')).toBeNull();
    const id = container()?.getAttribute('aria-labelledby');
    expect(document.getElementById(id as string)?.textContent?.trim()).toBe(
      'From config',
    );
  });

  // ---- closing ------------------------------------------------------------

  it('closes on Escape and on backdrop click by default, playing the leave animation first', async () => {
    let ref = service.open(host.noHeader());
    await stabilize();
    let closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    pressEscape();
    expect(ref.animationState()).toBe('leave');
    expect(closed).not.toHaveBeenCalled();
    finishClose();
    expect(closed).toHaveBeenCalledOnce();

    ref = service.open(host.noHeader());
    await stabilize();
    closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    backdrop()?.click();
    finishClose();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('keeps Escape inert with closeOnEscape=false while the backdrop still closes, and vice versa', async () => {
    let ref = service.open(host.noHeader(), { closeOnEscape: false });
    await stabilize();
    pressEscape();
    expect(ref.animationState()).toBe('enter');
    backdrop()?.click();
    expect(ref.animationState()).toBe('leave');
    finishClose();

    ref = service.open(host.noHeader(), { closeOnBackdrop: false });
    await stabilize();
    backdrop()?.click();
    expect(ref.animationState()).toBe('enter');
    pressEscape();
    expect(ref.animationState()).toBe('leave');
    finishClose();
  });

  it('disposes after the 250 ms fallback when no animationend arrives', async () => {
    const ref = service.open(host.headless());
    await stabilize();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    ref.close('fallback');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(closed).toHaveBeenCalledExactlyOnceWith('fallback');
    expect(q('.headless')).toBeNull();
  });

  it('closeAll() closes every open dialog and openDialogs tracks them', async () => {
    const a = service.open(host.noHeader());
    const b = service.open(host.headless());
    await stabilize();
    expect(service.openDialogs).toEqual([a, b]);
    service.closeAll();
    expect(a.animationState()).toBe('leave');
    expect(b.animationState()).toBe('leave');
    finishClose();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(service.openDialogs).toEqual([]);
    expect(q('.mlv-dialog-container')).toBeNull();
  });

  it('de-registers a dialog the CDK closes on its own', async () => {
    service.open(host.noHeader());
    await stabilize();
    expect(service.openDialogs).toHaveLength(1);

    // A CDK-initiated close (history navigation, overlay detachment, the CDK's
    // own closeAll) disposes without Malva's leave animation ever running.
    TestBed.inject(Dialog).closeAll();

    expect(service.openDialogs).toEqual([]);
    expect(q('.mlv-dialog-container')).toBeNull();
  });

  // ---- focus --------------------------------------------------------------

  it("initialFocus 'auto' skips the close button and focuses the first body control", async () => {
    service.open(ComponentContent, { data: { label: 'x' } });
    await stabilize();
    expect(document.activeElement).toBe(q('.inside'));
  });

  it("initialFocus 'container' focuses the dialog container", async () => {
    service.open(ComponentContent, {
      data: { label: 'x' },
      initialFocus: 'container',
    });
    await stabilize();
    expect(document.activeElement).toBe(container());
  });

  it('restores focus to the opener on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const ref = service.open(host.noHeader());
    await stabilize();
    expect(document.activeElement).not.toBe(trigger);
    ref.close();
    finishClose();
    await stabilize();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('keeps static false restore-focus behavior disabled', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');

    const ref = service.open(host.noHeader(), { restoreFocus: false });
    await stabilize();
    ref.close();
    finishClose();
    await stabilize();

    expect(openerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(opener);
    expect(service.openDialogs).toEqual([]);
    opener.remove();
  });

  it('keeps static selector restore-focus behavior resolved at disposal', async () => {
    const opener = document.createElement('button');
    const target = document.createElement('button');
    target.id = 'dialog-selector-restore-target';
    document.body.append(opener, target);
    opener.focus();

    const ref = service.open(host.noHeader(), {
      restoreFocus: '#dialog-selector-restore-target',
    });
    await stabilize();
    ref.close();
    finishClose();
    await stabilize();

    expect(target.isConnected).toBe(true);
    expect(document.activeElement).toBe(target);
    expect(service.openDialogs).toEqual([]);
    opener.remove();
    target.remove();
  });

  it('restores focus to an explicit connected target without touching a detached opener', async () => {
    const opener = document.createElement('button');
    const fallback = document.createElement('button');
    document.body.append(opener, fallback);
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');
    const config: MlvDialogConfig = { restoreFocus: fallback };

    const ref = service.open(host.noHeader(), config);
    await stabilize();
    opener.remove();
    expect(opener.isConnected).toBe(false);

    ref.close();
    finishClose();
    await stabilize();

    expect(openerFocus).not.toHaveBeenCalled();
    expect(fallback.isConnected).toBe(true);
    expect(document.activeElement).toBe(fallback);
    expect(service.openDialogs).toEqual([]);
    fallback.remove();
  });

  it('resolves a dynamic restore-focus policy only when the dialog is disposed', async () => {
    const opener = document.createElement('button');
    const lateTarget = document.createElement('button');
    document.body.append(opener, lateTarget);
    opener.focus();
    let restoreTarget: true | HTMLElement = true;
    const resolver = vi.fn(() => restoreTarget);

    const ref = service.open(host.noHeader(), {
      restoreFocus: resolver,
    });
    await stabilize();
    restoreTarget = lateTarget;
    ref.close();

    expect(resolver).not.toHaveBeenCalled();
    finishClose();
    await stabilize();

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(lateTarget);
    expect(service.openDialogs).toEqual([]);
    opener.remove();
    lateTarget.remove();
  });

  it('never focuses a detached captured opener when a dynamic policy resolves to true', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');
    const resolver = vi.fn(() => true);

    const ref = service.open(host.noHeader(), {
      restoreFocus: resolver,
    });
    await stabilize();
    opener.remove();
    expect(opener.isConnected).toBe(false);

    ref.close();
    finishClose();
    await stabilize();

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(openerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(opener);
    expect(service.openDialogs).toEqual([]);
  });

  it('contains a throwing dynamic restore-focus resolver so disposal still completes', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const openerFocus = vi.spyOn(opener, 'focus');
    const resolver = vi.fn((): never => {
      throw new Error('Consumer restore-focus failure');
    });
    const ref = service.open(host.noHeader(), { restoreFocus: resolver });
    await stabilize();
    const results: unknown[] = [];
    const completed = vi.fn();
    ref.afterClosed().subscribe({
      next: (result) => results.push(result),
      complete: completed,
    });

    expect(service.openDialogs).toEqual([ref]);
    expect(() => ref.close('closed')).not.toThrow();
    expect(() => ref._onSurfaceAnimationEnd()).not.toThrow();
    await stabilize();

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['closed']);
    expect(completed).toHaveBeenCalledOnce();
    expect(service.openDialogs).toEqual([]);
    expect(
      document.querySelector('.cdk-overlay-container')?.children,
    ).toHaveLength(0);
    expect(openerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(opener);

    opener.focus();
    openerFocus.mockClear();
    const nextRef = service.open(host.noHeader());
    await stabilize();
    expect(service.openDialogs).toEqual([nextRef]);

    expect(() => nextRef.close()).not.toThrow();
    expect(() => nextRef._onSurfaceAnimationEnd()).not.toThrow();
    await stabilize();

    expect(service.openDialogs).toEqual([]);
    expect(
      document.querySelector('.cdk-overlay-container')?.children,
    ).toHaveLength(0);
    expect(openerFocus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  // ---- stacking -----------------------------------------------------------

  describe('stacking', () => {
    it('closes only the topmost dialog on Escape, then the one below it', async () => {
      const a = service.open(host.noHeader());
      const b = service.open(host.noHeader());
      await stabilize();

      pressEscape();
      expect(b.animationState()).toBe('leave');
      expect(a.animationState()).toBe('enter');

      finishClose();
      expect(service.openDialogs).toEqual([a]);

      pressEscape();
      expect(a.animationState()).toBe('leave');
      finishClose();
      expect(service.openDialogs).toEqual([]);
    });

    it('lets an overlay opened on top swallow Escape until it is disposed', async () => {
      // The CDK keyboard dispatcher walks the attached overlays from the top
      // and stops at the first one with keydown observers — a select/combobox
      // popup opened from inside a dialog behaves exactly like this.
      const a = service.open(host.noHeader());
      await stabilize();

      const overlayRef = TestBed.inject(Overlay).create();
      overlayRef.attach(new ComponentPortal(PopupContent));
      const onPopupKeydown = vi.fn();
      overlayRef.keydownEvents().subscribe(onPopupKeydown);

      try {
        pressEscape();
        expect(onPopupKeydown).toHaveBeenCalledOnce();
        expect(a.animationState()).toBe('enter');
      } finally {
        // A failing assertion must not leave the overlay swallowing Escape for
        // the rest of the file — the dispatcher outlives this spec.
        overlayRef.dispose();
      }

      pressEscape();
      expect(onPopupKeydown).toHaveBeenCalledOnce();
      expect(a.animationState()).toBe('leave');
      finishClose();
    });

    it('reports Escape and backdrop clicks through the ref when both opt-outs are set', async () => {
      const ref = service.open(host.noHeader(), {
        closeOnEscape: false,
        closeOnBackdrop: false,
      });
      await stabilize();
      const onKeydown = vi.fn<(event: KeyboardEvent) => void>();
      const onBackdropClick = vi.fn();
      ref.keydownEvents().subscribe(onKeydown);
      ref.backdropClick().subscribe(onBackdropClick);

      pressEscape();
      expect(onKeydown).toHaveBeenCalledOnce();
      expect(onKeydown.mock.calls[0][0].key).toBe('Escape');
      expect(ref.animationState()).toBe('enter');

      backdrop()?.click();
      expect(onBackdropClick).toHaveBeenCalledOnce();
      expect(ref.animationState()).toBe('enter');
    });
  });
});

describe('MlvDialogService.confirm', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    service = TestBed.inject(MlvDialogService);
  });

  const confirmButton = () =>
    document.querySelector<HTMLButtonElement>('.mlv-confirm-dialog__confirm');
  const cancelButton = () =>
    document.querySelector<HTMLButtonElement>('.mlv-confirm-dialog__cancel');

  it('renders a confirm-appearance surface with title, message and localized labels, and no close button', async () => {
    const answers: boolean[] = [];
    service
      .confirm({ title: 'Delete file?', message: 'This cannot be undone.' })
      .subscribe((a) => answers.push(a));
    await stabilize();

    expect(
      document
        .querySelector('.mlv-dialog')
        ?.classList.contains('mlv-dialog--confirm'),
    ).toBe(true);
    expect(
      document.querySelector('.mlv-dialog__title')?.textContent?.trim(),
    ).toBe('Delete file?');
    expect(
      document.querySelector('.mlv-dialog__text')?.textContent?.trim(),
    ).toBe('This cannot be undone.');
    expect(confirmButton()?.textContent?.trim()).toBe('Confirm');
    expect(cancelButton()?.textContent?.trim()).toBe('Cancel');
    expect(document.querySelector('.mlv-dialog__close')).toBeNull();
    const id = document
      .querySelector('.mlv-dialog-container')
      ?.getAttribute('aria-labelledby');
    expect(document.getElementById(id as string)?.textContent?.trim()).toBe(
      'Delete file?',
    );

    cancelButton()?.click();
    finishClose();
    expect(answers).toEqual([false]);
  });

  it('emits true exactly once and completes when confirmed', async () => {
    const answers: boolean[] = [];
    let completed = false;
    service
      .confirm({ title: 'Publish?', message: 'Everyone will see this.' })
      .subscribe({
        next: (a) => answers.push(a),
        complete: () => (completed = true),
      });
    await stabilize();
    confirmButton()?.click();
    finishClose();
    expect(answers).toEqual([true]);
    expect(completed).toBe(true);
  });

  it('resolves false when dismissed with Escape', async () => {
    const answers: boolean[] = [];
    service
      .confirm({ title: 'Discard?', message: 'Unsaved changes will be lost.' })
      .subscribe((a) => answers.push(a));
    await stabilize();
    document
      .querySelector('.mlv-dialog-container')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    finishClose();
    expect(answers).toEqual([false]);
  });

  it('honours custom labels', async () => {
    service
      .confirm({
        title: 'Leave?',
        message: 'Really?',
        confirmLabel: 'Leave page',
        cancelLabel: 'Stay',
      })
      .subscribe();
    await stabilize();
    expect(confirmButton()?.textContent?.trim()).toBe('Leave page');
    expect(cancelButton()?.textContent?.trim()).toBe('Stay');
  });

  it('uses the danger button and focuses Cancel for a destructive action', async () => {
    service
      .confirm({
        title: 'Delete account?',
        message: 'All data is removed.',
        destructive: true,
      })
      .subscribe();
    await stabilize();
    expect(
      confirmButton()?.classList.contains('mlv-button--variant-error'),
    ).toBe(true);
    expect(document.activeElement).toBe(cancelButton());
  });

  it("treats the 'danger' tone as destructive", async () => {
    service
      .confirm({ title: 'Remove?', message: 'Gone.', tone: 'danger' })
      .subscribe();
    await stabilize();
    expect(
      confirmButton()?.classList.contains('mlv-button--variant-error'),
    ).toBe(true);
    expect(document.activeElement).toBe(cancelButton());
  });

  it('focuses Confirm for a non-destructive action', async () => {
    service.confirm({ title: 'Save?', message: 'Keep changes.' }).subscribe();
    await stabilize();
    expect(document.activeElement).toBe(confirmButton());
  });

  it('maps the remaining tones to matching confirm button variants', async () => {
    service
      .confirm({ title: 'Overwrite?', message: 'Careful.', tone: 'warning' })
      .subscribe();
    await stabilize();
    expect(
      confirmButton()?.classList.contains('mlv-button--variant-warning'),
    ).toBe(true);
    service.closeAll();
    finishClose();

    service
      .confirm({ title: 'Continue?', message: 'Heads up.', tone: 'info' })
      .subscribe();
    await stabilize();
    expect(
      confirmButton()?.classList.contains('mlv-button--variant-info'),
    ).toBe(true);
    service.closeAll();
    finishClose();

    // `success` has no dedicated button variant — it maps back to the default.
    service
      .confirm({ title: 'All good?', message: 'Nice.', tone: 'success' })
      .subscribe();
    await stabilize();
    expect(
      confirmButton()?.classList.contains('mlv-button--variant-primary'),
    ).toBe(true);
  });

  it('resolves false when dismissed with a backdrop click', async () => {
    const answers: boolean[] = [];
    service
      .confirm({ title: 'Leave?', message: 'Changes are lost.' })
      .subscribe((a) => answers.push(a));
    await stabilize();
    backdrop()?.click();
    finishClose();
    expect(answers).toEqual([false]);
  });

  it("sizes the confirmation with the 's' preset by default", async () => {
    service.confirm({ title: 'Apply?', message: 'Right now.' }).subscribe();
    await stabilize();
    expect(pane()?.style.width).toBe('400px');
  });

  it('describes the dialog with the message paragraph', async () => {
    service
      .confirm({ title: 'Reset?', message: 'Everything returns to defaults.' })
      .subscribe();
    await stabilize();

    const id = container()?.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const message = document.getElementById(id as string);
    expect(message?.classList.contains('mlv-dialog__text')).toBe(true);
    expect(message?.textContent?.trim()).toBe(
      'Everything returns to defaults.',
    );
  });

  it('opens a destructive confirmation as an alertdialog, a regular one as a dialog', async () => {
    service
      .confirm({
        title: 'Delete?',
        message: 'Gone forever.',
        destructive: true,
      })
      .subscribe();
    await stabilize();
    expect(container()?.getAttribute('role')).toBe('alertdialog');
    service.closeAll();
    finishClose();

    service.confirm({ title: 'Save?', message: 'Keep changes.' }).subscribe();
    await stabilize();
    expect(container()?.getAttribute('role')).toBe('dialog');
  });

  it('replays the answer to a subscriber that arrives after the dialog closed', async () => {
    const answer$ = service.confirm({
      title: 'Publish?',
      message: 'Everyone will see this.',
    });
    await stabilize();
    confirmButton()?.click();
    finishClose();

    const spy = vi.fn();
    answer$.subscribe(spy);
    expect(spy).toHaveBeenCalledExactlyOnceWith(true);
  });

  // ---- axe --------------------------------------------------------------

  const axeRules = [
    'aria-dialog-name',
    'aria-valid-attr-value',
    'aria-allowed-attr',
    'aria-required-attr',
  ];

  it('has no aria-dialog-name/aria-valid-attr-value/aria-allowed-attr/aria-required-attr violations for a destructive confirm() (axe)', async () => {
    service
      .confirm({
        title: 'Delete account?',
        message: 'All data is removed.',
        destructive: true,
      })
      .subscribe();
    await stabilize();

    const results = await axe.run(
      document.querySelector('.cdk-overlay-container') as HTMLElement,
      { runOnly: { type: 'rule', values: axeRules } },
    );
    expect(results.violations).toEqual([]);
  });

  it('has no aria-dialog-name/aria-valid-attr-value/aria-allowed-attr/aria-required-attr violations for a plain confirm() (axe)', async () => {
    service.confirm({ title: 'Save?', message: 'Keep changes.' }).subscribe();
    await stabilize();

    const results = await axe.run(
      document.querySelector('.cdk-overlay-container') as HTMLElement,
      { runOnly: { type: 'rule', values: axeRules } },
    );
    expect(results.violations).toEqual([]);
  });
});
