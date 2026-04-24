import { Octokit } from "@octokit/rest";
import { execSync } from "child_process";

export class GitUtils {
  private octokit: Octokit;
  private token: string;

  constructor(octokit: Octokit, token: string) {
    this.octokit = octokit;
    this.token = token;
  }

  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    try {
      // Use GitHub API to get diff
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github.v3.diff",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const diff = await response.text();
      return diff;
    } catch (error) {
      // Fallback: use git command if available
      try {
        const baseRef = await this.getBaseRef(owner, repo, pullNumber);
        const headRef = await this.getHeadRef(owner, repo, pullNumber);
        
        if (baseRef && headRef) {
          execSync(`git fetch origin ${baseRef} ${headRef}`, { stdio: "pipe" });
          const diff = execSync(`git diff ${baseRef}...${headRef}`, { encoding: "utf-8" });
          return diff;
        }
      } catch {
        // ignore fallback errors
      }
      
      throw error;
    }
  }

  private async getBaseRef(owner: string, repo: string, pullNumber: number): Promise<string | undefined> {
    try {
      const { data } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
      return data.base.ref;
    } catch {
      return undefined;
    }
  }

  private async getHeadRef(owner: string, repo: string, pullNumber: number): Promise<string | undefined> {
    try {
      const { data } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
      return data.head.ref;
    } catch {
      return undefined;
    }
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
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
    } catch {
      return "";
    }
  }
}
