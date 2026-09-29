import type { MlvMenu } from '@malva-ui/core/menu';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';

/**
 * @internal Registers open toolbar menu panels, submenus included, with the
 * editor's overlay registry, so focus inside a portaled panel still counts as
 * focus inside the editor (the selection bubble stays up, `readonly` and
 * `disabled` flips can close it).
 */
export interface MlvEditorMenuRegistration {
  /**
   * Call from the trigger's `(menuOpened)`. The panel is looked up on the next
   * microtask, once the overlay has rendered it.
   *
   * @param menu The menu that opened.
   * @param close Closes that menu when the registry asks.
   */
  opened(menu: MlvMenu, close: () => void): void;
  /** Call from the trigger's `(menuClosed)`. */
  closed(menu: MlvMenu): void;
  /** Releases every registration; call on destroy. */
  releaseAll(): void;
}

/**
 * @internal Creates a {@link MlvEditorMenuRegistration} for one toolbar
 * control.
 *
 * @param overlays The editor-scoped overlay registry.
 * @param document The document the panels render into.
 */
export function createMlvEditorMenuRegistration(
  overlays: MlvEditorOverlayRegistry,
  document: Document,
): MlvEditorMenuRegistration {
  const entries = new Map<
    MlvMenu,
    { open: boolean; release: (() => void) | undefined }
  >();

  const closed = (menu: MlvMenu): void => {
    const entry = entries.get(menu);
    if (!entry) return;
    entry.open = false;
    entry.release?.();
    entries.delete(menu);
  };

  return {
    opened(menu, close) {
      closed(menu);
      const entry = {
        open: true,
        release: undefined as (() => void) | undefined,
      };
      entries.set(menu, entry);
      queueMicrotask(() => {
        if (!entry.open) return;
        const panel = document.getElementById(menu.panelId);
        if (!panel) return;
        entry.release = overlays.register(panel, close);
      });
    },
    closed,
    releaseAll() {
      for (const menu of [...entries.keys()]) closed(menu);
    },
  };
}
