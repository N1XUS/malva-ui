/** Visual treatment shared by buttons and button containers. */
export type MlvButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outlined'
  | 'accent'
  | 'transparent'
  | 'elevated'
  | 'error'
  | 'warning'
  | 'info';

/**
 * Shape applied to an individual button. `circle` and `square` are icon-only
 * shapes (width equals height); `pill` keeps the content width with a fully
 * rounded stadium radius.
 */
export type MlvButtonShape = 'default' | 'circle' | 'square' | 'pill';
