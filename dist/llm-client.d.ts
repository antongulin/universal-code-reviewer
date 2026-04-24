export declare class LLMClient {
    private client;
    private model;
    private maxOutputTokens?;
    constructor(baseUrl: string, apiKey: string, model: string, maxOutputTokens?: number, timeoutMs?: number);
    chatCompletion(systemPrompt: string, userContent: string): Promise<string>;
}
//# sourceMappingURL=llm-client.d.ts.map