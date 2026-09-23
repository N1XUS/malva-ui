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

/**
 * Container roles whose ARIA children include `group` — the roles under which
 * a labelled section of rows can be expressed at all.
 *
 * Read off the WAI-ARIA required-owned-elements table (the same table axe-core
 * 4.12.1 ships as `ariaRoles[<role>].requiredOwned`); these four are exhaustive
 * as of that version:
 *
 * - `listbox` → `['group', 'option']`
 * - `menu` → `['group', 'menuitemradio', 'menuitem', 'menuitemcheckbox', 'menu', 'separator']`
 * - `menubar` → the same list as `menu`
 * - `tree` → `['group', 'treeitem']`
 *
 * Every other container role in that table owns a closed set that `group` is
 * not in (`list` → `['listitem']`, `tablist` → `['tab']`, `table`/`grid`/
 * `treegrid` → `['rowgroup', 'row']`, and so on), so under those the group has
 * no role it may claim and claims none.
 */
const GROUP_OWNING_CONTAINER_ROLES: ReadonlySet<string> = new Set([
  'listbox',
  'menu',
  'menubar',
  'tree',
]);

/**
 * Container roles that require particular owned children — minus `list`, which
 * {@link MlvListItemGroup._hostRole} already covers by claiming `listitem`, the
 * one role such a container records and stops at.
 *
 * Inside one of these a `<button>` toggler is an unallowed owned child: a
 * container owns every roled or focusable descendant it reaches through
 * roleless wrappers, and axe *flattens* a `role="group"` child a container
 * requires, so a `group` is no shield either. Under every role **not** in this
 * set — `toolbar`, `radiogroup`, `region`, `group`, a typo such as `lst`, a
 * role ARIA has never heard of — a `<button>` is perfectly legal and the group
 * stays collapsible. See {@link MlvListItemGroup._alwaysOpen}.
 *
 * **This set is enumerable precisely because it is the closed side.** Exactly
 * thirteen roles carry a `requiredOwned` list in axe-core 4.12.1's role table —
 * `feed`, `grid`, `list`, `listbox`, `menu`, `menubar`, `row`, `rowgroup`,
 * `suggestion`, `table`, `tablist`, `tree`, `treegrid`; re-derive with
 * `Object.entries(axe.utils.getStandards().ariaRoles).filter(([, d]) => Array.isArray(d.requiredOwned))`.
 * Every other role owns nothing at all, and `ariaRequiredChildrenEvaluate`
 * proves it: it reads `requiredOwned(role)`, which answers `null` for any role
 * declaring no array, and returns `true` on the spot. It is the *complement* —
 * "every role that owns no children" — that is the open set.
 *
 * It is nonetheless a **snapshot of ARIA** and can drift: a role that later
 * gains required children, or an axe upgrade, wants this list re-derived. Drift
 * is one-directional and graceful — a newly child-requiring role missing from
 * here renders a toggler that raises `aria-required-children`, which a sweep
 * catches; nothing crashes and no consumer silently loses a control.
 */
const CHILD_REQUIRING_CONTAINER_ROLES: ReadonlySet<string> = new Set([
  'feed',
  'grid',
  'listbox',
  'menu',
  'menubar',
  'row',
  'rowgroup',
  'suggestion',
  'table',
  'tablist',
  'tree',
  'treegrid',
]);

@Component({
  selector: 'mlv-list-item-group',
  imports: [LucideChevronRight],
  templateUrl: './list-item-group.html',
  styleUrl: './list-item-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-list-item-group',
    // Derived from the enclosing list's `listRole` — see `_hostRole`. It was a
    // static `role="listitem"` until #224: correct under the default
    // `role="list"` and wrong everywhere else, including outside a list, where
    // a `listitem` has no required `list` parent at all.
    '[attr.role]': '_hostRole()',
    '[class.mlv-list-item-group--toggled]': '_expanded()',
    '[class.mlv-list-item-group--pinned]': '_alwaysOpen()',
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
   * Ignored wherever no toggler is rendered and the content is therefore always
   * on screen — see {@link _alwaysOpen}.
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
   * {@link _contentVisible} — read it, and never this signal, when gating the
   * content region.
   */
  protected readonly _expanded = linkedSignal(() => this.open());

  /**
   * @private The enclosing `mlv-list`, when the group is declared inside one.
   * Optional: `ssr-smoke.spec.ts` and any standalone use render it with no list.
   */
  private readonly _list = inject(MLV_LIST, { optional: true });

  /**
   * @private The ARIA role the enclosing list renders, or `null` when this
   * group resolves no list.
   *
   * `null` is genuinely "no container", not "the default container": DI here is
   * lexical, so a group merely *projected* into a list resolves nothing, and a
   * group used on its own resolves nothing either.
   */
  private readonly _parentRole = computed(() => this._list?.listRole() ?? null);

  /**
   * @protected ARIA role for the group's own host element, or `null` for none.
   *
   * `listitem` **only** under the default `role="list"`, where the group is one
   * row of the outer list and the `<li><button aria-expanded><ul>…</ul></li>`
   * disclosure shape applies. Anywhere else it is `null`:
   *
   * - Under `menu` / `menubar` / `listbox` / `tree` the container owns no
   *   `listitem`, and the grouping role those *do* own is expressed on the
   *   content region instead (see {@link _contentRole}) — putting `group` here
   *   as well would nest a second, identically labelled group inside the first.
   * - Under any other container role there is no role to claim.
   * - With **no** enclosing list, `role="listitem"` is a dangling required
   *   parent — `listitem`'s ARIA required context is `list`, and there is none.
   *   That is the shape `libs/core/src/ssr-smoke.spec.ts` renders, and it was a
   *   live `aria-required-parent` violation until #224.
   *
   * Emitting nothing is always safe: a roleless, non-focusable element with no
   * global ARIA attribute is transparent to a container's owned-children check,
   * so whatever the container is, it sees straight through to the rows.
   */
  protected readonly _hostRole = computed<string | null>(() =>
    this._parentRole() === 'list' ? 'listitem' : null,
  );

  /**
   * @protected ARIA role for the collapsible content region, or `null` for none.
   *
   * The region exists to give the projected rows the container context their
   * own roles require, so its role follows the container the group sits in:
   *
   * | enclosing `listRole` | content role | why                                                         |
   * | -------------------- | ------------ | ----------------------------------------------------------- |
   * | `list` (default)     | `list`       | a `listitem` may not contain another; the rows need a `list` |
   * | none (no list)       | `list`       | the group *is* the list — its documented content is rows     |
   * | `menu` / `menubar` / `listbox` / `tree` | `group` | the one grouping role those containers own     |
   * | anything else        | `null`       | no valid role exists; stay transparent                       |
   *
   * The last row covers **two** shapes that differ in whether a toggler is
   * rendered — the other child-requiring containers (`tablist`, `grid`, …),
   * which suppress it, and everything else (`toolbar`, an unknown value), which
   * does not. Neither may claim a role here: under the first the role would be
   * an unallowed owned child, and under the second there is no container
   * semantic for a `list` of rows to sit in. See {@link _alwaysOpen}.
   *
   * `group` rather than a nested `menu` / `listbox`: a nested `menu` is a
   * *submenu*, a pattern `mlv-menu` already owns and one that would need a
   * controlling `menuitem` with `aria-haspopup`. `group` is what the container
   * roles above actually list as their sectioning child, and it is what
   * `mlv-menu-group` and `mlv-dropdown-panel`'s own APG listbox groups already
   * render for the identical job.
   */
  protected readonly _contentRole = computed<string | null>(() => {
    const parent = this._parentRole();
    if (parent === null || parent === 'list') {
      return 'list';
    }
    return GROUP_OWNING_CONTAINER_ROLES.has(parent) ? 'group' : null;
  });

  /**
   * @protected Whether this group renders **no** disclosure toggler — and its
   * content is therefore always on screen.
   *
   * Two independent reasons, neither of which is "the group is expanded":
   *
   * 1. `variant="inset"` pins the content open in CSS (the stylesheet holds
   *    `__content` at `grid-template-rows: 1fr`), so a toggler would be a
   *    `<button aria-expanded>` describing content it does not control — WCAG
   *    4.1.2.
   * 2. The enclosing list claims a container role that **requires** particular
   *    owned children — one of {@link CHILD_REQUIRING_CONTAINER_ROLES}. A
   *    container owns every roled or focusable descendant it reaches through
   *    roleless wrappers — and axe *flattens* a `role="group"` child when the
   *    container requires one, so a `group` is no shield either. Only under
   *    `role="list"` does the group hold a role (`listitem`) that the container
   *    stops at, which is what keeps the toggler out of the container's
   *    owned-children set. Under the other twelve the `<button>` would be read
   *    as a direct child of the container, and none of them owns `button`.
   *
   * Reason 2 is a **closed-set** test, not a catch-all, and that is deliberate.
   * Reading it the other way round — "any `listRole` other than `list`" —
   * silently removes a control that is provably legal: `toolbar`, `radiogroup`,
   * `region`, `group` and every unrecognised or misspelt value own no children
   * at all, so `ariaRequiredChildrenEvaluate` returns `true` for them before it
   * looks at anything, and a `<button>` inside raises nothing (measured: a
   * `role="toolbar"` container holding this toggler sweeps clean, and so does a
   * typo'd `role="lst"`, which raises only `aria-roles` about the name itself).
   * Suppressing there would turn a fat-fingered `listRole` into every section
   * of that list being permanently expanded with `toggle()` and `[(open)]`
   * quietly inert. The enumeration is possible because the child-requiring side
   * is the closed one — see {@link CHILD_REQUIRING_CONTAINER_ROLES}.
   *
   * No shipped composition is affected either way: every `mlv-list-item-group`
   * in the workspace sits in a default `role="list"`.
   *
   * A plain section label takes the toggler's place wherever this is true.
   */
  protected readonly _alwaysOpen = computed(() => {
    if (this._list?.variant() === 'inset') {
      return true;
    }
    const parent = this._parentRole();
    return parent !== null && CHILD_REQUIRING_CONTAINER_ROLES.has(parent);
  });

  /**
   * @protected Whether the content region is on screen — the **only** predicate
   * anything gating that region may read.
   *
   * A group's content is visible for either of two independent reasons, and
   * neither alone is the answer:
   *
   * - `_expanded()` — the user (or `open`) disclosed it, in a list that lets
   *   the group collapse;
   * - `_alwaysOpen()` — nothing renders a toggler, so nothing can ever close
   *   it. For `variant="inset"` the stylesheet expresses that on `--pinned`,
   *   entirely independently of `--toggled`.
   *
   * So a pinned group renders its rows on screen with `_expanded()` false, and
   * `!_expanded()` is **not** "collapsed". Using it to gate {@link _contentId}'s
   * region — the shape #221 invites — would mark the visible rows of every
   * inset section inert and drop every control in them out of the tab order.
   * The `--toggled` class is no better, and fails in the direction that hides
   * the mistake: since #220 `open` coerces, so an inset group written
   * `<mlv-list-item-group open>` carries `--toggled` *and* `--pinned`. A
   * regression spec written against `apps/docs` list examples 5 and 8 (both
   * bare `open`) would pass while `list.spec.ts`'s `InsetListGroupsHost`
   * (inset, no `open`) broke. `list-item-group.spec.ts` covers all four states.
   */
  protected readonly _contentVisible = computed(
    () => this._expanded() || this._alwaysOpen(),
  );

  /** @protected Unique ID for the collapsible content region. */
  protected readonly _contentId = mlvNextId('mlv-list-group-content');

  /**
   * @protected Unique ID for the pinned section label, which names the content
   * region in place of the toggler that would otherwise own it.
   */
  protected readonly _labelId = mlvNextId('mlv-list-group-label');

  /**
   * @protected The id the content region points `aria-labelledby` at, or `null`
   * for no attribute.
   *
   * Set only when there is both a label element to point at (no toggler) *and*
   * a role on the region to name. Naming a **roleless** region would be worse
   * than not naming it: `aria-labelledby` is a global ARIA attribute, so it
   * makes the region a container-owned child in its own right — with no role,
   * which no container allows — turning the transparent wrapper of
   * {@link _contentRole}'s last row back into a violation.
   */
  protected readonly _contentLabelledBy = computed<string | null>(() =>
    this._alwaysOpen() && this._contentRole() !== null ? this._labelId : null,
  );

  /**
   * Flips the expanded state and emits `openChange`.
   *
   * Visually a no-op wherever no toggler is rendered — the content stays on
   * screen either way. See {@link _alwaysOpen}.
   */
  toggle(): void {
    const next = !this._expanded();
    this._expanded.set(next);
    this.openChange.emit(next);
  }
}
