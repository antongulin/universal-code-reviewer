import * as core from "@actions/core";

export interface ReviewFinding {
  severity: "critical" | "important" | "suggestion";
  category: string;
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
  codeSnippet?: string;
}

export interface StructuredReview {
  summary: string;
  critical: ReviewFinding[];
  important: ReviewFinding[];
  suggestions: ReviewFinding[];
  rawResponse: string;
}

export class ReviewParser {
  static parse(rawText: string): StructuredReview {
    const review: StructuredReview = {
      summary: "",
      critical: [],
      important: [],
      suggestions: [],
      rawResponse: rawText,
    };

    try {
      const summaryMatch = rawText.match(/##\s*Summary[\s\S]*?(?=##\s*(Critical|Important|Suggestion|$))/i);
      if (summaryMatch) {
        review.summary = summaryMatch[0].replace(/##\s*Summary\s*/i, "").trim();
      }

      const criticalSection = this.extractSection(rawText, "Critical");
      const importantSection = this.extractSection(rawText, "Important");
      const suggestionSection = this.extractSection(rawText, "Suggestion");

      review.critical = this.parseFindings(criticalSection, "critical");
      review.important = this.parseFindings(importantSection, "important");
      review.suggestions = this.parseFindings(suggestionSection, "suggestion");

      core.info(`Parsed: ${review.critical.length} critical, ${review.important.length} important, ${review.suggestions.length} suggestions`);
    } catch (error) {
      core.warning(`Failed to parse structured review: ${error}. Treating entire response as raw summary.`);
      review.summary = rawText;
    }

    return review;
  }

  private static extractSection(text: string, sectionName: string): string {
    const regex = new RegExp(
      `##\\s*${sectionName}[^\\n]*(?::|\\s*\\(.*?\\))?\\s*\\n([\\s\\S]*?)(?=##\\s*(?:Critical|Important|Suggestion|Summary|$))`,
      "i"
    );
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

  private static parseFindings(section: string, severity: string): ReviewFinding[] {
    if (!section) return [];

    const lines = section.split("\n");
    const findings: ReviewFinding[] = [];
    let currentFinding: Partial<ReviewFinding> | null = null;
    let descriptionLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isNewItem = /^[-*•·]\d*\./.test(trimmed) || /^\d+\./.test(trimmed);

      if (isNewItem) {
        if (currentFinding) {
          currentFinding.description = descriptionLines.join("\n").trim();
          if (currentFinding.description) {
            findings.push(currentFinding as ReviewFinding);
          }
        }

        const fileLine = this.extractFileAndLine(trimmed);
        currentFinding = {
          severity: severity as any,
          category: "",
          description: "",
          recommendation: "",
          file: fileLine.file,
          line: fileLine.line,
        };

        // Use cleaned text (without file:line prefix) as first description line
        descriptionLines = [fileLine.cleanedText];
      } else if (trimmed.startsWith("  ") || trimmed.startsWith("\t")) {
        if (this.looksLikeCode(trimmed)) {
          if (currentFinding) {
            currentFinding.codeSnippet = (currentFinding.codeSnippet || "") + trimmed + "\n";
          }
        } else {
          descriptionLines.push(trimmed);
        }
      } else {
        descriptionLines.push(trimmed);
      }
    }

    if (currentFinding) {
      currentFinding.description = descriptionLines.join("\n").trim();
      if (currentFinding.description) {
        findings.push(currentFinding as ReviewFinding);
      }
    }

    return findings;
  }

  private static looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /^\s*(def|class|function|const|let|var|import|export|if|for|while|return)/,
      /^\s*[/].*[/]/,
      /^\s*[`"']/,
      /^\s*[{\[(]/,
    ];
    return codeIndicators.some((pattern) => pattern.test(text));
  }

  private static extractFileAndLine(text: string): { file?: string; line?: number; cleanedText: string } {
    // Match pattern like `src/auth.ts:42 — description` or `src/auth.ts:42 - description`
    const fullPattern = /^[`']?([^`\s]+\.(?:[a-zA-Z0-9]+))\s*:\s*(\d+)\s*[\-\u2013\u2014]\s*(.+)$/i;
    const match = text.match(fullPattern);

    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        cleanedText: match[3].trim(),
      };
    }

    // Fallback: try to find file and line anywhere in the text
    const filePattern = /[`']?([^`\s]+\.(?:[a-zA-Z0-9]+))[`']?/i;
    const linePattern = /:(\d+)/i;

    const fileMatch = text.match(filePattern);
    const lineMatch = text.match(linePattern);

    return {
      file: fileMatch ? fileMatch[1] : undefined,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      cleanedText: text,
    };
  }
}
