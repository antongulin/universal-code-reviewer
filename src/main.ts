import * as core from "@actions/core";
import * as github from "@actions/github";
import { LLMClient } from "./llm-client";
import { GitUtils } from "./git-utils";
import { ReviewParser } from "./review-parser";
import { GitHubReviewer } from "./github-reviewer";
import { getReviewPrompt, getSummaryPrompt, getHelpMessage } from "./prompts/review-prompts";
import { ReviewerCommand, hasRequiredPermission, parseSlashCommand } from "./commands";

async function run(): Promise<void> {
  try {
    const eventName = github.context.eventName;
    const payload = github.context.payload;
    const token = core.getInput("github-token", { required: true });
    const octokit = github.getOctokit(token);
    const minCommandPermission = core.getInput("min-command-permission") || "write";

    core.info(`Event: ${eventName}`);

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    let shouldRun = false;
    let prNumber: number | undefined;
    let command: ReviewerCommand = "review"; // default command for PR events

    if (eventName === "pull_request_target") {
      core.warning("pull_request_target is intentionally not supported because it can expose secrets to untrusted PR code. Use pull_request or maintainer-only issue_comment commands instead.");
      return;
    }

    if (eventName === "pull_request") {
      shouldRun = true;
      prNumber = payload.pull_request?.number;
    } else if (eventName === "issue_comment") {
      const commentBody: string = payload.comment?.body || "";

      if (!payload.issue?.pull_request) {
        core.info("Issue comment is not on a pull request. Skipping.");
        return;
      }

      if (payload.comment?.user?.type === "Bot") {
        core.info("Ignoring bot comment.");
        return;
      }

      const parsedCommand = parseSlashCommand(commentBody);
      if (!parsedCommand) {
        core.info("No supported slash command found. Skipping.");
        return;
      }

      const commentAuthor = payload.comment?.user?.login;
      const authorized = await isAuthorizedCommenter(
        octokit,
        owner,
        repo,
        commentAuthor,
        minCommandPermission
      );

      if (!authorized) {
        core.warning(
          `Ignoring /${parsedCommand} from ${commentAuthor || "unknown user"}; minimum permission is ${minCommandPermission}.`
        );
        return;
      }

      command = parsedCommand;
      prNumber = payload.issue.number;

      if (command === "help") {
        await postHelpComment(octokit, payload);
        return;
      }

      shouldRun = true;
    }

    if (!shouldRun || !prNumber) {
      core.info("No matching trigger found. Skipping.");
      return;
    }

    const apiKey = core.getInput("llm-api-key") || core.getInput("api-key") || "ollama";
    const baseUrl = core.getInput("llm-base-url") || core.getInput("base-url") || "";
    const model = core.getInput("model", { required: true });
    const failOnCritical = core.getInput("fail-on-critical") === "true";
    const maxDiffSize = parseInt(core.getInput("max-diff-size") || "50000", 10);
    const maxComments = parseInt(core.getInput("max-comments") || "25", 10);
    const inlineReviewInstructions = core.getInput("review-instructions") || "";
    const reviewInstructionsFile = core.getInput("review-instructions-file") || "";

    if (!baseUrl) {
      throw new Error("Input required and not supplied: llm-base-url");
    }

    core.info(`Model: ${model}`);

    core.info(`Running /${command} on PR #${prNumber} in ${owner}/${repo}`);
    const statusCommentId = await postStartedComment(octokit, owner, repo, prNumber, command, model);

    const gitUtils = new GitUtils(octokit as any);
    const diff = await gitUtils.getPullRequestDiff(owner, repo, prNumber);
    
    if (!diff || diff.trim().length === 0) {
      core.warning("No diff found for this PR.");
      return;
    }

    const truncatedDiff = diff.length > maxDiffSize 
      ? diff.slice(0, maxDiffSize) + "\n\n[... Diff truncated due to size limit]"
      : diff;

    core.info(`Diff size: ${diff.length} chars${diff.length > maxDiffSize ? " (truncated)" : ""}`);
    const reviewInstructions = command === "review"
      ? await loadReviewInstructions(
        octokit,
        gitUtils,
        owner,
        repo,
        prNumber,
        inlineReviewInstructions,
        reviewInstructionsFile
      )
      : "";

    const llm = new LLMClient(baseUrl, apiKey, model);
    
    let reviewText: string;
    if (command === "summary") {
      reviewText = await runSummary(llm, truncatedDiff);
    } else {
      reviewText = await runReview(llm, truncatedDiff, reviewInstructions);
    }

    if (command === "summary") {
      // Post summary as a regular comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: reviewText,
      });
      await updateStatusComment(octokit, owner, repo, statusCommentId, "summary");
    } else {
      // Full review parsed and posted as a review
      core.info("Parsing review response...");
      const findings = ReviewParser.parse(reviewText);

      core.info(`Found ${findings.critical.length} critical, ${findings.important.length} important, ${findings.suggestions.length} suggestions`);

      const reviewer = new GitHubReviewer(octokit as any, maxComments);
      await reviewer.postReview(owner, repo, prNumber, findings);
      await updateStatusComment(octokit, owner, repo, statusCommentId, "review");

      if (findings.critical.length > 0 && failOnCritical) {
        core.setFailed(`Found ${findings.critical.length} critical issue(s). Failing check.`);
      }
    }

    core.info("Done.");

  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function loadReviewInstructions(
  octokit: any,
  gitUtils: GitUtils,
  owner: string,
  repo: string,
  prNumber: number,
  inlineInstructions: string,
  instructionsFile: string
): Promise<string> {
  const instructions = inlineInstructions.trim() ? [inlineInstructions.trim()] : [];
  const filePath = instructionsFile.trim();

  if (filePath) {
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const fileInstructions = await gitUtils.getFileContent(owner, repo, filePath, pullRequest.base.sha);
    if (fileInstructions.trim()) {
      core.info(`Loaded reviewer instructions from ${filePath}`);
      instructions.push(`Instructions from ${filePath}:\n${fileInstructions.trim()}`);
    }
  }

  return instructions.join("\n\n");
}

async function isAuthorizedCommenter(
  octokit: any,
  owner: string,
  repo: string,
  username: string | undefined,
  minCommandPermission: string
): Promise<boolean> {
  if (!username) return false;

  try {
    const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    return hasRequiredPermission(data.permission, minCommandPermission);
  } catch (error) {
    core.warning(`Could not verify permissions for ${username}: ${error}`);
    return false;
  }
}

async function postStartedComment(
  octokit: any,
  owner: string,
  repo: string,
  issueNumber: number,
  command: string,
  model: string
): Promise<number | undefined> {
  try {
    const action = command === "summary" ? "summary" : "code review";
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: [
        "Universal Code Reviewer is working on this pull request.",
        "",
        `Mode: ${action}`,
        `Model: ${model}`,
      ].join("\n"),
    });
    return data.id;
  } catch (error) {
    core.warning(`Could not post started comment: ${error}`);
    return undefined;
  }
}

async function updateStatusComment(
  octokit: any,
  owner: string,
  repo: string,
  commentId: number | undefined,
  command: "review" | "summary"
): Promise<void> {
  if (!commentId) return;

  try {
    const result = command === "summary" ? "summary" : "review";
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: `Universal Code Reviewer finished the ${result}.`,
    });
  } catch (error) {
    core.warning(`Could not update status comment: ${error}`);
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

async function runReview(llm: LLMClient, diff: string, reviewInstructions: string): Promise<string> {
  const systemPrompt = getReviewPrompt(reviewInstructions);
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
    "Review the following code diff and return only the strict JSON object described in the system prompt.",
    "Use line numbers from the new side of the diff for line-specific findings.",
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
