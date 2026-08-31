/**
 * Shared API-reference contract.
 *
 * These interfaces are the stable contract between the build-time API
 * extraction pipeline (`apps/docs/tools/extract-api.ts`, Phase D) and the
 * runtime API viewer component (`docs-api-viewer`, Phase E). The extractor
 * writes one JSON file per documented library (`src/generated/api/<name>.json`)
 * shaped as an {@link ApiEntry}; the viewer consumes it.
 *
 * The shape mirrors the public-API tables kept in each library's `CLAUDE.md`
 * (components, directives, pipes, services, tokens, type aliases, interfaces).
 */

/** The classification buckets an exported symbol can fall into. */
export type ApiSymbolKind =
  | 'component'
  | 'directive'
  | 'pipe'
  | 'service'
  | 'token'
  | 'type'
  | 'interface'
  | 'class';

/**
 * A single input or output of a symbol.
 *
 * Used for both signal `input()`/`input.required()`/`model()` inputs and
 * `output()`/`model()` outputs. Inherited members (walked from a base class such
 * as `FormControlBase`) carry `inherited: true` so the viewer can group them.
 */
export interface ApiMember {
  /** The member name, e.g. `variant`, `disabled`, `checkedChange`. */
  name: string;
  /**
   * The rendered surface type text, generics preserved, e.g. `MlvButtonVariant`,
   * `boolean`, `MlvInputInputMode | null`. Coerced boolean inputs surface as
   * `boolean`.
   */
  type: string;
  /** The default value text (first argument of the signal call), when present. */
  default?: string;
  /** The leading JSDoc description of the member, when present. */
  description?: string;
  /** `true` for `input.required()` / `model.required()` members. */
  required?: boolean;
  /** `true` when the member is inherited from a base class. */
  inherited?: boolean;
  /** The base-class name a member was inherited from, when `inherited`. */
  inheritedFrom?: string;
}

/**
 * A single public method of a symbol.
 *
 * Angular lifecycle hooks and `_`-prefixed / `@internal` / `@private` members
 * are excluded by the extractor.
 */
export interface ApiMethod {
  /** The method name, e.g. `open`, `focus`, `writeValue`. */
  name: string;
  /** The rendered signature, e.g. `open<T>(component: Type<T>, config?: MlvDialogConfig): MlvDialogRef`. */
  signature: string;
  /** The leading JSDoc description of the method, when present. */
  description?: string;
  /** `true` when the method is inherited from a base class. */
  inherited?: boolean;
  /** The base-class name a method was inherited from, when `inherited`. */
  inheritedFrom?: string;
}

/**
 * A single exported symbol of a library (component, directive, pipe, service,
 * injection token, type alias, interface, or plain class).
 */
export interface ApiSymbol {
  /** The exported identifier, e.g. `MlvButton`, `DIALOG_DATA`, `MlvButtonVariant`. */
  name: string;
  /** The classification of the symbol. */
  kind: ApiSymbolKind;
  /** The `@Component`/`@Directive` selector or `@Pipe` name, when applicable. */
  selector?: string;
  /** The leading JSDoc description of the declaration, when present. */
  description?: string;
  /** Signal inputs (`input()`/`model()`), own then inherited. Empty for non-directive kinds. */
  inputs: ApiMember[];
  /** Signal outputs (`output()`/`model()` change events), own then inherited. */
  outputs: ApiMember[];
  /**
   * Public readable properties that are **not** inputs/outputs — `computed()` /
   * `signal()` state, public getters, and plain public fields — own then
   * inherited. Structural view/content queries and `_`/`@internal` members are
   * excluded by the extractor.
   */
  properties: ApiMember[];
  /** Public methods, own then inherited. */
  methods: ApiMethod[];
  /**
   * For `type`/`interface`/`token` kinds: the rendered type text
   * (alias body, interface declaration, or `InjectionToken<T>`).
   */
  typeText?: string;
}

/** The full extracted API of one documented library, keyed by its docs-page (kebab) name. */
export interface ApiEntry {
  /** The docs-page kebab name, e.g. `button`, `form-field`. */
  name: string;
  /** Every documented public symbol of the library. */
  symbols: ApiSymbol[];
}
