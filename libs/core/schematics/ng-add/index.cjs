'use strict';

Object.defineProperty(exports, '__esModule', { value: true });
exports.default = installMalvaUi;

const { chain, SchematicsException } = require('@angular-devkit/schematics');
const {
  addDependency,
  addRootProvider,
  ExistingBehavior,
  InstallBehavior,
  readWorkspace,
  updateWorkspace,
} = require('@schematics/angular/utility');
const packageJson = require('../../package.json');

const GLOBAL_STYLESHEET = 'node_modules/@malva-ui/core/styles/malva-ui.css';

/**
 * Install and configure Malva UI in an Angular application.
 *
 * @param {{
 *   project?: string;
 *   theme?: "light" | "dark";
 *   density?: "tight" | "compact" | "comfortable" | "spacious" | "airy";
 *   includeStyles?: boolean;
 *   configureProviders?: boolean;
 *   themeStorageKey?: string;
 *   skipInstall?: boolean;
 * }} options Schematic options supplied by the Angular CLI.
 * @returns {import("@angular-devkit/schematics").Rule} The installation rule.
 */
function installMalvaUi(options) {
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
      theme: options.theme ?? 'light',
      density: options.density ?? 'comfortable',
      includeStyles: options.includeStyles ?? true,
      configureProviders: options.configureProviders ?? true,
      themeStorageKey: options.themeStorageKey ?? 'mlv-theme',
      skipInstall: options.skipInstall ?? false,
    };

    context.logger.info(`\nInstalling Malva UI in "${projectName}"`);

    const rules = [
      logStep(1, 'Adding Malva UI companion packages'),
      ...addCompanionDependencies(normalizedOptions.skipInstall),
    ];

    if (normalizedOptions.includeStyles) {
      rules.push(
        logStep(2, 'Adding Malva UI global styles'),
        addGlobalStyles(projectName),
      );
    } else {
      rules.push(logStep(2, 'Leaving global styles unchanged'));
    }

    if (normalizedOptions.configureProviders) {
      rules.push(
        logStep(3, 'Configuring theme and density providers'),
        addProviderUnlessPresent(
          projectName,
          project.sourceRoot ?? `${project.root}/src`,
          'provideDefaultTheme',
          ({ code, external }) =>
            code`${external(
              'provideDefaultTheme',
              '@malva-ui/cdk/theme',
            )}(${JSON.stringify(normalizedOptions.theme)}, ${JSON.stringify(
              normalizedOptions.themeStorageKey,
            )})`,
        ),
        addProviderUnlessPresent(
          projectName,
          project.sourceRoot ?? `${project.root}/src`,
          'provideMlvDensity',
          ({ code, external }) =>
            code`${external(
              'provideMlvDensity',
              '@malva-ui/cdk/density',
            )}(${JSON.stringify(normalizedOptions.density)})`,
        ),
      );
    } else {
      rules.push(logStep(3, 'Leaving application providers unchanged'));
    }

    rules.push((resultTree, resultContext) => {
      resultContext.logger.info(
        '\nMalva UI is ready. Import components from @malva-ui/core/<component>.\n',
      );
      return resultTree;
    });

    return chain(rules);
  };
}

/**
 * Resolve a single application from the workspace or validate an explicit name.
 *
 * @param {import("@angular-devkit/core").workspaces.WorkspaceDefinition} workspace Angular workspace definition.
 * @param {string | undefined} requestedProject Explicit project option.
 * @returns {string} The resolved application name.
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

  if (applications.length === 1) {
    return applications[0];
  }

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
 * Add the packages that back the grouped core distribution.
 *
 * @param {boolean} skipInstall Whether to suppress the package-manager task.
 * @returns {import("@angular-devkit/schematics").Rule[]} Dependency rules.
 */
function addCompanionDependencies(skipInstall) {
  const install = skipInstall ? InstallBehavior.None : InstallBehavior.Auto;
  const dependencyOptions = {
    existing: ExistingBehavior.Skip,
    install,
  };

  return [
    addDependency('@malva-ui/core', packageJson.version, dependencyOptions),
    addDependency('@malva-ui/cdk', packageJson.version, dependencyOptions),
    addDependency('@malva-ui/i18n', packageJson.version, dependencyOptions),
  ];
}

/**
 * Add the packaged Malva UI stylesheet to an application's build target.
 *
 * @param {string} projectName Application project name.
 * @returns {import("@angular-devkit/schematics").Rule} Workspace update rule.
 */
function addGlobalStyles(projectName) {
  return updateWorkspace((workspace) => {
    const project = workspace.projects.get(projectName);
    const buildTarget = project?.targets.get('build');

    if (!project || !buildTarget) {
      throw new SchematicsException(
        `Could not find a build target for project "${projectName}".`,
      );
    }

    const styles = buildTarget.options['styles'];
    if (styles === undefined) {
      buildTarget.options['styles'] = [GLOBAL_STYLESHEET];
      return;
    }

    if (!Array.isArray(styles)) {
      throw new SchematicsException(
        `The build styles option for "${projectName}" is not an array and cannot be updated safely.`,
      );
    }

    const alreadyConfigured = styles.some((style) =>
      typeof style === 'string'
        ? style === GLOBAL_STYLESHEET
        : style && style['input'] === GLOBAL_STYLESHEET,
    );

    if (!alreadyConfigured) {
      styles.push(GLOBAL_STYLESHEET);
    }
  });
}

/**
 * Add a root provider only when the application's source does not already call it.
 *
 * @param {string} projectName Application project name.
 * @param {string} sourceRoot Application source root.
 * @param {string} providerName Provider function name used for idempotence.
 * @param {import("@schematics/angular/utility").CodeBlockCallback} callback Provider code callback.
 * @returns {import("@angular-devkit/schematics").Rule} Guarded provider rule.
 */
function addProviderUnlessPresent(
  projectName,
  sourceRoot,
  providerName,
  callback,
) {
  return (tree, context) => {
    const normalizedRoot = `/${sourceRoot.replace(/^\/+|\/+$/g, '')}/`;
    let isPresent = false;
    tree.visit((filePath) => {
      if (
        !isPresent &&
        filePath.startsWith(normalizedRoot) &&
        filePath.endsWith('.ts') &&
        tree.readText(filePath).includes(`${providerName}(`)
      ) {
        isPresent = true;
      }
    });

    if (isPresent) {
      context.logger.info(`  ${providerName} is already configured; skipping.`);
      return tree;
    }

    return addRootProvider(projectName, callback)(tree, context);
  };
}

/**
 * Create a numbered progress message rule.
 *
 * @param {number} number Step number.
 * @param {string} message Step description.
 * @returns {import("@angular-devkit/schematics").Rule} Logging rule.
 */
function logStep(number, message) {
  return (tree, context) => {
    context.logger.info(`[${number}/3] ${message}`);
    return tree;
  };
}
