import { AiProviderError, type AiProvider } from '../../src/services/ai/ai.provider.js';

type JsonHandler = (request: { system: string; prompt: string; jsonSchema: unknown }) => unknown;
type TextHandler = (request: { system: string; prompt: string }) => string;

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  readonly calls: { kind: 'json' | 'text'; system: string; prompt: string }[] = [];
  failWith: AiProviderError | null = null;

  constructor(
    public jsonHandler: JsonHandler = defaultJsonHandler,
    public textHandler: TextHandler = () =>
      '**Mock explanation.** Normalisation removes redundancy.',
  ) {}

  async generateJson(request: { system: string; prompt: string; jsonSchema: unknown }) {
    this.calls.push({ kind: 'json', system: request.system, prompt: request.prompt });
    if (this.failWith) throw this.failWith;
    return this.jsonHandler(request);
  }

  async generateText(request: { system: string; prompt: string }) {
    this.calls.push({ kind: 'text', system: request.system, prompt: request.prompt });
    if (this.failWith) throw this.failWith;
    return this.textHandler(request);
  }

  fail(reason: AiProviderError['reason'] = 'upstream') {
    this.failWith = new AiProviderError('mock failure', reason);
  }
}

export function defaultJsonHandler(request: { system: string; prompt: string }): unknown {
  if (request.system.includes('classify')) {
    const text = request.prompt.toLowerCase();
    const question = text.slice(text.indexOf('<question>'));
    if (question.includes('normali') || question.includes('sql')) {
      return { subjectCode: 'CS202', category: 'Normalization', confidence: 0.93 };
    }
    if (question.includes('semaphore') || question.includes('mutex')) {
      return { subjectCode: 'CS203', category: 'Synchronization', confidence: 0.88 };
    }
    return { subjectCode: 'CS201', category: 'General', confidence: 0.3 };
  }
  return { findings: [] };
}
