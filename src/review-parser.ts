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
      const jsonReview = this.parseJsonReview(rawText);
      if (jsonReview) {
        core.info(
          `Parsed JSON review: ${jsonReview.critical.length} critical, ${jsonReview.important.length} important, ${jsonReview.suggestions.length} suggestions`
        );
        return jsonReview;
      }

      const markdownReview = this.parseMarkdownReview(rawText, review);
      review.summary = markdownReview.summary;
      review.critical = markdownReview.critical;
      review.important = markdownReview.important;
      review.suggestions = markdownReview.suggestions;

      core.info(`Parsed: ${review.critical.length} critical, ${review.important.length} important, ${review.suggestions.length} suggestions`);
    } catch (error) {
      core.warning(`Failed to parse structured review: ${error}. Treating entire response as raw summary.`);
      review.summary = rawText;
    }

    return review;
  }

  private static parseJsonReview(rawText: string): StructuredReview | null {
    const jsonText = this.extractJsonObject(rawText);
    if (!jsonText) return null;

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      return {
        summary: this.asString(parsed.summary),
        critical: this.normalizeFindings(parsed.critical, "critical"),
        important: this.normalizeFindings(parsed.important, "important"),
        suggestions: this.normalizeFindings(parsed.suggestions, "suggestion"),
        rawResponse: rawText,
      };
    } catch {
      return null;
    }
  }

  private static extractJsonObject(rawText: string): string | null {
    const fencedJson = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedJson) return fencedJson[1].trim();

    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    return rawText.slice(start, end + 1).trim();
  }

  private static normalizeFindings(value: unknown, severity: ReviewFinding["severity"]): ReviewFinding[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => this.normalizeFinding(item, severity))
      .filter((item): item is ReviewFinding => item !== null);
  }

  private static normalizeFinding(value: unknown, severity: ReviewFinding["severity"]): ReviewFinding | null {
    if (!value || typeof value !== "object") return null;

    const item = value as Record<string, unknown>;
    const description = this.asString(item.description).trim();
    if (!description) return null;

    const line = this.asNumber(item.line);
    const file = this.asString(item.file).trim() || undefined;

    return {
      severity,
      category: this.asString(item.category),
      file,
      line,
      description,
      recommendation: this.asString(item.recommendation),
      codeSnippet: this.asString(item.codeSnippet) || undefined,
    };
  }

  private static asString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  private static asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return parseInt(value, 10);
    return undefined;
  }

  private static parseMarkdownReview(rawText: string, review: StructuredReview): StructuredReview {
    const summaryMatch = rawText.match(/#{2,3}\s*Summary[\s\S]*?(?=(?:#{2,3}\s*(?:Critical|Important|Suggestion)|$))/i);
    if (summaryMatch) {
      review.summary = summaryMatch[0].replace(/#{2,3}\s*Summary\s*/i, "").trim();
    }

    const criticalSection = this.extractSection(rawText, "Critical");
    const importantSection = this.extractSection(rawText, "Important");
    const suggestionSection = this.extractSection(rawText, "Suggestion");

    review.critical = this.parseFindings(criticalSection, "critical");
    review.important = this.parseFindings(importantSection, "important");
    review.suggestions = this.parseFindings(suggestionSection, "suggestion");

    return review;
  }

  private static extractSection(text: string, sectionName: string): string {
    const regex = new RegExp(
      `#{2,3}\\s*${sectionName}[^\\n]*(?::|\\s*\\(.*?\\))?\\s*\\n([\\s\\S]*?)(?=(?:#{2,3}\\s*(?:Critical|Important|Suggestion|Summary)|$))`,
      "i"
    );
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

  private static parseFindings(section: string, severity: ReviewFinding["severity"]): ReviewFinding[] {
    if (!section) return [];

    const lines = section.split("\n");
    const findings: ReviewFinding[] = [];
    let currentFinding: Partial<ReviewFinding> | null = null;
    let descriptionLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const itemText = trimmed.replace(/^[-*•·]\s+/, "").replace(/^\d+\.\s+/, "");
      if (/^(none|n\/a|no issues?)\.?$/i.test(itemText)) continue;

      const isNewItem = /^[-*•·]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);

      if (isNewItem) {
        if (currentFinding) {
          currentFinding.description = descriptionLines.join("\n").trim();
          if (currentFinding.description) {
            findings.push(currentFinding as ReviewFinding);
          }
        }

        const fileLine = this.extractFileAndLine(trimmed);
        currentFinding = {
          severity,
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
    const itemText = text.replace(/^[-*•·]\s+/, "").replace(/^\d+\.\s+/, "");
    const fullPattern = /^[`']?([^`\s]+\.(?:[a-zA-Z0-9]+))[`']?\s*:\s*(\d+)\s*(?:--|[\-\u2013\u2014])\s*(.+)$/i;
    const match = itemText.match(fullPattern);

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

    const fileMatch = itemText.match(filePattern);
    const lineMatch = itemText.match(linePattern);

    return {
      file: fileMatch ? fileMatch[1] : undefined,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      cleanedText: itemText,
    };
  }
}
