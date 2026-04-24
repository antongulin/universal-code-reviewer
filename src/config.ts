export const DEFAULT_LLM_TIMEOUT_MS = 600000; // 10 minutes

export function parseLLMTimeout(input: string): { value: number; valid: boolean } {
  if (!input) return { value: DEFAULT_LLM_TIMEOUT_MS, valid: true };
  const parsed = Number(input);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { value: parsed, valid: true };
  }
  return { value: DEFAULT_LLM_TIMEOUT_MS, valid: false };
}
