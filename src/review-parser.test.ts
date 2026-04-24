import { ReviewParser } from "./review-parser";

describe("ReviewParser", () => {
  it("parses strict JSON review output", () => {
    const review = ReviewParser.parse(
      JSON.stringify({
        summary: "Good structure, but one risky auth path needs work.",
        critical: [
          {
            file: "src/auth.ts",
            line: 42,
            category: "security",
            description: "Missing authorization check before returning account data.",
            recommendation: "Check that the requester owns the account before returning it.",
            codeSnippet: "if (account.userId !== user.id) throw new Error('Forbidden');",
          },
        ],
        important: [],
        suggestions: [],
      })
    );

    expect(review.summary).toContain("Good structure");
    expect(review.critical).toHaveLength(1);
    expect(review.critical[0]).toMatchObject({
      severity: "critical",
      file: "src/auth.ts",
      line: 42,
      category: "security",
    });
  });

  it("parses JSON inside a code fence", () => {
    const review = ReviewParser.parse(`Here is the review:\n\n\`\`\`json
{
  "summary": "Looks safe overall.",
  "critical": [],
  "important": [
    {
      "file": "src/main.ts",
      "line": "12",
      "category": "reliability",
      "description": "Timeout errors are not handled.",
      "recommendation": "Catch timeout errors and retry once."
    }
  ],
  "suggestions": []
}
\`\`\``);

    expect(review.important).toHaveLength(1);
    expect(review.important[0].line).toBe(12);
  });

  it("falls back to markdown headings and bullet findings", () => {
    const review = ReviewParser.parse(`### Summary
The change is focused and easy to follow.

### Critical Issues (must fix)
- src/auth.ts:42 -- Missing authorization check before returning account data.

### Important Issues (should fix)
- None

### Suggestions (nice to have)
1. README.md:12 - Clarify the setup instructions.
`);

    expect(review.summary).toContain("focused");
    expect(review.critical).toHaveLength(1);
    expect(review.critical[0]).toMatchObject({
      file: "src/auth.ts",
      line: 42,
      description: "Missing authorization check before returning account data.",
    });
    expect(review.important).toHaveLength(0);
    expect(review.suggestions).toHaveLength(1);
    expect(review.suggestions[0].file).toBe("README.md");
  });
});
