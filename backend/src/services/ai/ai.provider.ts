export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateJson(request: { system: string; prompt: string; jsonSchema: unknown }): Promise<unknown>;
  generateText(request: {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  }): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly reason: 'timeout' | 'quota' | 'invalid_response' | 'blocked' | 'upstream',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}
