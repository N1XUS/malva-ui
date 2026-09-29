import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/*
 * `@malva-ui/editor/collaboration` is `export *` from public-only modules
 * (best-practices: barrels never name symbols). So nothing `@internal` — the
 * session, binder, schema guard, anchors, frame and metadata constants,
 * palette helpers — may be exported by a module the barrel lists, and the
 * barrel may list nothing else.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BARREL = resolve(HERE, '../index.ts');

/** Parses one TypeScript file. */
const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

/** Whether `node` carries the modifier `kind`. */
const has = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

/** Every exported declaration of a module: its name and whether it is `@internal`. */
function exportsOf(file: string): { name: string; internal: boolean }[] {
  const source = parse(file);
  const found: { name: string; internal: boolean }[] = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      throw new Error(`${file}: re-exports are not allowed behind the barrel`);
    }
    if (!has(statement, ts.SyntaxKind.ExportKeyword)) continue;
    const internal = ts
      .getJSDocTags(statement)
      .some((tag) => tag.tagName.text === 'internal');
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        found.push({ name: declaration.name.getText(source), internal });
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      found.push({ name: statement.name.text, internal });
    }
  }
  return found;
}

describe('@malva-ui/editor/collaboration barrel', () => {
  const barrel = parse(BARREL);

  it('re-exports whole modules only', () => {
    for (const statement of barrel.statements) {
      expect(ts.isExportDeclaration(statement)).toBe(true);
      const declaration = statement as ts.ExportDeclaration;
      // `export * from` has no export clause; a named list would have one.
      expect(declaration.exportClause).toBeUndefined();
      expect(declaration.isTypeOnly).toBe(false);
    }
  });

  it('reaches no @internal symbol and exactly the public surface', () => {
    const names: string[] = [];
    const internal: string[] = [];
    for (const statement of barrel.statements) {
      const specifier = (
        (statement as ts.ExportDeclaration).moduleSpecifier as ts.StringLiteral
      ).text;
      for (const symbol of exportsOf(resolve(HERE, `../${specifier}.ts`))) {
        names.push(symbol.name);
        if (symbol.internal) internal.push(`${specifier}: ${symbol.name}`);
      }
    }
    expect(internal).toEqual([]);
    expect(names.sort()).toEqual(
      [
        'MLV_EDITOR_COLLABORATION_COLORS',
        'MlvEditorCollaboration',
        'MlvEditorCollaborationConnectionState',
        'MlvEditorCollaborationPeer',
        'MlvEditorCollaborationPeerMode',
        'MlvEditorCollaborationSeedOptions',
        'MlvEditorCollaborationStatus',
        'MlvEditorCollaborationTransport',
        'MlvEditorCollaborationTransportContext',
        'MlvEditorCollaborationTransportEvent',
        'MlvEditorCollaborationUser',
        'MlvEditorPresence',
        'createMlvEditorCollaborationSeed',
        'decodeMlvEditorCollaborationFrame',
        'encodeMlvEditorCollaborationFrame',
        'mlvEditorCollaborationFrameType',
      ].sort(),
    );
  });
});
