# Migration Quick Reference Checklist

**Quick reference for version migration tasks**

---

## Phase 1: Critical (Week 1-2) 🔴

### 1.1 Google Generative AI SDK Migration
- [ ] Install `@google/genai` package
- [ ] Remove `@google/generative-ai` package
- [ ] Update imports in `gemini.service.ts`
- [ ] Refactor `GoogleGenerativeAI` → `GoogleGenAI`
- [ ] Update `complete()` method API
- [ ] Update `chat()` method API
- [ ] Update `stream()` method API
- [ ] Update type definitions
- [ ] Run unit tests
- [ ] Test AI features manually
- [ ] Verify no TypeScript errors

### 1.2 Node.js Upgrade to v24 LTS
- [ ] Update `.nvmrc` to `24`
- [ ] Update `.node-version` to `24`
- [ ] Update root `package.json` engines to `>=24.0.0`
- [ ] Update backend `package.json` engines to `>=24.0.0`
- [ ] Update `@types/node` to `^24.0.0`
- [ ] Switch to Node.js 24 locally (`nvm use 24`)
- [ ] Rebuild dependencies (`rm -rf node_modules && npm install`)
- [ ] Update Railway deployment config
- [ ] Update Vercel deployment config
- [ ] Test application startup
- [ ] Test all API endpoints
- [ ] Verify database connections

---

## Phase 2: High Priority (Week 3-4) 🟠

### 2.1 Vite Upgrade to v7.1.4
- [ ] Install `vite@^7.1.4`
- [ ] Install `@vitejs/plugin-react@^4.2.1`
- [ ] Review `vite.config.ts` for breaking changes
- [ ] Test development server (`npm run dev`)
- [ ] Test production build (`npm run build`)
- [ ] Test preview (`npm run preview`)
- [ ] Verify HMR works
- [ ] Verify proxy configuration
- [ ] Check build output

### 2.2 React Upgrade to v19.2.3
- [ ] Install `react@^19.2.3` and `react-dom@^19.2.3`
- [ ] Install `@types/react@^19.0.0` and `@types/react-dom@^19.0.0`
- [ ] Review components using `forwardRef`
- [ ] Update form handling (if needed)
- [ ] Update Context usage (if needed)
- [ ] Fix TypeScript errors
- [ ] Test all components render
- [ ] Test forms
- [ ] Test state management
- [ ] Check for console warnings
- [ ] Verify performance

### 2.3 NestJS Upgrade to v11.1.11
- [ ] Install all `@nestjs/*` packages to v11
- [ ] Update `@nestjs/cli` and testing packages
- [ ] Review breaking changes
- [ ] Fix compilation errors
- [ ] Test module loading
- [ ] Test dependency injection
- [ ] Test API endpoints
- [ ] Test guards/interceptors
- [ ] Run all tests

---

## Phase 3: Medium Priority (Week 5-6) 🟡

### 3.1 TypeScript Upgrade to v5.9.2
- [ ] Update backend TypeScript to `^5.9.2`
- [ ] Update frontend TypeScript to `^5.9.2`
- [ ] Fix new type errors
- [ ] Test backend build
- [ ] Test frontend build

### 3.2 ESLint Upgrade to v9.39.2
- [ ] Update ESLint packages (backend)
- [ ] Update ESLint packages (frontend)
- [ ] Create `eslint.config.js` (flat config)
- [ ] Remove old `.eslintrc` files
- [ ] Test linting (`npm run lint`)
- [ ] Verify IDE integration

### 3.3 TypeORM Upgrade to v0.3.26
- [ ] Install `typeorm@^0.3.26`
- [ ] Review changelog
- [ ] Test entity definitions
- [ ] Test database operations (if used)

### 3.4 Supabase Client Update
- [ ] Update frontend `@supabase/supabase-js` to `^2.90.1`
- [ ] Test authentication
- [ ] Test database queries

---

## General Testing (After Each Phase)

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual testing of critical flows
- [ ] Check for console errors
- [ ] Check for TypeScript errors
- [ ] Verify build processes
- [ ] Test in staging environment
- [ ] Monitor error logs

---

## Deployment Checklist

- [ ] Update environment variables (if needed)
- [ ] Update CI/CD configurations
- [ ] Test deployment to staging
- [ ] Verify production deployment
- [ ] Monitor for errors post-deployment
- [ ] Update documentation

---

## Rollback Preparation

- [ ] Create backup branch before starting
- [ ] Document current versions
- [ ] Test rollback procedure
- [ ] Keep old package versions noted
- [ ] Have rollback commands ready

---

**Last Updated:** January 17, 2026
