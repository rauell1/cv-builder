import { NextRequest, NextResponse } from 'next/server';
import {
  callAIRaceForTask,
  getProviderCredentialDetails,
  getProviderCredentialStatus,
  hasAnyProviderCredentials,
  type AIMessage,
} from '@/lib/ai-provider';
import { aiQueue } from '@/lib/request-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface AiChatRequest {
  messages: { role: string; content: string }[];
  model?: string;
  modelId?: string;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body: AiChatRequest = await request.json();
    const { messages, temperature } = body;
    const model = body.model || body.modelId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (messages.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Conversation too long. Maximum 50 messages allowed.' },
        { status: 400 }
      );
    }

    const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    if (totalChars > 100_000) {
      return NextResponse.json(
        { success: false, error: 'Total message content too long. Maximum 100,000 characters allowed.' },
        { status: 400 }
      );
    }

    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { success: false, error: 'model (or modelId) string is required' },
        { status: 400 }
      );
    }

    for (const msg of messages) {
      if (!msg.role || typeof msg.content !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each message must have role (string) and content (string)' },
          { status: 400 }
        );
      }
    }

    if (!hasAnyProviderCredentials()) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI provider is configured. Set one of: ZHIPU_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, NVIDIA_API_KEY.',
          providerStatus: getProviderCredentialStatus(),
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    try {
      const result = await aiQueue.enqueue(
        () => callAIRaceForTask('general', messages as AIMessage[], 2, temperature),
        'normal',
      );

      console.warn('[ai-chat] request succeeded', {
        model,
        resolvedModel: result.model,
        provider: result.provider,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        success: true,
        content: result.content,
        model: result.model,
        provider: result.provider,
      });
    } catch (providerError: unknown) {
      const message = providerError instanceof Error ? providerError.message : 'An error occurred with the AI provider';
      console.error('[ai-chat] provider failed', {
        model,
        durationMs: Date.now() - startedAt,
        message,
      });
      return NextResponse.json(
        {
          success: false,
          error: message,
          providerStatus: getProviderCredentialStatus(),
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    console.error('[ai-chat] Unexpected error:', { durationMs: Date.now() - startedAt, error });
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
