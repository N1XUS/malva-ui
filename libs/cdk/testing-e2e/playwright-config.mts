import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

export interface MlvE2eConfigOptions {
  /** Directory containing spec files, relative to the calling Playwright config. */
  readonly testDir: string;
  /** Project name shown in the Playwright report. Defaults to 'chromium'. */
  readonly projectName?: string;
}

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4200';
const useStaticServer = process.env['PLAYWRIGHT_WEB_SERVER'] === 'static';

/**
 * Factory producing a Playwright config tailored to one Malva UI component.
 *
 * Nx normally provides `docs:serve` as a continuous dependency. Direct
 * Playwright invocation retains the existing web-server fallback.
 */
export function createE2eConfig(
  options: MlvE2eConfigOptions,
): PlaywrightTestConfig {
  return defineConfig({
    testDir: options.testDir,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 2 : 0,
    workers: process.env['CI'] ? 2 : undefined,
    reporter: process.env['CI']
      ? [['html', { open: 'never' }], ['list']]
      : [['list']],
    use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    webServer: {
      command: useStaticServer
        ? 'yarn nx run docs:serve-static --port=4200'
        : 'yarn nx run docs:serve --port=4200',
      url: baseURL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 180_000,
    },
    projects: [
      {
        name: options.projectName ?? 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
}
