import type {
  ContentMatch,
  MarkType,
  NodeType,
  Schema,
} from '@tiptap/pm/model';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

/*
 * D-F9: y-tiptap 3.0.9 renders shared content with `schema.node` /
 * `schema.text` and, when that throws, DELETES the Y item from the shared
 * document (y-tiptap.js L968-974, L1004-1008). A client whose schema lacks a
 * node, mark or attribute a peer wrote would erase it for everyone. These
 * checks run before y-tiptap sees the content, so such content fails the
 * session closed instead.
 */

/** @private y-tiptap's suffix on overlapping mark keys (y-tiptap.js L1490). */
const HASHED_MARK_KEY = /(.*)(--[a-zA-Z0-9+/=]{8})$/;

/** @private Types that can hold block or inline children. */
type Container = Y.XmlFragment | Y.XmlElement;

/**
 * @private The part of a shared type the checks read. Yjs types are
 * invariant in their event type, so `AbstractType<unknown>` accepts none of
 * them; this structural view accepts every one without a cast.
 */
interface SharedNode {
  readonly _item: Y.Item | null;
}

/** @private A schema mismatch, raised by the checks. */
const mismatch = (detail: string): Error =>
  new Error(
    `The shared document does not match this editor's schema: ${detail}.`,
  );

/** @private Attribute keys a node or mark type declares. */
const declaredAttributes = (
  type: NodeType | MarkType,
): Readonly<Record<string, unknown>> =>
  (type.spec.attrs as Readonly<Record<string, unknown>> | undefined) ?? {};

/**
 * @private Whether `type` declares `key` itself. Own keys only: `spec.attrs`
 * is a plain object, so `in` would accept `constructor` or `toString` from
 * its prototype. (`Object.hasOwn` is ES2022, past the workspace's `es2020`
 * lib.)
 */
const declares = (type: NodeType | MarkType, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(declaredAttributes(type), key);

/**
 * @private Validates shared content against one schema. `isNew` decides which
 * child elements are checked in depth: every element for a whole-fragment
 * check, only the ones a transaction created for an incremental one.
 */
class SchemaChecker {
  constructor(
    private readonly _schema: Schema,
    private readonly _isNew: (type: SharedNode) => boolean,
  ) {}

  /** The node type of the fragment or an element; throws for an unknown name. */
  typeOf(container: Container): NodeType {
    if (!(container instanceof Y.XmlElement)) return this._schema.topNodeType;
    const type = this._schema.nodes[container.nodeName];
    if (!type || type.isText)
      throw mismatch(`unknown node type "${container.nodeName}"`);
    return type;
  }

  /** Checks an element's attributes: declared, required ones present, valid. */
  attributes(element: Y.XmlElement, type: NodeType): void {
    const attributes = element.getAttributes() as Record<string, unknown>;
    for (const key of Object.keys(attributes)) {
      if (!declares(type, key))
        throw mismatch(`unknown attribute "${key}" on "${type.name}"`);
    }
    try {
      // `create` computes the attributes: defaults, required ones, `validate`.
      type.create(attributes);
    } catch (cause) {
      throw mismatch(`invalid attributes on "${type.name}" (${String(cause)})`);
    }
  }

  /** Checks an element in depth: attributes, children, their subtrees. */
  element(element: Y.XmlElement, type: NodeType): void {
    this.attributes(element, type);
    this.children(element, type);
  }

  /**
   * Checks the children of a container against its content expression and
   * the marks of every text run in it. New child elements are checked in depth.
   *
   * An incomplete end (a required child missing) is not a mismatch: it is how
   * every new document starts (an empty fragment) and what concurrent
   * deletions between two valid clients leave. ProseMirror refills it at the
   * top level and Tiptap's content check (F-D22) still catches it deeper; a
   * child the expression does not allow at all is rejected.
   */
  children(container: Container, type: NodeType): void {
    let match: ContentMatch | null = type.contentMatch;
    for (
      let item = container._start;
      item !== null;
      item = item.right as Y.Item | null
    ) {
      if (item.deleted || !(item.content instanceof Y.ContentType)) continue;
      const child = item.content.type;
      if (child instanceof Y.XmlText) {
        match = this._textRuns(child, type, match);
      } else if (child instanceof Y.XmlElement) {
        const childType = this.typeOf(child);
        match = match?.matchType(childType) ?? null;
        if (!match)
          throw mismatch(
            `"${childType.name}" is not allowed in "${type.name}"`,
          );
        if (this._isNew(child)) this.element(child, childType);
      } else {
        throw mismatch(`unsupported shared type in "${type.name}"`);
      }
    }
  }

  /** @private Matches the runs of a text against the parent and checks their marks. */
  private _textRuns(
    text: Y.XmlText,
    parent: NodeType,
    match: ContentMatch | null,
  ): ContentMatch | null {
    const textType = this._schema.nodes['text'];
    for (const run of text.toDelta() as {
      insert: unknown;
      attributes?: Record<string, unknown>;
    }[]) {
      if (typeof run.insert !== 'string')
        throw mismatch(`embedded content in "${parent.name}"`);
      match = textType ? (match?.matchType(textType) ?? null) : null;
      if (!match) throw mismatch(`text is not allowed in "${parent.name}"`);
      for (const [key, value] of Object.entries(run.attributes ?? {}))
        this._mark(key, value, parent);
    }
    return match;
  }

  /** @private Checks one text-delta mark: known, attributes declared and valid, allowed here. */
  private _mark(key: string, value: unknown, parent: NodeType): void {
    const name = HASHED_MARK_KEY.exec(key)?.[1] ?? key;
    const type = this._schema.marks[name];
    if (!type) throw mismatch(`unknown mark "${name}"`);
    if (!parent.allowsMarkType(type))
      throw mismatch(`mark "${name}" is not allowed in "${parent.name}"`);
    const attributes =
      value !== null && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    for (const attribute of Object.keys(attributes)) {
      if (!declares(type, attribute))
        throw mismatch(`unknown attribute "${attribute}" on mark "${name}"`);
    }
    try {
      type.create(attributes);
    } catch (cause) {
      throw mismatch(`invalid attributes on mark "${name}" (${String(cause)})`);
    }
  }
}

/**
 * @internal Checks a whole fragment, e.g. a host-provided document that
 * already holds content, before y-tiptap renders it. Throws on a mismatch.
 */
export function checkMlvEditorCollaborationFragment(
  fragment: Y.XmlFragment,
  schema: Schema,
): void {
  const checker = new SchemaChecker(schema, () => true);
  checker.children(fragment, schema.topNodeType);
}

/**
 * @internal Checks what one transaction changed inside `fragment`, in time
 * proportional to the change: each changed container's direct children
 * (element names, content expression, text marks), each element whose
 * attributes changed, and every element the transaction created, in depth.
 * Unchanged subtrees were checked when they arrived. Throws on a mismatch.
 */
export function checkMlvEditorCollaborationTransaction(
  transaction: Y.Transaction,
  fragment: Y.XmlFragment,
  schema: Schema,
): void {
  const isNew = (type: SharedNode): boolean => {
    const id = type._item?.id;
    return (
      id !== undefined &&
      id.clock >= (transaction.beforeState.get(id.client) ?? 0)
    );
  };
  const checker = new SchemaChecker(schema, isNew);
  const containers = new Set<Container>();
  const attributed = new Set<Y.XmlElement>();
  transaction.changed.forEach((keys, type) => {
    const node: SharedNode = type;
    if (!liveIn(node, fragment)) return;
    if (type instanceof Y.XmlText) {
      containers.add(type.parent as Container);
    } else if (type instanceof Y.XmlElement) {
      if (keys.has(null)) containers.add(type);
      if ([...keys].some((key) => key !== null)) attributed.add(type);
    } else if (node === fragment && keys.has(null)) {
      containers.add(fragment);
    }
  });
  attributed.forEach((element) =>
    checker.attributes(element, checker.typeOf(element)),
  );
  containers.forEach((container) =>
    checker.children(container, checker.typeOf(container)),
  );
}

/** @private Whether `type` is `fragment` or a live (undeleted) descendant of it. */
function liveIn(type: SharedNode, fragment: Y.XmlFragment): boolean {
  for (let current: SharedNode = type; current !== fragment; ) {
    const item = current._item;
    if (item === null || item.deleted) return false;
    current = item.parent as SharedNode;
  }
  return true;
}

/**
 * @internal Validates every transaction that touches the bound fragment on
 * the document's `beforeObserverCalls`, which Yjs emits before any observer:
 * y-tiptap's deep observer, and so its render-and-delete, has not run yet
 * (yjs.mjs L3255-3296). On a mismatch it stops listening and calls
 * `onReject` synchronously, which cuts the binding off, so the observer list
 * Yjs reads right after no longer holds y-tiptap's. The binding's own pushes
 * (origin `ySyncPluginKey`) come from a schema-valid ProseMirror document and
 * are not checked.
 */
export class MlvEditorCollaborationSchemaGuard {
  /** @private The document listened to. */
  private readonly _doc: Y.Doc;

  /** @private Checks one transaction. */
  private readonly _onBeforeObserverCalls = (
    transaction: Y.Transaction,
  ): void => {
    if (transaction.origin === ySyncPluginKey) return;
    try {
      checkMlvEditorCollaborationTransaction(
        transaction,
        this._fragment,
        this._schema,
      );
    } catch (error) {
      this.dispose();
      this._onReject(error);
    }
  };

  constructor(
    private readonly _fragment: Y.XmlFragment,
    private readonly _schema: Schema,
    private readonly _onReject: (error: unknown) => void,
  ) {
    const doc = _fragment.doc;
    if (!doc)
      throw new Error('The collaboration fragment is not bound to a document.');
    this._doc = doc;
    doc.on('beforeObserverCalls', this._onBeforeObserverCalls);
  }

  /** Stops listening. Idempotent. */
  dispose(): void {
    this._doc.off('beforeObserverCalls', this._onBeforeObserverCalls);
  }
}
