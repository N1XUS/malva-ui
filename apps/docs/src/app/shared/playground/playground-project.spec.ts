import {
  collectImportSpecifiers,
  createPlaygroundProject,
  maskNonCode,
  packageRootOf,
  unpublishedRecheckReason,
} from './playground-project';
import type {
  PlaygroundPeers,
  PlaygroundSourceFile,
  PlaygroundVersions,
} from './playground-project';

/**
 * A stand-in for the generated table. Deliberately hand-written rather than
 * imported from `src/generated`: these specs pin the shape of the payload, not
 * the versions of the day, and the generated table is asserted against the
 * workspace root manifest by `playground-corpus.spec.ts` instead.
 */
const VERSIONS: PlaygroundVersions = {
  '@angular/aria': '22.0.0',
  '@angular/build': '22.0.0',
  '@angular/cdk': '22.0.0',
  '@angular/cli': '22.0.0',
  '@angular/common': '22.0.0',
  '@angular/compiler': '22.0.0',
  '@angular/compiler-cli': '22.0.0',
  '@angular/core': '22.0.0',
  '@angular/forms': '22.0.0',
  '@angular/platform-browser': '22.0.0',
  '@angular/router': '22.0.0',
  '@lucide/angular': '^1.25.0',
  '@malva-ui/cdk': '9.9.9',
  '@malva-ui/core': '9.9.9',
  '@malva-ui/editor': '9.9.9',
  '@malva-ui/i18n': '9.9.9',
  // In `nx.json` -> `release.projects`, so the real table names it too. The
  // refusal spec below lists it as unpublished explicitly.
  '@malva-ui/taskboard': '9.9.9',
  '@tiptap/core': '3.0.0',
  // Present so the exact dev-dependency list below proves a typings package is
  // added only for an example that imports its package.
  '@types/sortablejs': '^1.15.9',
  sortablejs: '^1.15.7',
  '@tiptap/starter-kit': '3.0.0',
  'intl-messageformat': '^11.0.0',
  rxjs: '~7.8.0',
  tslib: '^2.3.0',
  typescript: '6.0.0',
};

const PEERS: PlaygroundPeers = {
  '@malva-ui/cdk': ['@angular/common', '@angular/core', 'rxjs'],
  '@malva-ui/core': [
    '@angular/aria',
    '@angular/cdk',
    '@angular/common',
    '@angular/core',
    '@angular/forms',
    '@lucide/angular',
    '@malva-ui/cdk',
    '@malva-ui/i18n',
    'rxjs',
  ],
  '@malva-ui/editor': ['@malva-ui/core', '@tiptap/core', '@tiptap/starter-kit'],
  '@malva-ui/i18n': ['@angular/core', 'intl-messageformat'],
};

const TYPESCRIPT = `import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ButtonBasicExampleComponent {}
`;

/**
 * The whole of `src/main.ts` for the default shape.
 *
 * Asserted with `toBe`, not a set of `toContain`s. The entry point is the one
 * file where an unintended *addition* is the failure mode — a polyfill import, a
 * stray provider, a second bootstrap — and no substring sweep can enumerate
 * what it is looking for the absence of. An exact copy can: any extra line
 * fails, whatever it says.
 *
 * That subsumes what four narrower assertions used to check: zoneless bootstrap,
 * the `ng add` theme/density pair, the i18n named-export workaround (ng-packagr
 * drops `export default` from every published locale pack), and the absence of
 * any polyfill. Update it by pasting what the builder emits, never by patching
 * it to match.
 */
const EXPECTED_MAIN = `import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { provideDefaultTheme } from '@malva-ui/cdk/theme';
import { provideMlvI18n } from '@malva-ui/i18n';

import Example from './example/index';

bootstrapApplication(Example, {
  providers: [
    provideZonelessChangeDetection(),
    provideDefaultTheme('light', 'mlv-theme'),
    provideMlvDensity('comfortable'),
    provideMlvI18n(() =>
      import('@malva-ui/i18n/en').then((pack) => ({
        default: pack.enLanguage,
      })),
    ),
  ],
}).catch((error) => console.error(error));
`;

/** The whole of `src/main.ts` for an example that imports `@angular/router`. */
const EXPECTED_MAIN_WITH_ROUTER = `import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { provideDefaultTheme } from '@malva-ui/cdk/theme';
import { provideMlvI18n } from '@malva-ui/i18n';

import Example from './example/index';

bootstrapApplication(Example, {
  providers: [
    provideZonelessChangeDetection(),
    provideDefaultTheme('light', 'mlv-theme'),
    provideMlvDensity('comfortable'),
    provideMlvI18n(() =>
      import('@malva-ui/i18n/en').then((pack) => ({
        default: pack.enLanguage,
      })),
    ),
    provideRouter([]),
  ],
}).catch((error) => console.error(error));
`;

/** The whole of `src/main.ts` for an example that imports `@angular/common/http`. */
const EXPECTED_MAIN_WITH_HTTP = `import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { provideDefaultTheme } from '@malva-ui/cdk/theme';
import { provideMlvI18n } from '@malva-ui/i18n';

import Example from './example/index';

bootstrapApplication(Example, {
  providers: [
    provideZonelessChangeDetection(),
    provideDefaultTheme('light', 'mlv-theme'),
    provideMlvDensity('comfortable'),
    provideMlvI18n(() =>
      import('@malva-ui/i18n/en').then((pack) => ({
        default: pack.enLanguage,
      })),
    ),
    provideHttpClient(),
  ],
}).catch((error) => console.error(error));
`;

/**
 * The whole of `.stackblitzrc` — four lines, and the other file that could
 * quietly acquire an install or start step nobody asked for.
 */
const EXPECTED_STACKBLITZRC = `{
  "installDependencies": true,
  "startCommand": "npm start"
}
`;

const build = (
  files: readonly PlaygroundSourceFile[] = [
    { type: 'TypeScript', content: TYPESCRIPT },
    { type: 'HTML', content: '<button mlvButton>Save</button>\n' },
  ],
) =>
  createPlaygroundProject({
    files,
    versions: VERSIONS,
    peers: PEERS,
    title: 'Malva UI — Button',
    description: 'Basic button example from the Malva UI documentation.',
  });

/** The project payload, or a failure naming what blocked it. */
const project = (files?: readonly PlaygroundSourceFile[]) => {
  const result = build(files);
  if (!result.project) {
    throw new Error(
      `expected a portable project, blocked by: ${result.blockedBy}`,
    );
  }
  return result.project;
};

/** The generated project's `package.json`, parsed. */
const packageJson = (files?: readonly PlaygroundSourceFile[]) =>
  JSON.parse(project(files).files['package.json']) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

describe('createPlaygroundProject', () => {
  describe('the emitted file set', () => {
    it('carries the example sources verbatim under src/example', () => {
      const files = project().files;

      expect(files['src/example/index.ts']).toBe(TYPESCRIPT);
      expect(files['src/example/index.html']).toBe(
        '<button mlvButton>Save</button>\n',
      );
    });

    it('omits the template and stylesheet an inline example does not have', () => {
      // 46 of the 479 examples use an inline `template:` and ship no index.html.
      const inline = TYPESCRIPT.replace(
        "templateUrl: './index.html',",
        "template: '<button mlvButton>Save</button>',",
      );
      const files = project([{ type: 'TypeScript', content: inline }]).files;

      expect(files['src/example/index.html']).toBeUndefined();
      expect(files['src/example/index.scss']).toBeUndefined();
      expect(files['src/example/index.ts']).toBe(inline);
    });

    it('carries a SCSS stylesheet under the name the example imports', () => {
      const files = project([
        { type: 'TypeScript', content: TYPESCRIPT },
        { type: 'SCSS', content: '.demo {\n  display: flex;\n}\n' },
      ]).files;

      expect(files['src/example/index.scss']).toBe(
        '.demo {\n  display: flex;\n}\n',
      );
    });

    it('creates a stylesheet the example declares but has no content for', () => {
      // `card/examples/7` declares `styleUrl: './index.scss'` against a 0-byte
      // file. Both the pipe and the example container drop an empty file, so
      // the builder is handed no SCSS at all — and omitting it from the project
      // fails the Angular compiler on a missing stylesheet.
      const files = project([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "templateUrl: './index.html',",
            "templateUrl: './index.html',\n  styleUrl: './index.scss',",
          ),
        },
        { type: 'HTML', content: '<button mlvButton>Save</button>\n' },
      ]).files;

      expect(files['src/example/index.scss']).toBe('');
    });

    it('creates every file the example references, and only those', () => {
      const files = project([
        { type: 'TypeScript', content: TYPESCRIPT },
      ]).files;

      // `TYPESCRIPT` names `./index.html` but no stylesheet.
      expect(files['src/example/index.html']).toBe('');
      expect(files['src/example/index.scss']).toBeUndefined();
    });

    it('emits a complete, non-empty Angular CLI project', () => {
      const files = project().files;

      expect(Object.keys(files).sort()).toEqual([
        '.stackblitzrc',
        'README.md',
        'angular.json',
        'package.json',
        'src/example/index.html',
        'src/example/index.ts',
        'src/index.html',
        'src/main.ts',
        'src/styles.css',
        'tsconfig.json',
      ]);

      // The generated scaffolding, not the example's own files: a declared but
      // empty stylesheet is legitimately empty (see above).
      for (const [name, content] of Object.entries(files)) {
        if (name.startsWith('src/example/')) continue;
        expect(`${name}: ${content.length > 0}`).toBe(`${name}: true`);
      }
    });

    it('opens on the example source rather than the generated scaffolding', () => {
      expect(project().openFile).toBe('src/example/index.ts');
      expect(project().template).toBe('node');
    });
  });

  describe('the entry point', () => {
    it('mounts the example through its own selector', () => {
      expect(project().files['src/index.html']).toContain(
        '<docs-button-basic-example></docs-button-basic-example>',
      );
    });

    it('mounts the exported component, not the first one declared', () => {
      // Ten docs examples declare a helper `@Component` above the exported one
      // (dialog/6, density/4, …). Taking the first selector mounts the helper.
      const files = project([
        {
          type: 'TypeScript',
          content: `import { Component } from '@angular/core';

@Component({ selector: 'docs-helper-badge', template: '<b></b>' })
export class HelperBadgeComponent {}

@Component({
  selector: 'docs-dialog-routable-example',
  imports: [HelperBadgeComponent],
  template: '<docs-helper-badge />',
})
export default class DialogRoutableExampleComponent {}
`,
        },
      ]).files;

      expect(files['src/index.html']).toContain(
        '<docs-dialog-routable-example></docs-dialog-routable-example>',
      );
      expect(files['src/index.html']).not.toContain('docs-helper-badge>');
    });

    it('ignores a decorator the example only displays inside a template', () => {
      // `getting-started` and `tailwind` already render Angular source in their
      // examples, so this shape is one authored example away. Reading the
      // displayed decorator mounts a tag no component declares: `ng build`
      // succeeds, `bootstrapApplication` finds no host, and the visitor gets a
      // blank page with nothing to explain it.
      const files = project([
        {
          type: 'TypeScript',
          content: `import { Component } from '@angular/core';

@Component({
  selector: 'docs-getting-started-example',
  template: \`
    <pre>@Component({ selector: 'app-root' })</pre>
  \`,
})
export default class GettingStartedExampleComponent {}
`,
        },
      ]).files;

      expect(files['src/index.html']).toContain(
        '<docs-getting-started-example></docs-getting-started-example>',
      );
      expect(files['src/index.html']).not.toContain('app-root');
    });

    it('ignores a commented-out selector above the live one', () => {
      const files = project([
        {
          type: 'TypeScript',
          content: `import { Component } from '@angular/core';

@Component({
  // selector: 'docs-old-name',
  selector: 'docs-new-name',
  template: '<b></b>',
})
export default class RenamedExampleComponent {}
`,
        },
      ]).files;

      expect(files['src/index.html']).toContain(
        '<docs-new-name></docs-new-name>',
      );
      expect(files['src/index.html']).not.toContain('docs-old-name');
    });

    it('bootstraps the default export without naming its class', () => {
      const main = project().files['src/main.ts'];

      expect(main).toContain("import Example from './example/index';");
      expect(main).toContain('bootstrapApplication(Example, {');
    });

    it('generates src/main.ts byte for byte', () => {
      expect(project().files['src/main.ts']).toBe(EXPECTED_MAIN);
    });

    it('adds provideRouter, and nothing else, for a routed example', () => {
      const routed = project([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "import { MlvButton } from '@malva-ui/core/button';",
            "import { RouterLink } from '@angular/router';",
          ),
        },
      ]);

      expect(routed.files['src/main.ts']).toBe(EXPECTED_MAIN_WITH_ROUTER);
    });

    it('adds provideHttpClient, and nothing else, for an example that fetches', () => {
      const fetching = project([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "import { MlvButton } from '@malva-ui/core/button';",
            "import { HttpClient } from '@angular/common/http';",
          ),
        },
      ]);

      expect(fetching.files['src/main.ts']).toBe(EXPECTED_MAIN_WITH_HTTP);
    });

    it('generates .stackblitzrc byte for byte', () => {
      expect(project().files['.stackblitzrc']).toBe(EXPECTED_STACKBLITZRC);
    });

    it('configures no polyfill, and says why in the README', () => {
      // The two remaining files a polyfill could enter through. `package.json`
      // needs no check of its own: its dependency and devDependency key sets
      // are asserted exactly below.
      expect(project().files['angular.json']).not.toContain('polyfills');
      expect(project().files['README.md']).toContain('zoneless-only');
    });

    it('loads the published stylesheet ng add installs', () => {
      const angularJson = JSON.parse(project().files['angular.json']) as {
        projects: Record<
          string,
          { architect: { build: { options: { styles: string[] } } } }
        >;
      };

      expect(
        angularJson.projects['malva-ui-playground'].architect.build.options
          .styles,
      ).toEqual([
        'node_modules/@malva-ui/core/styles/malva-ui.css',
        'src/styles.css',
      ]);
    });
  });

  describe('the dependency set', () => {
    it('pins every Malva package at the generated release version', () => {
      expect(packageJson().dependencies['@malva-ui/core']).toBe('9.9.9');
      expect(packageJson().dependencies['@malva-ui/cdk']).toBe('9.9.9');
      expect(packageJson().dependencies['@malva-ui/i18n']).toBe('9.9.9');
    });

    it('installs the peer closure of every package the example imports', () => {
      // `@malva-ui/core` peers on `@malva-ui/cdk`, which peers on `rxjs`.
      expect(Object.keys(packageJson().dependencies).sort()).toEqual([
        '@angular/aria',
        '@angular/cdk',
        '@angular/common',
        '@angular/compiler',
        '@angular/core',
        '@angular/forms',
        '@angular/platform-browser',
        '@lucide/angular',
        '@malva-ui/cdk',
        '@malva-ui/core',
        '@malva-ui/i18n',
        'intl-messageformat',
        'rxjs',
        'tslib',
      ]);
    });

    it('pulls the Tiptap peers in for an editor example', () => {
      const deps = packageJson([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "from '@malva-ui/core/button'",
            "from '@malva-ui/editor'",
          ),
        },
      ]).dependencies;

      expect(deps['@malva-ui/editor']).toBe('9.9.9');
      expect(deps['@tiptap/core']).toBe('3.0.0');
      expect(deps['@tiptap/starter-kit']).toBe('3.0.0');
    });

    it('carries the Angular toolchain as dev dependencies and an ng serve script', () => {
      expect(Object.keys(packageJson().devDependencies).sort()).toEqual([
        '@angular/build',
        '@angular/cli',
        '@angular/compiler-cli',
        'typescript',
      ]);
      expect(packageJson().scripts['start']).toBe('ng serve');
    });

    it('declares the typings of an untyped package the example imports', () => {
      // #594. `scheduler/examples/6` imports `sortablejs`, which ships no types,
      // and the generated tsconfig is `strict`: without `@types/sortablejs` the
      // project failed `ng build` with TS7016 (measured on 0.2.0).
      const result = createPlaygroundProject({
        files: [
          {
            type: 'TypeScript',
            content: TYPESCRIPT.replace(
              "import { MlvButton } from '@malva-ui/core/button';",
              "import { MlvButton } from '@malva-ui/core/button';\n" +
                "import Sortable from 'sortablejs';\n" +
                "import { untyped } from '@example/untyped';",
            ),
          },
        ],
        versions: {
          ...VERSIONS,
          '@example/untyped': '1.0.0',
          // DefinitelyTyped's name for a scoped package.
          '@types/example__untyped': '2.0.0',
        },
        peers: PEERS,
        title: 'T',
        description: 'D',
      });
      if (!result.project) throw new Error(`blocked: ${result.blockedBy}`);

      const { dependencies, devDependencies } = JSON.parse(
        result.project.files['package.json'],
      ) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };

      expect(dependencies['sortablejs']).toBe('^1.15.7');
      expect(devDependencies['@types/sortablejs']).toBe('^1.15.9');
      expect(devDependencies['@types/example__untyped']).toBe('2.0.0');
      expect(
        Object.keys(dependencies).filter((name) => name.startsWith('@types/')),
      ).toEqual([]);
    });
  });

  describe('portability', () => {
    it('refuses an example that imports docs-local code', () => {
      const result = build([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "from '@malva-ui/core/button'",
            "from '../../../../shared'",
          ),
        },
      ]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('../../../../shared');
    });

    it('refuses an example whose stylesheet loads a docs-local partial', () => {
      // #594. All eight `taskboard/*` examples `@use '../ticket'`, a partial
      // beside the example directories. The project carries only the example's
      // own files, so `ng build` failed with "Can't find stylesheet to import"
      // (measured on 0.2.0) — hidden while taskboard was unpublished.
      const result = build([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "templateUrl: './index.html',",
            "templateUrl: './index.html',\n  styleUrl: './index.scss',",
          ),
        },
        { type: 'SCSS', content: "@use '../ticket';\n\n.demo { gap: 0; }\n" },
      ]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('docs-local code');
      expect(result.blockedBy).toContain('../ticket');
    });

    // The other spellings a stylesheet load takes. Each builds a project with
    // no `../shared.css` in it, so each has to withhold the button too.
    it.each([
      ["@import url('../shared.css');", '../shared.css'],
      ['@import url(../shared.css);', '../shared.css'],
      ['@import url( "../shared.css" );', '../shared.css'],
      ['@use"../shared";', '../shared'],
      ["@IMPORT '../shared';", '../shared'],
    ])('refuses an example whose stylesheet holds %s', (rule, url) => {
      const result = build([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "templateUrl: './index.html',",
            "templateUrl: './index.html',\n  styleUrl: './index.scss',",
          ),
        },
        { type: 'SCSS', content: `${rule}\n\n.demo { gap: 0; }\n` },
      ]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain(url);
    });

    it.each([
      "@use 'sass:map';",
      '@use "sass:math" as math;',
      "@forward 'sass:list';",
    ])(
      'keeps an example whose stylesheet loads only a Sass built-in: %s',
      (rule) => {
        const result = build([
          {
            type: 'TypeScript',
            content: TYPESCRIPT.replace(
              "templateUrl: './index.html',",
              "templateUrl: './index.html',\n  styleUrl: './index.scss',",
            ),
          },
          { type: 'SCSS', content: `${rule}\n\n.demo { gap: 0; }\n` },
        ]);

        expect(result.blockedBy).toBeNull();
      },
    );

    it('refuses an example importing a package the version table does not know', () => {
      const result = build([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "from '@malva-ui/core/button'",
            "from 'chart.js/auto'",
          ),
        },
      ]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('chart.js');
    });

    it('refuses an example with no parseable selector', () => {
      const result = build([
        {
          type: 'TypeScript',
          content: TYPESCRIPT.replace(
            "selector: 'docs-button-basic-example',",
            '',
          ),
        },
      ]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('selector');
    });

    it('refuses an example whose TypeScript source has not resolved', () => {
      const result = build([{ type: 'HTML', content: '<p>only markup</p>' }]);

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('TypeScript');
    });

    it('refuses an example importing a package npm has never seen', () => {
      // The version table is derived from `nx.json` -> `release.projects`, so a
      // package that has landed but never shipped resolves to a version that
      // 404s on install. A button that opens a WebContainer failing at
      // `npm install` is the worst of the failure modes: it looks like the
      // library is broken.
      //
      // The list is passed explicitly: `UNPUBLISHED_PACKAGES` is empty while
      // every release-set package is on npm (#594), and the refusal has to stay
      // proven for the next package that joins the set before it ships.
      const result = createPlaygroundProject({
        files: [
          {
            type: 'TypeScript',
            content: TYPESCRIPT.replace(
              "from '@malva-ui/core/button'",
              "from '@malva-ui/taskboard'",
            ),
          },
        ],
        versions: VERSIONS,
        peers: PEERS,
        title: 'T',
        description: 'D',
        unpublished: ['@malva-ui/taskboard'],
      });

      expect(result.project).toBeNull();
      expect(result.blockedBy).toContain('@malva-ui/taskboard');
      expect(result.blockedBy).toContain('never been published');
    });

    it('lets the CI writer opt out, which is why the flag exists at all', () => {
      // `docs:write-playground-project` materialises the project and the
      // workflow's own preflight decides whether npm can install it, so a leg
      // whose example imports a listed package keeps proving its dependency
      // closure and starts proving the install the day the package ships.
      const result = createPlaygroundProject({
        files: [
          {
            type: 'TypeScript',
            content: TYPESCRIPT.replace(
              "from '@malva-ui/core/button'",
              "from '@malva-ui/taskboard'",
            ),
          },
        ],
        versions: VERSIONS,
        peers: PEERS,
        title: 'T',
        description: 'D',
        unpublished: [],
      });

      expect(result.blockedBy).toBeNull();
    });
  });
});

describe('maskNonCode', () => {
  it('blanks comment, string and template bodies without moving anything', () => {
    const source = "const a = 'x//y'; // don't\nlet b = `t${1}u`;";

    expect(maskNonCode(source)).toBe(
      "const a = '    ';         \nlet b = `   1  `;",
    );
    expect(maskNonCode(source)).toHaveLength(source.length);
  });

  it('keeps a nested template literal balanced', () => {
    // Naive alternation reopens code at the inner backtick and leaves the outer
    // literal's tail visible; the mode stack does not.
    expect(maskNonCode('`a ${ `b @Component` } c`')).toBe(
      '`     `            `    `',
    );
  });
});

describe('collectImportSpecifiers', () => {
  it('finds static, type-only, side-effect, re-export and dynamic specifiers', () => {
    const source = `import { a } from '@angular/core';
import type { B } from '@malva-ui/core/dropdown';
import 'side-effect-pkg';
export { c } from './local';
const d = await import('@malva-ui/i18n/en');
`;

    expect(collectImportSpecifiers(source).sort()).toEqual([
      './local',
      '@angular/core',
      '@malva-ui/core/dropdown',
      '@malva-ui/i18n/en',
      'side-effect-pkg',
    ]);
  });

  it('ignores a quoted path that is not an import', () => {
    expect(collectImportSpecifiers("const t = './index.html';")).toEqual([]);
  });
});

describe('packageRootOf', () => {
  it('keeps both segments of a scoped package and drops deep paths', () => {
    expect(packageRootOf('@malva-ui/core/button')).toBe('@malva-ui/core');
    expect(packageRootOf('@angular/platform-browser/animations/async')).toBe(
      '@angular/platform-browser',
    );
    expect(packageRootOf('rxjs/operators')).toBe('rxjs');
    expect(packageRootOf('sortablejs')).toBe('sortablejs');
  });
});

describe('unpublishedRecheckReason', () => {
  // #594. The offline pin compared the verified-at version with the root
  // manifest whether or not the list named anything, so once the list was
  // emptied every later release would have turned `docs:test` red over a claim
  // nobody was making.
  it('owes nothing for an empty list, however old its verified-at version', () => {
    expect(unpublishedRecheckReason([], '0.2.0', '0.2.1')).toBeNull();
    expect(unpublishedRecheckReason([], '0.1.15', '1.0.0')).toBeNull();
  });

  it('owes a re-check for a listed package once a release has moved past it', () => {
    const reason = unpublishedRecheckReason(
      ['@malva-ui/scheduler', '@malva-ui/taskboard'],
      '0.1.15',
      '0.2.0',
    );

    expect(reason).toContain('@malva-ui/scheduler, @malva-ui/taskboard');
    expect(reason).toContain('checked against npm at 0.1.15');
    expect(reason).toContain('root manifest is 0.2.0');
    expect(reason).toContain('set UNPUBLISHED_VERIFIED_AT to 0.2.0');
  });

  it('re-arms the moment an entry is added under a stale verified-at version', () => {
    // An entry added without looking fails on the commit that adds it, which
    // is the check the constant exists to force.
    expect(
      unpublishedRecheckReason(['@malva-ui/new'], '0.2.0', '0.2.3'),
    ).toContain('@malva-ui/new');
  });

  it('owes nothing while the list was checked at the current root version', () => {
    expect(
      unpublishedRecheckReason(['@malva-ui/new'], '0.2.3', '0.2.3'),
    ).toBeNull();
  });
});
