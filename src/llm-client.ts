import { OpenAI } from "openai";
import * as core from "@actions/core";

export class LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    core.info(`Initializing LLM client: baseUrl=${baseUrl}, model=${model}`);
    
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || "ollama",
      maxRetries: 3,
      timeout: 120000, // 2 minutes for large diffs
    });

    this.model = model;
  }

  async chatCompletion(systemPrompt: string, userContent: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 8192,
      });

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
