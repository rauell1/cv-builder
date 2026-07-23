import { NextRequest, NextResponse } from 'next/server';
import { callAIWithFallback, DEFAULT_TEXT_MODEL } from '@/lib/ai-provider';
import type { AchievementEnhancement } from '@/lib/cv-types';
import { resolveClientIp } from '@/lib/rate-limit';
import { getVisitorIdFromRequest } from '@/lib/visitor';
import { getRequestGeo } from '@/lib/geo';
import { logGenerationEvent } from '@/lib/generation-log';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ACHIEVEMENT_ENHANCER_SYSTEM_PROMPT = `You are a CV achievement optimization expert. Rewrite the following experience bullet points to be significantly more impactful.

RULES:
- Start EVERY bullet with a strong action verb (Led, Built, Delivered, Optimized, Implemented, Reduced, Increased, Managed, Developed, Designed, Achieved, Launched, Spearheaded, Transformed, Architected, Streamlined, Accelerated, Pioneered, Negotiated, Mentored)
- Add MEASURABLE RESULTS - numbers, percentages, dollar amounts, scale metrics
- Focus on OUTCOMES and IMPACT, not tasks or responsibilities
- Keep each bullet under 2 lines (approximately 25 words)
- Transform passive descriptions into active achievement statements
- If a job context is provided, align language to that industry/role
- Do NOT fabricate achievements - only amplify what is implied or reasonably inferred from the original text
- Maintain the original meaning and scope - do not change what was actually done

Return JSON: { "enhanced": ["improved bullet 1", "improved bullet 2", ...], "improvements": ["Added quantified impact to bullet 1", "Changed passive to active voice in bullet 2", ...] }

The "enhanced" array must have the same length as the input bullets array.
The "improvements" array must have the same length, describing what was changed in each bullet.`;

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  const ip = resolveClientIp(request);
  const visitorId = getVisitorIdFromRequest(request);
  const geo = getRequestGeo(request);
  try {
    const body = await request.json();
    const { bullets, jobContext } = body;

    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'bullets is required and must be a non-empty array of strings' },
        { status: 400 }
      );
    }

    if (bullets.some((b: unknown) => typeof b !== 'string' || b.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'All bullets must be non-empty strings' },
        { status: 400 }
      );
    }

    const userMessage = jobContext
      ? `Here are the bullet points to enhance:\n\n${bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}\n\nJob Context / Industry: ${jobContext}`
      : `Here are the bullet points to enhance:\n\n${bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}`;

    const { content: responseText, model: usedModel } = await callAIWithFallback(
      [
        { role: 'system', content: ACHIEVEMENT_ENHANCER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      DEFAULT_TEXT_MODEL,
      'standard'
    );

    let result: AchievementEnhancement;
    try {
      const cleanResponse = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(cleanResponse) as AchievementEnhancement;

      if (!Array.isArray(parsed.enhanced) || !Array.isArray(parsed.improvements)) {
        throw new Error('Missing enhanced or improvements arrays');
      }

      // Ensure arrays match the input length
      result = {
        enhanced: parsed.enhanced.slice(0, bullets.length),
        improvements: parsed.improvements.slice(0, bullets.length),
      };

      // Pad if the AI returned fewer items than input
      while (result.enhanced.length < bullets.length) {
        const idx = result.enhanced.length;
        result.enhanced.push(bullets[idx]);
        result.improvements.push('No improvement suggested - kept original');
      }
    } catch (parseError) {
      console.error('Failed to parse achievement enhancement response:', parseError);
      console.error('Raw response:', responseText);
      void logGenerationEvent({
        type: 'enhance-achievements',
        success: false,
        model: usedModel,
        errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
        durationMs: Date.now() - requestStart,
        ip,
        visitorId,
        country: geo.country,
        region: geo.region,
        city: geo.city,
      });
      return NextResponse.json(
        { success: false, error: 'AI returned an invalid format for achievement enhancement. Please try again.' },
        { status: 500 }
      );
    }

    void logGenerationEvent({
      type: 'enhance-achievements',
      success: true,
      model: usedModel,
      durationMs: Date.now() - requestStart,
      ip,
      visitorId,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
    return NextResponse.json({
      success: true,
      data: result,
      model: usedModel,
    });
  } catch (error: unknown) {
    console.error('Enhance achievements error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    void logGenerationEvent({
      type: 'enhance-achievements',
      success: false,
      errorMessage: message,
      durationMs: Date.now() - requestStart,
      ip,
      visitorId,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
