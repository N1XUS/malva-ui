# Releasing Malva UI

How a release is cut. What a release *promises* — the semver contract, the
deprecation window and the support window per major — is
[`../VERSIONING.md`](../VERSIONING.md).

Releases are **manual**. A push to `main` never publishes anything — CI lints,
tests, builds and typechecks. A release starts when a human runs the **Release**
workflow (`.github/workflows/release.yml`).

The release workflow only **builds and publishes**: it does not re-run the test
suite. The gate is CI on `main` — release a commit CI has already gone green on.

One run does all of this, in order:

1. `nx release` → `preVersionCommand` builds `cdk`, `core`, `i18n`, `editor`, `scheduler`, `tailwind` in production mode.
2. Versions the workspace root `package.json` (all six packages move together — `projectsRelationship: "fixed"`).
3. Writes `CHANGELOG.md` from the conventional commits since the last tag.
4. Commits (`chore(release): v{version}`), tags (`v{version}`), **pushes to `main`**, creates the GitHub Release.
5. `scripts/generate-ai-docs.mjs`.
6. `scripts/publish.mjs` — resolves version placeholders in each dist manifest,
   widens exact Angular/Tiptap pins into `^X.Y.0` peer ranges, preflights every
   `exports` target, publishes in dependency order.

Steps 5–6 are skipped on a dry run.

---

## 1. One-time GitHub setup

The workflow's `auth` input picks between two credential models:

| `auth` | Credential | When |
| --- | --- | --- |
| `token` (default) | `AUTH` secret on the `release` Environment | Today. Works on a private repo, and is the only way to make a package exist in the first place. |
| `trusted` | None — OIDC **Trusted Publishing** | After going public and configuring a trusted publisher on each package. See §1.6. |

### 1.1 npm token → `AUTH` Environment secret

**On npmjs.com** — avatar → **Access Tokens** → **Generate New Token**:

| Choice | Value |
| --- | --- |
| Type | **Granular Access Token** (or classic **Automation**) |
| Expiration | your call — granular tokens cap at 365 days, so diary the renewal |
| Packages and scopes | **Read and write**, limited to the `@malva-ui` scope |
| Organizations | read/write, if `@malva-ui` is an org rather than a user scope |

> Do **not** use a classic **Publish** token. It prompts for a 2FA OTP, which a
> runner cannot answer. **Automation** and granular tokens bypass 2FA for publish.

**On GitHub** — the token lives as an **Environment** secret, not a repository one:

**Settings → Environments → `release` → Environment secrets → Add secret**

- Name: `AUTH`
- Secret: the token

The job declares `environment: release`, which is what makes `secrets.AUTH`
resolve — a job that does not name an Environment cannot see its secrets, and the
expression silently evaluates to an empty string instead of failing.

> `secrets.AUTH` (the npm token) and the `auth` workflow input (the mode switch)
> are unrelated despite the names.

### 1.2 Workflow permissions

The workflow's built-in `GITHUB_TOKEN` has `contents: read` and `id-token: write`.
Git writes and GitHub Release creation use a separate, short-lived installation
token from the **Malva UI Release** GitHub App. `contents: write` alone does not
bypass the `main` ruleset's pull-request requirement.

**Settings → Actions → General → Actions permissions** must allow
`actions/checkout`, `actions/setup-node`, `actions/cache`, and
`actions/create-github-app-token`.

### 1.3 Dedicated release App

1. In **Settings → Developer settings → GitHub Apps**, create a private App
   named **Malva UI Release**, installable only on the `N1XUS` account. Set the
   homepage to this repository, disable webhooks, and grant only repository
   **Contents: Read and write** (Metadata read is automatic).
2. Install it on **only `N1XUS/malva-ui`** and generate a private key.
3. In **Settings → Environments → release**, set:
   - Environment variable `RELEASE_APP_CLIENT_ID`: the App's client ID.
   - Environment secret `RELEASE_APP_PRIVATE_KEY`: the complete PEM private key.
4. In **Settings → Rules → Rulesets → Protect main → Bypass list**, add that
   installed App with **Always allow**. **For pull requests only** cannot permit
   Nx Release's direct push. Keep the pull-request rule enabled for everyone else.
   If a tag ruleset is added for `v*`, grant the release App the necessary bypass
   there too.
5. Restrict the `release` environment's deployment branches to `main` so other
   branches cannot access its key. The workflow also runs its release job only
   on `refs/heads/main`.

The workflow checks these settings before installing dependencies, mints a
repository-scoped token, uses it for checkout/push and the GitHub Release API,
and attributes the release commit to the App's bot. Dry runs request read-only
Contents access but still require the App setup. Tokens expire after one hour
and the token action revokes them when the job finishes; rerun the workflow if
it expires before Nx pushes.

The App needs no Administration permission. Its bypass is granted to its App
identity, not to the Git commit author or the workflow's built-in token. Do not
reuse this App or its private key for general Claude/Codex PR work; use the
[separate development bot](GITHUB-BOTS.md).

### 1.4 Optional — require an approval click

The `release` Environment currently has **no protection rules**, so runs start
immediately. To gate them:

**Settings → Environments → `release` → Required reviewers** → add yourself.

Every run — dry runs included — then waits on an approval click before any step
executes. No workflow change needed; the job already names the Environment.

### 1.5 npm provenance

The `provenance` input defaults to **false** because provenance requires a
**public** repository — npm verifies the OIDC claim against a public source. This
repo is currently private, so leave it off. After going public, flip the input
default to `true`.

### 1.6 Trusted Publishing (target state)

npm **Trusted Publishing** exchanges the GitHub Actions OIDC identity for a
short-lived publish credential. No long-lived token is stored anywhere, and npm
attaches provenance automatically. It is where this repo should end up — but it
cannot be turned on yet, for two independent reasons:

1. **The repo is private.** Trusted Publishing signs provenance from the OIDC
   claim, and npm only accepts provenance for a package whose source repository
   is public.
2. **`@malva-ui/tailwind` does not exist on npm.** A trusted publisher is
   configured *on a package*, so the package has to be published once before it
   can be configured.

**Migration order, once the repo is public:**

1. Run one release with `auth: token` so `@malva-ui/tailwind` exists on npm.
2. For **each** of the six packages — `@malva-ui/cdk`, `core`, `i18n`, `editor`,
   `scheduler`, `tailwind` — open npmjs.com → the package → **Settings → Publishing access →
   Trusted publisher → GitHub Actions**, and enter:

   | Field | Value |
   | --- | --- |
   | Organization or user | `N1XUS` |
   | Repository | `malva-ui` |
   | Workflow filename | `release.yml` |
   | Environment | `release` — the job names it, so npm's strict match requires it here too |

   The environment field is matched strictly against the job's `environment:`.
   Change one and you must change the other.
3. Run a release with `auth: trusted` and `dryRun: false`.
4. Delete the `AUTH` Environment secret and revoke the token on npmjs.com.

**What the workflow already does for you:**

- `permissions: id-token: write` is declared, which is what mints the OIDC token.
- `actions/setup-node` is deliberately called **without** `registry-url`. That
  option makes setup-node write an `.npmrc` line interpolating
  `${NODE_AUTH_TOKEN}`; under Trusted Publishing there is no such variable and
  npm fails reading its own config. Token mode writes the `.npmrc` line itself
  in a separate step instead.
- `auth: trusted` runs `npm install -g npm@latest` first. The OIDC exchange needs
  npm ≥ 11.5.1, and the runner's bundled npm follows whatever Node line `.nvmrc`
  pins.
- `NPM_PROVENANCE` is forced on under `trusted`.

Trusted Publishing does **not** replace §1.2 and §1.3 — those govern the git push
and the GitHub Release, which use the release App installation token instead of npm credentials.

---

## 2. Running a release

**UI:** Actions → **Release** → **Run workflow** → branch `main` → set the inputs → Run.

**CLI:**

```bash
gh workflow run release.yml -f dryRun=true
```

```bash
gh workflow run release.yml -f dryRun=false -f specifier=auto -f distTag=latest
```

| Input | Meaning |
| --- | --- |
| `specifier` | `auto` derives the bump from conventional commits. `patch`/`minor`/`major`/`prerelease` force it. |
| `dryRun` | **defaults to `true`.** Prints the plan; writes nothing, publishes nothing. |
| `distTag` | `latest` for the stable line, `next` for prereleases. |
| `auth` | `token` uses the `AUTH` Environment secret. `trusted` uses OIDC Trusted Publishing — see §1.6. |
| `provenance` | Public repo only — see §1.5. Implied by `auth: trusted`. |

Always run once with `dryRun: true`, read the rendered changelog and the resolved
version, then run again with `dryRun: false`.

The release commit lands on `main`, which triggers a normal CI run. That is
expected and harmless.

---

## 3. Version resolution

`nx release` resolves the **current** version from the latest git tag matching
`v{version}`, then applies the conventional-commit bump.

### 3.1 Pre-1.0 bumps are shifted down

`adjustSemverBumpsForZeroMajorVersion` defaults to `true` in Nx, so while the
major is `0`:

| Commits contain | Nx logs | Nx actually applies |
| --- | --- | --- |
| `feat:` | `minor` | **patch** (`0.1.12` → `0.1.13`) |
| breaking change | `major` | **minor** (`0.1.12` → `0.2.0`) |

This is deliberate — it is the SemVer spec's 0.x rule — but the log line reads
`Applied semver relative bump "minor" … to get new version 0.1.13`, which looks
like a bug and is not. To bump literally, set
`release.version.adjustSemverBumpsForZeroMajorVersion: false` in `nx.json`, or
pass an explicit `specifier`.

### 3.2 Fix the tag gap before the first run

Right now the three sources of truth disagree:

| Source | Version |
| --- | --- |
| Latest git tag | `v0.1.12` |
| Root `package.json` | `0.1.13` |
| npm (`@malva-ui/core`, `cdk`, `i18n`, `editor`) | `0.1.13` |

`0.1.13` was published without a matching tag, so Nx still resolves the current
version as `0.1.12` and would compute `0.1.13` again — a version npm already has.
That fails *quietly*: `scripts/publish.mjs` skips any `name@version` already on
the registry, so the run would commit, tag `v0.1.13`, push, and create a GitHub
Release for a version it then publishes nothing for.

Backfill the missing tag (`e4e21657` is the commit that set `0.1.13`):

```bash
git tag v0.1.13 e4e21657
```

```bash
git push origin v0.1.13
```

The next release then resolves `0.1.13` → `0.1.14`, and the changelog covers
everything since that tag.

`@malva-ui/tailwind` has never been published; its first release publishes at the
same fixed version as the rest.

---

## 4. Local dry runs

```bash
yarn nx release --dry-run --skip-publish
```

```bash
yarn build:libs && node scripts/publish.mjs --dry-run
```

```bash
yarn publish:local
```

`publish:local` targets a Verdaccio registry at `http://localhost:4873`. Note that
`nx.json` sets `release.git.push: true`, so a **non**-dry local `nx release` will
push to `origin` — override it before experimenting locally.
