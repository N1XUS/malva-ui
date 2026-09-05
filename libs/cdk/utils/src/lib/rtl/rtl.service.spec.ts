import { DOCUMENT } from '@angular/common';
import { ElementRef } from '@angular/core';
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

    // The document is still LTR; only the subtree is flipped.
    expect(service.direction()).toBe('ltr');

    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'), child)).toBe(
      RIGHT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowRight'), child)).toBe(
      LEFT_ARROW,
    );
    expect(
      service.normalizeArrowKey(
        keyboardEvent('ArrowLeft'),
        new ElementRef(child),
      ),
    ).toBe(RIGHT_ARROW);
  });

  it('leaves vertical arrows alone inside a scoped RTL subtree', () => {
    const scope = document.createElement('div');
    scope.setAttribute('dir', 'rtl');
    host.appendChild(scope);

    expect(service.normalizeArrowKey(keyboardEvent('ArrowUp'), scope)).toBe(
      UP_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowDown'), scope)).toBe(
      DOWN_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('Home'), scope)).toBeNull();
  });

  it('keeps an LTR island unmirrored while the document is RTL', () => {
    const island = document.createElement('div');
    island.setAttribute('dir', 'ltr');
    host.appendChild(island);
    service.setDirection('rtl');

    expect(service.normalizeArrowKey(keyboardEvent('ArrowLeft'), island)).toBe(
      LEFT_ARROW,
    );
    expect(service.normalizeArrowKey(keyboardEvent('ArrowRight'), island)).toBe(
      RIGHT_ARROW,
    );
  });

  it('falls back to the global direction when no target is given', () => {
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
