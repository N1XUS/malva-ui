import type { ElementRef, OnDestroy, Signal } from '@angular/core';
import { afterRenderEffect, computed, Injectable, signal } from '@angular/core';

export interface MlvDrawerSectionState {
  id: Signal<string>;
  label: Signal<string>;
  elementRef: ElementRef;
}

export interface MlvDrawerSectionConfig {
  id: string;
  label: string;
  element: ElementRef;
}

export interface MlvDrawerSectionIntersection {
  intersecting: boolean;
  threshold: number;
  id: string;
}

@Injectable()
export class MlvDrawerSectionsService implements OnDestroy {
  readonly sections = signal(new Map<string, MlvDrawerSectionState>());

  readonly intersectedSections = signal<
    Record<string, MlvDrawerSectionIntersection>
  >({});

  /**
   * The registered section with the highest intersection ratio in
   * `intersectedSections`.
   *
   * - The highest `threshold` wins.
   * - A tie at the highest ratio goes to the entry recorded last — the last
   *   one in `Object.values(intersectedSections())` order.
   * - A `NaN` ratio never wins.
   *
   * Resolves to no section when nothing has intersected yet, or when the
   * winning id belongs to no registered section.
   */
  readonly currentScrolledSection = computed(() => {
    let bestFit: MlvDrawerSectionIntersection | undefined;
    for (const candidate of Object.values(this.intersectedSections())) {
      // `>=` hands a tie to the later entry; the `-Infinity` seed lets a first
      // entry of any real ratio in while a `NaN` fails every comparison.
      if (candidate.threshold >= (bestFit?.threshold ?? -Infinity)) {
        bestFit = candidate;
      }
    }

    return bestFit ? this.sections().get(bestFit.id) : null;
  });

  readonly normalizedSections = computed<MlvDrawerSectionState[]>(() => {
    const sections = Array.from(this.sections().values());

    return sections;
  });

  private _observer: IntersectionObserver | null = null;

  constructor() {
    // `afterRenderEffect`, not `effect`: `initObservers` constructs an
    // `IntersectionObserver`, a browser global Node does not define, and a
    // plain `effect` runs during server-side change detection — so the service
    // threw the moment it was constructed on a server. Render hooks never run
    // on the server at all, which removes the failure rather than guarding it.
    //
    // `normalizedSections()` is read for its dependency, not its value: it is
    // what re-initialises the observer as sections register and unregister,
    // otherwise newly added sections would never be tracked.
    afterRenderEffect(() => {
      this.normalizedSections();
      this.initObservers();
    });
  }

  /**
   * Registers a section so it appears in `normalizedSections` and is observed
   * for scroll position.
   *
   * A **new** `Map` is stored rather than the existing one being mutated:
   * signals compare with `Object.is`, so returning the same reference from
   * `update()` is not a change and neither `normalizedSections` nor the
   * observer effect would ever see the section.
   */
  register(section: MlvDrawerSectionState) {
    this.sections.update((sections) =>
      new Map(sections).set(section.id(), section),
    );
  }

  /** Removes a section from tracking. See {@link register} for why the map is copied. */
  unregister(section: MlvDrawerSectionState) {
    this.sections.update((sections) => {
      const next = new Map(sections);
      next.delete(section.id());
      return next;
    });
  }

  destroyObservers(): void {
    this._observer?.disconnect();
    this._observer = null;
    this.intersectedSections.set({});
  }

  initObservers(): void {
    this.destroyObservers();

    this._observer = new IntersectionObserver(
      (entries) => {
        // A shallow copy is enough: every entry below is replaced wholesale,
        // never written in place, so the snapshot a reader already holds keeps
        // its values. What the copy must provide is a **new** record, because
        // the signal compares with `Object.is`.
        const shallowIntersectedSections = { ...this.intersectedSections() };

        entries.forEach((entry) => {
          shallowIntersectedSections[entry.target.id] = {
            intersecting: entry.isIntersecting,
            threshold: entry.intersectionRatio,
            id: entry.target.id,
          };
        });

        this.intersectedSections.set(shallowIntersectedSections);
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    this.normalizedSections().forEach((section) => {
      this._observer?.observe(section.elementRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.sections().clear();
    this.destroyObservers();
  }
}
