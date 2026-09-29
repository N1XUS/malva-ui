/** @private SVG namespace for the glyph. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @private Lucide `link` glyph (ISC), inlined because a ProseMirror widget is
 * built outside Angular's renderer. The two paths are Lucide's own.
 */
const LINK_PATHS: readonly string[] = [
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
  'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
];

/** @internal What the copy-link button needs to render and act. */
export interface MlvHeadingLinkButtonOptions {
  /** Accessible name (i18n `copyHeadingLink`). */
  readonly label: string;
  /** `true` in an editable editor, where the button leaves the tab order. */
  readonly editable: boolean;
  /** Runs on activation (click, Enter, Space — the native button's click). */
  readonly activate: () => void;
}

/** @private Builds the decorative glyph, hidden from assistive technology. */
const createGlyph = (doc: Document): SVGSVGElement => {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'mlv-editor__heading-link-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of LINK_PATHS) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
};

/**
 * @internal The copy-link button a heading widget renders at its inline end.
 *
 * A native `<button type="button">`, so Enter and Space arrive as its own
 * click (#299) and no key handler is bound. `contenteditable="false"` keeps
 * ProseMirror from treating it as editable content; the glyph carries no
 * text, so the heading's `textContent` is unchanged.
 */
export const createHeadingLinkButton = (
  doc: Document,
  options: MlvHeadingLinkButtonOptions,
): HTMLButtonElement => {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'mlv-editor__heading-link';
  button.setAttribute('contenteditable', 'false');
  button.setAttribute('aria-label', options.label);
  button.tabIndex = options.editable ? -1 : 0;
  if (options.editable) {
    // Editable, the button is no tab stop and the heading menu's item is the
    // keyboard path (N1-D13), so it leaves the tree: the heading's name is its
    // text alone. Readonly, it is a named tab stop and stays in the tree.
    button.setAttribute('aria-hidden', 'true');
  }
  button.append(createGlyph(doc));
  // Raw listeners, kept raw: the button is ProseMirror widget DOM, built with
  // no injection context and discarded by ProseMirror, and each listener
  // lives exactly as long as the node it is bound to.
  if (options.editable) {
    // Keeps the caret and focus in the content, as a toolbar button does.
    button.addEventListener('mousedown', (event) => event.preventDefault());
  }
  button.addEventListener('click', (event) => {
    event.preventDefault();
    options.activate();
  });
  return button;
};
