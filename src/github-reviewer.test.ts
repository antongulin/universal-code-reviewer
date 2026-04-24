import { GitHubReviewer } from "./github-reviewer";

describe("GitHubReviewer", () => {
  it("maps new-file line numbers to GitHub diff positions", () => {
    const reviewer = new GitHubReviewer({} as any);
    const mapLineToPosition = (reviewer as any).mapLineToPosition.bind(reviewer) as (
      patch: string,
      targetLine: number
    ) => number | null;

    const patch = [
      "@@ -1,3 +1,4 @@",
      " import value from './value';",
      "-const oldName = value;",
      "+const newName = value;",
      "+const enabled = true;",
      " export { newName };",
    ].join("\n");

    expect(mapLineToPosition(patch, 2)).toBe(4);
    expect(mapLineToPosition(patch, 3)).toBe(5);
    expect(mapLineToPosition(patch, 4)).toBe(6);
    expect(mapLineToPosition(patch, 99)).toBeNull();
  });
});
