#!/bin/bash
set -e

# Ensure git config is set (required by Vercel)
git config user.name "Attendry" || true
git config user.email "attendry@example.com" || true

# Build the application
npm ci
npm run build
