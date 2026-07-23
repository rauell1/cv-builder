import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DATA_RETENTION } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Daily cron (see vercel.json) that deletes CV session rows past their
 * retention window. Enforces the promise made on the landing page - CV
 * data is not kept indefinitely.
 *
 * Vercel signs cron-triggered requests with `Authorization: Bearer $CRON_SECRET`.
 * Reject anything else so this endpoint can't be used to wipe sessions on demand.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - DATA_RETENTION.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await db.cVSession.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });

  console.warn(`[cleanup-sessions] Deleted ${count} session(s) older than ${DATA_RETENTION.SESSION_MAX_AGE_DAYS} days`);

  return NextResponse.json({ success: true, deletedCount: count, cutoff: cutoff.toISOString() });
}
