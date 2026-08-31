import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable()
export class MlvSelectionService<T = unknown> {
  readonly multiple = signal(false);
  readonly selectedValues = signal<T[]>([]);
  readonly focusFirst$ = new Subject<void>();

  /**
   * Equality predicate used for all membership checks (`isSelected`,
   * `deselect`, and the `select`/`toggle` de-dup path). Defaults to reference
   * equality (`a === b`). Set a custom comparator (e.g. compare by id) so object
   * values written via `writeValue` after deserialization match the option
   * instances and check-marks / display value stay in agreement.
   */
  readonly compareWith = signal<(a: T, b: T) => boolean>((a, b) => a === b);

  readonly displayValue = computed(() => {
    const values = this.selectedValues();
    if (values.length === 0) return '';
    if (values.length === 1) return String(values[0]);
    return `${values.length} items selected`;
  });

  /** @private Index of `value` within the current selection, or `-1`. */
  private _indexOf(value: T): number {
    const compare = this.compareWith();
    return this.selectedValues().findIndex((v) => compare(v, value));
  }

  select(value: T): void {
    if (this.multiple()) {
      const current = this.selectedValues();
      const index = this._indexOf(value);
      if (index >= 0) {
        this.selectedValues.set([
          ...current.slice(0, index),
          ...current.slice(index + 1),
        ]);
      } else {
        this.selectedValues.set([...current, value]);
      }
    } else {
      this.selectedValues.set([value]);
    }
  }

  deselect(value: T): void {
    const compare = this.compareWith();
    this.selectedValues.set(
      this.selectedValues().filter((v) => !compare(v, value)),
    );
  }

  isSelected(value: T): boolean {
    return this._indexOf(value) >= 0;
  }

  clear(): void {
    this.selectedValues.set([]);
  }

  setValues(values: T[]): void {
    this.selectedValues.set(values);
  }

  toggle(value: T): void {
    if (this.isSelected(value)) {
      this.deselect(value);
    } else {
      this.select(value);
    }
  }

  requestFocusFirst(): void {
    this.focusFirst$.next();
  }
}
