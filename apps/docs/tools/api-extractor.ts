/**
 * Build-time API extraction core (Phase D).
 *
 * Pure, testable ts-morph logic that turns a library's public barrel
 * (`libs/<family>/<name>/src/index.ts`) into a typed {@link ApiEntry}. The
 * thin CLI wrapper (`extract-api.ts`) enumerates docs pages, calls
 * {@link extractEntry} for each, and writes the JSON + module map.
 *
 * Kept separate from the CLI so the spec can exercise the extraction against
 * real library sources without triggering any file writes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node, Project } from 'ts-morph';
import type {
  CallExpression,
  ClassDeclaration,
  Decorator,
  ExportedDeclarations,
  GetAccessorDeclaration,
  JSDoc,
  MethodDeclaration,
  PropertyDeclaration,
  VariableDeclaration,
} from 'ts-morph';
import type {
  ApiEntry,
  ApiMember,
  ApiMethod,
  ApiSymbol,
  ApiSymbolKind,
} from '../src/app/shared/api-viewer/api.types';
import { docsPages } from '../src/app/app.routes';

/** Angular lifecycle hooks are implementation detail, never public API methods. */
const NG_LIFECYCLE_HOOKS: ReadonlySet<string> = new Set([
  'ngOnInit',
  'ngOnDestroy',
  'ngOnChanges',
  'ngDoCheck',
  'ngAfterContentInit',
  'ngAfterContentChecked',
  'ngAfterViewInit',
  'ngAfterViewChecked',
  'ngDoBootstrap',
]);

/** Render order for symbols within an entry. */
const KIND_ORDER: Record<ApiSymbolKind, number> = {
  component: 0,
  directive: 1,
  pipe: 2,
  service: 3,
  class: 4,
  token: 5,
  interface: 6,
  type: 7,
};

/** Result of resolving a docs page to a source library barrel. */
export interface ResolvedLib {
  /** The library family (`core` / `cdk` / `i18n` / `editor`). */
  family: string;
  /** The leaf library directory name. */
  dir: string;
  /** Absolute path to the library's public `src/index.ts` barrel. */
  indexPath: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Workspace / page resolution
// ────────────────────────────────────────────────────────────────────────────

/** Walks up from `startDir` until it finds the Nx workspace root (contains `nx.json`). */
export function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate workspace root (nx.json) from ${startDir}`,
      );
    }
    dir = parent;
  }
}

/**
 * Lists every page with a public API target from the typed docs manifest.
 */
export function listDocumentedPages(_repoRoot: string): string[] {
  return docsPages
    .filter((page) => page.api !== null)
    .map((page) => page.path)
    .sort();
}

/**
 * Resolves a docs page to the public barrel declared in the typed manifest.
 */
export function resolveLib(
  repoRoot: string,
  pageName: string,
): ResolvedLib | null {
  const target = docsPages.find((page) => page.path === pageName)?.api;
  if (!target) return null;
  const dir = target.entry;
  const indexPath = path.join(
    repoRoot,
    'libs',
    target.family,
    ...(dir ? [dir] : []),
    'src',
    'index.ts',
  );
  return fs.existsSync(indexPath)
    ? { family: target.family, dir, indexPath }
    : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Project construction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates a ts-morph project seeded with every library source file, using the
 * workspace `tsconfig.base.json` compiler options so `@malva-ui/*` path aliases
 * (and therefore cross-library base classes) resolve.
 */
export function createApiProject(repoRoot: string): Project {
  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, 'tsconfig.base.json'),
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: false,
  });
  project.addSourceFilesAtPaths([
    path.join(repoRoot, 'libs', '**', 'src', '**', '*.ts'),
    `!${path.join(repoRoot, 'libs', '**', '*.spec.ts')}`,
    `!${path.join(repoRoot, 'libs', '**', '*.e2e.ts')}`,
    `!${path.join(repoRoot, 'libs', '**', 'node_modules', '**')}`,
  ]);
  return project;
}

// ────────────────────────────────────────────────────────────────────────────
// Entry extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the full {@link ApiEntry} for one library barrel: resolves every
 * re-exported symbol through `export *`, classifies it, and extracts its
 * members. `pageName` is the docs-page kebab key the entry is stored under.
 */
export function extractEntry(
  project: Project,
  pageName: string,
  indexPath: string,
): ApiEntry {
  const barrel =
    project.getSourceFile(indexPath) ?? project.addSourceFileAtPath(indexPath);
  const symbols: ApiSymbol[] = [];
  for (const [name, declarations] of barrel.getExportedDeclarations()) {
    const declaration = pickDeclaration(declarations);
    if (!declaration) continue;
    const symbol = classifyAndExtract(name, declaration);
    if (symbol) symbols.push(symbol);
  }
  symbols.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name),
  );
  return { name: pageName, symbols };
}

/** Picks the most meaningful declaration when a name resolves to several (merging, overloads). */
function pickDeclaration(
  declarations: ExportedDeclarations[],
): ExportedDeclarations | undefined {
  const priority = (node: ExportedDeclarations): number => {
    if (Node.isClassDeclaration(node)) return 0;
    if (Node.isVariableDeclaration(node))
      return injectionTokenType(node) ? 1 : 5;
    if (Node.isEnumDeclaration(node)) return 2;
    if (Node.isTypeAliasDeclaration(node)) return 3;
    if (Node.isInterfaceDeclaration(node)) return 4;
    return 6;
  };
  return [...declarations].sort((a, b) => priority(a) - priority(b))[0];
}

/** Classifies and extracts a single declaration, or returns `null` for unsupported kinds. */
function classifyAndExtract(
  name: string,
  declaration: ExportedDeclarations,
): ApiSymbol | null {
  if (Node.isClassDeclaration(declaration)) {
    return extractClass(name, declaration);
  }
  if (Node.isInterfaceDeclaration(declaration)) {
    return emptySymbol(name, 'interface', {
      description: jsDocDescription(declaration),
      typeText: stripExport(declaration.getText()),
    });
  }
  if (Node.isTypeAliasDeclaration(declaration)) {
    const typeText =
      declaration.getTypeNode()?.getText() ??
      cleanType(declaration.getType().getText());
    return emptySymbol(name, 'type', {
      description: jsDocDescription(declaration),
      typeText,
    });
  }
  if (Node.isEnumDeclaration(declaration)) {
    return emptySymbol(name, 'type', {
      description: jsDocDescription(declaration),
      typeText: stripExport(declaration.getText()),
    });
  }
  if (Node.isVariableDeclaration(declaration)) {
    const tokenType = injectionTokenType(declaration);
    if (!tokenType) return null; // non-token const (position maps, provider factories) → skip
    return emptySymbol(name, 'token', {
      description: jsDocDescription(
        declaration.getVariableStatement() ?? declaration,
      ),
      typeText: tokenType,
    });
  }
  return null; // functions and other exports do not map to the API-symbol kinds
}

/** Builds a member-less symbol (types, interfaces, tokens). */
function emptySymbol(
  name: string,
  kind: ApiSymbolKind,
  extra: Partial<ApiSymbol>,
): ApiSymbol {
  return {
    name,
    kind,
    inputs: [],
    outputs: [],
    properties: [],
    methods: [],
    ...extra,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Class extraction (components / directives / pipes / services / classes)
// ────────────────────────────────────────────────────────────────────────────

function extractClass(name: string, declaration: ClassDeclaration): ApiSymbol {
  const kind = classKind(declaration);
  const members = extractClassApi(declaration);
  return {
    name,
    kind,
    selector: classSelector(declaration, kind),
    description: jsDocDescription(declaration),
    inputs: members.inputs,
    outputs: members.outputs,
    properties: members.properties,
    methods: members.methods,
  };
}

/** Classifies a class by its Angular decorator, defaulting to a plain `class`. */
function classKind(declaration: ClassDeclaration): ApiSymbolKind {
  if (declaration.getDecorator('Component')) return 'component';
  if (declaration.getDecorator('Pipe')) return 'pipe';
  if (declaration.getDecorator('Injectable')) return 'service';
  if (declaration.getDecorator('Directive')) return 'directive';
  return 'class';
}

/** Reads the `selector` from `@Component`/`@Directive` or the `name` from `@Pipe`. */
function classSelector(
  declaration: ClassDeclaration,
  kind: ApiSymbolKind,
): string | undefined {
  if (kind === 'pipe') {
    return decoratorStringProp(declaration.getDecorator('Pipe'), 'name');
  }
  const decorator =
    declaration.getDecorator('Component') ??
    declaration.getDecorator('Directive');
  return decoratorStringProp(decorator, 'selector');
}

/** Reads a string-literal property (`selector`, `name`) from a decorator's config object. */
function decoratorStringProp(
  decorator: Decorator | undefined,
  prop: string,
): string | undefined {
  if (!decorator) return undefined;
  const [arg] = decorator.getArguments();
  if (!arg || !Node.isObjectLiteralExpression(arg)) return undefined;
  const property = arg.getProperty(prop);
  if (!property || !Node.isPropertyAssignment(property)) return undefined;
  const initializer = property.getInitializer();
  if (!initializer) return undefined;
  return Node.isStringLiteral(initializer)
    ? initializer.getLiteralValue()
    : initializer.getText();
}

interface ClassMembers {
  inputs: ApiMember[];
  outputs: ApiMember[];
  properties: ApiMember[];
  methods: ApiMethod[];
}

/** Collects own members plus inherited (base-class) members, de-duplicated by name. */
function extractClassApi(declaration: ClassDeclaration): ClassMembers {
  const own = collectMembers(declaration, undefined);
  const inputs = [...own.inputs];
  const outputs = [...own.outputs];
  const properties = [...own.properties];
  const methods = [...own.methods];
  const seenInputs = new Set(inputs.map((m) => m.name));
  const seenOutputs = new Set(outputs.map((m) => m.name));
  const seenProperties = new Set(properties.map((m) => m.name));
  const seenMethods = new Set(methods.map((m) => m.name));
  // A member surfaced as an input/output must never re-appear as a property.
  const claimed = new Set([...seenInputs, ...seenOutputs]);

  for (const base of baseClassChain(declaration)) {
    const inherited = collectMembers(base, base.getName());
    for (const member of inherited.inputs) {
      if (!seenInputs.has(member.name)) {
        inputs.push(member);
        seenInputs.add(member.name);
        claimed.add(member.name);
      }
    }
    for (const member of inherited.outputs) {
      if (!seenOutputs.has(member.name)) {
        outputs.push(member);
        seenOutputs.add(member.name);
        claimed.add(member.name);
      }
    }
    for (const member of inherited.properties) {
      if (!seenProperties.has(member.name) && !claimed.has(member.name)) {
        properties.push(member);
        seenProperties.add(member.name);
      }
    }
    for (const member of inherited.methods) {
      if (!seenMethods.has(member.name)) {
        methods.push(member);
        seenMethods.add(member.name);
      }
    }
  }
  return { inputs, outputs, properties, methods };
}

/** Resolves the ordered chain of base classes above `declaration`. */
function baseClassChain(declaration: ClassDeclaration): ClassDeclaration[] {
  const chain: ClassDeclaration[] = [];
  const seen = new Set<ClassDeclaration>();
  let current: ClassDeclaration | undefined = declaration;
  while (current) {
    const base = resolveBaseClass(current);
    if (!base || seen.has(base)) break;
    seen.add(base);
    chain.push(base);
    current = base;
  }
  return chain;
}

/** Resolves a class's immediate base declaration via the checker, with a heritage-clause fallback. */
function resolveBaseClass(
  declaration: ClassDeclaration,
): ClassDeclaration | undefined {
  const viaChecker = declaration.getBaseClass();
  if (viaChecker) return viaChecker;
  const heritage = declaration.getExtends();
  if (!heritage) return undefined;
  const expression = heritage.getExpression();
  const symbol = expression.getSymbol() ?? expression.getType().getSymbol();
  const declarations = symbol?.getDeclarations() ?? [];
  for (const decl of declarations) {
    if (Node.isClassDeclaration(decl)) return decl;
  }
  return undefined;
}

/**
 * Structural view/content query factories. Their results are internal wiring,
 * not consumer-facing public properties, so they are excluded from `properties`.
 */
const QUERY_FACTORIES = new Set([
  'viewChild',
  'viewChild.required',
  'viewChildren',
  'contentChild',
  'contentChild.required',
  'contentChildren',
]);

/** Extracts signal inputs/outputs, public properties, and public methods declared directly on a class. */
function collectMembers(
  declaration: ClassDeclaration,
  inheritedFrom: string | undefined,
): ClassMembers {
  const inputs: ApiMember[] = [];
  const outputs: ApiMember[] = [];
  const properties: ApiMember[] = [];
  const methods: ApiMethod[] = [];

  for (const property of declaration.getProperties()) {
    const signal = extractSignalMember(property, inheritedFrom);
    if (signal) {
      if (signal.input) inputs.push(signal.input);
      if (signal.output) outputs.push(signal.output);
      continue;
    }
    // Not an input/output signal — surface it as a public property (skips
    // excluded members and structural queries inside the helper).
    const prop = extractProperty(property, inheritedFrom);
    if (prop) properties.push(prop);
  }

  for (const accessor of declaration.getGetAccessors()) {
    const prop = extractAccessor(accessor, inheritedFrom);
    if (prop) properties.push(prop);
  }

  for (const method of declaration.getMethods()) {
    const extracted = extractMethod(method, inheritedFrom);
    if (extracted) methods.push(extracted);
  }

  return { inputs, outputs, properties, methods };
}

/**
 * Surfaces a public readable property that is not an input/output — `computed()`
 * / `signal()` state, or a plain public field. Returns `null` for excluded
 * (`_`/`@internal`/non-public) members and for structural view/content queries.
 */
function extractProperty(
  property: PropertyDeclaration,
  inheritedFrom: string | undefined,
): ApiMember | null {
  const name = property.getName();
  if (isExcludedMember(property, name)) return null;

  const initializer = property.getInitializer();
  if (initializer && Node.isCallExpression(initializer)) {
    if (QUERY_FACTORIES.has(initializer.getExpression().getText())) return null;
  }

  const member: ApiMember = {
    name,
    type: cleanType(property.getType().getText(property)),
  };
  const description = jsDocDescription(property);
  if (description) member.description = description;
  if (inheritedFrom !== undefined) {
    member.inherited = true;
    if (inheritedFrom) member.inheritedFrom = inheritedFrom;
  }
  return member;
}

/** Surfaces a public getter as a read-only property. */
function extractAccessor(
  accessor: GetAccessorDeclaration,
  inheritedFrom: string | undefined,
): ApiMember | null {
  const name = accessor.getName();
  if (isExcludedMember(accessor, name)) return null;

  const type =
    accessor.getReturnTypeNode()?.getText() ??
    accessor.getReturnType().getText(accessor);
  const member: ApiMember = { name, type: cleanType(type) };
  const description = jsDocDescription(accessor);
  if (description) member.description = description;
  if (inheritedFrom !== undefined) {
    member.inherited = true;
    if (inheritedFrom) member.inheritedFrom = inheritedFrom;
  }
  return member;
}

interface SignalMembers {
  input?: ApiMember;
  output?: ApiMember;
}

/**
 * Recognises `input()`, `input.required()`, `model()`, `model.required()`,
 * and `output()` field initializers and turns them into members. A `model()`
 * produces both an input and its `<name>Change` output.
 */
function extractSignalMember(
  property: PropertyDeclaration,
  inheritedFrom: string | undefined,
): SignalMembers | null {
  const name = property.getName();
  if (isExcludedMember(property, name)) return null;

  const initializer = property.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return null;

  const callee = initializer.getExpression().getText();
  const role = signalRole(callee);
  if (!role) return null;

  const description = jsDocDescription(property);
  const inherited = inheritedFrom !== undefined;
  const coercion = detectCoercion(initializer.getText());
  const type = surfaceType(initializer, property, coercion);
  const defaultValue = role.required ? undefined : defaultText(initializer);

  const base: ApiMember = { name, type };
  if (defaultValue !== undefined) base.default = defaultValue;
  if (description) base.description = description;
  if (role.required) base.required = true;
  if (inherited) {
    base.inherited = true;
    if (inheritedFrom) base.inheritedFrom = inheritedFrom;
  }

  if (role.kind === 'input') return { input: base };
  if (role.kind === 'output') return { output: base };
  // model(): an input plus a matching `<name>Change` output.
  const output: ApiMember = { name: `${name}Change`, type };
  if (description) output.description = description;
  if (inherited) {
    output.inherited = true;
    if (inheritedFrom) output.inheritedFrom = inheritedFrom;
  }
  return { input: base, output };
}

interface SignalRole {
  kind: 'input' | 'output' | 'model';
  required: boolean;
}

/** Maps a signal-factory callee to its role, or `null` for non-signal calls (`signal`, `computed`, `inject`, …). */
function signalRole(callee: string): SignalRole | null {
  switch (callee) {
    case 'input':
      return { kind: 'input', required: false };
    case 'input.required':
      return { kind: 'input', required: true };
    case 'model':
      return { kind: 'model', required: false };
    case 'model.required':
      return { kind: 'model', required: true };
    case 'output':
      return { kind: 'output', required: false };
    default:
      return null;
  }
}

type Coercion = 'boolean' | 'number' | null;

/** Detects a coercion transform so `input<boolean, BooleanInput>(false, {transform})` surfaces `boolean`. */
function detectCoercion(callText: string): Coercion {
  if (
    callText.includes('coerceBooleanProperty') ||
    callText.includes('booleanAttribute')
  ) {
    return 'boolean';
  }
  if (
    callText.includes('coerceNumberProperty') ||
    callText.includes('numberAttribute')
  ) {
    return 'number';
  }
  return null;
}

/**
 * Resolves the surfaced (read) type of a signal member. Priority: coercion
 * override → explicit first type argument → resolved signal generic →
 * default-literal inference → `unknown`.
 */
function surfaceType(
  call: CallExpression,
  property: PropertyDeclaration,
  coercion: Coercion,
): string {
  if (coercion) return coercion;

  const typeArgs = call.getTypeArguments();
  if (typeArgs.length >= 1) return cleanType(typeArgs[0].getText());

  const resolved = property.getType().getTypeArguments();
  if (resolved.length >= 1) {
    const text = cleanType(resolved[0].getText(property));
    if (text && text !== 'unknown') return text;
  }

  const [firstArg] = call.getArguments();
  return firstArg ? inferTypeFromExpression(firstArg) : 'unknown';
}

/** Cheap literal-based type inference used when no explicit or resolved generic is available. */
function inferTypeFromExpression(node: Node): string {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    return 'string';
  if (Node.isNumericLiteral(node)) return 'number';
  const text = node.getText();
  if (text === 'true' || text === 'false') return 'boolean';
  if (text === 'null') return 'null';
  if (text === 'undefined') return 'undefined';
  return cleanType(node.getType().getText(node)) || 'unknown';
}

/** The default value text (first call argument), cleaned of newlines. */
function defaultText(call: CallExpression): string | undefined {
  const [firstArg] = call.getArguments();
  if (!firstArg) return undefined;
  return cleanValue(firstArg.getText());
}

/** Extracts a single public method, excluding lifecycle hooks and non-public members. */
function extractMethod(
  method: MethodDeclaration,
  inheritedFrom: string | undefined,
): ApiMethod | null {
  const name = method.getName();
  if (isExcludedMember(method, name)) return null;
  if (NG_LIFECYCLE_HOOKS.has(name)) return null;

  const result: ApiMethod = { name, signature: methodSignature(method) };
  const description = jsDocDescription(method);
  if (description) result.description = description;
  if (inheritedFrom !== undefined) {
    result.inherited = true;
    result.inheritedFrom = inheritedFrom;
  }
  return result;
}

/** Renders a readable method signature: `name<T>(params): returnType`. */
function methodSignature(method: MethodDeclaration): string {
  const typeParams = method.getTypeParameters().map((tp) => tp.getText());
  const typeParamText = typeParams.length ? `<${typeParams.join(', ')}>` : '';
  const params = method.getParameters().map((p) => cleanValue(p.getText()));
  const returnType =
    method.getReturnTypeNode()?.getText() ??
    cleanType(method.getReturnType().getText(method));
  return `${method.getName()}${typeParamText}(${params.join(', ')}): ${returnType}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────────

/** Excludes `_`-prefixed, non-public, and `@internal`/`@private` members from the public surface. */
function isExcludedMember(
  node: PropertyDeclaration | MethodDeclaration | GetAccessorDeclaration,
  name: string,
): boolean {
  if (name.startsWith('_')) return true;
  if (node.getScope() !== 'public') return true;
  for (const doc of node.getJsDocs()) {
    for (const tag of doc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName === 'internal' || tagName === 'private') return true;
    }
    const text = doc.getDescription().trimStart();
    if (text.startsWith('@internal') || text.startsWith('@private'))
      return true;
  }
  return false;
}

/** Returns the leading JSDoc description of a node, or `undefined` when absent/empty. */
function jsDocDescription(node: Node): string | undefined {
  const getJsDocs = (node as { getJsDocs?: () => JSDoc[] }).getJsDocs;
  if (typeof getJsDocs !== 'function') return undefined;
  const docs = getJsDocs.call(node);
  if (!docs.length) return undefined;
  const description = docs[docs.length - 1].getDescription().trim();
  return description || undefined;
}

/** Returns the `InjectionToken<T>` type text when the variable is a token, else `null`. */
function injectionTokenType(declaration: VariableDeclaration): string | null {
  // An explicit annotation is the only signal for a token a barrel re-exports
  // under its own name rather than constructing
  // (`const DIALOG_DATA: InjectionToken<unknown> = CDK_DIALOG_DATA`): the
  // initializer is a plain identifier, so the `new` check below never fires.
  const annotation = declaration.getTypeNode()?.getText();
  if (annotation && /^InjectionToken\b/.test(annotation)) {
    return cleanType(annotation);
  }

  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isNewExpression(initializer)) return null;
  if (initializer.getExpression().getText() !== 'InjectionToken') return null;
  const [typeArg] = initializer.getTypeArguments();
  return `InjectionToken<${cleanType(typeArg?.getText() ?? 'unknown')}>`;
}

/** Collapses whitespace and strips cross-file `import("…").` prefixes from a rendered type. */
function cleanType(text: string): string {
  return text
    .replace(/import\((?:"[^"]*"|'[^']*')\)\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapses multiline value/param text to a single readable line. */
function cleanValue(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Drops a leading `export ` modifier from rendered declaration text. */
function stripExport(text: string): string {
  return text.replace(/^export\s+/, '').trim();
}
