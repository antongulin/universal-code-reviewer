"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubReviewer = void 0;
const core = __importStar(require("@actions/core"));
class GitHubReviewer {
    octokit;
    maxComments;
    constructor(octokit, maxComments = 25) {
        this.octokit = octokit;
        this.maxComments = Number.isFinite(maxComments) ? Math.max(0, maxComments) : 25;
    }
    async postReview(owner, repo, pullNumber, findings) {
        try {
            core.info("Posting review to PR #" + pullNumber + "...");
            // Fetch file patches to map line positions
            const files = await this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
                owner,
                repo,
                pull_number: pullNumber,
                per_page: 100,
            });
            // Build line-level comments from findings
            const { comments, postedFindings } = this.buildReviewComments(findings, files);
            // Build the review summary body (high-level)
            const body = this.buildReviewBody(findings, postedFindings);
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
            core.info("Posted review #" + review.id + " with " + comments.length + " individual line comments");
        }
        catch (error) {
            core.error("Failed to post review: " + error);
            throw error;
        }
    }
    /**
     * Build separate line-level comments for each finding that can be mapped to a line.
     * Each comment appears as an individual thread the repo owner can reply to and resolve.
     */
    buildReviewComments(findings, files) {
        const comments = [];
        const postedFindings = new Set();
        // Combine all findings
        const allFindings = [
            ...findings.critical,
            ...findings.important,
            ...findings.suggestions,
        ];
        for (const finding of allFindings) {
            if (comments.length >= this.maxComments) {
                core.info(`Reached max-comments limit (${this.maxComments}); remaining findings will stay in the review body.`);
                break;
            }
            // Need both file and line to post a line comment
            if (!finding.file || !finding.line)
                continue;
            const diffFile = files.find((f) => f.filename === finding.file);
            if (!diffFile) {
                core.warning("Could not find diff for file: " + finding.file);
                continue;
            }
            const position = this.mapLineToPosition(diffFile.patch || "", finding.line);
            if (!position) {
                core.warning("Could not map line " + finding.line + " to diff position for file: " + finding.file);
                continue;
            }
            const commentBody = this.formatCommentBody(finding);
            comments.push({
                path: finding.file,
                position,
                body: commentBody,
            });
            postedFindings.add(finding);
        }
        return { comments, postedFindings };
    }
    formatCommentBody(finding) {
        const severityEmoji = finding.severity === "critical"
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
    buildReviewBody(findings, postedFindings) {
        const parts = [];
        parts.push("## :robot: Code Review");
        parts.push("");
        // Stats summary
        const statBlocks = [];
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
        // Add findings that were not posted inline because they had no line, mapping failed,
        // or the max-comments limit was reached.
        const unpostedFindings = [
            ...findings.critical,
            ...findings.important,
            ...findings.suggestions,
        ].filter((f) => !postedFindings.has(f));
        if (unpostedFindings.length > 0) {
            parts.push("");
            parts.push("---");
            parts.push("### :page_facing_up: Findings Not Posted Inline");
            for (let i = 0; i < unpostedFindings.length; i++) {
                parts.push("");
                parts.push(this.formatUnpostedFinding(i + 1, unpostedFindings[i]));
            }
        }
        parts.push("");
        parts.push("---");
        parts.push("*Reviews powered by [Universal Code Reviewer](https://github.com/antongulin/universal-code-reviewer)*");
        return parts.join("\n");
    }
    formatUnpostedFinding(index, finding) {
        const line = finding.line ? ":" + finding.line : "";
        const location = finding.file ? " (`" + finding.file + line + "`)" : "";
        let result = finding.severity === "critical"
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
    mapLineToPosition(patch, targetLine) {
        if (!patch)
            return null;
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
            }
            else if (line.startsWith("-")) {
                // Removed line — does not exist in new file, keep position but don't count line
            }
            else {
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
exports.GitHubReviewer = GitHubReviewer;
//# sourceMappingURL=github-reviewer.js.map