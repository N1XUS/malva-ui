/**
 * Twelve mid-luminance peer colours (relative luminance ≈ 0.24), each ≥ 3:1
 * against every surface a caret is painted on in both themes: the light base
 * `#fafafa` and editor surface `#ffffff`, the dark base `#171717` and the
 * dark editor surface `#333333` (`--mlv-elevation-bg-3`). A peer's colour is
 * shared across viewers with different themes, so it cannot follow the
 * viewer's tokens. A consumer-supplied colour is used as given; meeting WCAG
 * 1.4.11 with it is the host's job.
 */
export const MLV_EDITOR_COLLABORATION_COLORS: readonly string[] = [
  '#e6574b',
  '#bb781b',
  '#838d14',
  '#4b9715',
  '#169c22',
  '#169a62',
  '#17949f',
  '#4387e4',
  '#8178ec',
  '#b162e9',
  '#e338d5',
  '#e54c8c',
];
