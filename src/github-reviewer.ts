import { Octokit } from "@octokit/rest";
import * as core from "@actions/core";
import { StructuredReview, ReviewFinding } from "./review-parser";

export class GitHubReviewer {
  private octokit: Octokit;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  async postReview(
    owner: string,
    repo: string,
    pullNumber: number,
    findings: StructuredReview
  ): Promise<void> {
    try {
      core.info("Posting review to PR #" + pullNumber + "...");

      // Fetch file patches to map line positions
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });

      // Build line-level comments from findings
      const comments = this.buildReviewComments(findings, files);

      // Build the review summary body (high-level)
      const body = this.buildReviewBody(findings);
      
      // Determine review event type
      const event = findings.critical.length > 0 ? "REQUEST_CHANGES" : "COMMENT";
      
      const { data: review } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        event,
        comments,
      });

      core.info(
        "Posted review #" + review.id + " with " + comments.length + " individual line comments"
      );

    } catch (error) {
      core.error("Failed to post review: " + error);
      throw error;
    }
  }

  /**
   * Build separate line-level comments for each finding that can be mapped to a line.
   * Each comment appears as an individual thread the repo owner can reply to and resolve.
   */
  private buildReviewComments(findings: StructuredReview, files: any[]): any[] {
    const comments: any[] = [];

    // Combine all findings
    const allFindings = [
      ...findings.critical,
      ...findings.important,
      ...findings.suggestions,
    ];

    for (const finding of allFindings) {
      // Need both file and line to post a line comment
      if (!finding.file || !finding.line) continue;

      const diffFile = files.find((f: any) => f.filename === finding.file);
      if (!diffFile) {
        core.warning("Could not find diff for file: " + finding.file);
        continue;
      }

      const position = this.mapLineToPosition(diffFile.patch || "", finding.line);
      if (!position) {
        core.warning(
          "Could not map line " + finding.line + " to diff position for file: " + finding.file
        );
        continue;
      }

      let commentBody = this.formatCommentBody(finding);

      comments.push({
        path: finding.file,
        position,
        body: commentBody,
      });
    }

    return comments;
  }

  private formatCommentBody(finding: ReviewFinding): string {
    const severityEmoji =
      finding.severity === "critical"
        ? ":x: CRITICAL"
        : finding.severity === "important"
        ? ":warning: IMPORTANT"
        : ":bulb: SUGGESTION";

    let body = severityEmoji + "\n\n" + finding.description;

    if (finding.recommendation) {
      body += "\n\n**Recommendation:** " + finding.recommendation;
    }

    if (finding.codeSnippet) {
      body += "\n\n```\n" + finding.codeSnippet + "\n```";
    }

    return body;
  }

  /**
   * Build a concise summary body. Findings are shown here ONLY if they
   * could not be mapped to individual line comments.
   */
  private buildReviewBody(findings: StructuredReview): string {
    const parts: string[] = [];

    parts.push("## :robot: Code Review");
    parts.push("");

    // Stats summary
    const statBlocks: string[] = [];
    if (findings.critical.length > 0) {
      statBlocks.push(":x: **" + findings.critical.length + " Critical**");
    }
    if (findings.important.length > 0) {
      statBlocks.push(":warning: **" + findings.important.length + " Important**");
    }
    if (findings.suggestions.length > 0) {
      statBlocks.push(":bulb: **" + findings.suggestions.length + " Suggestions**");
    }
    if (statBlocks.length === 0) {
      statBlocks.push(":white_check_mark: **No issues found**");
    }
    parts.push(statBlocks.join(" | "));

    // Overall summary from the model
    if (findings.summary) {
      parts.push("");
      parts.push("### Summary");
      parts.push(findings.summary);
    }

    // Add any "orphan" findings that could not be mapped to lines
    const orphanFindings = [
      ...findings.critical,
      ...findings.important,
      ...findings.suggestions,
    ].filter((f) => !f.file || !f.line);

    if (orphanFindings.length > 0) {
      parts.push("");
      parts.push("---");
      parts.push("### :page_facing_up: General Findings (not linked to specific lines)");
      for (let i = 0; i < orphanFindings.length; i++) {
        parts.push("") ;
        parts.push(this.formatOrphanFinding(i + 1, orphanFindings[i]));
      }
    }

    parts.push("");
    parts.push("---");
    parts.push(
      "*Reviews powered by [Universal Code Reviewer](https://github.com/antongulin/universal-code-reviewer)*"
    );

    return parts.join("\n");
  }

  private formatOrphanFinding(index: number, finding: ReviewFinding): string {
    const location = finding.file ? " (`" + finding.file + "`)" : "";
    let result =
      finding.severity === "critical"
        ? ":x:"
        : finding.severity === "important"
        ? ":warning:"
        : ":bulb:";
    result += " **" + index + location + "** — " + finding.description;

    if (finding.recommendation) {
      result += "\n> " + finding.recommendation;
    }
    return result;
  }

  /**
   * Map a file line number to the diff position GitHub expects.
   * Position is the 1-based index from the first @@ hunk header.
   */
  private mapLineToPosition(patch: string, targetLine: number): number | null {
    if (!patch) return null;

    let position = 0;
    let currentLine = 0;
    let inHunk = false;

    for (const line of patch.split("\n")) {
      // Hunk header: parse the starting line number in the NEW file
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          // +N is the first line of this hunk in the new file
          currentLine = parseInt(match[1], 10);
        }
        inHunk = true;
        position++; // @@ line counts toward position in GitHub's diff
        continue;
      }

      if (!inHunk) {
        // Lines before the first hunk (shouldn't happen in patch)
        continue;
      }

      // "\ No newline at end of file" marker doesn't count
      if (line.startsWith("\\")) {
        position++;
        continue;
      }

      position++;

      if (line.startsWith("+")) {
        // Added line exists in the new file
        if (currentLine === targetLine) {
          return position;
        }
        currentLine++;
      } else if (line.startsWith("-")) {
        // Removed line — does not exist in new file, keep position but don't count line
      } else {
        // Context line — exists in both old and new file
        if (currentLine === targetLine) {
          return position;
        }
        currentLine++;
      }
    }

    return null;
  }
}
