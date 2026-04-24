# Universal Code Reviewer

AI code reviews for GitHub pull requests using the LLM provider you choose.

Use OpenAI, Ollama, Groq, Together AI, Ollama Cloud, or any OpenAI-compatible API. This action does not add its own review quota, subscription, or model lock-in. Your real limits are your GitHub Actions minutes, your provider limits, and the model you run.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why Use This?

Most AI review tools are tied to one vendor, one model, one pricing model, and one set of usage limits. Universal Code Reviewer is different:

| You want | This project gives you |
| --- | --- |
| More control | Bring your own LLM endpoint and API key |
| No model lock-in | Switch models by changing one workflow input |
| Private reviews | Use self-hosted Ollama or a private OpenAI-compatible endpoint |
| Predictable costs | Pay your provider directly, with no markup from this action |
| Simple adoption | Add one GitHub Actions workflow to a repo |
| Useful PR feedback | Review summaries plus Critical, Important, and Suggestion findings |

## What It Does

- Runs automatically when a pull request is opened or updated.
- Lets you manually request a review with `/review` or `@code-reviewer`.
- Lets you request a short PR summary with `/summary`.
- Sends the PR diff to your configured LLM endpoint.
- Posts a GitHub PR review with a summary and line-level comments when possible.
- Can fail the check when critical issues are found.

## What It Does Not Do

- It does not provide free LLM usage. You pay your provider, or you run your own model.
- It does not remove GitHub Actions limits. Private repos still use your Actions minutes.
- It does not guarantee perfect findings. Review quality depends on the model and diff context.
- It does not keep code fully local unless your configured endpoint is local/private.
- It does not yet provide one-click org-wide installation. That is planned as a GitHub App.

## Quick Start

### 1. Choose A Provider

Use any API that supports the OpenAI Chat Completions format.

| Provider | Base URL example | API key |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | OpenAI API key |
| Groq | `https://api.groq.com/openai/v1` | Groq API key |
| Together AI | `https://api.together.xyz/v1` | Together API key |
| Ollama Cloud | Provider URL from Ollama | Ollama Cloud key |
| Self-hosted Ollama | `http://your-server:11434/v1` | Use `ollama` |
| Custom endpoint | Your OpenAI-compatible URL | Your API key |

Important: GitHub-hosted runners cannot reach `localhost` on your laptop. If you use Ollama, run it on a reachable server or expose it with a private network/tunnel. See [Self-Hosting](#self-hosting).

### 2. Add Secrets

In the repository where you want reviews, go to **Settings -> Secrets and variables -> Actions** and add:

| Secret | Required | Example |
| --- | --- | --- |
| `LLM_API_KEY` | Yes | `sk-...` or `ollama` |
| `LLM_BASE_URL` | Yes | `https://api.openai.com/v1` |
| `LLM_MODEL` | Optional | `gpt-4o`, `llama3.2`, `codellama:13b` |

For many repositories, set these as organization secrets and allow selected repos to use them.

### 3. Add The Workflow

Create `.github/workflows/code-review.yml` in the repository you want reviewed:

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && github.event.issue.pull_request && (
        contains(github.event.comment.body, '/review') ||
        contains(github.event.comment.body, '/summary') ||
        contains(github.event.comment.body, '/help') ||
        contains(github.event.comment.body, '@code-reviewer')
      ))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Universal Code Review
        uses: antongulin/universal-code-reviewer@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
          llm-base-url: ${{ secrets.LLM_BASE_URL }}
          model: ${{ secrets.LLM_MODEL || 'kimi-k2.6:cloud' }}
          fail-on-critical: "false"
```

Open a pull request. The action will review the diff and post results back to the PR.

## Common Setups

### Automatic Review On Every PR

Use the Quick Start workflow as-is. This is best for teams that want every PR checked.

### Manual Review Only

Use this when you want to avoid review noise or reduce LLM cost.

```yaml
name: Manual Code Review

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    if: |
      github.event.issue.pull_request && (
        contains(github.event.comment.body, '/review') ||
        contains(github.event.comment.body, '/summary') ||
        contains(github.event.comment.body, '/help') ||
        contains(github.event.comment.body, '@code-reviewer')
      )
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: antongulin/universal-code-reviewer@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
          llm-base-url: ${{ secrets.LLM_BASE_URL }}
          model: ${{ secrets.LLM_MODEL || 'gpt-4o' }}
```

Then comment on a PR:

```text
/review
```

### Strict Mode For Critical Issues

Use this if you want the workflow check to fail when the reviewer finds critical issues.

```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  llm-api-key: ${{ secrets.LLM_API_KEY }}
  llm-base-url: ${{ secrets.LLM_BASE_URL }}
  model: ${{ secrets.LLM_MODEL || 'gpt-4o' }}
  fail-on-critical: "true"
```

### Different Model Per Repository

Use org-level secrets for the API key and base URL, then choose a model per repo.

```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  llm-api-key: ${{ secrets.LLM_API_KEY }}
  llm-base-url: ${{ secrets.LLM_BASE_URL }}
  model: "codellama:70b"
```

## Slash Commands

Comment on a pull request with one of these commands:

| Command | Result |
| --- | --- |
| `/review` | Full review with Critical, Important, and Suggestion findings |
| `/summary` | Short explanation of what changed |
| `/help` | List available commands |
| `@code-reviewer` | Alias for `/review` when `trigger-on-mention` is enabled |

Examples:

```text
/review
```

```text
/summary
```

```text
Can you check the auth changes? @code-reviewer
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | Yes | `${{ github.token }}` | Token used to read PRs and post reviews |
| `llm-api-key` | No | `ollama` | API key for your LLM endpoint |
| `api-key` | No | empty | Alias for `llm-api-key` |
| `llm-base-url` | Yes | none | OpenAI-compatible API base URL |
| `base-url` | No | empty | Alias for `llm-base-url` |
| `model` | Yes | `kimi-k2.6:cloud` | Model name sent to the provider |
| `trigger-on-mention` | No | `true` | Enables `@code-reviewer` comments |
| `fail-on-critical` | No | `false` | Fails the workflow if critical issues are found |
| `max-diff-size` | No | `50000` | Maximum diff characters sent to the model |

## Model Suggestions

There is no single best model. Pick based on cost, latency, privacy, and review quality.

| Model | Good for | Notes |
| --- | --- | --- |
| `gpt-4o` | General code review | Strong default if using OpenAI |
| `kimi-k2.6:cloud` | Deep review and reasoning | Default model in this project |
| `deepseek-coder` | Code-focused review | Good if your provider supports it |
| `codellama:13b` | Self-hosted lightweight review | Faster, lower resource usage |
| `codellama:70b` | Self-hosted higher-quality review | Requires more hardware |
| `llama3.2` | Fast summaries and basic checks | Best for speed, not deep review |

For important repositories, test a few models on real PRs before standardizing.

## Self-Hosting

Self-hosting is useful when privacy, cost control, or provider independence matters.

### Run Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull codellama:13b

# Start the server
ollama serve
```

Ollama exposes an OpenAI-compatible API at:

```text
http://localhost:11434/v1
```

That URL only works from the same machine. GitHub Actions needs a reachable address.

### Make Ollama Reachable From GitHub Actions

| Option | Best for | Notes |
| --- | --- | --- |
| VPS or dedicated server | Stable team usage | Run Ollama on a server and use its private/public URL |
| Tailscale | Private networking | Requires runner/network setup that can reach your Tailnet |
| Cloudflare Tunnel | Quick testing | Public tunnel URL; protect access carefully |
| Self-hosted GitHub runner | Maximum privacy | Run the GitHub runner on the same network as Ollama |

Example base URL for a server:

```text
http://your-server-ip:11434/v1
```

## Security And Privacy

The action sends PR diffs to the LLM endpoint you configure. Choose that endpoint based on your data policy.

| Setup | Where code goes |
| --- | --- |
| OpenAI, Groq, Together, or another hosted API | To that provider |
| Self-hosted Ollama on your server | To your server |
| Self-hosted GitHub runner plus local Ollama | Stays inside your infrastructure |

Recommended practices:

- Use least-privilege GitHub permissions in the workflow.
- Store API keys in GitHub Secrets, not in workflow files.
- Prefer organization secrets for teams.
- Review your provider's data retention policy before using it on private code.
- Avoid `pull_request_target` unless you understand the security implications.

## Costs And Limits

This project does not charge you and does not enforce a daily review quota. Your actual usage depends on:

| Limit source | What it affects |
| --- | --- |
| GitHub Actions minutes | Runtime cost for private repositories |
| LLM provider billing | Token cost per review |
| LLM provider rate limits | How many reviews can run at once |
| Model context window | How much diff can be reviewed at once |
| `max-diff-size` | How much diff this action sends |

For public repositories, GitHub-hosted Actions minutes are generally free. For private repositories, reviews use your plan's Actions minutes. Most reviews should take around 1-2 minutes, but large PRs or slow self-hosted models can take longer.

## Comparison

| Feature | Universal Code Reviewer | Hosted AI review tools |
| --- | --- | --- |
| Model choice | Any OpenAI-compatible model | Usually fixed or limited |
| Provider choice | You choose | Vendor chooses |
| Self-hosting | Supported | Usually not supported |
| Action-level quota | None | Often plan-based |
| Cost model | Your GitHub minutes plus your LLM provider | Vendor subscription or usage plan |
| Setup | GitHub workflow and secrets | Usually GitHub App install |
| Best for | Control, privacy, model flexibility | Fastest setup and managed experience |

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| `Connection refused` | GitHub cannot reach your LLM endpoint | Use a reachable server, tunnel, or self-hosted runner |
| `Empty response from LLM` | Model is missing or provider returned no content | Pull/load the model and check provider logs |
| `Invalid API key` | Wrong secret value | For local Ollama, use `ollama`; for hosted APIs, use the real key |
| No comments appear | Missing workflow permissions | Add `pull-requests: write` and `issues: write` |
| Slash commands do nothing | Workflow `if` condition does not include the command | Use the workflow from this README |
| Review is too shallow | Model is too small or diff was truncated | Use a stronger model or increase `max-diff-size` |
| Large PR review misses files | Diff exceeded `max-diff-size` | Split the PR or raise the limit |

## Development

```bash
git clone https://github.com/antongulin/universal-code-reviewer.git
cd universal-code-reviewer
npm install
npm run build
```

Useful commands:

```bash
npm run build
npm run lint
npm test
npm run package
```

## Roadmap

### v0.1.0

- GitHub Action for OpenAI-compatible LLM review.
- Automatic PR review on open/update.
- Slash commands: `/review`, `/summary`, `/help`.
- Line-level comments when findings can be mapped to the diff.
- Support for hosted and self-hosted LLM endpoints.

### Planned

- GitHub App for one-click installation across many repositories.
- Better handling for very large PRs.
- Configurable review rules per repository.
- Better model-specific presets.
- More reliable inline comment mapping.

## Contributing

Issues and pull requests are welcome. Good areas to improve:

- Prompt quality.
- Review parsing.
- Provider examples.
- Large diff handling.
- GitHub App version.
- Documentation and real-world usage examples.

## License

MIT
