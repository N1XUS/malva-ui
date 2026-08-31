#!/usr/bin/env node
/**
 * Generate consumer-facing AI documentation for published Malva UI packages.
 *
 * The package/entry-point list is derived from ng-package.json files. This is
 * intentionally strict: an unrelated project document can never be published
 * as an invented package subpath.
 *
 * Usage: node scripts/generate-ai-docs.mjs [--dry-run]
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const packageDefinitions = [
  {
    name: 'core',
    packageName: '@malva-ui/core',
    root: 'libs/core',
    description:
      'Full-featured Angular UI components for the Malva UI design system.',
    quickStart: [
      "import { MlvButton } from '@malva-ui/core/button';",
      "import { MlvDialogService } from '@malva-ui/core/dialog';",
      "import { MlvInput } from '@malva-ui/core/input';",
    ],
  },
  {
    name: 'cdk',
    packageName: '@malva-ui/cdk',
    root: 'libs/cdk',
    description:
      'Low-level infrastructure primitives for the Malva UI design system.',
    quickStart: [
      "import { MlvClick } from '@malva-ui/cdk/accessibility';",
      "import { MlvDensityDirective } from '@malva-ui/cdk/density';",
      "import { MlvAutofocus } from '@malva-ui/cdk/utils';",
    ],
  },
  {
    name: 'i18n',
    packageName: '@malva-ui/i18n',
    root: 'libs/i18n',
    description:
      'Localisation contracts, default English messages, and locale providers for Malva UI.',
    quickStart: [
      "import { provideMlvI18n } from '@malva-ui/i18n';",
      "provideMlvI18n(() => import('@malva-ui/i18n/en'));",
    ],
  },
];

function discoverEntrypoints(definition) {
  const packageRoot = resolve(workspaceRoot, definition.root);
  if (!existsSync(resolve(packageRoot, 'ng-package.json'))) {
    throw new Error(`${definition.packageName} has no root ng-package.json`);
  }

  const entrypoints = readdirSync(packageRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(packageRoot, entry.name, 'ng-package.json')),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return [definition.name, ...entrypoints];
}

function findSourceDocument(definition, entrypoint) {
  const qualified = resolve(
    workspaceRoot,
    '.claude/projects',
    `libs-${definition.name}-${entrypoint}.md`,
  );
  const canonical = resolve(
    workspaceRoot,
    '.claude/projects',
    `libs-${entrypoint}.md`,
  );
  const local = resolve(
    workspaceRoot,
    definition.root,
    entrypoint === definition.name ? '' : entrypoint,
    'CLAUDE.md',
  );
  const source = existsSync(qualified)
    ? qualified
    : existsSync(canonical)
      ? canonical
      : local;

  if (!existsSync(source)) {
    throw new Error(
      `Missing documentation for ${definition.packageName}${entrypoint === definition.name ? '' : `/${entrypoint}`}`,
    );
  }
  return source;
}

function transformContent(content, importPath) {
  let text = content.replace(/^---\s*\n/, '');
  text = text.replace(/> \*\*Keep this file up to date\.\*\*[^\n]*\n\n?/g, '');
  text = text.replace(
    /Exported from `libs\/[^`]+`/g,
    `Exported from \`${importPath}\``,
  );
  text = text.replace(
    /\*{0,2}(?:File|Path|Template|Styles?|Stylesheet)(?::)?\*{0,2}\s*`libs\/[^`]+`/g,
    '',
  );
  text = text.replace(/`libs\/[^`]+`/g, '*(internal)*');
  text = text.replace(/```[^\n]*\nlibs\/[\s\S]*?```/g, '');
  text = text.replace(
    /^.*(?:tsconfig\.spec|vite\.config|test-setup|\.spec\.ts|jest\.config|CLAUDE\.md|nx\.json|project\.json).*$\n?/gm,
    '',
  );
  return `${text.replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function extractDescription(content) {
  const overview = content.match(/## Overview\s*\n\n([^\n]+)/)?.[1];
  if (overview) {
    const sentence = overview
      .replace(/\s*\(.*?\)/g, '')
      .trim()
      .split(/\.\s/)[0];
    return sentence.endsWith('.') ? sentence : `${sentence}.`;
  }
  return content.match(/^# (.+)/m)?.[1]?.trim() ?? '';
}

function generateAgentsMd(definition, docs) {
  let markdown = `# ${definition.packageName} — AI Reference\n\n`;
  markdown += `${definition.description}\n\n## Quick Start\n\n`;
  markdown += '\`\`\`ts\n';
  markdown += `${definition.quickStart.join('\n')}\n\`\`\`\n\n`;
  markdown += '## Conventions\n\n';
  markdown +=
    '- Components use standalone Angular APIs, signals, and OnPush change detection.\n';
  markdown +=
    '- BEM classes and `--mlv-*` custom properties provide style isolation and theming.\n';
  markdown += '- Import only documented package entry points.\n\n';
  markdown +=
    '## Reference\n\n| Area | Import | Description |\n|---|---|---|\n';
  for (const doc of docs) {
    markdown += `| ${doc.name} | \`${doc.importPath}\` | ${doc.description} [Details](docs/ai/${doc.name}.md) |\n`;
  }
  return markdown;
}

console.log('\nGenerating AI documentation from published entry points\n');

for (const definition of packageDefinitions) {
  const docs = discoverEntrypoints(definition).map((entrypoint) => {
    const importPath =
      entrypoint === definition.name
        ? definition.packageName
        : `${definition.packageName}/${entrypoint}`;
    const source = findSourceDocument(definition, entrypoint);
    const transformed = transformContent(
      readFileSync(source, 'utf8'),
      importPath,
    );
    const outDir = resolve(
      workspaceRoot,
      'dist/libs',
      definition.name,
      'docs/ai',
    );
    const outFile = resolve(outDir, `${entrypoint}.md`);

    if (dryRun) {
      console.log(`  [dry-run] ${importPath} <- ${basename(source)}`);
    } else {
      if (!existsSync(resolve(workspaceRoot, 'dist/libs', definition.name))) {
        throw new Error(
          `dist/libs/${definition.name} does not exist; build the package first`,
        );
      }
      mkdirSync(outDir, { recursive: true });
      writeFileSync(outFile, transformed, 'utf8');
      console.log(`  ${importPath}`);
    }

    return {
      name: entrypoint,
      importPath,
      description: extractDescription(transformed),
    };
  });

  if (!dryRun) {
    writeFileSync(
      resolve(workspaceRoot, 'dist/libs', definition.name, 'AGENTS.md'),
      generateAgentsMd(definition, docs),
      'utf8',
    );
  }
}

console.log('\nAI documentation generation complete.\n');
