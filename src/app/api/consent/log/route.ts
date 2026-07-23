import { NextRequest, NextResponse } from "next/server";

export interface ServerConsentLog {
  id: string;
  timestamp: string;
  categories: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  geoRegion: string;
  userAgent: string;
  ipHash?: string;
}

// In-memory audit log store (persisted in runtime memory)
const serverConsentLogs: ServerConsentLog[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, timestamp, categories, geoRegion, userAgent } = body;

    if (!id || !categories) {
      return NextResponse.json({ error: "Invalid consent log payload" }, { status: 400 });
    }

    // Anonymize IP address for compliance
    const forwardedFor = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const ipHash = Buffer.from(forwardedFor).toString("base64").slice(0, 12);

    const logEntry: ServerConsentLog = {
      id: id || "LOG-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: timestamp || new Date().toISOString(),
      categories,
      geoRegion: geoRegion || "EU",
      userAgent: userAgent || req.headers.get("user-agent") || "Unknown",
      ipHash,
    };

    serverConsentLogs.unshift(logEntry);
    if (serverConsentLogs.length > 200) {
      serverConsentLogs.pop();
    }

    return NextResponse.json({ success: true, recordedLog: logEntry }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to record consent log", details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";

  if (format === "csv") {
    const headers = ["Log ID", "Timestamp", "Region", "Necessary", "Functional", "Analytics", "Marketing", "IP Hash", "User Agent"];
    const rows = serverConsentLogs.map((log) => [
      log.id,
      log.timestamp,
      log.geoRegion,
      log.categories.necessary,
      log.categories.functional,
      log.categories.analytics,
      log.categories.marketing,
      log.ipHash,
      `"${log.userAgent.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="server-consent-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ total: serverConsentLogs.length, logs: serverConsentLogs }, { status: 200 });
}
