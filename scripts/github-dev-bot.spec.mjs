import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';
import { createAppJwt, runWithDevBot } from './github-dev-bot.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const config = { clientId: 'Iv1.test', privateKey };

test('signs an RS256 JWT with clock skew allowance and a bounded lifetime', () => {
  const jwt = createAppJwt('Iv1.test', privateKey, 1_800_000_000);
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {
    alg: 'RS256',
    typ: 'JWT',
  });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), {
    iss: 'Iv1.test',
    iat: 1_799_999_940,
    exp: 1_800_000_540,
  });
  assert.ok(
    verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  );
});

function harness({ status = 0, spawnError, apiError } = {}) {
  const requests = [];
  const children = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, ...options });
    assert.ok(url.startsWith('https://api.github.com/'));
    assert.equal(options.redirect, 'error');
    if (apiError && options.method === 'POST')
      return { ok: false, status: 403 };
    return {
      ok: true,
      status: 200,
      json: async () =>
        options.method === 'POST'
          ? { token: 'test-installation-token' }
          : { id: 123 },
    };
  };
  const spawnImpl = (command, args, options) => {
    children.push({ command, args, ...options });
    if (spawnError) throw new Error('spawn failed');
    return { status };
  };
  return { requests, children, fetchImpl, spawnImpl };
}

test('scopes credentials to malva-ui, preserves argument boundaries and revokes after the command', async () => {
  const h = harness();
  const env = {
    GH_TOKEN: 'personal',
    GITHUB_TOKEN: 'personal',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'color.ui',
    GIT_CONFIG_VALUE_0: 'false',
  };
  const args = [
    'pr',
    'create',
    '--title',
    'literal $(do-not-run)',
    '--body-file',
    '/tmp/pr body.md',
  ];
  assert.equal(await runWithDevBot(config, 'gh', args, { ...h, env }), 0);
  assert.equal(
    h.requests[0].url,
    'https://api.github.com/repos/N1XUS/malva-ui/installation',
  );
  assert.equal(
    h.requests[1].url,
    'https://api.github.com/app/installations/123/access_tokens',
  );
  assert.deepEqual(JSON.parse(h.requests[1].body), {
    repositories: ['malva-ui'],
    permissions: { contents: 'write', pull_requests: 'write' },
  });
  assert.equal(h.requests[2].method, 'DELETE');
  assert.equal(h.requests[2].url, 'https://api.github.com/installation/token');
  assert.equal(
    h.requests[2].headers.Authorization,
    'Bearer test-installation-token',
  );
  const child = h.children[0];
  assert.equal(child.command, 'gh');
  assert.deepEqual(child.args, args);
  assert.equal(child.shell, false);
  assert.equal(child.env.GH_TOKEN, 'test-installation-token');
  assert.equal(child.env.GITHUB_TOKEN, 'test-installation-token');
  assert.equal(child.env.GH_REPO, 'N1XUS/malva-ui');
  assert.equal(child.env.GIT_CONFIG_KEY_0, 'color.ui');
  assert.equal(
    child.env.GIT_CONFIG_KEY_1,
    'credential.https://github.com.helper',
  );
  assert.equal(child.env.GIT_CONFIG_VALUE_1, '');
  assert.equal(child.env.GIT_CONFIG_VALUE_2, '!gh auth git-credential');
  assert.equal(env.GH_TOKEN, 'personal');
  assert.equal(env.GIT_CONFIG_COUNT, '1');
});

test('preserves a command failure and still revokes the token', async () => {
  const h = harness({ status: 7 });
  assert.equal(
    await runWithDevBot(config, 'git', ['push', 'origin', 'codex/test'], h),
    7,
  );
  assert.equal(h.requests.at(-1).method, 'DELETE');
});

test('revokes the token when spawning the command fails', async () => {
  const h = harness({ spawnError: true });
  await assert.rejects(
    runWithDevBot(config, 'gh', ['pr', 'list'], h),
    /spawn failed/,
  );
  assert.equal(h.requests.at(-1).method, 'DELETE');
});

test('fails closed on token creation errors without running as the personal account', async () => {
  const h = harness({ apiError: true });
  await assert.rejects(runWithDevBot(config, 'gh', ['pr', 'list'], h), /403/);
  assert.equal(h.children.length, 0);
  assert.equal(h.requests.length, 2);
});

test('rejects missing configuration and arbitrary commands before making API requests', async () => {
  const h = harness();
  await assert.rejects(
    runWithDevBot({}, 'gh', ['pr', 'list'], h),
    /clientId.*privateKey/,
  );
  await assert.rejects(
    runWithDevBot(config, 'sh', ['-c', 'echo test'], h),
    /gh or git/,
  );
  assert.equal(h.requests.length, 0);
});
