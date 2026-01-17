# Version Migration Plan

**Date:** January 17, 2026  
**Purpose:** Step-by-step guide to migrate from current versions to recommended versions  
**Estimated Total Duration:** 4-6 weeks (depending on testing and deployment cycles)

---

## Overview

This plan outlines the migration strategy organized by priority:
- **Phase 1: Critical** (Week 1-2) - EOL packages and security issues
- **Phase 2: High Priority** (Week 3-4) - Major framework updates
- **Phase 3: Medium Priority** (Week 5-6) - Tooling and dependency updates

Each phase includes:
- Prerequisites
- Step-by-step instructions
- Testing checkpoints
- Rollback procedures
- Success criteria

---

## Pre-Migration Checklist

Before starting any migration:

- [ ] **Create a backup branch** from current production state
- [ ] **Document current environment** (Node.js version, package versions)
- [ ] **Run full test suite** and document baseline results
- [ ] **Identify all deployment environments** (local, staging, production)
- [ ] **Set up feature flags** for gradual rollout (if applicable)
- [ ] **Notify team members** of migration timeline
- [ ] **Prepare rollback plan** for each phase

---

## Phase 1: Critical Updates (Week 1-2)

### Priority: 🔴 CRITICAL - Immediate Action Required

---

### 1.1 Migrate @google/generative-ai to @google/genai

**Status:** ❌ END-OF-LIFE (EOL since August 31, 2025)  
**Estimated Time:** 4-6 hours  
**Risk Level:** Medium (API changes required)

#### Prerequisites
- [ ] Review [Google GenAI SDK migration guide](https://ai.google.dev/gemini-api/docs/migrate)
- [ ] Understand new API structure (Client-based vs model-based)
- [ ] Backup current `gemini.service.ts`

#### Step-by-Step Instructions

**Step 1: Install new package**
```bash
cd backend
npm uninstall @google/generative-ai
npm install @google/genai
```

**Step 2: Update imports in `backend/src/modules/ai/services/gemini.service.ts`**

**Before:**
```typescript
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
```

**After:**
```typescript
import { GoogleGenAI } from '@google/genai';
```

**Step 3: Refactor service initialization**

**Before:**
```typescript
this.genAI = new GoogleGenerativeAI(apiKey);
this.model = this.genAI.getGenerativeModel({
  model: this.modelName,
});
```

**After:**
```typescript
this.client = new GoogleGenAI({ apiKey });
// Model is accessed through client.models
```

**Step 4: Update `complete()` method**

**Before:**
```typescript
const result = await this.model.generateContent(fullPrompt);
const response = result.response;
return response.text();
```

**After:**
```typescript
const response = await this.client.models.generateContent({
  model: this.modelName,
  contents: fullPrompt,
});
return response.text;
```

**Step 5: Update `chat()` method**

**Before:**
```typescript
const chat = this.model.startChat({ history });
const result = await chat.sendMessage(lastMessage.content);
return result.response.text();
```

**After:**
```typescript
// New SDK uses client.chats API
const chat = await this.client.chats.create({
  model: this.modelName,
  history: history,
});
const result = await chat.sendMessage(lastMessage.content);
return result.text;
```

**Step 6: Update `stream()` method**

**Before:**
```typescript
const result = await this.model.generateContentStream(fullPrompt);
for await (const chunk of result.stream) {
  const text = chunk.text();
  if (text) {
    yield text;
  }
}
```

**After:**
```typescript
const stream = await this.client.models.generateContentStream({
  model: this.modelName,
  contents: fullPrompt,
});
for await (const chunk of stream) {
  const text = chunk.text;
  if (text) {
    yield text;
  }
}
```

**Step 7: Update type definitions**
- Update `private genAI: GoogleGenerativeAI` → `private client: GoogleGenAI`
- Update `private model: GenerativeModel` → Remove (access via client)
- Update `isAvailable()` to check `this.client` instead

#### Testing Checklist
- [ ] Unit tests pass for `GeminiService`
- [ ] Test `complete()` method with various prompts
- [ ] Test `chat()` method with message history
- [ ] Test `stream()` method (if used)
- [ ] Test error handling (missing API key, invalid requests)
- [ ] Integration tests with AI features pass
- [ ] Manual testing of chat functionality in UI

#### Rollback Procedure
```bash
cd backend
git checkout HEAD -- src/modules/ai/services/gemini.service.ts
npm uninstall @google/genai
npm install @google/generative-ai@^0.24.1
```

#### Success Criteria
- ✅ All tests pass
- ✅ AI chat features work in application
- ✅ No TypeScript errors
- ✅ No runtime errors in logs

---

### 1.2 Standardize and Upgrade Node.js to v24 LTS

**Status:** ⚠️ Version mismatch + EOL approaching  
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium (may require dependency rebuilds)

#### Prerequisites
- [ ] Verify Node.js v24 LTS is available in your environment
- [ ] Check Railway/Vercel deployment platforms support Node.js 24
- [ ] Review any native module dependencies (pg, etc.)

#### Step-by-Step Instructions

**Step 1: Update version files**
```bash
# Update .nvmrc
echo "24" > .nvmrc

# Update .node-version
echo "24" > .node-version
```

**Step 2: Update root `package.json`**
```json
"engines": {
  "node": ">=24.0.0",
  "npm": ">=10.0.0"
}
```

**Step 3: Update `backend/package.json`**
```json
"engines": {
  "node": ">=24.0.0",
  "npm": ">=10.0.0"
}
```

**Step 4: Update `@types/node` in backend**
```bash
cd backend
npm install --save-dev @types/node@^24.0.0
```

**Step 5: Switch to Node.js 24 locally**
```bash
# Using nvm
nvm install 24
nvm use 24

# Verify version
node --version  # Should show v24.x.x
```

**Step 6: Rebuild native dependencies**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

**Step 7: Update deployment configurations**
- **Railway:** Update `NODE_VERSION` environment variable or `package.json` engines
- **Vercel:** Update build settings to use Node.js 24
- **Docker:** Update Dockerfile base image if used

#### Testing Checklist
- [ ] Application starts successfully
- [ ] Backend API endpoints respond correctly
- [ ] Frontend builds without errors
- [ ] Database connections work (Supabase)
- [ ] All npm scripts execute successfully
- [ ] No native module errors in logs

#### Rollback Procedure
```bash
# Revert version files
echo "18" > .nvmrc
echo "18" > .node-version

# Revert package.json engines
# (manually edit to >=18.0.0)

# Switch back to Node.js 18
nvm use 18
npm install
```

#### Success Criteria
- ✅ Application runs on Node.js 24
- ✅ All tests pass
- ✅ No deprecation warnings
- ✅ Deployment platforms support Node.js 24

---

## Phase 2: High Priority Updates (Week 3-4)

### Priority: 🟠 HIGH - Next Sprint

---

### 2.1 Upgrade Vite from v5.0.8 to v7.1.4

**Status:** ⚠️ 2 major versions behind  
**Estimated Time:** 6-8 hours  
**Risk Level:** Medium-High (major version jump)

#### Prerequisites
- [ ] Review [Vite 7 migration guide](https://vitejs.dev/guide/migration.html)
- [ ] Review [Vite 6 migration guide](https://vitejs.dev/guide/migration.html) (if needed)
- [ ] Backup `vite.config.ts`
- [ ] Check all Vite plugins for compatibility

#### Step-by-Step Instructions

**Step 1: Update Vite and related plugins**
```bash
cd frontend
npm install vite@^7.1.4 @vitejs/plugin-react@^4.2.1
```

**Step 2: Review `vite.config.ts` for breaking changes**
- Check plugin compatibility
- Review configuration format changes
- Update any deprecated options

**Step 3: Update build scripts if needed**
- Verify `vite build` still works
- Check output directory structure
- Verify source maps

**Step 4: Test development server**
```bash
npm run dev
# Verify hot module replacement works
# Test proxy configuration
```

**Step 5: Test production build**
```bash
npm run build
# Verify dist/ output
# Test preview build
npm run preview
```

#### Testing Checklist
- [ ] Development server starts without errors
- [ ] Hot module replacement works
- [ ] Production build completes successfully
- [ ] Build output is correct
- [ ] Source maps work in production
- [ ] Proxy configuration works
- [ ] All routes load correctly

#### Rollback Procedure
```bash
cd frontend
npm install vite@^5.0.8 @vitejs/plugin-react@^4.2.1
git checkout HEAD -- vite.config.ts
```

#### Success Criteria
- ✅ Dev server works correctly
- ✅ Production build succeeds
- ✅ No console errors
- ✅ Performance is maintained or improved

---

### 2.2 Upgrade React from v18.2.0 to v19.2.3

**Status:** ⚠️ React 18 no longer in active support  
**Estimated Time:** 8-12 hours  
**Risk Level:** High (breaking changes)

#### Prerequisites
- [ ] Review [React 19 upgrade guide](https://react.dev/blog/2024/12/05/react-19)
- [ ] Review [React 19 breaking changes](https://react.dev/blog/2024/12/05/react-19#breaking-changes)
- [ ] Audit all React components for deprecated patterns
- [ ] Check all React-related dependencies for compatibility

#### Step-by-Step Instructions

**Step 1: Update React and React DOM**
```bash
cd frontend
npm install react@^19.2.3 react-dom@^19.2.3
```

**Step 2: Update React types**
```bash
npm install --save-dev @types/react@^19.0.0 @types/react-dom@^19.0.0
```

**Step 3: Update React Router (if needed)**
```bash
# Check compatibility - React Router v6.20.0 should work with React 19
# If issues occur, may need to update
npm install react-router-dom@^6.20.0
```

**Step 4: Review and update components using `forwardRef`**
- React 19 allows `ref` as a prop directly
- Remove unnecessary `forwardRef` wrappers where possible

**Step 5: Update form handling (if using form actions)**
- Review form components for React 19 form action changes
- Update any custom form handling

**Step 6: Update Context usage (if applicable)**
- Review Context API usage for any breaking changes

**Step 7: Fix TypeScript errors**
- Update component prop types
- Fix any type mismatches

#### Testing Checklist
- [ ] All components render correctly
- [ ] No console warnings about deprecated APIs
- [ ] Forms work correctly
- [ ] Context providers work
- [ ] Refs work correctly
- [ ] Event handlers work
- [ ] State updates work correctly
- [ ] No memory leaks
- [ ] Performance is maintained

#### Rollback Procedure
```bash
cd frontend
npm install react@^18.2.0 react-dom@^18.2.0
npm install --save-dev @types/react@^18.2.43 @types/react-dom@^18.2.17
```

#### Success Criteria
- ✅ All components work correctly
- ✅ No TypeScript errors
- ✅ No React warnings in console
- ✅ Application performance is maintained

---

### 2.3 Upgrade NestJS from v10.0.0 to v11.1.11

**Status:** ⚠️ 1 major version behind  
**Estimated Time:** 6-10 hours  
**Risk Level:** Medium (major version)

#### Prerequisites
- [ ] Review [NestJS v11 migration guide](https://docs.nestjs.com/migration-guide)
- [ ] Check all NestJS packages for compatibility
- [ ] Review breaking changes documentation
- [ ] Backup critical service files

#### Step-by-Step Instructions

**Step 1: Update all NestJS core packages**
```bash
cd backend
npm install @nestjs/common@^11.1.11 \
            @nestjs/core@^11.1.11 \
            @nestjs/platform-express@^11.1.11 \
            @nestjs/config@^3.1.1 \
            @nestjs/mapped-types@^2.0.2 \
            @nestjs/throttler@^5.2.0 \
            @nestjs/typeorm@^10.0.0
```

**Step 2: Update NestJS CLI and testing**
```bash
npm install --save-dev @nestjs/cli@^11.0.0 \
                        @nestjs/schematics@^11.0.0 \
                        @nestjs/testing@^11.1.11
```

**Step 3: Review breaking changes**
- Check decorator changes
- Review module imports
- Check dependency injection changes
- Review exception filters

**Step 4: Update TypeScript configuration if needed**
- Ensure `experimentalDecorators` and `emitDecoratorMetadata` are enabled

**Step 5: Fix any compilation errors**
- Update imports if needed
- Fix decorator usage
- Update exception handling

**Step 6: Test all modules**
- Verify all modules load correctly
- Test dependency injection
- Test guards and interceptors

#### Testing Checklist
- [ ] Application compiles without errors
- [ ] All modules load correctly
- [ ] API endpoints respond correctly
- [ ] Dependency injection works
- [ ] Guards and interceptors work
- [ ] Exception filters work
- [ ] All tests pass

#### Rollback Procedure
```bash
cd backend
npm install @nestjs/common@^10.0.0 \
            @nestjs/core@^10.0.0 \
            @nestjs/platform-express@^10.0.0 \
            @nestjs/cli@^10.0.0 \
            @nestjs/schematics@^10.0.0 \
            @nestjs/testing@^10.0.0
```

#### Success Criteria
- ✅ Application starts successfully
- ✅ All API endpoints work
- ✅ No runtime errors
- ✅ All tests pass

---

## Phase 3: Medium Priority Updates (Week 5-6)

### Priority: 🟡 MEDIUM - Next Month

---

### 3.1 Upgrade TypeScript to v5.9.2

**Status:** ⚠️ Multiple minor versions behind  
**Estimated Time:** 2-4 hours  
**Risk Level:** Low-Medium

#### Step-by-Step Instructions

**Step 1: Update backend TypeScript**
```bash
cd backend
npm install --save-dev typescript@^5.9.2
```

**Step 2: Update frontend TypeScript**
```bash
cd frontend
npm install --save-dev typescript@^5.9.2
```

**Step 3: Fix any new type errors**
- Review TypeScript 5.9 release notes
- Fix any stricter type checking
- Update type definitions if needed

**Step 4: Verify builds**
```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

#### Testing Checklist
- [ ] No TypeScript compilation errors
- [ ] Type checking is more accurate (if applicable)
- [ ] Build processes work
- [ ] IDE type hints work correctly

#### Success Criteria
- ✅ Both projects compile successfully
- ✅ No new type errors
- ✅ Build times are acceptable

---

### 3.2 Upgrade ESLint to v9.39.2

**Status:** ⚠️ Major version behind  
**Estimated Time:** 4-6 hours  
**Risk Level:** Medium (new flat config format)

#### Prerequisites
- [ ] Review [ESLint v9 migration guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [ ] Understand flat config format
- [ ] Backup current ESLint configuration

#### Step-by-Step Instructions

**Step 1: Update ESLint packages (backend)**
```bash
cd backend
npm install --save-dev eslint@^9.39.2 \
                        @typescript-eslint/eslint-plugin@^8.0.0 \
                        @typescript-eslint/parser@^8.0.0 \
                        eslint-config-prettier@^9.0.0 \
                        eslint-plugin-prettier@^5.0.0
```

**Step 2: Update ESLint packages (frontend)**
```bash
cd frontend
npm install --save-dev eslint@^9.39.2 \
                        @typescript-eslint/eslint-plugin@^8.0.0 \
                        @typescript-eslint/parser@^8.0.0 \
                        eslint-plugin-react-hooks@^5.0.0 \
                        eslint-plugin-react-refresh@^0.4.5
```

**Step 3: Migrate to flat config format**

Create `eslint.config.js` (or `.mjs`) in both backend and frontend:

**Backend example:**
```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    rules: {
      // Your custom rules
    },
  }
);
```

**Step 4: Remove old `.eslintrc` files**
```bash
# Remove old config files
rm .eslintrc.js .eslintrc.json .eslintrc.yml
```

**Step 5: Test linting**
```bash
npm run lint
```

#### Testing Checklist
- [ ] ESLint runs without errors
- [ ] All rules work correctly
- [ ] Prettier integration works
- [ ] IDE integration works
- [ ] CI/CD linting passes

#### Success Criteria
- ✅ ESLint runs successfully
- ✅ All rules are applied correctly
- ✅ No configuration errors

---

### 3.3 Upgrade TypeORM to v0.3.26

**Status:** ⚠️ 9 patch versions behind  
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

#### Step-by-Step Instructions

**Step 1: Update TypeORM**
```bash
cd backend
npm install typeorm@^0.3.26
```

**Step 2: Review changelog**
- Check for any breaking changes
- Review bug fixes

**Step 3: Test database operations**
- Verify entity definitions work
- Test migrations (if used)
- Test queries

#### Testing Checklist
- [ ] TypeORM imports work
- [ ] Entity definitions are valid
- [ ] No runtime errors
- [ ] Database operations work (if TypeORM is used)

#### Success Criteria
- ✅ No compilation errors
- ✅ No runtime errors
- ✅ Database operations work (if applicable)

---

### 3.4 Update Supabase Client (Frontend)

**Status:** ⚠️ 1 minor version behind  
**Estimated Time:** 30 minutes  
**Risk Level:** Low

#### Step-by-Step Instructions

**Step 1: Update Supabase client**
```bash
cd frontend
npm install @supabase/supabase-js@^2.90.1
```

**Step 2: Test Supabase operations**
- Verify authentication works
- Test database queries
- Test real-time subscriptions (if used)

#### Testing Checklist
- [ ] Authentication works
- [ ] Database queries work
- [ ] No breaking changes in API

#### Success Criteria
- ✅ Frontend Supabase version matches backend
- ✅ All Supabase operations work

---

## Testing Strategy

### After Each Phase

1. **Unit Tests**
   ```bash
   # Backend
   cd backend && npm test
   
   # Frontend
   cd frontend && npm test
   ```

2. **Integration Tests**
   - Test critical user flows
   - Test API endpoints
   - Test database operations

3. **Manual Testing**
   - Test all major features
   - Test error scenarios
   - Test edge cases

4. **Performance Testing**
   - Check build times
   - Check runtime performance
   - Check bundle sizes (frontend)

5. **Deployment Testing**
   - Test in staging environment
   - Verify environment variables
   - Test deployment scripts

---

## Rollback Strategy

### General Rollback Procedure

1. **Identify the problematic change**
   - Check git commit history
   - Review error logs
   - Identify which phase/update caused issues

2. **Revert changes**
   ```bash
   # Revert to previous commit
   git revert <commit-hash>
   
   # Or checkout previous branch
   git checkout <previous-branch>
   ```

3. **Restore dependencies**
   ```bash
   # Remove node_modules and lock files
   rm -rf node_modules package-lock.json
   
   # Restore from backup or reinstall old versions
   npm install
   ```

4. **Verify rollback**
   - Run tests
   - Test application manually
   - Verify deployment

---

## Success Metrics

### Phase 1 (Critical)
- ✅ EOL package migrated
- ✅ Node.js standardized and upgraded
- ✅ All tests pass
- ✅ No security vulnerabilities

### Phase 2 (High Priority)
- ✅ Vite upgraded successfully
- ✅ React upgraded successfully
- ✅ NestJS upgraded successfully
- ✅ Application performance maintained or improved

### Phase 3 (Medium Priority)
- ✅ TypeScript upgraded
- ✅ ESLint migrated to flat config
- ✅ All dependencies updated
- ✅ Code quality maintained

---

## Timeline Summary

| Phase | Duration | Updates | Risk Level |
|-------|----------|---------|------------|
| **Phase 1** | Week 1-2 | Google AI SDK, Node.js | Medium |
| **Phase 2** | Week 3-4 | Vite, React, NestJS | Medium-High |
| **Phase 3** | Week 5-6 | TypeScript, ESLint, TypeORM, Supabase | Low-Medium |
| **Total** | 4-6 weeks | All updates | - |

---

## Post-Migration Tasks

After completing all phases:

- [ ] Update documentation with new versions
- [ ] Update CI/CD configurations
- [ ] Update deployment documentation
- [ ] Create migration summary report
- [ ] Schedule next version review (3-6 months)
- [ ] Monitor for any issues in production
- [ ] Update team on new features/APIs available

---

## Notes and Considerations

### Dependencies Between Updates

1. **Node.js 24** should be done first (required for Supabase v2.79+)
2. **React 19** may require **Vite 7** for optimal support
3. **ESLint 9** can be done independently but requires config migration
4. **TypeScript 5.9** should be done before major framework updates for better type checking

### Risk Mitigation

- Test each update in isolation when possible
- Use feature branches for each phase
- Deploy to staging before production
- Monitor error logs closely after each deployment
- Keep rollback plan ready

### Communication

- Notify team of migration timeline
- Document any breaking changes for team
- Share new features/APIs available after updates
- Update onboarding documentation

---

**Plan Created:** January 17, 2026  
**Next Review:** After Phase 1 completion
