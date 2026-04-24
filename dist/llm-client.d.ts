export declare class LLMClient {
    private client;
    private model;
    constructor(baseUrl: string, apiKey: string, model: string);
    chatCompletion(systemPrompt: string, userContent: string): Promise<string>;
}
//# sourceMappingURL=llm-client.d.ts.map