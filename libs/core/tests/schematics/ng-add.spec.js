'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { Tree } = require('@angular-devkit/schematics');
const { SchematicTestRunner } = require('@angular-devkit/schematics/testing');

const collectionPath = path.resolve(
  __dirname,
  '../../schematics/collection.json',
);

test('configures dependencies, styles, theme, and density', async () => {
  const result = await runSchematic({
    theme: 'dark',
    density: 'compact',
    themeStorageKey: 'acme-theme',
  });

  const packageJson = JSON.parse(result.readContent('/package.json'));
  assert.equal(
    packageJson.dependencies['@malva-ui/core'],
    '0.0.0-malva-ui-package-version',
  );
  assert.equal(
    packageJson.dependencies['@malva-ui/cdk'],
    '0.0.0-malva-ui-package-version',
  );
  assert.equal(
    packageJson.dependencies['@malva-ui/i18n'],
    '0.0.0-malva-ui-package-version',
  );

  const workspace = JSON.parse(result.readContent('/angular.json'));
  assert.deepEqual(workspace.projects.demo.architect.build.options.styles, [
    'src/styles.scss',
    'node_modules/@malva-ui/core/styles/malva-ui.css',
  ]);

  const appConfig = result.readContent('/src/app/app.config.ts');
  assert.match(
    appConfig,
    /import \{ provideDefaultTheme \} from '@malva-ui\/cdk\/theme';/,
  );
  assert.match(appConfig, /provideDefaultTheme\("dark", "acme-theme"\)/);
  assert.match(
    appConfig,
    /import \{ provideMlvDensity \} from '@malva-ui\/cdk\/density';/,
  );
  assert.match(appConfig, /provideMlvDensity\("compact"\)/);
});

test('can leave styles and application providers unchanged', async () => {
  const result = await runSchematic({
    includeStyles: false,
    configureProviders: false,
  });

  const workspace = JSON.parse(result.readContent('/angular.json'));
  assert.deepEqual(workspace.projects.demo.architect.build.options.styles, [
    'src/styles.scss',
  ]);
  assert.equal(result.readContent('/src/app/app.config.ts'), initialAppConfig);
});

test('is idempotent when run repeatedly', async () => {
  const first = await runSchematic();
  const second = await runSchematic({}, first);

  const workspace = JSON.parse(second.readContent('/angular.json'));
  const styles = workspace.projects.demo.architect.build.options.styles;
  assert.equal(
    styles.filter(
      (style) => style === 'node_modules/@malva-ui/core/styles/malva-ui.css',
    ).length,
    1,
  );

  const appConfig = second.readContent('/src/app/app.config.ts');
  assert.equal((appConfig.match(/provideDefaultTheme\(/g) ?? []).length, 1);
  assert.equal((appConfig.match(/provideMlvDensity\(/g) ?? []).length, 1);
});

test('bootstraps providers in an NgModule application', async () => {
  const tree = createWorkspaceTree();
  tree.overwrite(
    '/src/main.ts',
    `import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule);
`,
  );
  tree.create(
    '/src/app/app.module.ts',
    `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
`,
  );

  const result = await runSchematic(
    { theme: 'dark', density: 'spacious' },
    tree,
  );
  const appModule = result.readContent('/src/app/app.module.ts');
  assert.match(appModule, /provideDefaultTheme\("dark", "mlv-theme"\)/);
  assert.match(appModule, /provideMlvDensity\("spacious"\)/);
});

test('requires a project when multiple applications exist', async () => {
  const tree = createWorkspaceTree();
  const workspace = JSON.parse(tree.readText('/angular.json'));
  workspace.projects.admin = {
    projectType: 'application',
    root: 'projects/admin',
    sourceRoot: 'projects/admin/src',
    architect: {
      build: {
        builder: '@angular-devkit/build-angular:application',
        options: { browser: 'projects/admin/src/main.ts', styles: [] },
      },
    },
  };
  tree.overwrite('/angular.json', JSON.stringify(workspace, null, 2));

  await assert.rejects(
    runSchematic({}, tree),
    /Run the installer again with --project <name>\./,
  );
});

/**
 * Run the installer against an in-memory Angular workspace.
 *
 * @param {Record<string, unknown>} [options] Schematic options.
 * @param {Tree} [tree] Initial file tree.
 * @returns {Promise<import("@angular-devkit/schematics/testing").UnitTestTree>} Result tree.
 */
async function runSchematic(options = {}, tree = createWorkspaceTree()) {
  const runner = new SchematicTestRunner('malva-ui-core', collectionPath);
  return runner.runSchematic('ng-add', { skipInstall: true, ...options }, tree);
}

const initialAppConfig = `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`;

/**
 * Create the minimum standalone Angular application needed by the installer.
 *
 * @returns {Tree} In-memory workspace tree.
 */
function createWorkspaceTree() {
  const tree = Tree.empty();
  tree.create(
    '/package.json',
    JSON.stringify({ name: 'demo', private: true, dependencies: {} }, null, 2),
  );
  tree.create(
    '/angular.json',
    JSON.stringify(
      {
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
                  styles: ['src/styles.scss'],
                },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  );
  tree.create(
    '/src/main.ts',
    `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
`,
  );
  tree.create('/src/app/app.config.ts', initialAppConfig);
  tree.create('/src/app/app.component.ts', 'export class AppComponent {}\n');
  tree.create('/src/styles.scss', '');
  return tree;
}
