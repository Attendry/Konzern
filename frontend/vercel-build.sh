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

# Install dependencies
# npm install should handle optional dependencies, but we'll ensure rollup is properly installed
echo "Installing dependencies..."
npm install

# Ensure rollup native dependencies are installed
# This is a workaround for npm's optional dependency bug on Vercel
echo "Ensuring rollup native dependencies..."
npm install @rollup/rollup-linux-x64-gnu --save-optional --no-save || true

# Build
npm run build
