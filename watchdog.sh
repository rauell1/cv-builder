#!/bin/bash
# Production-mode watchdog for Next.js server
# Checks every 20 seconds if the server is running, restarts if not

WATCHDOG_PID_FILE="/home/z/my-project/watchdog.pid"
NEXT_BUILD_DIR="/home/z/my-project/.next"
START_CMD="cd /home/z/my-project && npx next start -p 3000 -H 0.0.0.0"
LOG_FILE="/home/z/my-project/server.log"
INTERVAL=20

# Write watchdog PID
echo $$ > "$WATCHDOG_PID_FILE"

echo "[watchdog] Starting production-mode watchdog (PID $$, interval=${INTERVAL}s)"

while true; do
    # Check if port 3000 is listening
    if ! ss -tlnp 2>/dev/null | grep -q ':3000 '; then
        echo "[watchdog] $(date '+%Y-%m-%d %H:%M:%S') Server not responding on port 3000. Restarting..."
        
        # Check if build exists
        if [ ! -f "$NEXT_BUILD_DIR/BUILD_ID" ]; then
            echo "[watchdog] No production build found. Running next build..."
            cd /home/z/my-project && npx next build > "$LOG_FILE" 2>&1
            if [ $? -ne 0 ]; then
                echo "[watchdog] Build failed! Check $LOG_FILE"
                sleep 30
                continue
            fi
        fi
        
        # Start server
        nohup npx next start -p 3000 -H 0.0.0.0 > "$LOG_FILE" 2>&1 &
        echo "[watchdog] Server started with PID $!"
        sleep 8
        
        # Verify it started
        if ss -tlnp 2>/dev/null | grep -q ':3000 '; then
            echo "[watchdog] Server is back online!"
        else
            echo "[watchdog] Server failed to start. Check $LOG_FILE"
            cat "$LOG_FILE" | tail -20
        fi
    fi
    
    sleep $INTERVAL
done
