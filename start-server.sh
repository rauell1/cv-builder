#!/bin/bash
cd /home/z/my-project
while true; do
  npx next start -p 3000 -H 0.0.0.0 >> /home/z/my-project/server.log 2>&1
  echo "[$(date)] Server exited, restarting in 3s..." >> /home/z/my-project/server.log
  sleep 3
done
