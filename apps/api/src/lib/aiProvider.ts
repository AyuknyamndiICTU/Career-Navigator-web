export type AIProviderResult = {
  activeProvider: 'Gemini' | 'Ollama Cloud';
  gemini?: { apiKey: string };
  ollama?: {
    baseUrl: 'https://ollama.com/v1';
    apiKey: string;
    models: string[];
  };
};

let didLogActiveProvider = false;

export function getAIProvider(): AIProviderResult {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  const hasGemini = typeof geminiApiKey === 'string' && geminiApiKey.trim().length > 0;
  const hasOllama = typeof ollamaApiKey === 'string' && ollamaApiKey.trim().length > 0;

  if (!hasGemini && !hasOllama) {
    throw new Error(
      'No AI provider configured. Set GEMINI_API_KEY or OLLAMA_API_KEY in your .env file.',
    );
  }

  const result: AIProviderResult = {
    activeProvider: hasGemini ? 'Gemini' : 'Ollama Cloud',
    gemini: hasGemini ? { apiKey: geminiApiKey as string } : undefined,
    ollama: hasOllama
      ? {
          baseUrl: 'https://ollama.com/v1',
          apiKey: ollamaApiKey as string,
          models: ['qwen3-coder:480b-cloud', 'glm-4.6:cloud'],
        }
      : undefined,
  };

  if (!didLogActiveProvider) {
    didLogActiveProvider = true;
     
    console.log(
      `[AI Provider] Active: ${result.activeProvider}`,
    );
  }

  return result;
}
