"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LLM_TIMEOUT_MS = void 0;
exports.parseLLMTimeout = parseLLMTimeout;
exports.DEFAULT_LLM_TIMEOUT_MS = 600000; // 10 minutes
function parseLLMTimeout(input) {
    if (!input)
        return { value: exports.DEFAULT_LLM_TIMEOUT_MS, valid: true };
    const parsed = Number(input);
    if (Number.isFinite(parsed) && parsed > 0) {
        return { value: parsed, valid: true };
    }
    return { value: exports.DEFAULT_LLM_TIMEOUT_MS, valid: false };
}
//# sourceMappingURL=config.js.map