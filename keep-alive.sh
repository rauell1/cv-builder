#!/bin/bash
# Keep-alive script for Next.js dev server
# Checks every 30 seconds if the server is responding
# If not, restarts it

cd /home/z/my-project

while true; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" != "200" ]; then
    echo "[$(date)] Server down (HTTP $HTTP_CODE). Restarting..."
    pkill -f "next dev" 2>/dev/null
    pkill -f "next start" 2>/dev/null
    sleep 2
    nohup bun run dev > dev.log 2>&1 &
    sleep 8
    NEW_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
    echo "[$(date)] Restart complete. HTTP $NEW_CODE"
  fi
  
  sleep 30
done
