# Contributing

Thanks for helping improve Universal Code Reviewer.

## Good First Areas

- Prompt quality and reviewer output examples.
- Parser reliability and schema validation.
- GitHub review comment mapping.
- Provider setup examples.
- Large pull request handling.
- Documentation clarity.

## Development

```bash
npm ci
npm run lint
npm test
npm run build
```

The action runs from `dist/index.js`, so source changes that affect runtime behavior must be bundled with `npm run build` before release.

## Pull Request Guidelines

- Keep changes focused.
- Add tests for parser, command, GitHub API, or review-mapping behavior when possible.
- Update the README when changing user-facing inputs or behavior.
- Do not commit secrets, provider keys, or private endpoint URLs.
