# Universal Code Reviewer

> 🤖 AI-powered code reviews using **any** LLM you choose. Bring your own API key — no vendor lock-in, no usage quotas.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

This GitHub Action brings intelligent code review to your pull requests — powered by **your choice of LLM**. Connect any OpenAI-compatible API endpoint (Ollama, OpenAI, Together AI, Groq, or your own self-hosted model) and get structured, high-quality reviews on every PR.

**Key difference from SaaS code review tools:** You control the model, the infrastructure, and the budget. There are **no hard limits** on how many PRs you can review — only what your API provider or self-hosted hardware supports.

---

## Comparison with Gemini Code Assist

| Feature | **Universal Code Reviewer** | Gemini Code Assist (Consumer) |
|---|---|---|
| **PR reviews/day** | **Unlimited** (your API, your limits) | 33/day hard limit |
| **Model** | **Your choice** (any OpenAI-compatible) | Fixed to Gemini 2.5 |
| **Privacy** | **Code stays with you** (self-hosted option) | Sent to Google |
| **Vendor lock-in** | **None** | Google ecosystem |
| **Cost** | **Pay your provider directly** (or self-host for free) | Free tier with limits |
| **Enterprise PRs/day** | **Unlimited** (same as consumer) | 100+/day |
| **Setup** | Workflow + 3 secrets | Install GitHub App |
| **Line comments** | Yes | Yes |
| **Slash commands** | `/review`, `/summary`, `/help` | `/gemini` |

> **Gemini Code Assist** is a great product with generous free limits, but if you hit the 33 PR/day cap, need a different model, or want full control over your data, this action gives you those options.

---

## Quick Start

### Step 1: Choose Your LLM Provider

#### Option A: Ollama (Self-hosted, fully private)

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull a code-capable model
ollama pull kimi-k2.6

# Start the server
ollama serve
```

API endpoint: `http://localhost:11434/v1` (or your server IP)

#### Option B: OpenAI

Sign up at [platform.openai.com](https://platform.openai.com), create an API key.

Base URL: `https://api.openai.com/v1`

#### Option C: Together AI / AnyScale / Groq / others

Any provider with an OpenAI-compatible Chat Completions API works. Just set the `base-url` and `api-key`.

### Step 2: Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your repo:

| Secret name | Value example | Required? |
|---|---|---|
| `LLM_API_KEY` | `sk-abc123...` | **Yes** (use `"ollama"` for self-hosted) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` or `http://your-server:11434/v1` | **Yes** |
| `LLM_MODEL` | `gpt-4o` or `kimi-k2.6:cloud` or `codellama:13b` | **Optional** (defaults to `kimi-k2.6:cloud`) |

> **Tip:** Set these as **organization secrets** to use across all repos in your org.

### Step 3: Add Workflow

Create `.github/workflows/code-review.yml`:

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  review:
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@code-reviewer'))
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

---

## Slash Commands

Trigger reviews or summaries by commenting on a pull request:

| Command | Description |
|---|---|
| `/review` | Full code review with Critical / Important / Suggestion tiers |
| `/summary` | Concise overview of what changed and why |
| `/help` | List all available commands |
| `@code-reviewer` | Alias for `/review` |

### Examples

```
/review

/summary

Can you check the auth logic? @code-reviewer
```

---

## Configuration

### Inputs

| Input | Description | Default |
|---|---|---|
| `github-token` | GitHub token for posting review comments | `GITHUB_TOKEN` |
| `llm-api-key` | API key for your LLM endpoint | `"ollama"` |
| `llm-base-url` | Base URL for OpenAI-compatible API | — |
| `model` | Model name for code review | `kimi-k2.6:cloud` |
| `trigger-on-mention` | Respond to `@code-reviewer` mentions | `true` |
| `fail-on-critical` | Fail the check if critical issues exist | `false` |
| `max-diff-size` | Max diff size in chars before truncation | `50000` |

### Per-Repo Model Override

Even with org-level secrets, you can override per repo:

```yaml
- uses: antongulin/universal-code-reviewer@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    llm-api-key: ${{ secrets.LLM_API_KEY }}
    llm-base-url: ${{ secrets.LLM_BASE_URL }}
    model: "codellama:70b"  # Different model just for this repo
```

---

## Model Recommendations

| Model | Provider | Best for | Speed |
|---|---|---|---|
| `kimi-k2.6:cloud` | Ollama Cloud | Deep reasoning, architecture, security | Medium |
| `gpt-4o` | OpenAI | Balanced quality and speed | Fast |
| `codellama:13b` | Ollama | Fast, solid code review | Fast |
| `codellama:70b` | Ollama | Maximum quality | Slow |
| `deepseek-coder` | Ollama / API | Excellent code-specific reasoning | Fast |
| `llama3.2` | Ollama | Ultra-fast lightweight screening | Very fast |

---

## How It Works

1. **Trigger:** PR opened/synchronize OR slash command / mention
2. **Fetch diff:** Gets PR diff via GitHub API
3. **Prompt:** Wraps diff in structured system prompt
4. **LLM call:** Sends to your endpoint with `temperature: 0.1` (focused output)
5. **Parse:** Structures response into Critical / Important / Suggestion tiers
6. **Post:** GitHub Review API creates a review + line-level comments

---

## Self-Hosting Guide

### Expose Your Local LLM to GitHub Actions

GitHub Actions can't reach `localhost`. Options:

#### Tailscale (Private, zero-config)

```bash
sudo tailscale up
tailscale status  # get IP like 100.x.y.z
```

Set `LLM_BASE_URL` to `http://100.x.y.z:11434/v1`.

#### Cloudflare Tunnel (Free, public)

```bash
cloudflared tunnel --url http://localhost:11434
```

Use the generated URL as `LLM_BASE_URL`.

#### VPS / Dedicated Server

Run Ollama on any server (Hetzner, DigitalOcean, etc.) and point `LLM_BASE_URL` to it.

---

## Development

```bash
git clone https://github.com/antongulin/universal-code-reviewer.git
cd universal-code-reviewer
npm install
npm run build
```

---

## Who Pays for What?

This action is **completely free** — there is no charge from the action publisher. Your costs are determined by your own infrastructure choices:

### GitHub Actions Minutes (You → GitHub)

The GitHub account or organization that **installs the workflow** pays for Actions minutes:

| Repo Type | Action Runs Cost |
|---|---|
| **Public repositories** | **Free and unlimited** |
| **Private repositories** | Counts against your GitHub plan's minutes (see below) |

This action uses **~1-2 minutes per review**, so even on the free plan's 2,000 minutes/month, you get **1,000+ reviews per month** for private repos.

### LLM API Costs (You → Your Provider)

You pay your LLM provider directly (or nothing if self-hosted):

| Provider | Cost | Notes |
|---|---|---|
| **Self-hosted Ollama** | **Free** | You supply the hardware (your laptop, VPS, or server) |
| **Ollama Cloud** | Pay per token | Check [ollama.com/pricing](https://ollama.com/pricing) |
| **OpenAI** | Pay per token | [platform.openai.com/pricing](https://platform.openai.com/pricing) |
| **Together AI / AnyScale** | Pay per token | Usually cheaper than OpenAI |
| **Groq** | Pay per token | Very fast, competitive pricing |

### Comparison: Total Cost of Ownership

| | Gemini Code Assist (Consumer) | **Universal Code Reviewer** |
|---|---|---|
| **Action cost** | Free (Google pays GitHub for their app) | Free (you pay your own GitHub minutes) |
| **LLM cost** | Free (Google covers it) | You pay your provider (or self-host for free) |
| **Reviews/day** | 33 hard limit | Unlimited |
| **Lock-in** | Must use Gemini | Use any model, switch anytime |
| **Data privacy** | Code sent to Google | Code goes only where you send it |

**Bottom line:** If you self-host Ollama on your own hardware, your total cost is **$0**. If you use a cloud LLM, your cost is whatever that provider charges — with no markup from this action.

---

## GitHub Actions Limits (Private Repos Only)

For private repositories, GitHub Actions has monthly minute quotas:

| Plan | Storage | Minutes/month |
|---|---|---|
| Free | 500 MB | 2,000 |
| Pro | 1 GB | 3,000 |
| Team | 2 GB | 50,000 |
| Enterprise | 50 GB | 50,000 |

**This action uses ~1-2 minutes per review**, so even the free tier gives you **1,000+ reviews/month** — far more than Gemini's 33/day consumer limit. The bottleneck is your LLM provider, not GitHub Actions.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| "Empty response from LLM" | Model not loaded | Run `ollama pull <model>` on the server |
| "Connection refused" | LLM not accessible | Verify `LLM_BASE_URL` and firewall rules |
| "Invalid API key" | Wrong key format | For self-hosted Ollama, use `"ollama"` (literal string) |
| Reviews not showing | Token permissions | Ensure workflow has `pull-requests: write` |
| "Diff too large" | PR has huge changes | Increase `max-diff-size` or split the PR |

---

## Contributing

PRs and issues are welcome! Improvements to prompts, new slash commands, or support for additional LLM providers are especially appreciated.

---

## License

MIT
