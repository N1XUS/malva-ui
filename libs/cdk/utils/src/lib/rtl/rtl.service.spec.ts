import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Directionality } from '@angular/cdk/bidi';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvRtlService } from './rtl.service';

function keyboardEvent(key = '', keyCode?: number): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', {
      configurable: true,
      value: keyCode,
    });
  }
  return event;
}

describe('MlvRtlService', () => {
  let service: MlvRtlService;
  let directionality: Directionality;
  let documentRef: Document;

  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    document.body.removeAttribute('dir');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlvRtlService);
    directionality = TestBed.inject(Directionality);
    documentRef = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    document.body.removeAttribute('dir');
  });

  it('defaults to LTR and synchronizes the document and CDK directionality', () => {
    expect(service.direction()).toBe('ltr');
    expect(service.rtl()).toBe(false);
    expect(documentRef.documentElement.dir).toBe('ltr');
    expect(directionality.value).toBe('ltr');
  });

  it('normalizes DOM arrow names to Angular CDK arrow codes in LTR', () => {
    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'))).toBe(
      LEFT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowRight'))).toBe(
      RIGHT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowUp'))).toBe(UP_ARROW);
    expect(service.normalizeArrowKey(keyboardEvent('ArrowDown'))).toBe(
      DOWN_ARROW,
    );
  });

  it('falls back to numeric CDK key codes when the DOM key is unavailable', () => {
    expect(service.normalizeArrowKey(keyboardEvent('', LEFT_ARROW))).toBe(
      LEFT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('', RIGHT_ARROW))).toBe(
      RIGHT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('', UP_ARROW))).toBe(
      UP_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('', DOWN_ARROW))).toBe(
      DOWN_ARROW,
    );
  });

  it('prefers a recognized DOM key over a contradictory legacy key code', () => {
    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowUp', LEFT_ARROW)),
    ).toBe(UP_ARROW);
  });

  it('swaps only horizontal arrow codes in RTL', () => {
    service.setDirection('rtl');

    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'))).toBe(
      RIGHT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowRight'))).toBe(
      LEFT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowUp'))).toBe(UP_ARROW);
    expect(service.normalizeArrowKey(keyboardEvent('ArrowDown'))).toBe(
      DOWN_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('', LEFT_ARROW))).toBe(
      RIGHT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('', RIGHT_ARROW))).toBe(
      LEFT_ARROW,
    );
  });

  it('updates the document and CDK directionality when direction changes', () => {
    const changes: string[] = [];
    directionality.change.subscribe((direction) => changes.push(direction));

    service.setRtl(true);

    expect(service.direction()).toBe('rtl');
    expect(service.rtl()).toBe(true);
    expect(documentRef.documentElement.dir).toBe('rtl');
    expect(directionality.value).toBe('rtl');
    expect(changes).toContain('rtl');

    service.toggle();
    expect(service.direction()).toBe('ltr');
    expect(documentRef.documentElement.dir).toBe('ltr');
    expect(directionality.value).toBe('ltr');
  });

  it('returns null for non-arrow keys', () => {
    expect(service.normalizeArrowKey(keyboardEvent('Enter'))).toBeNull();
    expect(service.normalizeArrowKey(keyboardEvent('Home'))).toBeNull();
    expect(service.normalizeArrowKey(keyboardEvent('', 13))).toBeNull();
  });
});

describe('MlvRtlService scoped direction', () => {
  let service: MlvRtlService;
  let host: HTMLElement;

  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlvRtlService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    document.documentElement.removeAttribute('dir');
  });

  it('resolves the global direction when no ancestor scopes it', () => {
    expect(service.resolveDirection(host)).toBe('ltr');

    service.setDirection('rtl');
    expect(service.resolveDirection(host)).toBe('rtl');
  });

  it('resolves the nearest ancestor dir over the global direction', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    const child = document.createElement('span');
    scope.appendChild(child);
    host.appendChild(scope);

    expect(service.direction()).toBe('ltr');
    expect(service.resolveDirection(child)).toBe('rtl');
    expect(service.resolveDirection(new ElementRef(child))).toBe('rtl');
  });

  it('skips dir="auto" scopes and keeps looking up the tree', () => {
    const outer = document.createElement('div');
    outer.setAttribute('dir', 'rtl');
    const auto = document.createElement('div');
    auto.setAttribute('dir', 'auto');
    outer.appendChild(auto);
    host.appendChild(outer);

    expect(service.resolveDirection(auto)).toBe('rtl');
  });

  it('mirrors arrow keys against the scope the target sits in, not the document', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    const child = document.createElement('span');
    scope.appendChild(child);
    host.appendChild(scope);

    // The document is still LTR; only the subtree is flipped. Callers hand
    // `normalizeArrowKey` a resolved direction — in a component that is a
    // cached `elementDirection` signal, here the equivalent one-off walk.
    expect(service.direction()).toBe('ltr');
    const direction = service.resolveDirection(child);

    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowLeft'), direction),
    ).toBe(RIGHT_ARROW);
    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowRight'), direction),
    ).toBe(LEFT_ARROW);
    expect(
      service.normalizeArrowKey(
        keyboardEvent('ArrowLeft'),
        service.resolveDirection(new ElementRef(child)),
      ),
    ).toBe(RIGHT_ARROW);
  });

  it('leaves vertical arrows alone inside a scoped RTL subtree', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    host.appendChild(scope);

    const direction = service.resolveDirection(scope);
    expect(direction).toBe('rtl');

    expect(service.normalizeArrowKey(keyboardEvent('ArrowUp'), direction)).toBe(
      UP_ARROW,
    );
    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowDown'), direction),
    ).toBe(DOWN_ARROW);
    expect(
      service.normalizeArrowKey(keyboardEvent('Home'), direction),
    ).toBeNull();
  });

  it('keeps an LTR island unmirrored while the document is RTL', () => {
    const island = document.createElement('div');
    island.setAttribute('dir', 'ltr');
    host.appendChild(island);
    service.setDirection('rtl');

    const direction = service.resolveDirection(island);
    expect(direction).toBe('ltr');

    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowLeft'), direction),
    ).toBe(LEFT_ARROW);
    expect(
      service.normalizeArrowKey(keyboardEvent('ArrowRight'), direction),
    ).toBe(RIGHT_ARROW);
  });

  it('falls back to the global direction when no direction is given', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    host.appendChild(scope);

    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'))).toBe(
      LEFT_ARROW,
    );

    service.setDirection('rtl');
    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'))).toBe(
      RIGHT_ARROW,
    );
  });

  it('falls back to the global direction for a null target', () => {
    service.setDirection('rtl');
    expect(service.resolveDirection(null)).toBe('rtl');
  });

  it('crosses an open shadow root to the scope around its host', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    const shadowHost = document.createElement('div');
    scope.appendChild(shadowHost);
    host.appendChild(scope);
    const inner = document.createElement('span');
    shadowHost.attachShadow({ mode: 'open' }).appendChild(inner);

    expect(service.resolveDirection(inner)).toBe('rtl');
  });

  it('resolves a detached node on a DOM without getRootNode instead of throwing', () => {
    // A directive in an `@if` view is constructed before its nodes are
    // inserted, and domino — the server DOM — implements no `getRootNode`.
    const detachedRoot = document.createElement('div');
    const child = document.createElement('span');
    detachedRoot.appendChild(child);
    for (const node of [detachedRoot, child]) {
      Object.defineProperty(node, 'getRootNode', { value: undefined });
    }
    service.setDirection('rtl');

    expect(service.resolveDirection(child)).toBe('rtl');
  });

  it('resolves a detached subtree rooted at <a href> or <area href> instead of throwing', () => {
    // `host` on these is the URL host string. A `getRootNode()`-based walk
    // took the detached root's `host` for a shadow host and stepped onto the
    // string, which has no DOM methods.
    const anchor = document.createElement('a');
    anchor.href = 'https://x/';
    const child = document.createElement('span');
    anchor.appendChild(child);
    const area = document.createElement('area');
    area.href = 'https://x/';
    service.setDirection('rtl');

    expect(service.resolveDirection(child)).toBe('rtl');
    expect(service.resolveDirection(anchor)).toBe('rtl');
    expect(service.resolveDirection(area)).toBe('rtl');
  });

  it('exposes a scoped direction signal that reacts to a global change', () => {
    const direction = TestBed.runInInjectionContext(() =>
      service.elementDirection(host),
    );

    expect(direction()).toBe('ltr');

    service.setDirection('rtl');
    expect(direction()).toBe('rtl');
  });

  it('exposes a scoped direction signal that reacts to an ancestor dir change', async () => {
    const scope = document.createElement('div');
    const child = document.createElement('span');
    scope.appendChild(child);
    host.appendChild(scope);

    const direction = TestBed.runInInjectionContext(() =>
      service.elementDirection(child),
    );
    expect(direction()).toBe('ltr');

    scope.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve));

    expect(direction()).toBe('rtl');
  });

  it('keeps the shared dir observer alive when the caller that started it is destroyed', async () => {
    @Component({ template: '' })
    class FirstCaller {
      readonly direction = inject(MlvRtlService).elementDirection(
        inject(ElementRef<HTMLElement>),
      );
    }

    // This component is the first `elementDirection` caller against this
    // service instance, so it is the one that starts the shared `dir`
    // observer. The second signal is created while that observer is running,
    // so it does not (and cannot) start one of its own — which is exactly why
    // the observer's lifetime has to be the service's and not the first
    // caller's.
    const fixture = TestBed.createComponent(FirstCaller);
    fixture.detectChanges();
    expect(fixture.componentInstance.direction()).toBe('ltr');

    const scope = document.createElement('div');
    const child = document.createElement('span');
    scope.appendChild(child);
    host.appendChild(scope);

    const survivor = TestBed.runInInjectionContext(() =>
      service.elementDirection(child),
    );
    expect(survivor()).toBe('ltr');

    fixture.destroy();

    scope.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve));

    expect(survivor()).toBe('rtl');
  });
});

describe('MlvRtlService.watchDirection', () => {
  let service: MlvRtlService;
  let host: HTMLElement;

  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlvRtlService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    document.documentElement.removeAttribute('dir');
  });

  it('does not report the direction the target already has', () => {
    const seen = vi.fn();
    const stop = service.watchDirection(host, seen);
    TestBed.tick();

    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('reports a global direction flip', () => {
    const seen = vi.fn();
    const stop = service.watchDirection(host, seen);
    TestBed.tick();

    service.setDirection('rtl');
    TestBed.tick();

    expect(seen).toHaveBeenCalledExactlyOnceWith('rtl');
    stop();
  });

  it('reports a scoped ancestor dir change', async () => {
    const child = document.createElement('span');
    host.appendChild(child);
    const seen = vi.fn();
    const stop = service.watchDirection(child, seen);
    TestBed.tick();

    host.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(seen).toHaveBeenCalledExactlyOnceWith('rtl');
    stop();
  });

  it('stops reporting once torn down', () => {
    const seen = vi.fn();
    service.watchDirection(host, seen)();

    service.setDirection('rtl');
    TestBed.tick();

    expect(seen).not.toHaveBeenCalled();
  });
});
