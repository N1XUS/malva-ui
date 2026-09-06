import { Component, ElementRef, Injectable, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Subscription } from 'rxjs';
import { MlvResizeObserver } from './resize-observer';
import {
  MlvResizeObserverFactory,
  MlvResizeObserverService,
} from './resize-observer.service';

/**
 * Stand-in for the platform `ResizeObserver`, handed to the service through the
 * public {@link MlvResizeObserverFactory} seam. jsdom implements no
 * `ResizeObserver` at all, so every assertion below is about what the service
 * asks the platform to do, not about real layout.
 */
class FakeResizeObserver implements ResizeObserver {
  /** Every instance the factory has handed out, in construction order. */
  static instances: FakeResizeObserver[] = [];

  /** Elements currently observed by this instance. */
  readonly targets = new Set<Element>();

  /** Whether `disconnect()` has been called. */
  disconnected = false;

  constructor(private readonly _callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.disconnected = true;
    this.targets.clear();
  }

  /** Delivers a batch the way the platform would, for the given targets. */
  emit(...targets: Element[]): void {
    this._callback(
      targets.map((target) => ({ target }) as ResizeObserverEntry),
      this,
    );
  }
}

/** Factory that hands out {@link FakeResizeObserver}s and counts constructions. */
@Injectable()
class CountingFactory extends MlvResizeObserverFactory {
  override create(callback: ResizeObserverCallback): ResizeObserver {
    return new FakeResizeObserver(callback);
  }
}

/** Factory standing in for a server render, where `ResizeObserver` is absent. */
@Injectable()
class NullFactory extends MlvResizeObserverFactory {
  /** Number of times the service asked for an observer. */
  calls = 0;

  override create(): ResizeObserver | null {
    this.calls++;
    return null;
  }
}

describe('MlvResizeObserverService', () => {
  let service: MlvResizeObserverService;
  let elementA: HTMLElement;
  let elementB: HTMLElement;

  const observers = () => FakeResizeObserver.instances;
  const observerFor = (element: Element) =>
    observers().find((instance) => instance.targets.has(element));

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: MlvResizeObserverFactory, useClass: CountingFactory },
      ],
    });
    service = TestBed.inject(MlvResizeObserverService);
    elementA = document.createElement('div');
    elementB = document.createElement('div');
    document.body.append(elementA, elementB);
  });

  afterEach(() => {
    elementA.remove();
    elementB.remove();
  });

  // Descriptive, not prescriptive: this pins today's one-observer-per-element
  // topology so a future move to a shared observer (#15) is a deliberate edit
  // to this assertion rather than a silent change. Every other assertion in
  // this block is a contract that must survive such a move — in particular
  // `delivers a batch only to the stream of the element it was reported for`,
  // which is what the `entries[0]` reads in the consumers depend on.
  it('creates one ResizeObserver per distinct observed element', () => {
    const subscriptions: Subscription[] = [
      service.observe(elementA).subscribe(),
      service.observe(elementB).subscribe(),
    ];

    expect(observers().length).toBe(2);
    expect(observerFor(elementA)).not.toBe(observerFor(elementB));

    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  it('accepts an ElementRef as well as a raw Element', () => {
    const subscription = service.observe(new ElementRef(elementA)).subscribe();

    expect(observers().length).toBe(1);
    expect(observers()[0].targets.has(elementA)).toBe(true);

    subscription.unsubscribe();
  });

  it('refcounts a second observation of the same element onto one observer', () => {
    const seenByFirst: ResizeObserverEntry[][] = [];
    const seenBySecond: ResizeObserverEntry[][] = [];

    const first = service
      .observe(elementA)
      .subscribe((entries) => seenByFirst.push(entries));
    const second = service
      .observe(elementA)
      .subscribe((entries) => seenBySecond.push(entries));

    expect(observers().length).toBe(1);

    observers()[0].emit(elementA);
    expect(seenByFirst.length).toBe(1);
    expect(seenBySecond.length).toBe(1);

    first.unsubscribe();
    second.unsubscribe();
  });

  it('keeps the observer alive while another subscriber still holds the element', () => {
    const stillSubscribed: ResizeObserverEntry[][] = [];

    const first = service.observe(elementA).subscribe();
    const second = service
      .observe(elementA)
      .subscribe((entries) => stillSubscribed.push(entries));

    first.unsubscribe();

    expect(observers().length).toBe(1);
    expect(observers()[0].disconnected).toBe(false);

    observers()[0].emit(elementA);
    expect(stillSubscribed.length).toBe(1);

    second.unsubscribe();
  });

  it('disconnects the observer when the last subscriber for that element leaves', () => {
    const first = service.observe(elementA).subscribe();
    const second = service.observe(elementA).subscribe();

    first.unsubscribe();
    expect(observers()[0].disconnected).toBe(false);

    second.unsubscribe();
    expect(observers()[0].disconnected).toBe(true);
  });

  it('leaves other elements observing when one element is unobserved', () => {
    const seenForB: ResizeObserverEntry[][] = [];

    const forA = service.observe(elementA).subscribe();
    const forB = service
      .observe(elementB)
      .subscribe((entries) => seenForB.push(entries));

    forA.unsubscribe();

    const bObserver = observerFor(elementB);
    expect(bObserver).toBeDefined();
    expect(bObserver?.disconnected).toBe(false);

    bObserver?.emit(elementB);
    expect(seenForB.length).toBe(1);

    forB.unsubscribe();
  });

  it('delivers a batch only to the stream of the element it was reported for', () => {
    const seenForA: ResizeObserverEntry[][] = [];
    const seenForB: ResizeObserverEntry[][] = [];

    const forA = service
      .observe(elementA)
      .subscribe((entries) => seenForA.push(entries));
    const forB = service
      .observe(elementB)
      .subscribe((entries) => seenForB.push(entries));

    observerFor(elementA)?.emit(elementA);

    expect(seenForA.length).toBe(1);
    expect(seenForA[0][0].target).toBe(elementA);
    expect(seenForB.length).toBe(0);

    forA.unsubscribe();
    forB.unsubscribe();
  });

  it('builds a fresh observer when an element is re-observed after teardown', () => {
    const seen: ResizeObserverEntry[][] = [];

    service.observe(elementA).subscribe().unsubscribe();
    expect(observers().length).toBe(1);
    expect(observers()[0].disconnected).toBe(true);

    const second = service
      .observe(elementA)
      .subscribe((entries) => seen.push(entries));

    expect(observers().length).toBe(2);
    expect(observers()[1].disconnected).toBe(false);

    observers()[1].emit(elementA);
    expect(seen.length).toBe(1);

    second.unsubscribe();
  });

  it('disconnects every observer and completes every stream on destroy', () => {
    let completed = 0;

    service.observe(elementA).subscribe({ complete: () => completed++ });
    service.observe(elementB).subscribe({ complete: () => completed++ });

    service.ngOnDestroy();

    expect(completed).toBe(2);
    expect(observers().length).toBe(2);
    expect(observers().every((instance) => instance.disconnected)).toBe(true);
  });

  describe('without a platform ResizeObserver (server rendering)', () => {
    let nullFactory: NullFactory;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: MlvResizeObserverFactory, useClass: NullFactory },
        ],
      });
      service = TestBed.inject(MlvResizeObserverService);
      nullFactory = TestBed.inject(
        MlvResizeObserverFactory,
      ) as unknown as NullFactory;
    });

    it('subscribes and tears down without emitting or throwing', () => {
      let emissions = 0;

      const subscription = service
        .observe(elementA)
        .subscribe(() => emissions++);

      expect(nullFactory.calls).toBe(1);
      expect(emissions).toBe(0);

      subscription.unsubscribe();
      expect(emissions).toBe(0);
    });

    it('never touches a global ResizeObserver', () => {
      // The service must reach the platform only through the factory, so a
      // server render where the global is absent cannot throw.
      expect(nullFactory.calls).toBe(0);
      const subscription = service.observe(elementA).subscribe();
      expect(nullFactory.calls).toBe(1);
      subscription.unsubscribe();
    });
  });
});

describe('MlvResizeObserver directive', () => {
  @Component({
    selector: 'mlv-resize-observer-host',
    imports: [MlvResizeObserver],
    template: `<div
      mlvResizeObserver
      #probe="mlvResizeObserver"
      (resized)="count = count + 1"
    ></div>`,
  })
  class ResizeObserverHost {
    /** Number of `resized` emissions seen by the template binding. */
    count = 0;

    /** The directive instance, resolved through its `exportAs` name. */
    readonly probe = viewChild.required<MlvResizeObserver>('probe');
  }

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: MlvResizeObserverFactory, useClass: CountingFactory },
      ],
    });
  });

  it('is reachable from a template through exportAs "mlvResizeObserver"', async () => {
    const fixture = TestBed.createComponent(ResizeObserverHost);
    await fixture.whenStable();

    const directive = fixture.componentInstance.probe();
    expect(directive).toBeInstanceOf(MlvResizeObserver);
    expect(directive.elementRef.nativeElement.tagName).toBe('DIV');
  });

  it('emits resized for its own host element', async () => {
    const fixture = TestBed.createComponent(ResizeObserverHost);
    await fixture.whenStable();

    const host = fixture.componentInstance.probe().elementRef.nativeElement;
    const observer = FakeResizeObserver.instances.find((instance) =>
      instance.targets.has(host),
    );
    expect(observer).toBeDefined();

    observer?.emit(host);
    await fixture.whenStable();

    expect(fixture.componentInstance.count).toBe(1);
  });
});
