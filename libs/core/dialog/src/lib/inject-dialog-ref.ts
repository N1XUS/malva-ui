import { inject } from '@angular/core';

import { MlvDialogRef } from './dialog-ref';

/**
 * @internal Injects the current `MlvDialogRef`, failing with a descriptive
 * error when a dialog part is rendered outside a dialog.
 *
 * @param consumer - Selector of the part, used in the error message.
 */
export function injectDialogRef<R = unknown, D = unknown>(
  consumer: string,
): MlvDialogRef<R, D> {
  const ref = inject(MlvDialogRef, { optional: true }) as MlvDialogRef<
    R,
    D
  > | null;
  if (!ref) {
    throw new Error(
      `[Malva UI] <${consumer}> must be rendered inside a dialog: open its template or component through MlvDialogService.open(), or wrap it in <ng-template [(mlvDialog)]>.`,
    );
  }
  return ref;
}
