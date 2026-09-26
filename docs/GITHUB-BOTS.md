# GitHub bot identities

Malva UI uses two private GitHub Apps, each installed only on `N1XUS/malva-ui`:

| App              | Use                                      | Repository permissions                 | Ruleset bypass                 |
| ---------------- | ---------------------------------------- | -------------------------------------- | ------------------------------ |
| Malva UI Release | Manual release workflow                  | Contents: read/write                   | Always allow on `Protect main` |
| Malva UI Dev     | Local Claude/Codex branch pushes and PRs | Contents and Pull requests: read/write | None                           |

Metadata read access is automatic. Neither App needs Administration permission,
OAuth user authorization, a webhook, or access to other repositories. Release
setup is in [RELEASING.md](RELEASING.md#13-dedicated-release-app).

## Development App setup

1. Open **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
   Name it **Malva UI Dev**, use `https://github.com/N1XUS/malva-ui` as the
   homepage, disable webhooks, and select **Only on this account**.
2. Grant repository **Contents: Read and write** and **Pull requests: Read and
   write**. Install the App on **only `malva-ui`**. Do not add it to a bypass list.
3. Generate a private key and store the PEM outside the checkout, for example
   `~/.config/malva-ui/dev-bot.pem`, with mode `600` in a directory with mode `700`.
4. Create `~/.config/malva-ui/github-dev-bot.json`:

   ```json
   {
     "clientId": "YOUR_APP_CLIENT_ID",
     "privateKeyPath": "/absolute/path/to/dev-bot.pem"
   }
   ```

   `MALVA_DEV_BOT_CONFIG` can point to another config file. The key path must be
   absolute. Do not commit the config or key, paste keys into chat, or share the
   release App's key with either development agent.

## Using the shared identity

Run from this checkout with Node.js and `gh` installed:

```bash
node scripts/github-dev-bot.mjs git push -u origin codex/my-change
node scripts/github-dev-bot.mjs gh pr create --draft --base main --title "fix: describe the change" --body-file /tmp/pr-body.md
node scripts/github-dev-bot.mjs gh pr edit 123 --body-file /tmp/pr-body.md
```

The wrapper signs a JWT, discovers this repository's installation, requests a
one-hour token scoped to `malva-ui` with Contents/Pull requests write access,
executes one command, and revokes the token even if the command fails. It does
not print credentials, change `gh auth` state, or edit Git configuration.
An abrupt termination such as `SIGKILL` can prevent cleanup; the token still
expires after one hour. Run a fresh invocation for each command.

Git pushes must use an **HTTPS remote**, as this checkout does. An SSH remote
uses the SSH key's identity instead. The wrapper replaces HTTPS credential
helpers only in the child environment; your normal personal CLI login remains
available outside it. Git commit authorship remains unchanged; the PR author
and authenticated pusher use the App identity.

Both agents should use the wrapper for writes instead of their GitHub connector,
whose identity is independent of this local command. Instructions are shared
through `.claude/projects/best-practices.md`, loaded by both repository guides.

The development App cannot push changes to `.github/workflows/` without the
additional Workflows permission. For such PRs, the repository owner can push
the branch with their normal Git access, then the development App can create
the PR. The development bot has no bypass and cannot push directly to `main`.

## Verification

```bash
yarn nx run @malva-ui/source:test
node scripts/github-dev-bot.mjs gh api repos/N1XUS/malva-ui --jq .full_name
```

After creating a real PR, verify its author is `malva-ui-dev[bot]`. Keep
`Protect main` enabled: pushes from the development App must go to a feature
branch and reach `main` through a pull request. A release dry run checks token
creation and build/version planning, but only a real release verifies the
ruleset bypass; a Git push with `--dry-run` does not prove server acceptance.
