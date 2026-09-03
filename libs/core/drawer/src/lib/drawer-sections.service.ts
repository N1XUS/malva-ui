import type { ElementRef, OnDestroy, Signal } from '@angular/core';
import { afterRenderEffect, computed, Injectable, signal } from '@angular/core';
import { cloneDeep, sortBy } from 'lodash-es';

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

  readonly currentScrolledSection = computed(() => {
    const bestFit = sortBy(Object.values(this.intersectedSections()), [
      'threshold',
    ]).reverse()[0];

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
        const shallowIntersectedSections = cloneDeep(
          this.intersectedSections() || {},
        );

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
