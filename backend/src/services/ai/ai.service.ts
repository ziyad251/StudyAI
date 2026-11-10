import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { Database } from '../../db/client.js';
import { subjects } from '../../db/schema.js';
import { ServiceUnavailableError } from '../../utils/errors.js';
import { AiProviderError, type AiProvider } from './ai.provider.js';
import {
  detectPersonalInformation,
  redactPersonalInformation,
  type PiiFinding,
} from './pii-detector.js';
import { CLASSIFIER_SYSTEM, PII_SYSTEM, delimit, tutorSystem } from './prompts.js';

export interface SubjectClassification {
  subjectId: string;
  subject: string;
  subjectCode: string;
  category: string;
  confidence: number;
}

export interface PersonalInfoCheck {
  hasPersonalInformation: boolean;
  findings: PiiFinding[];
  aiChecked: boolean;
  disclaimer: string;
}

const PII_DISCLAIMER =
  'Automated checks help catch common identifying details but cannot guarantee that everything is detected. Please review your question before posting.';

const piiAiResponseSchema = z.object({
  findings: z
    .array(
      z.object({
        type: z.enum(['NAME', 'EMAIL', 'PHONE', 'ROLL_NUMBER', 'SOCIAL_HANDLE', 'OTHER']),
        excerpt: z.string().max(200),
        reason: z.string().max(300),
      }),
    )
    .max(20),
});

export class AiService {
  constructor(
    private readonly db: Database,
    private readonly provider: AiProvider | null,
    private readonly logger: Logger,
  ) {}

  get isAvailable(): boolean {
    return this.provider !== null;
  }

  get modelName(): string | null {
    return this.provider?.model ?? null;
  }

  private requireProvider(): AiProvider {
    if (!this.provider) {
      throw new ServiceUnavailableError(
        'AI features are not configured on this server',
        'AI_UNAVAILABLE',
      );
    }
    return this.provider;
  }

  private toUnavailable(error: unknown, operation: string): never {
    const reason = error instanceof AiProviderError ? error.reason : 'unknown';
    this.logger.warn({ err: error, operation, reason }, 'AI provider call failed');
    if (reason === 'quota') {
      throw new ServiceUnavailableError(
        'The AI assistant is busy right now. Please try again shortly.',
        'AI_BUSY',
      );
    }
    throw new ServiceUnavailableError(
      'The AI assistant is temporarily unavailable. Please try again later.',
      'AI_UNAVAILABLE',
    );
  }

  async classifyQuestion(text: string): Promise<SubjectClassification> {
    const provider = this.requireProvider();
    const catalogue = await this.db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        category: subjects.category,
        description: subjects.description,
      })
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(asc(subjects.code));
    if (catalogue.length === 0) {
      throw new ServiceUnavailableError('No subjects are configured', 'AI_UNAVAILABLE');
    }

    const codes = catalogue.map((s) => s.code) as [string, ...string[]];
    const responseSchema = z.object({
      subjectCode: z.enum(codes),
      category: z.string().trim().min(1).max(60),
      confidence: z.number().min(0).max(1),
    });

    const prompt = [
      'Subject catalogue:',
      ...catalogue.map(
        (s) =>
          `- ${s.code}: ${s.name} (${s.category})${s.description ? ` – ${s.description}` : ''}`,
      ),
      '',
      delimit('question', redactPersonalInformation(text)),
    ].join('\n');

    let raw: unknown;
    try {
      raw = await provider.generateJson({
        system: CLASSIFIER_SYSTEM,
        prompt,
        jsonSchema: z.toJSONSchema(responseSchema),
      });
    } catch (error) {
      this.toUnavailable(error, 'classify');
    }

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      this.toUnavailable(
        new AiProviderError('Classification failed validation', 'invalid_response'),
        'classify',
      );
    }
    const subject = catalogue.find((s) => s.code === parsed.data.subjectCode)!;
    return {
      subjectId: subject.id,
      subject: subject.name,
      subjectCode: subject.code,
      category: parsed.data.category,
      confidence: Math.round(parsed.data.confidence * 100) / 100,
    };
  }

  async tryClassifyQuestion(text: string): Promise<SubjectClassification | null> {
    if (!this.isAvailable) return null;
    try {
      return await this.classifyQuestion(text);
    } catch {
      return null;
    }
  }

  async checkPersonalInformation(text: string): Promise<PersonalInfoCheck> {
    const findings = detectPersonalInformation(text);
    let aiChecked = false;

    if (this.provider) {
      try {
        const raw = await this.provider.generateJson({
          system: PII_SYSTEM,
          prompt: delimit('student_text', redactPersonalInformation(text)),
          jsonSchema: z.toJSONSchema(piiAiResponseSchema),
        });
        const parsed = piiAiResponseSchema.safeParse(raw);
        if (parsed.success) {
          aiChecked = true;
          for (const f of parsed.data.findings) {
            if (!f.excerpt || !text.toLowerCase().includes(f.excerpt.toLowerCase())) continue;
            if (f.excerpt.includes('[REDACTED_')) continue;
            findings.push({ type: f.type, excerpt: f.excerpt, message: f.reason, source: 'AI' });
          }
        }
      } catch (error) {
        this.logger.warn(
          { err: error },
          'AI personal-information check failed; using pattern checks only',
        );
      }
    }

    return {
      hasPersonalInformation: findings.length > 0,
      findings,
      aiChecked,
      disclaimer: PII_DISCLAIMER,
    };
  }

  async explain(input: {
    title?: string;
    text: string;
    subjectName: string | null;
  }): Promise<string> {
    const provider = this.requireProvider();
    const prompt = [
      input.title ? delimit('question_title', redactPersonalInformation(input.title)) : '',
      delimit('question', redactPersonalInformation(input.text)),
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const answer = await provider.generateText({
        system: tutorSystem(input.subjectName),
        prompt,
        maxOutputTokens: 1500,
      });
      return answer.trim();
    } catch (error) {
      this.toUnavailable(error, 'explain');
    }
  }
}
