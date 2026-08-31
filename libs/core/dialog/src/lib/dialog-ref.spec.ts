import type { CdkDialogContainer, DialogRef } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { MlvDialogRef } from './dialog-ref';

interface Stub {
  cdkRef: DialogRef<string>;
  closed: Subject<string | undefined>;
  keydownEvents: Subject<KeyboardEvent>;
  backdropClick: Subject<MouseEvent>;
  close: ReturnType<typeof vi.fn>;
  addLabel: ReturnType<typeof vi.fn>;
  removeLabel: ReturnType<typeof vi.fn>;
  backdrop: HTMLElement;
  detachContainer(): void;
}

function stubCdkRef(): Stub {
  const closed = new Subject<string | undefined>();
  const keydownEvents = new Subject<KeyboardEvent>();
  const backdropClick = new Subject<MouseEvent>();
  const addLabel = vi.fn();
  const removeLabel = vi.fn();
  const backdrop = document.createElement('div');
  const container = {
    _addAriaLabelledBy: addLabel,
    _removeAriaLabelledBy: removeLabel,
  } as unknown as CdkDialogContainer;
  const cdkRef = {
    id: 'cdk-dialog-7',
    closed,
    keydownEvents,
    backdropClick,
    containerInstance: container,
    overlayRef: { backdropElement: backdrop },
    close: vi.fn((result?: string) => {
      cdkRef.containerInstance = null as unknown as CdkDialogContainer;
      closed.next(result);
      closed.complete();
    }),
    updateSize: vi.fn(),
    addPanelClass: vi.fn(),
    removePanelClass: vi.fn(),
  } as unknown as DialogRef<string> & { containerInstance: CdkDialogContainer };
  return {
    cdkRef,
    closed,
    keydownEvents,
    backdropClick,
    close: cdkRef.close as ReturnType<typeof vi.fn>,
    addLabel,
    removeLabel,
    backdrop,
    detachContainer: () => {
      cdkRef.containerInstance = null as unknown as CdkDialogContainer;
    },
  };
}

describe('MlvDialogRef', () => {
  it('exposes id, data and config from the CDK ref and consumer config', () => {
    const stub = stubCdkRef();
    const config = { data: { label: 'x' }, size: 's' };
    const ref = new MlvDialogRef<string, { label: string }>(
      stub.cdkRef,
      config,
    );
    expect(ref.id).toBe('cdk-dialog-7');
    expect(ref.data).toEqual({ label: 'x' });
    expect(ref.config).toBe(config);
    expect(ref.animationState()).toBe('enter');
  });

  it('close() emits beforeClose synchronously, starts the leave animation and defers the CDK close', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    const before = vi.fn();
    ref.beforeClose().subscribe(before);

    ref.close('r');

    expect(before).toHaveBeenCalledOnce();
    expect(ref.animationState()).toBe('leave');
    expect(
      stub.backdrop.classList.contains('mlv-dialog-backdrop--leaving'),
    ).toBe(true);
    expect(stub.close).not.toHaveBeenCalled();
    // Drain the 250 ms leave fallback so it does not outlive the test.
    ref._onSurfaceAnimationEnd();
  });

  it('finishes the close with the result when the surface leave animation ends', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    const after = vi.fn();
    ref.afterClosed().subscribe(after);

    ref.close('r');
    ref._onSurfaceAnimationEnd();

    expect(stub.close).toHaveBeenCalledExactlyOnceWith('r');
    expect(after).toHaveBeenCalledExactlyOnceWith('r');
  });

  it('falls back to closing after 250 ms when no animationend arrives', () => {
    vi.useFakeTimers();
    try {
      const stub = stubCdkRef();
      const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
      ref.close('slow');
      vi.advanceTimersByTime(249);
      expect(stub.close).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(stub.close).toHaveBeenCalledExactlyOnceWith('slow');
    } finally {
      vi.useRealTimers();
    }
  });

  it('is idempotent: repeated close() calls keep the first result and close once', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    const before = vi.fn();
    ref.beforeClose().subscribe(before);

    ref.close('first');
    ref.close('second');
    ref._onSurfaceAnimationEnd();
    ref._onSurfaceAnimationEnd();

    expect(before).toHaveBeenCalledOnce();
    expect(stub.close).toHaveBeenCalledExactlyOnceWith('first');
  });

  it("moves from 'enter' to 'idle' when the enter animation ends", () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    ref._onSurfaceAnimationEnd();
    expect(ref.animationState()).toBe('idle');
    expect(stub.close).not.toHaveBeenCalled();
  });

  it('labels the container through the aria-labelledby queue and tolerates a detached container', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    ref._labelBy('t1');
    expect(stub.addLabel).toHaveBeenCalledWith('t1');
    stub.detachContainer();
    expect(() => ref._unlabelBy('t1')).not.toThrow();
    expect(stub.removeLabel).not.toHaveBeenCalled();
  });

  it('marks itself closed when the CDK ref closes on its own (navigation, closeAll)', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    stub.close();
    ref.close('late');
    ref._onSurfaceAnimationEnd();
    expect(stub.close).toHaveBeenCalledOnce();
    expect(ref.animationState()).toBe('enter');
  });

  it('exposes the CDK keydown and backdrop-click streams as-is', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    expect(ref.keydownEvents()).toBe(stub.keydownEvents);
    expect(ref.backdropClick()).toBe(stub.backdropClick);

    const keydown = vi.fn();
    const click = vi.fn();
    ref.keydownEvents().subscribe(keydown);
    ref.backdropClick().subscribe(click);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    stub.keydownEvents.next(event);
    stub.backdropClick.next(new MouseEvent('click'));

    expect(keydown).toHaveBeenCalledExactlyOnceWith(event);
    expect(click).toHaveBeenCalledOnce();
  });

  it('forwards updateSize/addPanelClass/removePanelClass to the CDK ref', () => {
    const stub = stubCdkRef();
    const ref = new MlvDialogRef<string, unknown>(stub.cdkRef, {});
    expect(ref.updateSize('10rem', '5rem')).toBe(ref);
    expect(ref.addPanelClass('a')).toBe(ref);
    expect(ref.removePanelClass(['a'])).toBe(ref);
    expect(stub.cdkRef.updateSize).toHaveBeenCalledWith('10rem', '5rem');
    expect(stub.cdkRef.addPanelClass).toHaveBeenCalledWith('a');
    expect(stub.cdkRef.removePanelClass).toHaveBeenCalledWith(['a']);
  });
});
