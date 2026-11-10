import { GoogleGenAI } from '@google/genai';
import { AiProviderError, type AiProvider } from './ai.provider.js';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async generate(config: Record<string, unknown>, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: { ...config, abortSignal: controller.signal },
      });
      const text = response.text;
      if (!text) {
        const blocked = response.promptFeedback?.blockReason;
        throw new AiProviderError(
          blocked ? `Response blocked: ${blocked}` : 'Empty response from Gemini',
          blocked ? 'blocked' : 'invalid_response',
        );
      }
      return text;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (controller.signal.aborted)
        throw new AiProviderError('Gemini request timed out', 'timeout', { cause: error });
      const status = (error as { status?: number }).status;
      if (status === 429)
        throw new AiProviderError('Gemini quota exceeded', 'quota', { cause: error });
      throw new AiProviderError('Gemini request failed', 'upstream', { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  async generateJson(request: {
    system: string;
    prompt: string;
    jsonSchema: unknown;
  }): Promise<unknown> {
    const text = await this.generate(
      {
        systemInstruction: request.system,
        responseMimeType: 'application/json',
        responseJsonSchema: request.jsonSchema,
        temperature: 0,
      },
      request.prompt,
    );
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new AiProviderError('Gemini returned invalid JSON', 'invalid_response', {
        cause: error,
      });
    }
  }

  generateText(request: {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    return this.generate(
      {
        systemInstruction: request.system,
        temperature: 0.4,
        maxOutputTokens: request.maxOutputTokens ?? 1500,
      },
      request.prompt,
    );
  }
}
