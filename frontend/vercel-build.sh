#!/bin/bash
set -e

# Set git config
git config --global user.name "Attendry" || true
git config --global user.email "attendry@example.com" || true

# Build (dependencies already installed by Vercel's installCommand)
# This avoids double installation and saves memory
echo "Building..."
npm run build
