import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { apiEntryLoaders } from '../../../generated/api';
import { DocsTocService } from '../toc';
import type { TocEntry } from '../toc';
import type { ApiEntry, ApiMember, ApiMethod, ApiSymbol } from './api.types';

/** @private A member/method list split into own vs. base-class-grouped inherited. */
interface MemberGroups<T> {
  /** Members declared on the symbol itself. */
  own: T[];
  /** Inherited members, grouped by the base class they came from. */
  inherited: { from: string; members: T[] }[];
}

/** @private The per-subsection view model (slug + grouped members). */
interface Subsection<T> {
  /** Unique anchor id/slug for this subsection. */
  slug: string;
  /** The subsection's members split into own + inherited groups. */
  groups: MemberGroups<T>;
}

/** @private The rendered view model for a single {@link ApiSymbol}. */
interface SymbolView {
  /** The source symbol. */
  symbol: ApiSymbol;
  /** Unique anchor id/slug for the symbol section (h2). */
  slug: string;
  /** Inputs subsection, when the symbol has any. */
  inputs?: Subsection<ApiMember>;
  /** Outputs subsection, when the symbol has any. */
  outputs?: Subsection<ApiMember>;
  /** Properties subsection, when the symbol has any. */
  properties?: Subsection<ApiMember>;
  /** Methods subsection, when the symbol has any. */
  methods?: Subsection<ApiMethod>;
  /** Type-text subsection slug, for `type`/`interface`/`token` kinds. */
  typeSlug?: string;
}

/**
 * @private Slugifies a symbol/section name for use as an anchor id. Matches the
 * MDX plugin's algorithm so API and Examples anchors read the same way.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** @private Splits a member list into own members and inherited-by-base groups. */
function groupMembers<
  T extends { inherited?: boolean; inheritedFrom?: string },
>(members: T[]): MemberGroups<T> {
  const own = members.filter((m) => !m.inherited);
  const byBase = new Map<string, T[]>();
  for (const m of members) {
    if (!m.inherited) continue;
    const key = m.inheritedFrom ?? 'Inherited';
    const list = byBase.get(key);
    if (list) list.push(m);
    else byBase.set(key, [m]);
  }
  return {
    own,
    inherited: [...byBase].map(([from, members]) => ({ from, members })),
  };
}

/**
 * Renders the generated API reference for a documented library — one section per
 * exported symbol, with Inputs / Outputs / Methods tables and a type block,
 * reusing the docs' table + typography styling. Inherited members (walked from
 * base classes such as `FormControlBase` / `MlvOverlayHostBase`) render in a
 * labelled subgroup.
 *
 * The entry JSON is lazy-loaded per page via {@link apiEntryLoaders} keyed by the
 * kebab `name` input, so no API data lands in the initial bundle. If the page has
 * no extracted entry the component renders nothing.
 *
 * Each symbol section and each Inputs/Outputs/Methods subsection carries a unique
 * `id` (slug); once rendered, the viewer publishes those headings to
 * {@link DocsTocService} so the shell's "On this page" sidebar reflects the API
 * tab, and clears them on teardown.
 */
@Component({
  selector: 'docs-api-viewer',
  imports: [NgTemplateOutlet],
  templateUrl: './api-viewer.component.html',
  styleUrl: './api-viewer.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-api' },
})
export class ApiViewerComponent {
  /** The kebab docs-page name whose API entry to load (e.g. `button`, `form-field`). */
  readonly name = input.required<string>();

  /** @private Injector used to schedule a post-render publish from an async callback. */
  private readonly _injector = inject(Injector);

  /** @private ToC service the rendered headings are published to. */
  private readonly _tocService = inject(DocsTocService);

  /** @private The loaded API entry, or `null` before load / when the page has none. */
  private readonly _entry = signal<ApiEntry | null>(null);

  /** The loaded API entry, exposed for the template. */
  readonly entry = this._entry.asReadonly();

  /**
   * The per-symbol view models: unique slugs, grouped own/inherited members, and
   * which subsections are present. Both the template and the ToC publish read
   * from this so anchors and ToC entries always agree.
   */
  readonly sections = computed<SymbolView[]>(() => {
    const entry = this._entry();
    if (!entry) return [];

    const used = new Set<string>();
    const uniq = (base: string): string => {
      const root = base || 'symbol';
      let slug = root;
      let n = 2;
      while (used.has(slug)) slug = `${root}-${n++}`;
      used.add(slug);
      return slug;
    };

    return entry.symbols.map((symbol) => {
      const slug = uniq(slugify(symbol.name));
      const view: SymbolView = { symbol, slug };

      if (symbol.inputs.length > 0) {
        view.inputs = {
          slug: uniq(`${slug}-inputs`),
          groups: groupMembers(symbol.inputs),
        };
      }
      if (symbol.outputs.length > 0) {
        view.outputs = {
          slug: uniq(`${slug}-outputs`),
          groups: groupMembers(symbol.outputs),
        };
      }
      if (symbol.properties.length > 0) {
        view.properties = {
          slug: uniq(`${slug}-properties`),
          groups: groupMembers(symbol.properties),
        };
      }
      if (symbol.methods.length > 0) {
        view.methods = {
          slug: uniq(`${slug}-methods`),
          groups: groupMembers(symbol.methods),
        };
      }
      if (symbol.typeText) {
        view.typeSlug = uniq(`${slug}-type`);
      }
      return view;
    });
  });

  constructor() {
    // Load the page's entry when `name` resolves (constant per instance in
    // practice — a new page mounts a fresh viewer). Publish after the sections
    // render so the ToC observer can resolve the heading elements by id.
    effect(() => {
      const name = this.name();
      untracked(() => this._load(name));
    });

    inject(DestroyRef).onDestroy(() => this._tocService.clear(this));
  }

  /** @private Lazy-loads the entry for `name`; renders nothing gracefully if absent. */
  private _load(name: string): void {
    const loader = apiEntryLoaders[name];
    if (!loader) {
      this._entry.set(null);
      return;
    }
    loader()
      .then((entry) => {
        this._entry.set(entry);
        afterNextRender(() => this._publishHeadings(), {
          injector: this._injector,
        });
      })
      .catch(() => this._entry.set(null));
  }

  /**
   * @private Publishes the rendered symbol/subsection headings to the ToC service.
   * Derived from {@link sections} (the same source the template renders), so ids
   * and ToC slugs always match.
   */
  private _publishHeadings(): void {
    const entries: TocEntry[] = [];
    for (const view of this.sections()) {
      entries.push({ level: 2, text: view.symbol.name, slug: view.slug });
      if (view.inputs)
        entries.push({ level: 3, text: 'Inputs', slug: view.inputs.slug });
      if (view.outputs)
        entries.push({ level: 3, text: 'Outputs', slug: view.outputs.slug });
      if (view.properties)
        entries.push({
          level: 3,
          text: 'Properties',
          slug: view.properties.slug,
        });
      if (view.methods)
        entries.push({ level: 3, text: 'Methods', slug: view.methods.slug });
      if (view.typeSlug)
        entries.push({ level: 3, text: 'Type', slug: view.typeSlug });
    }
    this._tocService.publish(this, entries);
  }
}
