#!/usr/bin/env node
// Short-lived credentials for local Claude/Codex GitHub operations. No login
// state or token is written to disk; each invocation revokes its token on exit.
import { spawnSync } from 'node:child_process';
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { constants, homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'N1XUS/malva-ui';

export function createAppJwt(
  clientId,
  privateKey,
  now = Math.floor(Date.now() / 1000),
) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: clientId, iat: now - 60, exp: now + 540 })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

export async function runWithDevBot(
  { clientId, privateKey },
  command,
  args,
  { env = process.env, fetchImpl = fetch, spawnImpl = spawnSync } = {},
) {
  if (!clientId || !privateKey)
    throw new Error(
      'Configure clientId and privateKey for the development App. See docs/GITHUB-BOTS.md.',
    );
  if (!['gh', 'git'].includes(command))
    throw new Error('The development bot runs gh or git commands only.');
  const configCount = Number(env.GIT_CONFIG_COUNT ?? 0);
  if (!Number.isInteger(configCount) || configCount < 0)
    throw new Error('Invalid GIT_CONFIG_COUNT.');

  async function request(path, token, method = 'GET', body) {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10',
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // Response bodies can contain credentials. Report only status and endpoint.
    if (!response.ok)
      throw new Error(`GitHub ${method} ${path} failed (${response.status}).`);
    return method === 'DELETE' ? undefined : response.json();
  }

  const jwt = createAppJwt(clientId, privateKey);
  const installation = await request(`/repos/${REPOSITORY}/installation`, jwt);
  if (!Number.isInteger(installation.id))
    throw new Error('GitHub returned no installation ID.');
  const credentials = await request(
    `/app/installations/${installation.id}/access_tokens`,
    jwt,
    'POST',
    {
      repositories: ['malva-ui'],
      permissions: { contents: 'write', pull_requests: 'write' },
    },
  );
  if (typeof credentials.token !== 'string' || !credentials.token)
    throw new Error('GitHub returned no installation token.');

  try {
    // Reset personal HTTPS credential helpers for this child process only.
    // gh auth git-credential reads GH_TOKEN, including when gh itself runs git.
    const childEnv = {
      ...env,
      GH_HOST: 'github.com',
      GH_REPO: REPOSITORY,
      GH_TOKEN: credentials.token,
      GITHUB_TOKEN: credentials.token,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: String(configCount + 2),
      [`GIT_CONFIG_KEY_${configCount}`]: 'credential.https://github.com.helper',
      [`GIT_CONFIG_VALUE_${configCount}`]: '',
      [`GIT_CONFIG_KEY_${configCount + 1}`]:
        'credential.https://github.com.helper',
      [`GIT_CONFIG_VALUE_${configCount + 1}`]: '!gh auth git-credential',
    };
    const result = spawnImpl(command, args, {
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    });
    if (result.error) throw result.error;
    return result.status ?? 128 + (constants.signals[result.signal] ?? 1);
  } finally {
    await request('/installation/token', credentials.token, 'DELETE');
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') {
    console.log(
      'Usage: node scripts/github-dev-bot.mjs <gh|git> ...args\nConfiguration: ~/.config/malva-ui/github-dev-bot.json (or MALVA_DEV_BOT_CONFIG). See docs/GITHUB-BOTS.md.',
    );
    return command ? 0 : 1;
  }
  const configPath =
    process.env.MALVA_DEV_BOT_CONFIG ??
    join(homedir(), '.config', 'malva-ui', 'github-dev-bot.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (
    typeof config.privateKeyPath !== 'string' ||
    !isAbsolute(config.privateKeyPath)
  ) {
    throw new Error(
      'privateKeyPath must be an absolute path outside the repository.',
    );
  }
  return runWithDevBot(
    {
      clientId: config.clientId,
      privateKey: readFileSync(config.privateKeyPath, 'utf8'),
    },
    command,
    args,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Development bot: ${error.message}`);
      process.exitCode = 1;
    });
}
