# Security Policy

## Supported versions

Malva UI is pre-1.0. Only the latest published version receives security fixes.

| Version        | Supported |
| -------------- | --------- |
| 0.1.x (latest) | ✅        |
| anything older | ❌        |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub: go to the repository's **Security** tab →
**Report a vulnerability**. That opens a private advisory visible only to the
maintainers, and it lets us discuss and patch before anything is public.

Please include:

- the affected package (`@malva-ui/core`, `cdk`, `i18n`, `editor`, `tailwind`) and version
- what an attacker can do with it
- a minimal reproduction — a StackBlitz, a repository, or a code snippet

You can expect an acknowledgement within a few days. If a fix is warranted we
will release it as a patch and credit you in the advisory unless you ask us not
to.

## Scope

These are in scope:

- XSS or injection reachable through a documented component input
- a component that bypasses its own sanitisation
- a supply-chain problem in a published tarball (unexpected files, wrong contents)

These are not:

- vulnerabilities in Angular, the CDK, Tiptap or any other peer dependency —
  report those upstream
- findings that require the consumer to already be passing attacker-controlled
  values into an input documented as trusted HTML
- automated scanner output with no demonstrated impact
