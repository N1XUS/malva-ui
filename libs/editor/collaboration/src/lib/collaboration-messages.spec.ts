import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import { enLanguage } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MLV_EDITOR_COLLABORATION_MOVE_CANCELLED_FALLBACK } from '../../../src/lib/editor/editor-collaboration.contract';
import {
  injectMlvEditorCollaborationMessages,
  OPTIONAL_MESSAGE_FALLBACKS,
} from './collaboration-messages';

/*
 * F-D19: the 13 optional collaboration keys carry an English fallback in two
 * places, `OPTIONAL_MESSAGE_FALLBACKS` here and the block handle's
 * `collaborationMoveCancelled` in the editor core. Both must equal the English
 * pack, so an English copy edit cannot leave a stale fallback behind.
 */
describe('MlvEditorCollaboration — message fallbacks', () => {
  const fallbacks: Record<string, string> = {
    ...OPTIONAL_MESSAGE_FALLBACKS,
    collaborationMoveCancelled:
      MLV_EDITOR_COLLABORATION_MOVE_CANCELLED_FALLBACK,
  };

  it('equals the English pack for every collaboration key', () => {
    const english = Object.fromEntries(
      Object.entries(enLanguage.editor).filter(([key]) =>
        key.startsWith('collaboration'),
      ),
    );
    expect(Object.keys(fallbacks)).toHaveLength(13);
    expect(fallbacks).toEqual(english);
  });

  it('treats a blank pack value as missing', () => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    const pack = TestBed.inject(
      MLV_EDITOR_I18N,
    ) as WritableSignal<MlvEditorI18n>;
    pack.update((value) => ({ ...value, collaborationSynced: '  ' }));
    const messages = TestBed.runInInjectionContext(
      injectMlvEditorCollaborationMessages,
    );
    expect(messages.templates().collaborationSynced).toBe(
      OPTIONAL_MESSAGE_FALLBACKS.collaborationSynced,
    );
  });
});
