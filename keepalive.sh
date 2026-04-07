#!/bin/bash
# Keepalive script for Next.js production server
# Restarts the server if it dies, with memory limits

cd /home/z/my-project

while true; do
    # Check if server is running
    if ss -tlnp | grep -q ':3000 '; then
        sleep 10
        continue
    fi

    echo "[$(date)] Server not running, restarting..."

    # Kill any leftover processes
    pkill -f "next-server" 2>/dev/null
    sleep 2

    # Rebuild if needed
    if [ ! -f ".next/BUILD_ID" ]; then
        echo "[$(date)] No build found, running next build..."
        npx next build 2>&1 | tail -5
    fi

    # Start server with adequate memory
    # Note: NODE_OPTIONS="--max-old-space-size=2048" prevents OOM crashes
    # - 512MB: server crashes on homepage (too low for Next.js 16 + all API routes)
    # - 768MB: server crashes on homepage after first AI call
    # - 1024MB: mostly stable but crashes on heavy AI calls (cover letter, restructure)
    # - 2048MB: stable for all operations including heavy AI workloads
    NODE_OPTIONS="--max-old-space-size=2048" nohup npx next start -p 3000 -H 0.0.0.0 > /home/z/my-project/server.log 2>&1 &

    # Wait for server to be ready AND responsive (not just listening)
    for i in $(seq 1 30); do
        sleep 2
        # Check both that port is open AND server responds to HTTP
        if ss -tlnp | grep -q ':3000 '; then
            HTTP_CODE=$(wget -q -T 3 -O /dev/null --server-response http://127.0.0.1:3000/ 2>&1 | head -1 | grep -o '[0-9]\{3\}')
            if [ "$HTTP_CODE" = "200" ]; then
                echo "[$(date)] Server started and responsive (PID: $(pgrep -f 'next-server' | head -1))"
                break
            fi
        fi
    done

    sleep 5
done
