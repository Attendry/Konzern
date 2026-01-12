#!/bin/bash
# Git configuration setup script for Vercel deployment

echo "Setting up Git configuration..."

# Set git user if not already set
if [ -z "$(git config user.name)" ]; then
    git config user.name "Attendry"
    echo "✓ Set git user.name to 'Attendry'"
else
    echo "✓ Git user.name already set: $(git config user.name)"
fi

if [ -z "$(git config user.email)" ]; then
    git config user.email "attendry@example.com"
    echo "✓ Set git user.email to 'attendry@example.com'"
else
    echo "✓ Git user.email already set: $(git config user.email)"
fi

echo ""
echo "Current Git configuration:"
echo "  Name:  $(git config user.name)"
echo "  Email: $(git config user.email)"
echo ""
echo "If you need to update the author of existing commits, run:"
echo "  git commit --amend --reset-author --no-edit"
echo "  git push --force-with-lease"
