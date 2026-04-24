"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitUtils = void 0;
class GitUtils {
    octokit;
    constructor(octokit) {
        this.octokit = octokit;
    }
    async getPullRequestDiff(owner, repo, pullNumber) {
        const response = await this.octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
            owner,
            repo,
            pull_number: pullNumber,
            headers: {
                accept: "application/vnd.github.v3.diff",
            },
        });
        return String(response.data);
    }
    async getFileContent(owner, repo, path, ref) {
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path,
                ref,
            });
            if ("content" in data) {
                return Buffer.from(data.content, "base64").toString("utf-8");
            }
            return "";
        }
        catch {
            return "";
        }
    }
}
exports.GitUtils = GitUtils;
//# sourceMappingURL=git-utils.js.map