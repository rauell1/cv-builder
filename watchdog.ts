#!/usr/bin/env bun
/**
 * Dev Server Watchdog
 * 
 * Monitors the Next.js dev server on port 3000 and auto-restarts it if it dies.
 * Designed for sandbox environments with memory pressure.
 * 
 * Usage: bun run watchdog.ts
 */

import { spawnSync, spawn, execSync } from "child_process";
import { existsSync } from "fs";

const HEALTH_URL = "http://localhost:3000/";
const CHECK_INTERVAL = 5000;   // Check every 5 seconds
const STARTUP_WAIT = 15000;     // Wait 15 seconds after starting

async function isAlive(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function killExisting(): Promise<void> {
  try {
    spawnSync("pkill", ["-f", "next-server"], { stdio: "ignore" });
    spawnSync("pkill", ["-f", "next dev"], { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // Ignore errors
  }
}

function startServer(): void {
  console.log(`[${new Date().toISOString()}] Starting dev server...`);
  
  const child = spawn("npx", ["next", "start", "-p", "3000", "-H", "0.0.0.0"], {
    cwd: "/home/z/my-project",
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      console.log(`[next] ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      console.error(`[next:err] ${line}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`[${new Date().toISOString()}] Dev server exited with code ${code}`);
  });
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Watchdog started — monitoring port 3000`);
  
  let consecutiveFailures = 0;
  const MAX_FAILURES = 3;

  while (true) {
    const alive = await isAlive();
    
    if (!alive) {
      consecutiveFailures++;
      
      if (consecutiveFailures > MAX_FAILURES) {
        console.log(`[${new Date().toISOString()}] Too many consecutive failures (${consecutiveFailures}), backing off for 30s...`);
        await new Promise((r) => setTimeout(r, 30000));
        consecutiveFailures = 0;
      }
      
      console.log(`[${new Date().toISOString()}] Server not responding, restarting...`);
      
      try {
        await killExisting();
      } catch {
        // Ignore
      }

      // Rebuild if .next is missing (don't delete it!)
      try {
        if (!existsSync("/home/z/my-project/.next/BUILD_ID")) {
          console.log(`[${new Date().toISOString()}] No build found, running next build...`);
          execSync("cd /home/z/my-project && npx next build", { stdio: "inherit", timeout: 120000 });
        }
      } catch {
        // Ignore
      }

      startServer();
      
      // Wait for startup
      await new Promise((r) => setTimeout(r, STARTUP_WAIT));
      
      if (await isAlive()) {
        console.log(`[${new Date().toISOString()}] Server recovered successfully`);
        consecutiveFailures = 0;
      }
    } else {
      consecutiveFailures = 0;
    }

    await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
  }
}

main().catch((err) => {
  console.error("Watchdog crashed:", err);
  process.exit(1);
});
