#!/bin/bash
# ultra-wrapper.sh - Restart and rebuild wrapper for Ultra

ULTRA_BIN="${ULTRA_BIN:-./ultra}"
ULTRA_DIR="${ULTRA_DIR:-$(dirname "$0")}"
RESTART_CODE=75
REBUILD_CODE=76

while true; do
  "$ULTRA_BIN" "$@"
  EXIT_CODE=$?
  
  case $EXIT_CODE in
    $RESTART_CODE)
      # Restart requested
      clear
      ;;
    $REBUILD_CODE)
      # Rebuild and restart requested
      clear
      echo "Rebuilding Ultra..."
      if (cd "$ULTRA_DIR" && bun run build); then
        echo "Build successful, restarting..."
        sleep 0.5
      else
        echo "Build failed! Press enter to retry or Ctrl+C to exit."
        read -r
      fi
      ;;
    *)
      # Normal exit or crash
      exit $EXIT_CODE
      ;;
  esac
done