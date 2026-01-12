#!/bin/bash
set -e

# Set git config FIRST - this must happen before any git operations
# Use --global to ensure it's available throughout the build
git config --global user.name "Attendry" || true
git config --global user.email "attendry@example.com" || true

# Also set local config as backup
git config user.name "Attendry" || true
git config user.email "attendry@example.com" || true

# Verify git config is set
echo "Git config:"
git config user.name || echo "WARNING: user.name not set"
git config user.email || echo "WARNING: user.email not set"

# Install dependencies (use npm install if package-lock.json is missing)
if [ -f "package-lock.json" ]; then
  npm ci
else
  echo "Warning: package-lock.json not found, using npm install"
  npm install
fi

# Build
npm run build
