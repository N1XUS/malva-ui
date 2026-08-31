import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type {
  MlvSearchFieldCommitEvent,
  MlvSearchFieldNavigateEvent,
} from '@malva-ui/core/search-field';
import { MlvSearchField } from '@malva-ui/core/search-field';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import {
  MlvActiveDescendant,
  MlvDropdownPanel,
  optionId,
} from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';

/** Suggestions the palette filters. */
const COMMANDS: MlvSelectOption<string>[] = [
  { label: 'Open dashboard', value: 'dashboard' },
  { label: 'Open billing settings', value: 'billing' },
  { label: 'Invite a teammate', value: 'invite' },
  { label: 'Create a project', value: 'project' },
  { label: 'Export invoices', value: 'invoices' },
  { label: 'Rotate API keys', value: 'keys' },
];

@Component({
  selector: 'docs-search-field-combobox-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSearchField, MlvDropdownPanel],
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally; a panel
  // used outside `mlv-select` / `mlv-combobox` has to supply it itself.
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SearchFieldComboboxExampleComponent {
  /** DOM id shared by the listbox and the field's `aria-controls`. */
  readonly listboxId = 'docs-search-field-suggestions';

  /** Current draft query, owned here so the filter reacts to every keystroke. */
  readonly query = signal('');

  /** Suggestion chosen through Enter or a click. */
  readonly picked = signal('');

  /** Query committed as a plain search, with no suggestion active. */
  readonly searched = signal('');

  /** Suggestions matching the current query. */
  readonly filtered = computed<MlvSelectOption<string>[]>(() => {
    const needle = this.query().trim().toLowerCase();
    if (!needle) return [];
    return COMMANDS.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  });

  /** Whether the suggestion popup is showing — drives `aria-expanded`. */
  readonly open = computed(
    () => !this._dismissed() && this.filtered().length > 0,
  );

  /**
   * Highlighted-option bookkeeping. DOM focus stays on the input; only this
   * index moves, and it is mirrored into `aria-activedescendant`.
   */
  readonly activeDescendant = new MlvActiveDescendant(
    () => this.filtered().length,
  );

  /** The highlighted suggestion, or `null` when nothing is active. */
  readonly activeOption = computed(
    () => this.filtered()[this.activeDescendant.index()] ?? null,
  );

  /** DOM id of the highlighted option row, matching what the panel renders. */
  readonly activeOptionId = computed(() => {
    const index = this.activeDescendant.index();
    return index < 0 ? null : optionId(this.listboxId, index);
  });

  /** Whether the popup was closed by picking a suggestion. */
  private readonly _dismissed = signal(false);

  /** Tracks the draft and reopens the popup as soon as the query changes. */
  onQueryChange(value: string): void {
    this.query.set(value);
    this._dismissed.set(false);
    this.activeDescendant.reset();
  }

  /**
   * Moves the highlight from the field's arrow-key hooks.
   *
   * `up`/`down`/`pageUp`/`pageDown` arrive already consumed. Home and End do
   * not — an editable combobox keeps them as caret keys — so this example opts
   * into them explicitly by calling `preventDefault()` itself.
   */
  onNavigate({ direction, event }: MlvSearchFieldNavigateEvent): void {
    if (!this.open()) return;

    if (direction === 'home' || direction === 'end') {
      event.preventDefault();
    }

    switch (direction) {
      case 'down':
        this.activeDescendant.move(1);
        break;
      case 'up':
        this.activeDescendant.move(-1);
        break;
      case 'home':
      case 'pageUp':
        this.activeDescendant.first();
        break;
      case 'end':
      case 'pageDown':
        this.activeDescendant.last();
        break;
    }
  }

  /**
   * Resolves the highlighted suggestion instead of running a plain search.
   *
   * With nothing highlighted the handler does nothing and the field commits as
   * usual, emitting `search`.
   */
  onCommit({ event }: MlvSearchFieldCommitEvent): void {
    const option = this.activeOption();
    if (!option) return;

    event.preventDefault();
    this._pick(option);
  }

  /** Records a plain search — reached only when no suggestion was active. */
  onSearch(query: string): void {
    this.searched.set(query);
  }

  /** Picks a suggestion clicked in the popup. */
  onPanelValueChange(values: readonly string[]): void {
    const option = COMMANDS.find((candidate) => candidate.value === values[0]);
    if (option) this._pick(option);
  }

  /** @private Commits a suggestion and closes the popup. */
  private _pick(option: MlvSelectOption<string>): void {
    this.picked.set(option.label);
    this.query.set(option.label);
    this.activeDescendant.reset();
    this._dismissed.set(true);
  }
}
