import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

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

    // Pseudonymize the IP with a one-way hash — NOT base64 (which is trivially
    // reversible encoding, not anonymization; a prior version incorrectly used
    // base64 here while claiming it was "anonymized"). SHA-256 cannot be
    // decoded back to the original IP. Note this is "pseudonymization" in the
    // strict GDPR sense (Recital 26), not true anonymization: because IPv4
    // address space is small, a determined party could still brute-force the
    // hash by trying all ~4 billion possible IPs. It is not used for anything
    // beyond a lightweight audit trail of consent choices.
    const forwardedFor = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const ipHash = createHash("sha256").update(forwardedFor).digest("hex").slice(0, 16);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to record consent log", details: message }, { status: 500 });
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
