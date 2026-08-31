'use strict';

Object.defineProperty(exports, '__esModule', { value: true });
exports.default = installMalvaUiTailwind;

const posixPath = require('node:path').posix;
const { chain, SchematicsException } = require('@angular-devkit/schematics');
const {
  addDependency,
  DependencyType,
  ExistingBehavior,
  InstallBehavior,
  readWorkspace,
  updateWorkspace,
} = require('@schematics/angular/utility');
const packageJson = require('../../package.json');

const CORE_STYLESHEET = 'node_modules/@malva-ui/core/styles/malva-ui.css';
const TAILWIND_PACKAGE = '@malva-ui/tailwind';
const TAILWIND_PLUGIN = '@tailwindcss/postcss';
const TAILWIND_VERSION = '^4.0.0';
const POSTCSS_VERSION = '^8.4.0';
const STYLESHEET_START = '/* malva-ui:tailwind:start */';
const STYLESHEET_END = '/* malva-ui:tailwind:end */';
const POSTCSS_START = '/* malva-ui:tailwind:start */';
const POSTCSS_END = '/* malva-ui:tailwind:end */';
const MANAGED_STYLESHEET = `${STYLESHEET_START}
@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";
${STYLESHEET_END}
`;
const MANAGED_POSTCSS_PLUGIN = `    ${POSTCSS_START}
    '${TAILWIND_PLUGIN}': {},
    ${POSTCSS_END}
`;
const POSTCSS_CONFIG_FILES = [
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.json',
  '.postcssrc',
  '.postcssrc.json',
  '.postcssrc.js',
  '.postcssrc.cjs',
  '.postcssrc.mjs',
];

/**
 * Install Tailwind CSS v4 and the Malva UI theme adapter in an Angular app.
 *
 * @param {{ project?: string; skipInstall?: boolean; includeCoreStyles?: boolean; stylesheet?: string }} options
 * @returns {import('@angular-devkit/schematics').Rule}
 */
function installMalvaUiTailwind(options = {}) {
  return async (tree, context) => {
    const workspace = await readWorkspace(tree);
    const projectName = resolveApplicationProject(workspace, options.project);
    const project = workspace.projects.get(projectName);

    if (!project) {
      throw new SchematicsException(
        `Could not find the Angular project "${projectName}".`,
      );
    }

    const normalizedOptions = {
      skipInstall: options.skipInstall ?? false,
      includeCoreStyles: options.includeCoreStyles ?? true,
      stylesheet: resolveStylesheetPath(project, options.stylesheet),
    };
    const install = normalizedOptions.skipInstall
      ? InstallBehavior.None
      : InstallBehavior.Auto;
    const dependencyOptions = {
      existing: ExistingBehavior.Skip,
      install,
    };

    context.logger.info(`\nInstalling Malva UI Tailwind in "${projectName}"`);

    const rules = [
      addDependency(TAILWIND_PACKAGE, packageJson.version, dependencyOptions),
      addDependency('tailwindcss', TAILWIND_VERSION, {
        ...dependencyOptions,
        type: DependencyType.Dev,
      }),
      addDependency(TAILWIND_PLUGIN, TAILWIND_VERSION, {
        ...dependencyOptions,
        type: DependencyType.Dev,
      }),
      addDependency('postcss', POSTCSS_VERSION, {
        ...dependencyOptions,
        type: DependencyType.Dev,
      }),
      writeManagedStylesheet(normalizedOptions.stylesheet),
      updateBuildStyles(
        projectName,
        normalizedOptions.stylesheet,
        normalizedOptions.includeCoreStyles,
      ),
      configurePostcss(),
      (resultTree, resultContext) => {
        resultContext.logger.info(
          '\nTailwind CSS v4 and Malva UI theme tokens are ready.\n',
        );
        return resultTree;
      },
    ];

    if (normalizedOptions.includeCoreStyles) {
      rules.splice(
        1,
        0,
        addDependency('@malva-ui/core', packageJson.version, dependencyOptions),
      );
    }

    return chain(rules);
  };
}

/**
 * Resolve one application project, requiring an explicit project for ambiguity.
 *
 * @param {import('@angular-devkit/core').workspaces.WorkspaceDefinition} workspace
 * @param {string | undefined} requestedProject
 * @returns {string}
 */
function resolveApplicationProject(workspace, requestedProject) {
  if (requestedProject) {
    const requested = workspace.projects.get(requestedProject);

    if (!requested) {
      throw new SchematicsException(
        `Project "${requestedProject}" does not exist in this workspace.`,
      );
    }

    if (requested.extensions['projectType'] !== 'application') {
      throw new SchematicsException(
        `Project "${requestedProject}" is not an Angular application.`,
      );
    }

    return requestedProject;
  }

  const applications = [];
  for (const [name, project] of workspace.projects) {
    if (project.extensions['projectType'] === 'application') {
      applications.push(name);
    }
  }

  if (applications.length === 1) return applications[0];
  if (applications.length === 0) {
    throw new SchematicsException(
      'No Angular application was found in this workspace.',
    );
  }

  throw new SchematicsException(
    `This workspace contains multiple Angular applications (${applications.join(
      ', ',
    )}). Run the installer again with --project <name>.`,
  );
}

/**
 * Resolve the managed stylesheet relative to the selected project root.
 *
 * @param {import('@angular-devkit/core').workspaces.ProjectDefinition} project
 * @param {string | undefined} requestedPath
 * @returns {string}
 */
function resolveStylesheetPath(project, requestedPath) {
  const projectRoot = normalizeRelativePath(project.root ?? '');
  const sourceRoot = normalizeRelativePath(
    project.sourceRoot ?? posixPath.join(projectRoot, 'src'),
  );

  if (requestedPath === undefined) {
    return posixPath.join(sourceRoot, 'styles/malva-ui-tailwind.css');
  }

  const normalized = requestedPath.replace(/\\/g, '/');
  const isAbsolute =
    posixPath.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized);
  const relative = posixPath.normalize(normalized.replace(/^\.\//, ''));

  if (
    isAbsolute ||
    relative === '..' ||
    relative.startsWith('../') ||
    !relative.endsWith('.css')
  ) {
    throw new SchematicsException(
      'The stylesheet path must stay inside the selected project root and end in .css.',
    );
  }

  return posixPath.join(projectRoot, relative);
}

/**
 * Write or update the marker-owned Tailwind stylesheet.
 *
 * @param {string} stylesheetPath
 * @returns {import('@angular-devkit/schematics').Rule}
 */
function writeManagedStylesheet(stylesheetPath) {
  return (tree, context) => {
    const filePath = `/${stylesheetPath}`;
    if (!tree.exists(filePath)) {
      tree.create(filePath, MANAGED_STYLESHEET);
      return tree;
    }

    const current = tree.readText(filePath);
    const start = current.indexOf(STYLESHEET_START);
    const end = current.indexOf(STYLESHEET_END);

    if (start !== -1 || end !== -1) {
      if (start === -1 || end === -1 || end < start) {
        throw new SchematicsException(
          `The managed stylesheet ${stylesheetPath} has an incomplete Malva UI marker block.`,
        );
      }
      if (
        current.indexOf(STYLESHEET_START, start + STYLESHEET_START.length) !==
          -1 ||
        current.indexOf(STYLESHEET_END, end + STYLESHEET_END.length) !== -1
      ) {
        throw new SchematicsException(
          `The managed stylesheet ${stylesheetPath} contains multiple Malva UI marker blocks.`,
        );
      }

      tree.overwrite(
        filePath,
        `${current.slice(0, start)}${MANAGED_STYLESHEET}${current.slice(
          end + STYLESHEET_END.length,
        )}`,
      );
      return tree;
    }

    if (
      current.includes('@import "tailwindcss"') ||
      current.includes(TAILWIND_PACKAGE)
    ) {
      context.logger.warn(
        `The stylesheet ${stylesheetPath} contains manual Tailwind imports without Malva UI markers; leaving it unchanged for manual review.`,
      );
    } else if (current.trim() === '') {
      tree.overwrite(filePath, MANAGED_STYLESHEET);
    } else {
      context.logger.warn(
        `The stylesheet ${stylesheetPath} is not empty and has no Malva UI markers; leaving it unchanged for manual review.`,
      );
    }

    return tree;
  };
}

/**
 * Add generated and core styles once, before existing global styles.
 *
 * @param {string} projectName
 * @param {string} stylesheetPath
 * @param {boolean} includeCoreStyles
 * @returns {import('@angular-devkit/schematics').Rule}
 */
function updateBuildStyles(projectName, stylesheetPath, includeCoreStyles) {
  return updateWorkspace((workspace) => {
    const project = workspace.projects.get(projectName);
    const buildTarget = project?.targets.get('build');

    if (!project || !buildTarget) {
      throw new SchematicsException(
        `Could not find a build target for project "${projectName}".`,
      );
    }

    const styles = buildTarget.options['styles'];
    if (styles !== undefined && !Array.isArray(styles)) {
      throw new SchematicsException(
        `The build styles option for "${projectName}" is not an array and cannot be updated safely.`,
      );
    }

    const existingStyles = styles ?? [];
    const additions = [];
    if (!hasStyleEntry(existingStyles, stylesheetPath))
      additions.push(stylesheetPath);
    if (includeCoreStyles && !hasStyleEntry(existingStyles, CORE_STYLESHEET)) {
      additions.push(CORE_STYLESHEET);
    }
    buildTarget.options['styles'] = [...additions, ...existingStyles];
  });
}

function hasStyleEntry(styles, expected) {
  return styles.some((style) =>
    typeof style === 'string'
      ? normalizeRelativePath(style) === normalizeRelativePath(expected)
      : style &&
        normalizeRelativePath(style['input'] ?? '') ===
          normalizeRelativePath(expected),
  );
}

/** @returns {import('@angular-devkit/schematics').Rule} */
function configurePostcss() {
  return (tree, context) => {
    const configs = POSTCSS_CONFIG_FILES.filter((file) =>
      tree.exists(`/${file}`),
    );
    if (configs.length > 1) {
      throw new SchematicsException(
        `Multiple PostCSS configuration files were found: ${configs.join(', ')}. Remove all but one before running the installer again.`,
      );
    }

    if (configs.length === 0) {
      tree.create(
        '/postcss.config.json',
        JSON.stringify(
          {
            plugins: {
              [TAILWIND_PLUGIN]: {},
            },
          },
          null,
          2,
        ) + '\n',
      );
      return tree;
    }

    const file = configs[0];
    const filePath = `/${file}`;
    const current = tree.readText(filePath);
    if (file.endsWith('.json') || file === '.postcssrc') {
      return mergeJsonPostcss(tree, filePath, current);
    }

    return mergeJavaScriptPostcss(tree, context, filePath, current);
  };
}

function mergeJsonPostcss(tree, filePath, current) {
  let config;
  try {
    config = JSON.parse(current);
  } catch (error) {
    throw new SchematicsException(
      `Could not parse PostCSS configuration ${filePath}: ${error.message}`,
    );
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new SchematicsException(
      `PostCSS configuration ${filePath} must contain a JSON object.`,
    );
  }

  if (config.plugins === undefined) config.plugins = {};
  if (
    !config.plugins ||
    typeof config.plugins !== 'object' ||
    Array.isArray(config.plugins)
  ) {
    throw new SchematicsException(
      `PostCSS configuration ${filePath} must use an object for plugins.`,
    );
  }
  config.plugins[TAILWIND_PLUGIN] ??= {};
  tree.overwrite(filePath, `${JSON.stringify(config, null, 2)}\n`);
  return tree;
}

function mergeJavaScriptPostcss(tree, context, filePath, current) {
  if (current.includes(POSTCSS_START) || current.includes(POSTCSS_END)) {
    const start = current.indexOf(POSTCSS_START);
    const end = current.indexOf(POSTCSS_END);
    if (start === -1 || end === -1 || end < start) {
      throw new SchematicsException(
        `The PostCSS configuration ${filePath} has an incomplete Malva UI marker block.`,
      );
    }
    tree.overwrite(
      filePath,
      `${current.slice(0, start)}${MANAGED_POSTCSS_PLUGIN}${current.slice(
        end + POSTCSS_END.length,
      )}`,
    );
    return tree;
  }

  if (current.includes(TAILWIND_PLUGIN)) {
    context.logger.warn(
      `The PostCSS configuration ${filePath} already contains ${TAILWIND_PLUGIN} without Malva UI markers; leaving it unchanged.`,
    );
    return tree;
  }

  const pluginsObject = /plugins\s*:\s*{/.exec(current);
  if (pluginsObject) {
    const insertAt = pluginsObject.index + pluginsObject[0].length;
    tree.overwrite(
      filePath,
      `${current.slice(0, insertAt)}\n${MANAGED_POSTCSS_PLUGIN}${current.slice(
        insertAt,
      )}`,
    );
    return tree;
  }

  const pluginsArray = /plugins\s*:\s*\[/.exec(current);
  if (pluginsArray) {
    const insertAt = pluginsArray.index + pluginsArray[0].length;
    tree.overwrite(
      filePath,
      `${current.slice(0, insertAt)}\n    ${POSTCSS_START}\n    '${TAILWIND_PLUGIN}',\n    ${POSTCSS_END}${current.slice(
        insertAt,
      )}`,
    );
    return tree;
  }

  const exportedObject = /(module\.exports|export\s+default)\s*=\s*{/.exec(
    current,
  );
  if (exportedObject) {
    const insertAt = exportedObject.index + exportedObject[0].length;
    tree.overwrite(
      filePath,
      `${current.slice(0, insertAt)}
  plugins: {
${MANAGED_POSTCSS_PLUGIN}  },
${current.slice(insertAt)}`,
    );
    return tree;
  }

  throw new SchematicsException(
    `Could not safely merge ${TAILWIND_PLUGIN} into PostCSS configuration ${filePath}.`,
  );
}

function normalizeRelativePath(value) {
  return posixPath.normalize(String(value).replace(/^\/+/, ''));
}
