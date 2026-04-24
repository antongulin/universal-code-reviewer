"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
const openai_1 = require("openai");
const core = __importStar(require("@actions/core"));
class LLMClient {
    client;
    model;
    constructor(baseUrl, apiKey, model) {
        core.info(`Initializing LLM client: baseUrl=${baseUrl}, model=${model}`);
        this.client = new openai_1.OpenAI({
            baseURL: baseUrl,
            apiKey: apiKey || "ollama",
            maxRetries: 3,
            timeout: 120000, // 2 minutes for large diffs
        });
        this.model = model;
    }
    async chatCompletion(systemPrompt, userContent) {
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
        }
        catch (error) {
            core.error(`LLM API error: ${error}`);
            throw new Error(`Failed to get response from LLM: ${error}`);
        }
    }
}
exports.LLMClient = LLMClient;
//# sourceMappingURL=llm-client.js.map