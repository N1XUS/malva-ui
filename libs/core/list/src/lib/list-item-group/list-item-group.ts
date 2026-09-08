import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MLV_LIST } from '../list/list-token';

@Component({
  selector: 'mlv-list-item-group',
  imports: [LucideChevronRight],
  templateUrl: './list-item-group.html',
  styleUrl: './list-item-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item-group',
    // `<mlv-list-item-group>` is projected straight into `<mlv-list>`, whose
    // host claims a container role. A container role owns every roled or
    // focusable descendant it reaches through roleless wrappers, so with no
    // role here the group's own toggler `<button>` became a direct child of
    // `role="list"` — which may own nothing but `listitem` (axe
    // `aria-required-children`, WCAG 1.3.1), and the whole list stopped being
    // exposed as a list. Claiming `listitem` makes the group one row of the
    // outer list and puts the toggler inside it; the content region then
    // claims `role="list"` in the template so the rows nested under it still
    // have the `list` context `listitem` requires. This is the
    // `<li><button aria-expanded><ul>…</ul></li>` disclosure shape.
    //
    // Unconditional, because a group *is* a list section: it is documented as
    // a child of `<mlv-list>`, and every shipped consumer puts it in one at the
    // default `listRole="list"` (`apps/docs/.../pages/list/examples/5` and
    // `/8`, both `variant="inset"`). A consumer who overrides `listRole` — the
    // input exists for exactly that, and six sites already use it — would put a
    // `listitem` inside e.g. `role="menu"`, which owns no such child. Deriving
    // both roles from the parent list is tracked separately; nothing ships that
    // shape today. Note `libs/core/src/ssr-smoke.spec.ts` renders the group
    // outside any list, so this role is not conditional on finding a parent.
    role: 'listitem',
    '[class.mlv-list-item-group--toggled]': '_expanded()',
    '[class.mlv-list-item-group--pinned]': '_pinnedOpen()',
  },
})
export class MlvListItemGroup {
  /** Visible section label — rendered on the toggler, or alone when pinned. */
  readonly label = input.required<string>();

  /**
   * Whether the group is expanded.
   *
   * A **live** binding, not merely an initial value: a user toggle wins until
   * this input changes again, and any change re-seeds the resolved state. (A
   * consumer re-publishing the value it already holds is not a change, so it
   * does not clobber a toggle.) These are `model()`'s semantics, preserved by
   * an internal `linkedSignal`.
   *
   * A coerced boolean, so both the attribute form (`<mlv-list-item-group open>`)
   * and a binding (`[open]="expanded()"`) work. Pair it with `(openChange)` —
   * or write `[(open)]` — to follow the user's own toggling. Being an `input()`
   * it is read-only from a template reference: bind it from your own signal
   * rather than reaching for `groupRef.open.set(…)`, which does not compile.
   *
   * Ignored while the enclosing list pins the group open (`variant="inset"`),
   * where the content is always rendered expanded and no toggler exists.
   */
  readonly open = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits the new expanded state whenever the user activates the toggler, or
   * {@link toggle} is called. Completes the two-way `[(open)]` pair.
   */
  readonly openChange = output<boolean>();

  /**
   * @protected Resolved expanded state. Seeded from `open` — and re-seeded
   * whenever it changes — but writable, so a user toggle is not lost when the
   * consumer binds `open` one-way. These are `model()`'s semantics; `model()`
   * itself cannot carry a `transform`, which is what left the documented bare
   * `open` attribute binding the empty string and reading falsy.
   *
   * **This is not the "is the content on screen?" predicate.** That is
   * `_expanded() || _pinnedOpen()` — a pinned (inset) group renders its content
   * expanded with `_expanded()` false, because the open-state CSS hangs off
   * `--pinned` as well as off `--toggled`. Anything that gates the content
   * region must read the pair. The queued case is #221 (keeping collapsed
   * content out of the tab order): the obvious `[attr.inert]="!_expanded()"`
   * would make the **visible** rows of every inset section inert and drop every
   * control in them from the tab order.
   *
   * The `--toggled` class is not the predicate either, and it fails in the
   * direction that hides the bug: `open` coerces now, so an inset group written
   * `<mlv-list-item-group open>` carries `--toggled` *and* `--pinned`. A
   * regression spec written against `apps/docs` list examples 5 and 8 (both
   * bare `open`) would therefore pass while `list.spec.ts`'s
   * `InsetListGroupsHost` (inset, no `open`) breaks. Cover both.
   */
  protected readonly _expanded = linkedSignal(() => this.open());

  /**
   * @private The enclosing `mlv-list`, when the group is declared inside one.
   * Optional: `ssr-smoke.spec.ts` and any standalone use render it with no list.
   */
  private readonly _list = inject(MLV_LIST, { optional: true });

  /**
   * @protected Whether the enclosing list's variant pins this group's content
   * open. `inset` renders sections as always-expanded cards — the stylesheet
   * holds `__content` at `grid-template-rows: 1fr` — so a toggler there would
   * be a `<button aria-expanded>` describing content it does not control
   * (WCAG 4.1.2). None is rendered; a plain section label takes its place.
   */
  protected readonly _pinnedOpen = computed(
    () => this._list?.variant() === 'inset',
  );

  /** @protected Unique ID for the collapsible content region. */
  protected readonly _contentId = mlvNextId('mlv-list-group-content');

  /**
   * @protected Unique ID for the pinned section label, which names the content
   * region in place of the toggler that would otherwise own it.
   */
  protected readonly _labelId = mlvNextId('mlv-list-group-label');

  /**
   * Flips the expanded state and emits `openChange`.
   *
   * Visually a no-op inside a list whose variant pins the group open — nothing
   * renders a toggler there, and the content stays expanded either way.
   */
  toggle(): void {
    const next = !this._expanded();
    this._expanded.set(next);
    this.openChange.emit(next);
  }
}
