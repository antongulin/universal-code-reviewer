# Universal Code Reviewer

Bring-your-own-LLM code reviews for GitHub pull requests.

Universal Code Reviewer is a GitHub Action that reads a pull request diff, sends it to the OpenAI-compatible LLM endpoint you configure, and posts review feedback back to the PR. It is useful if you already have API access, Ollama Cloud, a self-hosted model, or another provider subscription and do not want to be locked into one hosted review product.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why This Exists

I used several AI review tools, including Gemini-based reviewers, GitHub Copilot review, CodeRabbit-style review tools, and similar bots. They are useful, but I kept running into the same problem: usage limits, model restrictions, or vendor lock-in.

At the same time, I already had access to Ollama Cloud and other model APIs. The idea was simple: instead of waiting for someone else's quota or model choice, create a small reusable GitHub Action that can review PRs with any OpenAI-compatible model.

The core approach is the same principle used by many public AI reviewer prompts and instructions: collect the PR diff, ask a strong model for structured feedback, then post actionable findings back to GitHub. One of the references behind this idea was the [Superpowers code-reviewer agent](https://github.com/obra/superpowers/blob/main/agents/code-reviewer.md), which shows how useful a focused review prompt can be. This project packages that kind of workflow into a reusable GitHub Action.

## How It Works

At a high level:

1. A pull request is opened, updated, or manually requested with `/review`.
2. GitHub Actions starts this action in your repository.
3. The action posts a short “working on it” comment so the author knows the review started.
4. The action fetches the PR diff from GitHub.
5. The diff is sent to your configured LLM endpoint.
6. The model returns structured feedback: Critical, Important, Suggestions, and Summary.
7. The action posts a GitHub PR review with line comments when possible.

You control the endpoint, the API key, and the model.

## Why Use It?

| If you want | This gives you |
| --- | --- |
| Model choice | Use any OpenAI-compatible model |
| No review-tool quota | The action has no daily review limit of its own |
| Existing API usage | Use the provider or subscription you already pay for |
| Self-hosting | Use Ollama or another private endpoint |
| Simple setup | Add one workflow file and three secrets |
| Transparent cost | You pay GitHub Actions minutes and your LLM provider directly |

## Important Tradeoffs

This is not magic and it is not completely free in every setup.

| Tradeoff | What it means |
| --- | --- |
| GitHub Actions limits still apply | Private repos use your Actions minutes |
| LLM provider limits still apply | Your API provider can rate-limit or charge you |
| Review quality depends on the model | Smaller/faster models may miss deeper issues |
| Large PRs are harder | Very large diffs can be truncated or should be split |
| Privacy depends on your endpoint | Hosted APIs receive your diff; self-hosted endpoints keep it under your control |

## Cost And Limits

Universal Code Reviewer does not add a daily review quota. Your real limits are:

- GitHub Actions minutes.
- Your LLM provider billing and rate limits.
- Your model context window.
- The configured `max-diff-size`.

For private repositories, GitHub's free plan includes about 2,000 Actions minutes per month. If a full review run takes up to 10 minutes, that is roughly 200 review runs per month. Many reviews are faster than that, often around 1-2 minutes, but large PRs or slower self-hosted models can take longer.

For public repositories, GitHub-hosted Actions minutes are generally free. Your LLM/API usage still depends on the provider you choose.

## Quick Start

### 1. Choose Your LLM Provider

Use any provider with an OpenAI-compatible Chat Completions API.

| Provider | Base URL example | API key |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | OpenAI API key |
| Groq | `https://api.groq.com/openai/v1` | Groq API key |
| Together AI | `https://api.together.xyz/v1` | Together API key |
| Ollama Cloud | Ollama Cloud OpenAI-compatible URL | Ollama Cloud key |
| Self-hosted Ollama | `http://your-server:11434/v1` | Use `ollama` |
| Custom endpoint | Your OpenAI-compatible URL | Your API key |

GitHub-hosted runners cannot reach `localhost` on your laptop. If you use Ollama, run it on a reachable server, use a tunnel/private network, or use a self-hosted GitHub runner.

### 2. Add Secrets

In the repository where you want reviews, go to **Settings -> Secrets and variables -> Actions** and add:

| Secret | Required | Example |
| --- | --- | --- |
| `LLM_API_KEY` | Yes | `sk-...` or `ollama` |
| `LLM_BASE_URL` | Yes | `https://api.openai.com/v1` |
| `LLM_MODEL` | Yes | `gpt-4o`, `llama3.2`, `codellama:13b`, provider-specific model name |

The action does not recommend one default model. Choose the model that matches your budget, speed, and quality needs. For example, Ollama Cloud can be used with its OpenAI-compatible API and any model available in your Ollama account, but the workflow should still keep the model configurable through `LLM_MODEL`.

### 3. Add The Workflow

Create `.github/workflows/code-review.yml`:

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
        contains(github.event.comment.body, '/help')
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
          model: ${{ secrets.LLM_MODEL }}
          fail-on-critical: "false"
```

Open a PR or comment `/review` on an existing PR.

## Commands

Comment on a pull request:

| Command | Result |
| --- | --- |
| `/review` | Full review with Critical, Important, and Suggestion findings |
| `/summary` | Short explanation of what changed |
| `/help` | List available commands |

There is no `@code-reviewer` trigger. That looks like a GitHub username mention and can notify or reference the wrong account. Slash commands are clearer and safer.

## Usage Variations

### Automatic Review On Every PR

Use the Quick Start workflow. This is best when you want every PR reviewed automatically.

### Manual Review Only

Use this if you want to reduce cost and only run reviews when requested.

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
        contains(github.event.comment.body, '/help')
      )
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: antongulin/universal-code-reviewer@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
          llm-base-url: ${{ secrets.LLM_BASE_URL }}
          model: ${{ secrets.LLM_MODEL }}
```

Then comment:

```text
/review
```

### Strict Mode

Fail the workflow when critical issues are found:

```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  llm-api-key: ${{ secrets.LLM_API_KEY }}
  llm-base-url: ${{ secrets.LLM_BASE_URL }}
  model: ${{ secrets.LLM_MODEL }}
  fail-on-critical: "true"
```

### Different Model Per Repository

Use organization secrets for `LLM_API_KEY` and `LLM_BASE_URL`, then set `LLM_MODEL` differently per repo.

```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  llm-api-key: ${{ secrets.LLM_API_KEY }}
  llm-base-url: ${{ secrets.LLM_BASE_URL }}
  model: "codellama:70b"
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | Yes | `${{ github.token }}` | Token used to read PRs and post reviews |
| `llm-api-key` | No | `ollama` | API key for your LLM endpoint |
| `api-key` | No | empty | Alias for `llm-api-key` |
| `llm-base-url` | Yes | none | OpenAI-compatible API base URL |
| `base-url` | No | empty | Alias for `llm-base-url` |
| `model` | Yes | none | Model name sent to the provider |
| `fail-on-critical` | No | `false` | Fails the workflow if critical issues are found |
| `max-diff-size` | No | `50000` | Maximum diff characters sent to the model |

## Model Selection

There is no universal best model. Use a fast model for summaries and smaller PRs; use a stronger model for security-sensitive or architecture-heavy reviews.

| Model type | Good for | Tradeoff |
| --- | --- | --- |
| Fast hosted model | Quick feedback | May miss deeper issues |
| Strong hosted model | Better reasoning | Higher token cost |
| Small self-hosted model | Low cost and privacy | Lower review quality |
| Large self-hosted model | Better private reviews | Requires more hardware |

Examples people may try: `gpt-4o`, `deepseek-coder`, `codellama:13b`, `codellama:70b`, `llama3.2`, Ollama Cloud models, or other provider-specific model names.

## Self-Hosting

Self-hosting is useful when privacy or provider independence matters.

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

That works only from the same machine. GitHub Actions needs a reachable URL.

| Option | Best for | Notes |
| --- | --- | --- |
| VPS or dedicated server | Stable team usage | Run Ollama on a server and point `LLM_BASE_URL` to it |
| Self-hosted GitHub runner | Maximum privacy | Runner and Ollama can live on the same private network |
| Tailscale | Private networking | Useful when the runner can reach your Tailnet |
| Cloudflare Tunnel | Quick testing | Public tunnel URL; protect it carefully |

## Security And Privacy

The action sends PR diffs to the LLM endpoint you configure.

| Setup | Where code goes |
| --- | --- |
| OpenAI, Groq, Together, or another hosted API | To that provider |
| Ollama Cloud | To Ollama Cloud |
| Self-hosted Ollama on your server | To your server |
| Self-hosted GitHub runner plus local model | Stays inside your infrastructure |

Recommended practices:

- Store API keys in GitHub Secrets.
- Use least-privilege workflow permissions.
- Review your provider's data retention policy before using it on private code.
- Avoid `pull_request_target` unless you understand the security implications.
- Split very large PRs for better review quality.

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| `Connection refused` | GitHub cannot reach your LLM endpoint | Use a reachable server, tunnel, or self-hosted runner |
| `Input required and not supplied: model` | `LLM_MODEL` is missing | Add the `LLM_MODEL` secret or set `model` directly |
| `Empty response from LLM` | Model is missing or provider returned no content | Pull/load the model and check provider logs |
| `Invalid API key` | Wrong secret value | For local Ollama, use `ollama`; for hosted APIs, use the real key |
| No comments appear | Missing workflow permissions | Add `pull-requests: write` and `issues: write` |
| Slash commands do nothing | Workflow `if` condition does not include the command | Use the workflow from this README |
| Review is too shallow | Model is too small or diff was truncated | Use a stronger model or increase `max-diff-size` |

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

### Current

- GitHub Action for OpenAI-compatible LLM review.
- Automatic PR review on open/update.
- Slash commands: `/review`, `/summary`, `/help`.
- Started/finished status comments so users know the action is running.
- Line-level comments when findings can be mapped to the diff.

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
