#!/bin/bash
# Check if port 3000 is listening, if not start the dev server
if ! ss -tlnp | grep -q ":3000 " 2>/dev/null; then
  # Kill any stale processes
  pkill -f "next-server" 2>/dev/null
  sleep 1
  # Start the server
  cd /home/z/my-project
  nohup npx next dev -p 3000 -H 0.0.0.0 >/dev/null 2>&1 &
  echo "$(date): Restarted server" >> /home/z/my-project/dev.log
fi
