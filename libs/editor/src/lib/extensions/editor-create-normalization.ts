/**
 * @internal Transaction meta marking the one normalization transaction an
 * editor extension dispatches from `onCreate` (block IDs, heading anchors).
 *
 * Tiptap runs `onCreate` a task after construction, after `MlvEditor` has
 * already applied its initial value, so a document change dispatched there
 * would otherwise be serialized and emitted as if the user had edited an
 * untouched editor. `MlvEditor` skips value emission for a transaction that
 * carries this meta; the stored value gains the attributes with the next
 * user edit, exactly like an external value load. Not exported from the
 * package barrel.
 */
export const MLV_EDITOR_CREATE_NORMALIZATION_META =
  'mlvEditorCreateNormalization';
