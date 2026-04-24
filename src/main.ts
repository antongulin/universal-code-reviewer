import * as core from "@actions/core";
import * as github from "@actions/github";
import { LLMClient } from "./llm-client";
import { GitUtils } from "./git-utils";
import { ReviewParser } from "./review-parser";
import { GitHubReviewer } from "./github-reviewer";
import { getReviewPrompt, getSummaryPrompt, getHelpMessage } from "./prompts/review-prompts";

interface SlashCommand {
  command: string;
  description: string;
}

const AVAILABLE_COMMANDS: SlashCommand[] = [
  { command: "/review", description: "Posts a full code review of the pull request" },
  { command: "/summary", description: "Posts a summary of the changes in the pull request" },
  { command: "/help", description: "Shows available commands" },
];

async function run(): Promise<void> {
  try {
    const eventName = github.context.eventName;
    const payload = github.context.payload;
    const token = core.getInput("github-token", { required: true });
    const octokit = github.getOctokit(token);

    const apiKey = core.getInput("llm-api-key") || core.getInput("api-key") || "ollama";
    const baseUrl = core.getInput("llm-base-url") || core.getInput("base-url") || "";
    const model = core.getInput("model", { required: true });
    const triggerOnMention = core.getInput("trigger-on-mention") === "true";
    const failOnCritical = core.getInput("fail-on-critical") === "true";
    const maxDiffSize = parseInt(core.getInput("max-diff-size") || "50000", 10);

    core.info(`Event: ${eventName}`);
    core.info(`Model: ${model}`);

    let shouldRun = false;
    let prNumber: number | undefined;
    let command = "review"; // default command for PR events

    if (eventName === "pull_request" || eventName === "pull_request_target") {
      shouldRun = true;
      prNumber = payload.pull_request?.number;
    } else if (eventName === "issue_comment") {
      const commentBody: string = payload.comment?.body || "";
      
      // Detect slash commands
      if (commentBody.includes("/help")) {
        await postHelpComment(octokit, payload);
        return;
      } else if (commentBody.includes("/review")) {
        command = "review";
        shouldRun = true;
      } else if (commentBody.includes("/summary")) {
        command = "summary";
        shouldRun = true;
      } else if (triggerOnMention && commentBody.includes("@code-reviewer")) {
        // Legacy @mention falls back to full review
        command = "review";
        shouldRun = true;
      }
      
      if (shouldRun) {
        prNumber = payload.issue?.number;
      }
    }

    if (!shouldRun || !prNumber) {
      core.info("No matching trigger found. Skipping.");
      return;
    }

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    core.info(`Running /${command} on PR #${prNumber} in ${owner}/${repo}`);

    const gitUtils = new GitUtils(octokit as any, token);
    const diff = await gitUtils.getPullRequestDiff(owner, repo, prNumber);
    
    if (!diff || diff.trim().length === 0) {
      core.warning("No diff found for this PR.");
      return;
    }

    const truncatedDiff = diff.length > maxDiffSize 
      ? diff.slice(0, maxDiffSize) + "\n\n[... Diff truncated due to size limit]"
      : diff;

    core.info(`Diff size: ${diff.length} chars${diff.length > maxDiffSize ? " (truncated)" : ""}`);

    const llm = new LLMClient(baseUrl, apiKey, model);
    
    let reviewText: string;
    if (command === "summary") {
      reviewText = await runSummary(llm, truncatedDiff);
    } else {
      reviewText = await runReview(llm, truncatedDiff);
    }

    if (command === "summary") {
      // Post summary as a regular comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: reviewText,
      });
    } else {
      // Full review parsed and posted as a review
      core.info("Parsing review response...");
      const findings = ReviewParser.parse(reviewText);

      core.info(`Found ${findings.critical.length} critical, ${findings.important.length} important, ${findings.suggestions.length} suggestions`);

      const reviewer = new GitHubReviewer(octokit as any);
      await reviewer.postReview(owner, repo, prNumber, findings);

      if (findings.critical.length > 0 && failOnCritical) {
        core.setFailed(`Found ${findings.critical.length} critical issue(s). Failing check.`);
      }
    }

    core.info("Done.");

  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function postHelpComment(octokit: any, payload: any): Promise<void> {
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const issueNumber = payload.issue?.number;

  if (!issueNumber) return;

  const helpBody = getHelpMessage();
  
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: helpBody,
  });

  core.info("Posted help comment.");
}

async function runReview(llm: LLMClient, diff: string): Promise<string> {
  const systemPrompt = getReviewPrompt();
  const userContent = buildReviewInput(diff);
  core.info("Getting full code review...");
  return await llm.chatCompletion(systemPrompt, userContent);
}

async function runSummary(llm: LLMClient, diff: string): Promise<string> {
  const systemPrompt = getSummaryPrompt();
  const userContent = buildSummaryInput(diff);
  core.info("Getting PR summary...");
  return await llm.chatCompletion(systemPrompt, userContent);
}

function buildReviewInput(diff: string): string {
  return [
    "Please review the following code diff and provide structured feedback.",
    "Format your response with these sections:",
    "## Critical Issues (must fix)",
    "## Important Issues (should fix)",
    "## Suggestions (nice to have)",
    "## Summary",
    "---",
    "CODE DIFF:",
    "```diff",
    diff,
    "```",
  ].join("\n");
}

function buildSummaryInput(diff: string): string {
  return [
    "Summarize the following pull request diff. Provide:",
    "1. High-level overview of what changed",
    "2. Key files affected",
    "3. Any notable patterns or patterns that could be improved",
    "Be concise but informative.",
    "---",
    "CODE DIFF:",
    "```diff",
    diff,
    "```",
  ].join("\n");
}

run();
