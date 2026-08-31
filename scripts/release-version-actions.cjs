'use strict';

const { readJson } = require('@nx/devkit');
const {
  default: JsVersionActions,
  afterAllProjectsVersioned,
} = require('@nx/js/src/release/version-actions');

/**
 * Nx normally reads each project's source package.json to resolve the current
 * version. Malva UI keeps placeholders in those manifests, so the workspace
 * root package.json is the canonical version source for every release project.
 */
class RootPackageVersionActions extends JsVersionActions {
  async readCurrentVersionFromSourceManifest(tree) {
    const manifestPath = 'package.json';
    const packageJson = readJson(tree, manifestPath);

    if (typeof packageJson.version !== 'string' || !packageJson.version) {
      throw new Error(
        `Unable to determine the current release version from ${manifestPath}`,
      );
    }

    return {
      currentVersion: packageJson.version,
      manifestPath,
    };
  }
}

module.exports = RootPackageVersionActions;
module.exports.afterAllProjectsVersioned = afterAllProjectsVersioned;
