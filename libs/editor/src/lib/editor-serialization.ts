import type { Editor, JSONContent } from '@tiptap/core';
import type {} from '@tiptap/markdown';
import type { MlvEditorError, MlvEditorFormat } from './editor.types';

type MlvEditorSerializable = Pick<
  Editor,
  'getHTML' | 'getMarkdown' | 'getJSON' | 'isEmpty'
>;

type MlvEditorSerializationResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: MlvEditorError };

/** @internal An external JSON value accepted as a document node. */
interface MlvEditorJsonParseSuccess {
  readonly ok: true;
  readonly document: JSONContent;
}

/** @internal An external JSON value rejected before it can reach Tiptap. */
interface MlvEditorJsonParseFailure {
  readonly ok: false;
  readonly cause: unknown;
}

/** @internal Result of validating one external JSON value. */
type MlvEditorJsonParseResult =
  | MlvEditorJsonParseSuccess
  | MlvEditorJsonParseFailure;

/**
 * Converts only null, empty, and whitespace-only external values to the
 * library's nullable empty representation. Structural markup is deliberately
 * preserved so Tiptap can determine semantic emptiness from its parsed schema.
 *
 * The rule is format-agnostic: an empty or whitespace-only JSON value is the
 * same nullable empty document as an empty HTML or Markdown value, because no
 * amount of surrounding whitespace describes a document.
 */
export function normalizeEditorValue(value: string | null): string | null {
  return value === null || value.trim().length === 0 ? null : value;
}

/**
 * Validates an external JSON value as a document node for the active schema.
 *
 * Tiptap reads a string argument as HTML, so a JSON value must be parsed here
 * before it can be applied. Malformed JSON, arrays, scalars, objects without a
 * `type`, and nodes that are not the schema's top node are all rejected with
 * the originating cause rather than mounted as a structurally invalid
 * document. Node types absent from the active schema are rejected later by
 * Tiptap itself, so a schema mismatch can never silently drop content.
 *
 * @param value External JSON string supplied by the host.
 * @param topNodeName Name of the active schema's top node, usually `doc`.
 * @returns The parsed document node, or the cause of its rejection.
 */
export function parseEditorJsonDocument(
  value: string,
  topNodeName: string,
): MlvEditorJsonParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause: unknown) {
    return { ok: false, cause };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      cause: new TypeError(
        'Editor JSON content must be a single ProseMirror document node.',
      ),
    };
  }

  const type = (parsed as { readonly type?: unknown }).type;
  if (type !== topNodeName) {
    return {
      ok: false,
      cause: new TypeError(
        `Editor JSON content must be a "${topNodeName}" node, received ${
          typeof type === 'string' ? `"${type}"` : String(type)
        }.`,
      ),
    };
  }

  return { ok: true, document: parsed as JSONContent };
}

/**
 * Whether two external values describe the same document in one format.
 *
 * HTML and Markdown keep exact string identity, where every textual difference
 * is a real content difference. JSON is compared structurally instead:
 * `JSON.stringify` preserves key insertion order, so a host-supplied document
 * and its canonical re-serialization are frequently unequal as strings while
 * describing the identical document. Treating that as a change would either
 * re-mount the document on every change-detection pass or emit a value the
 * user never typed.
 *
 * @param value External or serialized value being examined.
 * @param tracked Value previously applied or emitted; `undefined` never matches.
 * @param format Format both values were produced in.
 */
export function editorValuesAreEquivalent(
  value: string | null,
  tracked: string | null | undefined,
  format: MlvEditorFormat,
): boolean {
  if (value === tracked) return true;
  if (format !== 'json') return false;
  if (typeof value !== 'string' || typeof tracked !== 'string') return false;

  try {
    return jsonValuesAreEqual(JSON.parse(value), JSON.parse(tracked));
  } catch {
    return false;
  }
}

/** @internal Order-independent structural comparison of two parsed JSON values. */
function jsonValuesAreEqual(value: unknown, other: unknown): boolean {
  if (value === other) return true;
  if (Array.isArray(value) || Array.isArray(other)) {
    return (
      Array.isArray(value) &&
      Array.isArray(other) &&
      value.length === other.length &&
      value.every((item, index) => jsonValuesAreEqual(item, other[index]))
    );
  }
  if (
    typeof value !== 'object' ||
    typeof other !== 'object' ||
    value === null ||
    other === null
  ) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const otherRecord = other as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length === Object.keys(otherRecord).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(otherRecord, key) &&
        jsonValuesAreEqual(record[key], otherRecord[key]),
    )
  );
}

/**
 * Serializes a Tiptap editor without leaking serialization exceptions to its
 * Angular caller. A failed result carries no replacement value, allowing the
 * caller to keep its last valid value.
 *
 * Semantic emptiness is determined by the parsed document rather than by
 * serialized text, so every format returns the same nullable empty value for
 * an empty document.
 */
export function serializeEditorValue(
  editor: MlvEditorSerializable,
  format: MlvEditorFormat,
): MlvEditorSerializationResult {
  try {
    if (editor.isEmpty) {
      return { ok: true, value: null };
    }

    const value = serializeDocument(editor, format);

    if (value.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: 'serialize',
          message: 'Unable to serialize editor content.',
          recoverable: true,
        },
      };
    }

    return { ok: true, value };
  } catch (cause: unknown) {
    return {
      ok: false,
      error: {
        code: 'serialize',
        message: 'Unable to serialize editor content.',
        recoverable: true,
        cause,
      },
    };
  }
}

/** @internal Exhaustive per-format serializer for a nonempty document. */
function serializeDocument(
  editor: MlvEditorSerializable,
  format: MlvEditorFormat,
): string {
  switch (format) {
    case 'html':
      return editor.getHTML();
    case 'markdown':
      return editor.getMarkdown();
    case 'json':
      return JSON.stringify(editor.getJSON());
  }
}
