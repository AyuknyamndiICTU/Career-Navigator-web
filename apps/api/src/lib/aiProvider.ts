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

  const hasOllama =
    typeof ollamaBaseUrl === 'string' && ollamaBaseUrl.trim().length > 0;

  if (!hasGemini && !hasOllama) {
    throw new Error(
      'No AI provider configured. Set GEMINI_API_KEY (Gemini) or OLLAMA_BASE_URL (Ollama) in your environment.',
    );
  }

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
          baseUrl: ollamaBaseUrl as string,
          apiKey:
            typeof ollamaApiKey === 'string' && ollamaApiKey.trim().length > 0
              ? (ollamaApiKey as string)
              : undefined,
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
