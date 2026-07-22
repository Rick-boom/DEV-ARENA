import { createModuleLogger } from '../../../lib/logger.js';
import { AIUnavailableError } from '../errors/ai-error.js';
import type { ILLMClient, LLMRequest, LLMResult } from '../interfaces/ai.interfaces.js';

const log = createModuleLogger('gemini-client');

/**
 * Gemini adapter implementing the ILLMClient port. Calls the Generative
 * Language REST API with structured output (responseMimeType JSON +
 * responseSchema) so the model returns parseable JSON. The service
 * depends only on ILLMClient, so this concrete client is swappable and,
 * crucially, replaced by a fake in tests (we can't reach Gemini from CI).
 *
 * Cost/robustness: temperature is low (grounded), output tokens capped,
 * and a short timeout + typed failure (AIUnavailable) keeps a slow or
 * down provider from hanging the request.
 */
export interface GeminiConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class GeminiClient implements ILLMClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: GeminiConfig) {
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.timeoutMs = config.timeoutMs ?? 12_000;
  }

  async complete(input: LLMRequest): Promise<LLMResult> {
    const url = `${this.baseUrl}/models/${input.model}:generateContent?key=${this.config.apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        responseMimeType: 'application/json',
        ...(input.responseSchema ? { responseSchema: input.responseSchema } : {}),
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.error({ status: res.status }, 'gemini non-200');
        throw new AIUnavailableError();
      }
      const json = (await res.json()) as GeminiResponse;
      const candidate = json.candidates?.[0];
      const blocked =
        candidate?.finishReason === 'SAFETY' ||
        (json.promptFeedback?.blockReason !== null &&
          json.promptFeedback?.blockReason !== undefined);
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      return {
        text,
        model: input.model,
        tokensIn: json.usageMetadata?.promptTokenCount,
        tokensOut: json.usageMetadata?.candidatesTokenCount,
        blocked,
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        log.error('gemini timeout');
        throw new AIUnavailableError('The AI coach timed out');
      }
      if (err instanceof AIUnavailableError) throw err;
      log.error({ err }, 'gemini request failed');
      throw new AIUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
