/* global process, console */
export type AIProviderResult = {
  activeProvider: 'Gemini' | 'Ollama Cloud';
  gemini?: {
    apiKey: string;

    generateContentUrlForModel: (_model: string) => string;
  };
  ollama?: {
    baseUrl: string;
    /**
     * Optional: local Ollama usually doesn't require an API key.
     * ollama.com cloud may require OLLAMA_API_KEY.
     */
    apiKey?: string;
    models: string[];
  };
};

/**
 * Gemini model used for CV extraction + chat generation.
 * Kept in code (not env) to match `apps/api/.env.example`.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

let didLogActiveProvider = false;

export function getAIProvider(): AIProviderResult {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // For local Ollama (compose), set:
  //   OLLAMA_BASE_URL="http://ollama:11434/v1"
  // For ollama.com cloud, set:
  //   OLLAMA_BASE_URL="https://ollama.com/v1"
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  const hasGemini =
    typeof geminiApiKey === 'string' && geminiApiKey.trim().length > 0;

  // Filter out obvious placeholder values that shouldn't be treated as real keys.
  const isPlaceholder = (value: string | undefined): boolean => {
    if (!value) return true;
    const trimmed = value.trim().toLowerCase();
    const placeholders = [
      'change-me',
      'your_ollama_cloud_key_here',
      'your-key-here',
      'your_key_here',
      'placeholder',
      'xxx',
      '',
    ];
    return placeholders.includes(trimmed);
  };

  const hasOllamaBaseUrl =
    typeof ollamaBaseUrl === 'string' && ollamaBaseUrl.trim().length > 0;
  const hasOllamaApiKey =
    typeof ollamaApiKey === 'string' &&
    ollamaApiKey.trim().length > 0 &&
    !isPlaceholder(ollamaApiKey);

  // Ollama is available if either OLLAMA_BASE_URL or OLLAMA_API_KEY is set.
  // When only OLLAMA_API_KEY is provided, we default to the Ollama Cloud URL.
  const hasOllama = hasOllamaBaseUrl || hasOllamaApiKey;

  if (!hasGemini && !hasOllama) {
    throw new Error(
      'No AI provider configured. Set GEMINI_API_KEY (Gemini) or OLLAMA_BASE_URL / OLLAMA_API_KEY (Ollama) in your environment.',
    );
  }

  // Default to Ollama Cloud when only the API key is set (no explicit base URL).
  const resolvedOllamaBaseUrl = hasOllamaBaseUrl
    ? (ollamaBaseUrl as string)
    : 'https://ollama.com/v1';

  const result: AIProviderResult = {
    activeProvider: hasGemini ? 'Gemini' : 'Ollama Cloud',
    gemini: hasGemini
      ? {
          apiKey: geminiApiKey as string,
          generateContentUrlForModel: (_model: string) =>
            `https://generativelanguage.googleapis.com/v1beta/models/${_model}:generateContent?key=${geminiApiKey}`,
        }
      : undefined,
    ollama: hasOllama
      ? {
          baseUrl: resolvedOllamaBaseUrl,
          apiKey: hasOllamaApiKey ? (ollamaApiKey as string) : undefined,
          models: ['qwen3-coder:480b-cloud', 'glm-4.6:cloud'],
        }
      : undefined,
  };

  if (!didLogActiveProvider) {
    didLogActiveProvider = true;
    console.log(`[AI Provider] Active: ${result.activeProvider}`);
  }

  return result;
}
