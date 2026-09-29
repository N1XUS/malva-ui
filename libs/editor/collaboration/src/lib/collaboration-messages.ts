import { computed, inject, type Signal } from '@angular/core';
import {
  MLV_EDITOR_I18N,
  MlvI18nResolverService,
  type MlvEditorI18n,
} from '@malva-ui/i18n';

/**
 * @internal The collaboration keys this entry point reads. `collaborationMoveCancelled`
 * is read by the editor core (the block handle lives there) with its own
 * fallback, so it is not listed here.
 */
export type MlvEditorCollaborationMessageKey = Exclude<
  Extract<keyof MlvEditorI18n, `collaboration${string}`>,
  'collaborationMoveCancelled'
>;

/**
 * @internal English fallbacks for the optional collaboration keys (F-D19). A
 * `Record` over the interface's keys, so a key added to `MlvEditorI18n`
 * without a fallback here fails to compile.
 */
export const OPTIONAL_MESSAGE_FALLBACKS: Readonly<
  Record<MlvEditorCollaborationMessageKey, string>
> = {
  collaborationConnecting: 'Connecting…',
  collaborationSyncing: 'Syncing…',
  collaborationSynced: 'All changes synced',
  collaborationOffline: 'Offline. Changes will sync when you reconnect.',
  collaborationClosed: 'Collaboration ended. The document is read-only.',
  collaborationFailed: 'Collaboration failed. The document is read-only.',
  collaborationPeers:
    '{count, plural, one {# other person here} other {# other people here}}',
  collaborationPresenceLabel: 'Collaborators',
  collaborationViewing: '{name} (viewing)',
  collaborationAnonymous: 'Anonymous',
  collaborationBackOnline: 'Back online. Changes synced.',
  collaborationSyncTimeout:
    'The document has not synced yet. Editing starts once it does.',
};

/** @internal Resolves the collaboration copy: the active pack, else English. */
export interface MlvEditorCollaborationMessages {
  /** The template of `key`, from the active pack or the fallback, live. */
  readonly templates: Signal<Record<MlvEditorCollaborationMessageKey, string>>;
  /** `key` formatted with `params` (ICU), in the active locale. */
  format(
    key: MlvEditorCollaborationMessageKey,
    params?: Record<string, string | number>,
  ): string;
}

/**
 * @internal Collaboration copy for the current injection context. Call in a
 * field initializer or constructor.
 */
export function injectMlvEditorCollaborationMessages(): MlvEditorCollaborationMessages {
  const i18n = inject(MLV_EDITOR_I18N, { optional: true });
  const resolver = inject(MlvI18nResolverService);
  const templates = computed(() => {
    const pack = i18n?.();
    const out = { ...OPTIONAL_MESSAGE_FALLBACKS };
    for (const key of Object.keys(out) as MlvEditorCollaborationMessageKey[]) {
      const value = pack?.[key];
      if (typeof value === 'string' && value.trim() !== '') out[key] = value;
    }
    return out;
  });
  return {
    templates,
    format: (key, params) => resolver.resolve(templates(), key, params),
  };
}
