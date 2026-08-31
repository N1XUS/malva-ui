import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonAfter } from '@malva-ui/core/button';
import { LucideChevronDown } from '@lucide/angular';

/** Sort orders offered by the menu. */
const SORT_OPTIONS: MlvSelectOption<string>[] = [
  { label: 'Name (A → Z)', value: 'name-asc' },
  { label: 'Name (Z → A)', value: 'name-desc' },
  { label: 'Date modified', value: 'date-modified' },
  { label: 'Date created', value: 'date-created' },
  { label: 'Size', value: 'size' },
];

@Component({
  selector: 'docs-dropdown-popup-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDropdownPanel,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvButton,
    MlvButtonAfter,
    LucideChevronDown,
  ],
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownPopupExampleComponent {
  /** Options handed to the panel. */
  readonly sortOptions = SORT_OPTIONS;

  /** Committed sort order. */
  readonly selected = signal<string[]>(['name-asc']);

  /**
   * @private The same service the panel injects. `requestFocusFirst()` is the
   * supported way to hand roving focus to the first option — the panel is
   * stamped inside the overlay, so it is out of reach of a view query.
   */
  private readonly _selection = inject(MlvSelectionService);

  /** @private Injection context for the deferred focus request below. */
  private readonly _injector = inject(Injector);

  /**
   * @private The trigger element itself. `read: ElementRef` is required —
   * `#sortTrigger` alone resolves to the `MlvButton` instance, which exposes no
   * `focus()`.
   */
  private readonly _trigger = viewChild.required('sortTrigger', {
    read: ElementRef<HTMLButtonElement>,
  });

  /** Label of the committed option, shown on the trigger. */
  readonly selectedLabel = computed(
    () =>
      SORT_OPTIONS.find((option) => option.value === this.selected()[0])
        ?.label ?? 'None',
  );

  /**
   * Moves focus onto the first option. `afterOpened` fires when the overlay
   * attaches, one render before the panel exists — request the focus after the
   * next render or the panel is not yet listening.
   */
  onOpened(): void {
    afterNextRender(() => this._selection.requestFocusFirst(), {
      injector: this._injector,
    });
  }

  /** Puts focus back on the trigger once the panel is gone. */
  onClosed(): void {
    this._trigger().nativeElement.focus();
  }

  /** Commits the pick and dismisses the popup, as a menu-style control does. */
  onValueChange(values: readonly string[], popup: MlvPopup): void {
    if (!values.length) return;

    this.selected.set([values[values.length - 1]]);
    popup.opened.set(false);
  }
}
