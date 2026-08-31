#!/usr/bin/env node
/**
 * Malva UI AI Translation CLI
 *
 * Generates language packs by translating the English source using AI providers.
 * Reads token context metadata for high-quality, context-aware translations.
 *
 * Usage:
 *   node scripts/malva-ui-translate.mjs --target uk --provider claude --api-key <key>
 *   node scripts/malva-ui-translate.mjs --target de,fr,uk --provider claude --api-key <key>
 *   node scripts/malva-ui-translate.mjs --target uk --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

// --- CLI args ---

const args = process.argv.slice(2);
const getFlag = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const targetLocales = (getFlag('target') ?? '').split(',').filter(Boolean);
const provider = getFlag('provider') ?? 'claude';
const apiKey = getFlag('api-key') ?? process.env.ANTHROPIC_API_KEY ?? '';
const dryRun = args.includes('--dry-run');
const model = getFlag('model') ?? 'claude-sonnet-4-5-20241022';

if (targetLocales.length === 0) {
  console.error('Usage: malva-ui-translate --target <locale[,locale2]> [--provider claude] [--api-key <key>]');
  process.exit(1);
}

if (!apiKey && !dryRun) {
  console.error('Error: --api-key or ANTHROPIC_API_KEY env var required (unless --dry-run).');
  process.exit(1);
}

// --- Load English source ---

console.log('\nMalva UI AI Translation CLI\n');

const enPath = resolve(workspaceRoot, 'libs/i18n/en/src/lib/en.ts');
const enSource = readFileSync(enPath, 'utf8');

// Parse the TypeScript object literal (simplified — works for our structure)
let enCode = enSource
  .replace(/import.*from.*;\n?/g, '')
  .replace(/export default\s+/, 'module.exports = ')
  .replace(/const (\w+):\s*\w+\s*=/, 'const $1 =');

const enModule = {};
new Function('module', enCode)(enModule);
const enPack = enModule.exports;

console.log(`  Loaded English pack: ${Object.keys(enPack).length} component sections\n`);

// --- Build translation requests ---

function flattenPack(pack) {
  const result = [];
  for (const [section, values] of Object.entries(pack)) {
    for (const [key, value] of Object.entries(values)) {
      result.push({
        key: `${section}.${key}`,
        sourceText: value,
        section,
        fieldKey: key,
      });
    }
  }
  return result;
}

const allKeys = flattenPack(enPack);
console.log(`  Total keys to translate: ${allKeys.length}\n`);

// --- Translate ---

async function translateWithClaude(keys, targetLocale) {
  const prompt = keys.map((k) => `Key: ${k.key}\nEnglish: "${k.sourceText}"`).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are translating UI component strings for an Angular component library from English to ${targetLocale}.

Rules:
- Output ONLY a JSON array of objects with "key" and "translatedText" fields
- Every string uses ICU MessageFormat. Preserve all {parameter} placeholders exactly
- For plural forms, use ALL required CLDR plural categories for ${targetLocale}
- Keep translations concise and natural for UI context
- aria-label values should be descriptive but brief

Strings to translate:

${prompt}`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}

// --- Generate language packs ---

for (const locale of targetLocales) {
  console.log(`  Translating to: ${locale}`);

  if (dryRun) {
    console.log(`  [dry-run] Would translate ${allKeys.length} keys to ${locale}`);
    continue;
  }

  let translations;
  try {
    translations = await translateWithClaude(allKeys, locale);
  } catch (err) {
    console.error(`  Translation failed for ${locale}: ${err.message}`);
    continue;
  }

  console.log(`  Received ${translations.length} translations`);

  // Build the language pack object
  const pack = {};
  for (const t of translations) {
    const [section, key] = t.key.split('.');
    if (!pack[section]) pack[section] = {};
    pack[section][key] = t.translatedText;
  }

  // Validate: ensure all keys from English are present
  let missing = 0;
  for (const k of allKeys) {
    if (!pack[k.section]?.[k.fieldKey]) {
      console.warn(`  Missing: ${k.key}`);
      pack[k.section] = pack[k.section] || {};
      pack[k.section][k.fieldKey] = k.sourceText; // fallback to English
      missing++;
    }
  }
  if (missing > 0) console.log(`  ${missing} keys fell back to English`);

  // Write the language pack file
  const outDir = resolve(workspaceRoot, 'libs/i18n', locale, 'src/lib');
  const outFile = resolve(outDir, `${locale}.ts`);

  mkdirSync(outDir, { recursive: true });

  const fileContent = `import type { MlvLanguage } from '@malva-ui/i18n';

const ${locale}: MlvLanguage = ${JSON.stringify(pack, null, 2)};

export default ${locale};
`;

  writeFileSync(outFile, fileContent, 'utf8');
  console.log(`  Written: libs/i18n/${locale}/src/lib/${locale}.ts`);

  // Write entry point files if they don't exist
  const entryDir = resolve(workspaceRoot, 'libs/i18n', locale, 'src');
  const ngPkgPath = resolve(workspaceRoot, 'libs/i18n', locale, 'ng-package.json');

  if (!existsSync(resolve(entryDir, 'index.ts'))) {
    writeFileSync(resolve(entryDir, 'index.ts'), `export { default } from './lib/${locale}';\n`, 'utf8');
  }
  if (!existsSync(ngPkgPath)) {
    writeFileSync(ngPkgPath, JSON.stringify({ lib: { entryFile: 'src/index.ts' } }, null, 2) + '\n', 'utf8');
  }

  // Add tsconfig path if not present
  const tsconfigPath = resolve(workspaceRoot, 'tsconfig.base.json');
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const pathKey = `@malva-ui/i18n/${locale}`;
  if (!tsconfig.compilerOptions.paths[pathKey]) {
    tsconfig.compilerOptions.paths[pathKey] = [`libs/i18n/${locale}/src/index.ts`];
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf8');
    console.log(`  Added ${pathKey} to tsconfig.base.json`);
  }
}

console.log('\nTranslation complete.\n');
