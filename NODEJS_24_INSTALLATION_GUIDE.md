# Node.js Version Guide

**Current Node.js Version:** v25.3.0 ✅  
**Required Node.js Version:** >=24.0.0 ✅ **REQUIREMENT MET**  
**Recommended for Production:** Node.js 24 LTS (Krypton)

## Important Note

You currently have **Node.js 25.3**, which is newer than the required >=24.0.0, so you're all set! 

**However:**
- Node.js 25 is a **Current** (non-LTS) release with the latest features
- Node.js 24 is the **LTS** (Long Term Support) version recommended for production
- For development, Node.js 25.3 works perfectly fine
- For production deployments, consider Node.js 24 LTS for better stability

**You can proceed with development using Node.js 25.3** - no installation needed!

---

## Option 1: Install nvm-windows (Recommended)

nvm-windows allows you to manage multiple Node.js versions easily.

### Step 1: Download nvm-windows
1. Go to: https://github.com/coreybutler/nvm-windows/releases
2. Download the latest `nvm-setup.exe` (e.g., `nvm-setup-v1.1.12.exe`)
3. Run the installer and follow the setup wizard

### Step 2: Install Node.js 24 LTS
After installing nvm-windows, open a **new** PowerShell or Command Prompt window and run:

```powershell
# Install Node.js 24 LTS
nvm install 24

# Use Node.js 24
nvm use 24

# Verify installation
node --version
# Should show: v24.x.x

npm --version
```

### Step 3: Set Node.js 24 as default (optional)
```powershell
nvm alias default 24
```

### Switching Between Versions
```powershell
# Switch to Node.js 24
nvm use 24

# Switch to Node.js 22
nvm use 22

# List installed versions
nvm list
```

---

## Option 2: Direct Installation from nodejs.org

This will replace your current Node.js v22 installation.

### Step 1: Download Node.js 24 LTS
1. Go to: https://nodejs.org/
2. Download the **LTS version** (should be v24.x.x)
3. Choose the Windows Installer (.msi) for your system (64-bit recommended)

### Step 2: Install
1. Run the downloaded `.msi` installer
2. Follow the installation wizard
3. **Important:** Check "Automatically install the necessary tools" if prompted
4. Complete the installation

### Step 3: Verify
Open a **new** PowerShell or Command Prompt window:

```powershell
node --version
# Should show: v24.x.x

npm --version
```

### Step 4: Reinstall Dependencies
After installing Node.js 24, you'll need to reinstall dependencies:

```powershell
# Backend
cd backend
rm -r node_modules
npm install --legacy-peer-deps

# Frontend
cd ../frontend
rm -r node_modules
npm install --legacy-peer-deps
```

---

## Option 3: Using fnm (Fast Node Manager)

fnm is a fast, cross-platform Node.js version manager written in Rust.

### Step 1: Install fnm
Using PowerShell:

```powershell
# Install via winget
winget install Schniz.fnm

# Or install via Chocolatey
choco install fnm

# Or install via Scoop
scoop install fnm
```

### Step 2: Initialize fnm
Add to your PowerShell profile:

```powershell
# Add to $PROFILE
fnm env --use-on-cd | Out-String | Invoke-Expression
```

### Step 3: Install and Use Node.js 24
```powershell
# Install Node.js 24 LTS
fnm install 24

# Use Node.js 24
fnm use 24

# Set as default
fnm default 24

# Verify
node --version
```

---

## Recommended Approach

**For Development:** Use **nvm-windows** (Option 1)
- Allows switching between Node.js versions easily
- Useful if you work on multiple projects with different Node.js requirements
- No need to uninstall current Node.js

**For Simple Setup:** Use **Direct Installation** (Option 2)
- Simpler, one-time installation
- Replaces current Node.js version
- Good if you only need Node.js 24

---

## After Installation

1. **Verify Node.js version:**
   ```powershell
   node --version
   # Should show: v24.x.x
   ```

2. **Verify npm version:**
   ```powershell
   npm --version
   # Should be >= 10.0.0
   ```

3. **Reinstall project dependencies:**
   ```powershell
   # Backend
   cd backend
   Remove-Item -Recurse -Force node_modules
   npm install --legacy-peer-deps
   
   # Frontend
   cd ../frontend
   Remove-Item -Recurse -Force node_modules
   npm install --legacy-peer-deps
   ```

4. **Test the builds:**
   ```powershell
   # Backend
   cd backend
   npm run build
   
   # Frontend
   cd ../frontend
   npm run build
   ```

---

## Troubleshooting

### Issue: "nvm is not recognized"
- Make sure you opened a **new** PowerShell/Command Prompt window after installing nvm-windows
- Restart your terminal/IDE

### Issue: "Node.js version still shows v22"
- Make sure you ran `nvm use 24` (if using nvm-windows)
- Close and reopen your terminal/IDE
- Check that nvm-windows is in your PATH

### Issue: Dependencies fail to install
- Try removing `node_modules` and `package-lock.json`:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  Remove-Item package-lock.json
  npm install --legacy-peer-deps
  ```

---

## Current Status

- **Current Node.js:** v25.3.0 ✅
- **Required Node.js:** >=24.0.0 ✅ **REQUIREMENT MET**
- **Recommended for Production:** Node.js 24 LTS (Krypton) - for long-term stability
- **Note:** Node.js 25.3 is newer than 24 LTS but is a Current (non-LTS) release. For production, consider using Node.js 24 LTS for better stability and longer support.

---

**Last Updated:** January 17, 2026
