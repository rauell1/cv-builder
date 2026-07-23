import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOutAdmin } from './actions';
import { Logo } from '@/components/ui/logo';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const { data: session } = await auth.getSession();
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!session?.user?.email || !adminEmail || session.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect('/admin/sign-in');
  }

  return session;
}

async function getStats() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalsByType, recentFailures, recentEvents, dailyRateLimits, topLocations, visitorRows] = await Promise.all([
    db.generationEvent.groupBy({
      by: ['type', 'success'],
      where: { createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    db.generationEvent.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    db.generationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    db.dailyRateLimit.findMany({
      where: { day: new Date().toISOString().slice(0, 10), subjectType: 'ip' },
      orderBy: { count: 'desc' },
      take: 10,
    }),
    db.generationEvent.groupBy({
      by: ['country', 'city'],
      where: { createdAt: { gte: since7d }, country: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    db.generationEvent.findMany({
      where: { createdAt: { gte: since24h }, visitorId: { not: null } },
      distinct: ['visitorId'],
      select: { visitorId: true },
    }),
  ]);

  const last24hCount = await db.generationEvent.count({ where: { createdAt: { gte: since24h } } });
  const last24hFailures = await db.generationEvent.count({ where: { createdAt: { gte: since24h }, success: false } });

  const byType = new Map<string, { success: number; failure: number }>();
  for (const row of totalsByType) {
    const entry = byType.get(row.type) || { success: 0, failure: 0 };
    if (row.success) entry.success += row._count._all;
    else entry.failure += row._count._all;
    byType.set(row.type, entry);
  }

  return {
    byType, recentFailures, recentEvents, dailyRateLimits, topLocations,
    uniqueVisitors24h: visitorRows.length, last24hCount, last24hFailures,
  };
}

export default async function AdminPage() {
  const session = await requireAdmin();
  const {
    byType, recentFailures, recentEvents, dailyRateLimits, topLocations,
    uniqueVisitors24h, last24hCount, last24hFailures,
  } = await getStats();

  const typeRows = Array.from(byType.entries()).sort((a, b) => (b[1].success + b[1].failure) - (a[1].success + a[1].failure));

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo size="md" href="/" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Generation Dashboard</h1>
              <p className="text-xs text-muted-foreground">Signed in as {session.user.email}</p>
            </div>
          </div>
          <form action={signOutAdmin}>
            <Button variant="outline" size="sm" type="submit">Sign out</Button>
          </form>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{last24hCount}</p>
              <p className="text-xs text-muted-foreground">generation events</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last 24h failures</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-destructive">{last24hFailures}</p>
              <p className="text-xs text-muted-foreground">
                {last24hCount > 0 ? `${Math.round((last24hFailures / last24hCount) * 100)}% failure rate` : 'no events yet'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique visitors (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{uniqueVisitors24h}</p>
              <p className="text-xs text-muted-foreground">by anonymous session cookie</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top IP today (by category)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyRateLimits[0] ? (
                <>
                  <p className="text-2xl font-semibold">{dailyRateLimits[0].count}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dailyRateLimits[0].subject} · {dailyRateLimits[0].category}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No traffic yet today</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top locations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top locations (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {topLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No location data yet.</p>
            ) : (
              <div className="space-y-2">
                {topLocations.map((row) => (
                  <div key={`${row.country}-${row.city}`} className="flex items-center justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                    <span className="text-foreground">
                      {[row.city, row.country].filter(Boolean).join(', ') || 'Unknown'}
                    </span>
                    <span className="text-muted-foreground">{row._count._all} requests</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success/failure by type, last 7 days */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By type (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {typeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {typeRows.map(([type, counts]) => {
                  const total = counts.success + counts.failure;
                  const failRate = total > 0 ? Math.round((counts.failure / total) * 100) : 0;
                  return (
                    <div key={type} className="flex items-center justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                      <span className="font-mono text-foreground">{type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{total} total</span>
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">{counts.success} ok</Badge>
                        {counts.failure > 0 && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                            {counts.failure} failed ({failRate}%)
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent failures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent failures</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures recorded.</p>
            ) : (
              <div className="space-y-3">
                {recentFailures.map((event) => (
                  <div key={event.id} className="text-xs border border-border/60 rounded-lg p-3 bg-background">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold">{event.type}</span>
                      <span className="text-muted-foreground">{event.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium' })} UTC</span>
                    </div>
                    <p className="text-muted-foreground mb-1">
                      {event.model ? `Model/format: ${event.model} · ` : ''}
                      {event.durationMs ? `${event.durationMs}ms · ` : ''}
                      IP: {event.ip || 'unknown'}
                    </p>
                    {event.errorMessage && (
                      <p className="text-destructive font-mono bg-destructive/5 rounded p-2 mt-1 whitespace-pre-wrap break-words">
                        {event.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent events (all) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <div className="space-y-1">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                    <span className="font-mono">{event.type}</span>
                    <span className="text-muted-foreground">{event.model || '-'}</span>
                    {event.success ? (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">ok</Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 text-[10px]">failed</Badge>
                    )}
                    <span className="text-muted-foreground">{event.createdAt.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
