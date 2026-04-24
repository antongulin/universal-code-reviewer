import { Octokit } from "@octokit/rest";
import { StructuredReview } from "./review-parser";
export declare class GitHubReviewer {
    private octokit;
    private maxComments;
    constructor(octokit: Octokit, maxComments?: number);
    postReview(owner: string, repo: string, pullNumber: number, findings: StructuredReview): Promise<void>;
    /**
     * Build separate line-level comments for each finding that can be mapped to a line.
     * Each comment appears as an individual thread the repo owner can reply to and resolve.
     */
    private buildReviewComments;
    private formatCommentBody;
    /**
     * Build a concise summary body. Findings are shown here ONLY if they
     * could not be mapped to individual line comments.
     */
    private buildReviewBody;
    private formatUnpostedFinding;
    /**
     * Map a file line number to the diff position GitHub expects.
     * Position is the 1-based index from the first @@ hunk header.
     */
    private mapLineToPosition;
}
//# sourceMappingURL=github-reviewer.d.ts.map