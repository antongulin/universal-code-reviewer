import { Octokit } from "@octokit/rest";
export declare class GitUtils {
    private octokit;
    constructor(octokit: Octokit);
    getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string>;
    getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string>;
}
//# sourceMappingURL=git-utils.d.ts.map