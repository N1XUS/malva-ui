import type { CdkDialogContainer, DialogRef } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { DIALOG_CONFIG, type MlvDialogConfig } from './dialog-config';
import { MlvDialog } from './dialog/dialog';
import { MlvDialogBody } from './dialog-body';
import { MlvDialogClose } from './dialog-close';
import { MlvDialogFooter } from './dialog-footer';
import { MlvDialogHeader } from './dialog-header';
import { MlvDialogRef } from './dialog-ref';

function stubRef(config: MlvDialogConfig = {}) {
  const addLabel = vi.fn();
  const removeLabel = vi.fn();
  const cdkRef = {
    id: 'cdk-dialog-1',
    closed: new Subject<unknown>(),
    containerInstance: {
      _addAriaLabelledBy: addLabel,
      _removeAriaLabelledBy: removeLabel,
    } as unknown as CdkDialogContainer,
    overlayRef: { backdropElement: null },
    close: vi.fn(),
  } as unknown as DialogRef<unknown>;
  const ref = new MlvDialogRef<unknown, unknown>(cdkRef, config);
  const close = vi.spyOn(ref, 'close');
  return { ref, close, addLabel, removeLabel };
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
    <mlv-dialog class="custom-surface">
      @if (withTitle()) {
        <mlv-dialog-header [title]="titleInput()" [closable]="closable()" />
      } @else {
        <mlv-dialog-header [closable]="closable()"
          ><h4>Projected</h4></mlv-dialog-header
        >
      }
      <mlv-dialog-body><button class="inside">Inside</button></mlv-dialog-body>
      <mlv-dialog-footer [align]="align()">
        <button class="cancel" mlvDialogClose>Cancel</button>
        <button class="ok" mlvDialogClose="ok" type="submit">Ok</button>
      </mlv-dialog-footer>
    </mlv-dialog>
  `,
})
class PartsHost {
  readonly withTitle = signal(true);
  readonly titleInput = signal<string | undefined>('Input title');
  readonly closable = signal<boolean | undefined>(undefined);
  readonly align = signal<'start' | 'end' | 'center' | 'between'>('end');
}

@Component({
  imports: [MlvDialog, MlvDialogHeader],
  template: `
    <mlv-dialog>
      <mlv-dialog-header title="Static title" />
    </mlv-dialog>
  `,
})
class StaticTitleHost {}

@Component({
  imports: [MlvDialog, MlvDialogHeader],
  template: `
    <mlv-dialog>
      <mlv-dialog-header title="A" />
      <mlv-dialog-header title="B" />
    </mlv-dialog>
  `,
})
class TwoHeadersHost {}

@Component({
  imports: [
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  template: `
    <mlv-dialog>
      <div mlvDialogHeader title="Attr"></div>
      <div mlvDialogBody><button class="inside">Inside</button></div>
      <div mlvDialogFooter align="center">
        <a class="link" mlvDialogClose="link" href="#">Link</a>
      </div>
    </mlv-dialog>
  `,
})
class AttributeHost {}

/** Matches the per-header title id: `<dialogId>-title-<n>`. */
const TITLE_ID = /^cdk-dialog-1-title-\d+$/;

async function mount(
  config: MlvDialogConfig = {},
  beforeFirstRender?: (host: PartsHost) => void,
) {
  const stub = stubRef(config);
  TestBed.configureTestingModule({
    imports: [PartsHost],
    providers: [
      provideMlvI18nTesting(),
      { provide: MlvDialogRef, useValue: stub.ref },
      { provide: DIALOG_CONFIG, useValue: config },
    ],
  });
  const fixture = TestBed.createComponent(PartsHost);
  beforeFirstRender?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host: fixture.componentInstance, ...stub };
}

describe('mlv-dialog surface', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps consumer classes and mirrors the ref animation state', async () => {
    const { ref, fixture } = await mount();
    const surface = fixture.nativeElement.querySelector(
      '.mlv-dialog',
    ) as HTMLElement;
    expect(surface.classList.contains('custom-surface')).toBe(true);
    expect(surface.classList.contains('mlv-dialog--enter')).toBe(true);
    surface.dispatchEvent(new Event('animationend'));
    expect(ref.animationState()).toBe('idle');
    ref.close();
    fixture.detectChanges();
    expect(surface.classList.contains('mlv-dialog--leave')).toBe(true);
    // Drain the ref's 250 ms leave fallback so it does not outlive the test.
    ref._onSurfaceAnimationEnd();
  });

  it('ignores animationend bubbling from descendants', async () => {
    const { ref, fixture } = await mount();
    fixture.nativeElement
      .querySelector('.inside')
      .dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(ref.animationState()).toBe('enter');
  });

  it("adds --confirm for appearance 'confirm'", async () => {
    const { fixture } = await mount({ appearance: 'confirm' });
    expect(
      fixture.nativeElement
        .querySelector('.mlv-dialog')
        .classList.contains('mlv-dialog--confirm'),
    ).toBe(true);
  });

  it('throws a descriptive error outside a dialog', () => {
    TestBed.configureTestingModule({
      imports: [MlvDialog],
      providers: [provideMlvI18nTesting()],
    });
    expect(() => TestBed.createComponent(MlvDialog)).toThrowError(
      /mlv-dialog.*MlvDialogService\.open/,
    );
  });
});

describe('mlv-dialog-header', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the title input as an h2 and labels the dialog with it', async () => {
    const { fixture, addLabel } = await mount({ title: 'Config title' });
    const title = fixture.nativeElement.querySelector(
      'h2.mlv-dialog__title',
    ) as HTMLElement;
    expect(title.textContent?.trim()).toBe('Input title');
    expect(title.id).toMatch(TITLE_ID);
    expect(addLabel).toHaveBeenCalledWith(expect.stringMatching(TITLE_ID));
  });

  it('prefers projected content over the config title', async () => {
    const { fixture, host } = await mount({ title: 'Config title' });
    host.withTitle.set(false);
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector(
      '.mlv-dialog__title',
    ) as HTMLElement;
    expect(title.tagName).toBe('DIV');
    expect(title.textContent?.trim()).toBe('Projected');
    expect(title.querySelector('h4')).not.toBeNull();
  });

  it('falls back to the config title when neither input nor content is given', async () => {
    const { fixture, host } = await mount({ title: 'Config title' });
    host.titleInput.set(undefined);
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('.mlv-dialog__title')
        ?.textContent?.trim(),
    ).toBe('Config title');
  });

  it('shows the close button by default and closes the dialog with it', async () => {
    const { fixture, close } = await mount();
    const x = fixture.nativeElement.querySelector(
      '.mlv-dialog__close button',
    ) as HTMLButtonElement;
    expect(x).not.toBeNull();
    x.click();
    expect(close).toHaveBeenCalledOnce();
  });

  it('resolves closable as input > config > default', async () => {
    const { fixture, host } = await mount({ closable: false });
    expect(
      fixture.nativeElement.querySelector('.mlv-dialog__close'),
    ).toBeNull();
    host.closable.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-dialog__close'),
    ).not.toBeNull();
  });

  it("forces the close button off for appearance 'confirm'", async () => {
    const { fixture, host } = await mount({ appearance: 'confirm' });
    host.closable.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-dialog__close'),
    ).toBeNull();
  });

  it('does not label the dialog when it renders no title at all', async () => {
    const { fixture, addLabel, removeLabel } = await mount({}, (host) =>
      host.titleInput.set(undefined),
    );
    expect(
      fixture.nativeElement
        .querySelector('.mlv-dialog__title')
        ?.textContent?.trim(),
    ).toBe('');
    expect(addLabel).not.toHaveBeenCalled();
    fixture.destroy();
    expect(removeLabel).not.toHaveBeenCalled();
  });

  it('labels the dialog once an asynchronous title renders', async () => {
    const { fixture, host, addLabel } = await mount({}, (partsHost) =>
      partsHost.titleInput.set(undefined),
    );
    expect(addLabel).not.toHaveBeenCalled();

    host.titleInput.set('Late title');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(addLabel).toHaveBeenCalledWith(expect.stringMatching(TITLE_ID));
  });

  it('unlabels the dialog when the title loses its text', async () => {
    const { fixture, host, addLabel, removeLabel } = await mount(
      {},
      (partsHost) => partsHost.titleInput.set(undefined),
    );
    host.titleInput.set('Late title');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(addLabel).toHaveBeenCalledWith(expect.stringMatching(TITLE_ID));

    host.titleInput.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(removeLabel).toHaveBeenCalledWith(expect.stringMatching(TITLE_ID));
  });

  it('does not leave a native title attribute on the host', async () => {
    // `<mlv-dialog-header title="…">` feeds the input; the static attribute must
    // not survive in the DOM or the whole header row grows a browser tooltip.
    const stub = stubRef();
    TestBed.configureTestingModule({
      imports: [StaticTitleHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvDialogRef, useValue: stub.ref },
        { provide: DIALOG_CONFIG, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(StaticTitleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector(
      'mlv-dialog-header',
    ) as HTMLElement;
    expect(header.hasAttribute('title')).toBe(false);
    expect(
      fixture.nativeElement
        .querySelector('h2.mlv-dialog__title')
        ?.textContent?.trim(),
    ).toBe('Static title');
  });

  it('unlabels the dialog when destroyed', async () => {
    const { fixture, removeLabel } = await mount();
    fixture.destroy();
    expect(removeLabel).toHaveBeenCalledWith(expect.stringMatching(TITLE_ID));
  });

  it('gives two headers in one dialog distinct title ids and registers both', async () => {
    const stub = stubRef();
    TestBed.configureTestingModule({
      imports: [TwoHeadersHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvDialogRef, useValue: stub.ref },
        { provide: DIALOG_CONFIG, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(TwoHeadersHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const ids = Array.from(
      root.querySelectorAll<HTMLElement>('.mlv-dialog__title'),
    ).map((el) => el.id);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(id).toMatch(TITLE_ID));
    expect(ids[0]).not.toBe(ids[1]);
    expect(stub.addLabel).toHaveBeenCalledWith(ids[0]);
    expect(stub.addLabel).toHaveBeenCalledWith(ids[1]);
  });
});

describe('mlv-dialog-body / mlv-dialog-footer / mlvDialogClose', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('body wraps content in the Malva scrollbar', async () => {
    const { fixture } = await mount();
    expect(
      fixture.nativeElement.querySelector(
        '.mlv-dialog__body .mlv-scrollbar .inside',
      ),
    ).not.toBeNull();
  });

  it('footer stamps the align modifier', async () => {
    const { fixture, host } = await mount();
    const footer = fixture.nativeElement.querySelector(
      '.mlv-dialog__footer',
    ) as HTMLElement;
    expect(footer.classList.contains('mlv-dialog__footer--align-end')).toBe(
      true,
    );
    host.align.set('between');
    fixture.detectChanges();
    expect(footer.classList.contains('mlv-dialog__footer--align-between')).toBe(
      true,
    );
    expect(footer.classList.contains('mlv-dialog__footer--align-end')).toBe(
      false,
    );
  });

  it('mlvDialogClose closes with its result and defaults type to button', async () => {
    const { fixture, close, ref } = await mount();
    const cancel = fixture.nativeElement.querySelector(
      '.cancel',
    ) as HTMLButtonElement;
    const ok = fixture.nativeElement.querySelector('.ok') as HTMLButtonElement;
    expect(cancel.getAttribute('type')).toBe('button');
    expect(ok.getAttribute('type')).toBe('submit');
    cancel.click();
    expect(close).toHaveBeenLastCalledWith(undefined);
    ok.click();
    expect(close).toHaveBeenLastCalledWith('ok');
    // The first click armed the ref's 250 ms leave fallback — drain it.
    ref._onSurfaceAnimationEnd();
  });

  it('behaves the same through the attribute forms, and adds no type to an anchor', async () => {
    const stub = stubRef();
    TestBed.configureTestingModule({
      imports: [AttributeHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvDialogRef, useValue: stub.ref },
        { provide: DIALOG_CONFIG, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(AttributeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(
      root.querySelector('.mlv-dialog__header h2.mlv-dialog__title')
        ?.textContent,
    ).toBe('Attr');
    expect(
      root.querySelector('.mlv-dialog__body .mlv-scrollbar .inside'),
    ).not.toBeNull();
    expect(
      root
        .querySelector('.mlv-dialog__footer')
        ?.classList.contains('mlv-dialog__footer--align-center'),
    ).toBe(true);

    const link = root.querySelector('.link') as HTMLAnchorElement;
    expect(link.hasAttribute('type')).toBe(false);
    // The directive closes on click and does not itself call
    // `preventDefault()`, so jsdom goes on to perform the `#` hash change.
    // Harmless here.
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(stub.close).toHaveBeenLastCalledWith('link');
    // Drain the ref's 250 ms leave fallback armed by that close.
    stub.ref._onSurfaceAnimationEnd();
  });
});
