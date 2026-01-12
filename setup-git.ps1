# Git configuration setup script for Vercel deployment (PowerShell)

Write-Host "Setting up Git configuration..." -ForegroundColor Cyan

# Set git user if not already set
$userName = git config user.name
$userEmail = git config user.email

if ([string]::IsNullOrEmpty($userName)) {
    git config user.name "Attendry"
    Write-Host "✓ Set git user.name to 'Attendry'" -ForegroundColor Green
} else {
    Write-Host "✓ Git user.name already set: $userName" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($userEmail)) {
    git config user.email "attendry@example.com"
    Write-Host "✓ Set git user.email to 'attendry@example.com'" -ForegroundColor Green
} else {
    Write-Host "✓ Git user.email already set: $userEmail" -ForegroundColor Green
}

Write-Host ""
Write-Host "Current Git configuration:" -ForegroundColor Cyan
Write-Host "  Name:  $(git config user.name)"
Write-Host "  Email: $(git config user.email)"
Write-Host ""
Write-Host "If you need to update the author of existing commits, run:" -ForegroundColor Yellow
Write-Host "  git commit --amend --reset-author --no-edit"
Write-Host "  git push --force-with-lease"
