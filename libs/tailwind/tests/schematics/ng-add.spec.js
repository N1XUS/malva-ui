'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { Tree } = require('@angular-devkit/schematics');
const { SchematicTestRunner } = require('@angular-devkit/schematics/testing');

const collectionPath = path.resolve(
  __dirname,
  '../../schematics/collection.json',
);
const runner = new SchematicTestRunner('malva-ui-tailwind', collectionPath);
const managedStylesheet = `/* malva-ui:tailwind:start */
@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";
/* malva-ui:tailwind:end */
`;

test('adds Tailwind and Malva dependencies and a managed stylesheet', async () => {
  const result = await runSchematic();
  const packageJson = JSON.parse(result.readContent('/package.json'));
  const styles = JSON.parse(result.readContent('/angular.json')).projects.demo
    .architect.build.options.styles;

  assert.equal(
    packageJson.dependencies['@malva-ui/tailwind'],
    '0.0.0-malva-ui-package-version',
  );
  assert.equal(
    packageJson.dependencies['@malva-ui/core'],
    '0.0.0-malva-ui-package-version',
  );
  assert.equal(packageJson.devDependencies.tailwindcss, '^4.0.0');
  assert.equal(packageJson.devDependencies['@tailwindcss/postcss'], '^4.0.0');
  assert.equal(packageJson.devDependencies.postcss, '^8.4.0');
  assert.deepEqual(styles, [
    'src/styles/malva-ui-tailwind.css',
    'node_modules/@malva-ui/core/styles/malva-ui.css',
    'src/styles.scss',
  ]);
  assert.equal(
    result.readContent('/src/styles/malva-ui-tailwind.css'),
    managedStylesheet,
  );
  assert.deepEqual(JSON.parse(result.readContent('/postcss.config.json')), {
    plugins: { '@tailwindcss/postcss': {} },
  });
});

test('preserves existing dependency versions and object style entries', async () => {
  const tree = createWorkspaceTree({ styles: [{ input: 'src/styles.scss' }] });
  const packageJson = JSON.parse(tree.readText('/package.json'));
  packageJson.dependencies['@malva-ui/core'] = '^1.2.3';
  packageJson.dependencies['@malva-ui/tailwind'] = '~1.2.3';
  packageJson.devDependencies = {
    tailwindcss: '4.1.2',
    '@tailwindcss/postcss': '4.1.2',
    postcss: '8.5.0',
  };
  tree.overwrite('/package.json', JSON.stringify(packageJson, null, 2));

  const result = await runSchematic({}, tree);
  const updatedPackageJson = JSON.parse(result.readContent('/package.json'));
  const styles = JSON.parse(result.readContent('/angular.json')).projects.demo
    .architect.build.options.styles;

  assert.equal(updatedPackageJson.dependencies['@malva-ui/core'], '^1.2.3');
  assert.equal(updatedPackageJson.dependencies['@malva-ui/tailwind'], '~1.2.3');
  assert.equal(updatedPackageJson.devDependencies.tailwindcss, '4.1.2');
  assert.deepEqual(styles, [
    'src/styles/malva-ui-tailwind.css',
    'node_modules/@malva-ui/core/styles/malva-ui.css',
    { input: 'src/styles.scss' },
  ]);
});

test('supports a custom stylesheet and can skip the core stylesheet', async () => {
  const result = await runSchematic({
    stylesheet: 'src/theme/tailwind.css',
    includeCoreStyles: false,
  });
  const workspace = JSON.parse(result.readContent('/angular.json'));
  const styles = workspace.projects.demo.architect.build.options.styles;
  const packageJson = JSON.parse(result.readContent('/package.json'));

  assert.deepEqual(styles, ['src/theme/tailwind.css', 'src/styles.scss']);
  assert.equal(packageJson.dependencies['@malva-ui/core'], undefined);
  assert.equal(
    result.readContent('/src/theme/tailwind.css'),
    managedStylesheet,
  );
  assert.equal(
    result.readContent('/postcss.config.json'),
    '{\n  "plugins": {\n    "@tailwindcss/postcss": {}\n  }\n}\n',
  );
});

test('replaces only the managed stylesheet block and does not duplicate styles', async () => {
  const first = await runSchematic();
  const surrounded = `/* application header */
${managedStylesheet}/* application footer */
`;
  first.overwrite('/src/styles/malva-ui-tailwind.css', surrounded);

  const second = await runSchematic({}, first);
  const stylesheet = second.readContent('/src/styles/malva-ui-tailwind.css');
  const styles = JSON.parse(second.readContent('/angular.json')).projects.demo
    .architect.build.options.styles;

  assert.equal(
    styles.filter((style) => style === 'src/styles/malva-ui-tailwind.css')
      .length,
    1,
  );
  assert.equal(
    styles.filter(
      (style) => style === 'node_modules/@malva-ui/core/styles/malva-ui.css',
    ).length,
    1,
  );
  assert.equal((stylesheet.match(/malva-ui:tailwind:start/g) ?? []).length, 1);
  assert.equal((stylesheet.match(/malva-ui:tailwind:end/g) ?? []).length, 1);
  assert.match(stylesheet, /^\/\* application header \*\//);
  assert.match(stylesheet, /\/\* application footer \*\//);
});

test('leaves unmarked manual stylesheet imports untouched', async () => {
  const tree = createWorkspaceTree();
  const manual = `@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";
/* application-owned rules */
`;
  tree.create('/src/styles/malva-ui-tailwind.css', manual);

  const result = await runSchematic({}, tree);
  assert.equal(result.readContent('/src/styles/malva-ui-tailwind.css'), manual);
});

test('merges the Tailwind plugin into an existing CJS PostCSS config', async () => {
  const tree = createWorkspaceTree();
  tree.create(
    '/postcss.config.cjs',
    `module.exports = {
  plugins: {
    autoprefixer: {},
  },
  custom: true,
};
`,
  );

  const result = await runSchematic({}, tree);
  const config = result.readContent('/postcss.config.cjs');

  assert.match(config, /autoprefixer: \{\}/);
  assert.match(config, /custom: true/);
  assert.match(config, /\/\* malva-ui:tailwind:start \*\//);
  assert.match(config, /'@tailwindcss\/postcss': \{\}/);
  assert.equal((config.match(/'@tailwindcss\/postcss'/g) ?? []).length, 1);
});

test('merges the Tailwind plugin into an existing JSON PostCSS config', async () => {
  const tree = createWorkspaceTree();
  tree.create(
    '/postcss.config.json',
    JSON.stringify({
      plugins: { autoprefixer: {}, cssnano: {} },
      custom: true,
    }),
  );

  const result = await runSchematic({}, tree);
  const config = JSON.parse(result.readContent('/postcss.config.json'));

  assert.deepEqual(config.plugins, {
    autoprefixer: {},
    cssnano: {},
    '@tailwindcss/postcss': {},
  });
  assert.equal(config.custom, true);
});

test('does not add a second PostCSS plugin on rerun', async () => {
  const first = await runSchematic();
  const second = await runSchematic({}, first);
  const config = second.readContent('/postcss.config.json');

  assert.equal((config.match(/"@tailwindcss\/postcss"/g) ?? []).length, 1);
});

test('rejects multiple PostCSS configurations', async () => {
  const tree = createWorkspaceTree();
  tree.create('/postcss.config.cjs', 'module.exports = { plugins: {} };');
  tree.create('/postcss.config.json', '{"plugins":{}}');

  await assert.rejects(
    runSchematic({}, tree),
    /Multiple PostCSS configuration files were found/,
  );
});

test('requires an explicit project when multiple applications exist', async () => {
  const tree = createWorkspaceTree();
  const workspace = JSON.parse(tree.readText('/angular.json'));
  workspace.projects.admin = {
    projectType: 'application',
    root: 'projects/admin',
    sourceRoot: 'projects/admin/src',
    architect: {
      build: {
        builder: '@angular-devkit/build-angular:application',
        options: { styles: [] },
      },
    },
  };
  tree.overwrite('/angular.json', JSON.stringify(workspace, null, 2));

  await assert.rejects(
    runSchematic({}, tree),
    /Run the installer again with --project <name>\./,
  );
});

test('rejects an invalid project-relative stylesheet path', async () => {
  await assert.rejects(
    runSchematic({ stylesheet: '../outside.css' }),
    /stylesheet.*(?:pattern|inside|\.css)/i,
  );
});

test('rejects a workspace without an Angular application', async () => {
  const tree = createWorkspaceTree();
  const workspace = JSON.parse(tree.readText('/angular.json'));
  workspace.projects.demo.projectType = 'library';
  tree.overwrite('/angular.json', JSON.stringify(workspace, null, 2));

  await assert.rejects(
    runSchematic({}, tree),
    /No Angular application was found/,
  );
});

async function runSchematic(options = {}, tree = createWorkspaceTree()) {
  return runner.runSchematic('ng-add', { skipInstall: true, ...options }, tree);
}

function createWorkspaceTree({ styles = ['src/styles.scss'] } = {}) {
  const tree = Tree.empty();
  tree.create(
    '/package.json',
    JSON.stringify({
      name: 'demo',
      private: true,
      dependencies: {},
    }),
  );
  tree.create(
    '/angular.json',
    JSON.stringify({
      version: 1,
      newProjectRoot: 'projects',
      projects: {
        demo: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          prefix: 'app',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:application',
              options: {
                browser: 'src/main.ts',
                styles,
              },
            },
          },
        },
      },
    }),
  );
  tree.create('/src/main.ts', 'export {};\n');
  tree.create('/src/styles.scss', '');
  return tree;
}
