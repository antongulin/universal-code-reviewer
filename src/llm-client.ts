import { OpenAI } from "openai";
import * as core from "@actions/core";

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private maxOutputTokens?: number;

  constructor(baseUrl: string, apiKey: string, model: string, maxOutputTokens?: number) {
    core.info(`Initializing LLM client: baseUrl=${baseUrl}, model=${model}`);
    
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || "ollama",
      maxRetries: 3,
      timeout: 120000, // 2 minutes for large diffs
    });

    this.model = model;
    this.maxOutputTokens = maxOutputTokens && Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
      ? maxOutputTokens
      : undefined;
  }

  async chatCompletion(systemPrompt: string, userContent: string): Promise<string> {
    try {
      const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
      };

      if (this.maxOutputTokens) {
        request.max_tokens = this.maxOutputTokens;
      }

      const response = await this.client.chat.completions.create(request);

      const content = response.choices[0]?.message?.content || "";
      
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      return content;
    } catch (error) {
      core.error(`LLM API error: ${error}`);
      throw new Error(`Failed to get response from LLM: ${error}`);
    }
  }
}
