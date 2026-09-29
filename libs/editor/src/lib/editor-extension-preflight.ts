import {
  findDuplicates,
  flattenExtensions,
  getExtensionField,
  type AnyExtension,
  type Extensions,
} from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import type { MlvEditorError, MlvEditorFormat } from './editor.types';

/** @internal Successful validation of the exact extension array selected by the editor. */
interface MlvEditorExtensionPreflightSuccess {
  readonly ok: true;
}

/** @internal Deterministic configuration failure discovered before editor construction. */
interface MlvEditorExtensionPreflightFailure {
  readonly ok: false;
  readonly error: MlvEditorError;
}

/** @internal Result of validating a literal/default extension composition. */
type MlvEditorExtensionPreflightResult =
  | MlvEditorExtensionPreflightSuccess
  | MlvEditorExtensionPreflightFailure;

/** @internal Resolves one public extension field without invoking it. */
function hasFunctionField(
  extension: AnyExtension,
  field: 'addCommands' | 'addStorage' | 'onBeforeCreate',
): boolean {
  return (
    typeof getExtensionField(extension, field, {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
    }) === 'function'
  );
}

/** @internal Official hook names whose identities establish Markdown provenance. */
const OFFICIAL_MARKDOWN_HOOKS = [
  'addCommands',
  'addStorage',
  'onBeforeCreate',
] as const;

/** @internal Whether this extension or a public parent carries all official Markdown hooks. */
function hasOfficialMarkdownLineage(extension: AnyExtension): boolean {
  let candidate: AnyExtension | null = extension;
  while (candidate) {
    if (
      OFFICIAL_MARKDOWN_HOOKS.every(
        (field) => candidate?.config[field] === Markdown.config[field],
      )
    ) {
      return true;
    }
    candidate = candidate.parent as AnyExtension | null;
  }
  return false;
}

/** @internal Checks that a same-name extension exposes the official Markdown integration. */
function supportsMarkdown(extension: AnyExtension): boolean {
  return (
    extension.name === 'markdown' &&
    hasOfficialMarkdownLineage(extension) &&
    hasFunctionField(extension, 'addCommands') &&
    hasFunctionField(extension, 'addStorage') &&
    hasFunctionField(extension, 'onBeforeCreate')
  );
}

/**
 * @internal Why an extension set cannot collaborate, or `null` when it can.
 *
 * Fails closed where upstream only warns: StarterKit's `undoRedo` beside the
 * collaboration undo manager gives two diverging undo systems, and a limited
 * `CharacterCount` would reject remote transactions, which cannot be
 * cancelled without desynchronising ProseMirror from Yjs.
 */
function collaborationConflict(
  flattened: readonly AnyExtension[],
): string | null {
  if (flattened.some((extension) => extension.name === 'undoRedo')) {
    return 'Collaboration replaces undo history: remove the undoRedo extension (StarterKit undoRedo: false).';
  }
  const limited = flattened.some((extension) => {
    if (extension.name !== 'characterCount') return false;
    const limit: unknown = (extension.options as { limit?: unknown }).limit;
    return typeof limit === 'number' && limit !== 0;
  });
  return limited
    ? 'Collaboration applies the character limit to local input only: configure CharacterCount without a limit and use characterLimit.'
    : null;
}

/**
 * @internal Flattens and validates the exact extension set before Tiptap can
 * warn, create schema state, or publish an editor instance.
 *
 * Only Markdown imposes an extension requirement. HTML is served by Tiptap's
 * own DOM serializer and JSON by the ProseMirror document, so both pass with
 * any otherwise valid extension set.
 */
export function preflightMlvEditorExtensions(
  extensions: Extensions,
  initialFormat: MlvEditorFormat,
  collaborating = false,
): MlvEditorExtensionPreflightResult {
  try {
    const flattened = flattenExtensions(extensions);
    const duplicates = findDuplicates(
      flattened.map((extension) => extension.name),
    );
    if (duplicates.length > 0) {
      return {
        ok: false,
        error: {
          code: 'configuration',
          message: `Duplicate Tiptap extension names: ${duplicates.join(', ')}.`,
          recoverable: false,
        },
      };
    }
    if (
      initialFormat === 'markdown' &&
      !flattened.some((extension) => supportsMarkdown(extension))
    ) {
      return {
        ok: false,
        error: {
          code: 'configuration',
          message:
            'Initial Markdown content requires the official Tiptap Markdown extension.',
          recoverable: false,
        },
      };
    }
    const conflict = collaborating ? collaborationConflict(flattened) : null;
    if (conflict) {
      return {
        ok: false,
        error: { code: 'configuration', message: conflict, recoverable: false },
      };
    }
    return { ok: true };
  } catch (cause: unknown) {
    return {
      ok: false,
      error: {
        code: 'configuration',
        message: 'Unable to compose the configured Tiptap extensions.',
        recoverable: false,
        cause,
      },
    };
  }
}
