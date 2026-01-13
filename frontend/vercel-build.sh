#!/bin/bash
set -e

# Set git config
git config --global user.name "Attendry" || true
git config --global user.email "attendry@example.com" || true

# Install platform-specific rollup module for Linux build environment
echo "Installing rollup linux module..."
npm install @rollup/rollup-linux-x64-gnu --save-optional || true

# Build (dependencies already installed by Vercel's installCommand)
# This avoids double installation and saves memory
echo "Building..."
npm run build
