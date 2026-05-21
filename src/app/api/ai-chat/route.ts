import { NextRequest, NextResponse } from 'next/server';
import {
  callAIWithFallback,
  getProvider,
  getProviderCredentialDetails,
  getProviderCredentialStatus,
  hasAnyProviderCredentials,
  type AIMessage,
} from '@/lib/ai-provider';

export const runtime = 'nodejs';

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
    // Accept both 'model' and 'modelId' for API consistency
    const model = body.model || body.modelId;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Limit message count to prevent token overflow and cost abuse
    if (messages.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Conversation too long. Maximum 50 messages allowed.' },
        { status: 400 }
      );
    }

    // Limit total content length to prevent oversized payloads
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

    // Validate each message has role and content
    for (const msg of messages) {
      if (!msg.role || typeof msg.content !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each message must have role (string) and content (string)' },
          { status: 400 }
        );
      }
    }

    // Detect provider from model ID
    const provider = getProvider(model);

    const hasAnyConfiguredProvider = hasAnyProviderCredentials();

    if (!hasAnyConfiguredProvider) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI provider is configured. Set one of: ZHIPU_API_KEY (or GLM_API_KEY/BIGMODEL_API_KEY), OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY (or GOOGLE_API_KEY/GEMINI_API_KEY).',
          providerStatus: getProviderCredentialStatus(),
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }

    try {
      const result = await callAIWithFallback(
        messages as AIMessage[],
        model,
        'standard',
        temperature
      );
      const durationMs = Date.now() - startedAt;
      console.warn('[ai-chat] request succeeded', {
        model,
        resolvedModel: result.model,
        provider: result.provider,
        durationMs,
      });

      return NextResponse.json({
        success: true,
        content: result.content,
        model: result.model,
        provider: result.provider,
      });
    } catch (providerError: unknown) {
      const message = providerError instanceof Error ? providerError.message : 'An error occurred with the AI provider';
      console.error('[ai-chat] provider fallback failed', {
        model,
        provider,
        durationMs: Date.now() - startedAt,
        message,
      });
      return NextResponse.json(
        {
          success: false,
          error: message,
          providerStatus: getProviderCredentialStatus(),
          diagnostics: (providerError as any)?.diagnostics,
          providerDetails: getProviderCredentialDetails(),
        },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    console.error('[ai-chat] Unexpected error:', {
      durationMs: Date.now() - startedAt,
      error,
    });
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
