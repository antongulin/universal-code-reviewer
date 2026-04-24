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
export declare class ReviewParser {
    static parse(rawText: string): StructuredReview;
    private static parseJsonReview;
    private static extractJsonObject;
    private static normalizeFindings;
    private static normalizeFinding;
    private static asString;
    private static asNumber;
    private static parseMarkdownReview;
    private static extractSection;
    private static parseFindings;
    private static looksLikeCode;
    private static extractFileAndLine;
}
//# sourceMappingURL=review-parser.d.ts.map