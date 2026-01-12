# PowerShell build script for Vercel
# Ensure git config is set (required by Vercel)
git config user.name "Attendry" 2>$null
git config user.email "attendry@example.com" 2>$null

# Build the application
npm ci
npm run build
