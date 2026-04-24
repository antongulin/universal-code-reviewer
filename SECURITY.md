# Security Policy

## Supported Versions

Security fixes are applied to the latest tagged release and the `main` branch.

## Reporting A Vulnerability

Please report security issues privately by opening a GitHub security advisory for this repository when available. If advisories are not enabled, email the maintainer listed on the GitHub profile.

Do not open a public issue for vulnerabilities that could expose secrets, private repository contents, or allow untrusted users to trigger paid LLM usage.

## Security Notes

Universal Code Reviewer sends pull request diffs to the LLM endpoint configured by the repository owner. Review your provider's data retention policy before using hosted APIs on private code.

Recommended workflow practices:

- Use GitHub Secrets for API keys.
- Keep workflow permissions minimal: `contents: read`, `pull-requests: write`, and `issues: write`.
- Avoid `pull_request_target`; this action intentionally skips that event.
- Keep slash commands maintainer-only with `min-command-permission: "write"` unless you understand the cost and privacy tradeoffs.
- Prefer self-hosted runners and private model endpoints for sensitive codebases.
