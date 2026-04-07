import { NextRequest, NextResponse } from 'next/server';
import { callAI, getProvider, getRequiredEnvKey, type AIMessage } from '@/lib/ai-provider';

interface AiChatRequest {
  messages: { role: string; content: string }[];
  model?: string;
  modelId?: string;
  temperature?: number;
}

export async function POST(request: NextRequest) {
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

    // For non-GLM providers, check API key availability first
    const requiredKey = getRequiredEnvKey(provider);
    if (requiredKey && !process.env[requiredKey]) {
      return NextResponse.json(
        {
          success: false,
          error: `The API key for the selected model is not configured. Please set the ${requiredKey} environment variable.`,
          missingKey: requiredKey,
        },
        { status: 400 }
      );
    }

    // Route to the central AI gateway
    let content: string;
    try {
      const result = await callAI(
        messages as AIMessage[],
        model,
        temperature
      );
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'The AI model returned an empty response. Please try again.' },
          { status: 500 }
        );
      }
      content = result;
    } catch (providerError: unknown) {
      const message = providerError instanceof Error ? providerError.message : 'An error occurred with the AI provider';
      console.error(`[ai-chat] ${provider} provider error for model ${model}:`, message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content,
      model,
      provider,
    });
  } catch (error: unknown) {
    console.error('[ai-chat] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
