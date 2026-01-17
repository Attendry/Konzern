# Architecture & Version Review Report

**Date:** January 17, 2026  
**Scope:** Full-stack application technology stack review  
**Focus:** Version updates, deprecation status, and recommendations

---

## Executive Summary

This report reviews the current technology stack and identifies packages that require updates due to:
- **Outdated versions** with newer stable releases available
- **End-of-life (EOL)** or deprecated packages
- **Security concerns** from outdated dependencies
- **Node.js version** inconsistencies and upcoming EOL

### Critical Issues Found:
1. ⚠️ **@google/generative-ai** is **END-OF-LIFE** (EOL since August 31, 2025)
2. ⚠️ **Node.js version mismatch** - `.nvmrc` specifies v18, but backend requires >=20, and v20 EOL is April 2026
3. ⚠️ **React 18** is no longer in active support (React 19 is current)
4. ⚠️ **Vite v5** is significantly outdated (v7.1.4 is current)

---

## Current Architecture Overview

### Technology Stack

| Layer | Technology | Current Version | Status |
|-------|------------|----------------|--------|
| **Runtime** | Node.js | 18 (specified) / >=20 (required) | ⚠️ Inconsistent |
| **Backend Framework** | NestJS | v10.0.0 | ⚠️ Update available |
| **Frontend Framework** | React | v18.2.0 | ⚠️ EOL |
| **Build Tool (Frontend)** | Vite | v5.0.8 | ⚠️ Significantly outdated |
| **Database** | Supabase (PostgreSQL) | - | ✅ Current |
| **ORM** | TypeORM | v0.3.17 | ⚠️ Minor update available |
| **Language** | TypeScript | v5.1.3 (backend) / v5.2.2 (frontend) | ⚠️ Update available |
| **Linter** | ESLint | v8.57.0 | ⚠️ Major update available |

---

## Detailed Version Analysis

### 🔴 CRITICAL - End-of-Life Packages

#### 1. @google/generative-ai (v0.24.1)
- **Status:** ❌ **END-OF-LIFE** (EOL since August 31, 2025)
- **Location:** `backend/package.json`
- **Current:** v0.24.1
- **Issue:** Package is in limited maintenance mode with no new features. Support fully ended on August 31, 2025.
- **Impact:** No security updates, bug fixes, or new features. May become incompatible with future Node.js/TypeScript versions.
- **Recommendation:** 
  - **URGENT:** Migrate to the new Google Generative AI SDK
  - Check Google's migration guide for the replacement package
  - Plan migration within next sprint

---

### 🟠 HIGH PRIORITY - Major Updates Available

#### 2. Vite (v5.0.8)
- **Status:** ⚠️ **Significantly Outdated**
- **Location:** `frontend/package.json`
- **Current:** v5.0.8
- **Latest Stable:** v7.1.4
- **Gap:** 2 major versions behind
- **Impact:** Missing performance improvements, bug fixes, and new features
- **Recommendation:**
  - Plan upgrade to v7.1.4
  - Review [Vite migration guide](https://vitejs.dev/guide/migration.html) for breaking changes
  - Test thoroughly as this is a major version jump

#### 3. React (v18.2.0)
- **Status:** ⚠️ **No Longer in Active Support**
- **Location:** `frontend/package.json`
- **Current:** v18.2.0
- **Latest Stable:** v19.2.3
- **Status:** React 18 has exited active support; React 19 is current
- **Impact:** Missing new features, optimizations, and long-term support
- **Recommendation:**
  - Plan upgrade to React 19.2.3
  - Review [React 19 upgrade guide](https://react.dev/blog/2024/12/05/react-19)
  - Note: React 19 has breaking changes (e.g., ref as prop, form actions)

#### 4. NestJS (v10.0.0)
- **Status:** ⚠️ **Major Update Available**
- **Location:** `backend/package.json`
- **Current:** v10.0.0
- **Latest Stable:** v11.1.11
- **Gap:** 1 major version behind
- **Impact:** Missing new features, performance improvements, and bug fixes
- **Recommendation:**
  - Review [NestJS v11 migration guide](https://docs.nestjs.com/migration-guide)
  - Test thoroughly as major versions may include breaking changes
  - Update all `@nestjs/*` packages together

#### 5. ESLint (v8.57.0)
- **Status:** ⚠️ **Major Update Available**
- **Location:** Both `backend/package.json` and `frontend/package.json`
- **Current:** v8.57.0 (backend), v8.55.0 (frontend)
- **Latest Stable:** v9.39.2
- **Status:** v9.x is in maintenance mode; v10.x is in beta
- **Impact:** Missing new rules, performance improvements, and bug fixes
- **Recommendation:**
  - Upgrade to ESLint v9.39.2
  - Review [ESLint v9 migration guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
  - Note: ESLint v9 has a new flat config format

---

### 🟡 MEDIUM PRIORITY - Updates Recommended

#### 6. TypeScript
- **Status:** ⚠️ **Update Available**
- **Location:** 
  - Backend: v5.1.3
  - Frontend: v5.2.2
- **Latest Stable:** v5.9.2
- **Gap:** Multiple minor versions behind
- **Impact:** Missing type improvements, performance optimizations, and bug fixes
- **Recommendation:**
  - Upgrade both to TypeScript v5.9.2
  - Review [TypeScript 5.9 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
  - Test for any type errors after upgrade

#### 7. TypeORM (v0.3.17)
- **Status:** ⚠️ **Minor Update Available**
- **Location:** `backend/package.json`
- **Current:** v0.3.17
- **Latest Stable:** v0.3.26
- **Gap:** 9 patch versions behind
- **Impact:** Missing bug fixes and minor improvements
- **Recommendation:**
  - Upgrade to v0.3.26
  - Review changelog for any breaking changes
  - Note: TypeORM is still pre-1.0.0, so breaking changes are possible

#### 8. Node.js Version Inconsistency
- **Status:** ⚠️ **Configuration Mismatch**
- **Location:** 
  - `.nvmrc`: v18
  - `.node-version`: v18
  - Root `package.json`: `>=18.0.0`
  - Backend `package.json`: `>=20.0.0`
- **Current LTS:** Node.js v24 LTS (Krypton)
- **Issue:** 
  - Version files specify v18, but backend requires >=20
  - Node.js v20 EOL is **April 30, 2026** (only 3 months away)
  - Node.js v18 is already EOL
- **Impact:** 
  - Confusion about which version to use
  - Security risks from unsupported Node.js versions
  - Potential compatibility issues
- **Recommendation:**
  - **URGENT:** Standardize on Node.js v24 LTS (Krypton)
  - Update `.nvmrc` to `24`
  - Update `.node-version` to `24`
  - Update root `package.json` engines to `>=24.0.0`
  - Update backend `package.json` engines to `>=24.0.0`
  - Test application thoroughly on Node.js v24

---

### 🟢 LOW PRIORITY - Current or Minor Updates

#### 9. Supabase Client
- **Status:** ✅ **Mostly Current**
- **Location:** 
  - Backend: v2.90.1 ✅
  - Frontend: v2.89.0 ⚠️ (1 minor version behind)
- **Latest Stable:** v2.90.1
- **Recommendation:**
  - Update frontend to v2.90.1 to match backend
  - Note: Supabase dropped Node.js 18 support in v2.79.0, so upgrading Node.js is required

#### 10. Other Dependencies
Most other dependencies are relatively current or have minor updates available:
- `@tanstack/react-table`: v8.10.7 ✅
- `axios`: v1.6.2 ✅
- `react-router-dom`: v6.20.0 ✅
- `recharts`: v3.6.0 ✅
- `pg`: v8.11.3 ✅
- `helmet`: v8.1.0 ✅

---

## Version Inconsistencies

### Node.js Version Mismatch
The project has conflicting Node.js version requirements:
- `.nvmrc` and `.node-version` specify: **v18**
- Root `package.json` requires: **>=18.0.0**
- Backend `package.json` requires: **>=20.0.0**

**Resolution:** Standardize on Node.js v24 LTS

### TypeScript Version Mismatch
- Backend uses: **v5.1.3**
- Frontend uses: **v5.2.2**

**Resolution:** Standardize on TypeScript v5.9.2 for both

### ESLint Version Mismatch
- Backend uses: **v8.57.0**
- Frontend uses: **v8.55.0**

**Resolution:** Standardize on ESLint v9.39.2 for both

---

## Recommended Update Priority

### Phase 1: Critical (Immediate Action Required)
1. **@google/generative-ai** - Migrate to new SDK (EOL)
2. **Node.js** - Standardize and upgrade to v24 LTS (EOL approaching)

### Phase 2: High Priority (Next Sprint)
3. **Vite** - Upgrade to v7.1.4 (2 major versions behind)
4. **React** - Upgrade to v19.2.3 (React 18 EOL)
5. **NestJS** - Upgrade to v11.1.11 (major version behind)

### Phase 3: Medium Priority (Next Month)
6. **TypeScript** - Upgrade to v5.9.2 (both backend and frontend)
7. **ESLint** - Upgrade to v9.39.2 (both backend and frontend)
8. **TypeORM** - Upgrade to v0.3.26
9. **Supabase (frontend)** - Update to v2.90.1

### Phase 4: Low Priority (Ongoing)
10. Other minor dependency updates as needed

---

## Migration Considerations

### Breaking Changes to Watch For

1. **React 19:**
   - `ref` as a prop (no longer needs `forwardRef`)
   - Form actions API changes
   - Context API changes
   - New hooks and features

2. **Vite 7:**
   - Configuration format changes
   - Plugin API updates
   - Build output changes

3. **NestJS 11:**
   - Check migration guide for breaking changes
   - Update all `@nestjs/*` packages together

4. **ESLint 9:**
   - New flat config format (replaces `.eslintrc`)
   - Rule changes and deprecations

5. **Node.js 24:**
   - Test all dependencies for compatibility
   - Review any native module rebuilds needed

---

## Testing Strategy

After each major update:
1. Run full test suite
2. Test critical user flows manually
3. Check for TypeScript errors
4. Verify build processes (frontend and backend)
5. Test deployment pipeline
6. Monitor for runtime errors

---

## Action Items Summary

### Immediate (This Week)
- [ ] Research Google Generative AI SDK migration path
- [ ] Update Node.js version files to v24
- [ ] Test application on Node.js v24

### Short-term (This Month)
- [ ] Migrate from `@google/generative-ai` to new SDK
- [ ] Upgrade Vite to v7.1.4
- [ ] Upgrade React to v19.2.3
- [ ] Upgrade NestJS to v11.1.11

### Medium-term (Next Quarter)
- [ ] Upgrade TypeScript to v5.9.2
- [ ] Upgrade ESLint to v9.39.2
- [ ] Upgrade TypeORM to v0.3.26
- [ ] Standardize all dependency versions across packages

---

## Additional Notes

### Architecture Observations
- **TypeORM Usage:** TypeORM entities are defined but not actively used (Supabase client is used instead). Consider removing TypeORM if not needed, or fully adopting it for better type safety.
- **Database:** Supabase (PostgreSQL) is current and well-maintained ✅
- **Build Tools:** Vite is modern but needs updating
- **Framework Choices:** NestJS and React are solid choices but need version updates

### Security Considerations
- Outdated packages may have security vulnerabilities
- Node.js v18/v20 EOL means no security patches after EOL dates
- EOL packages like `@google/generative-ai` receive no security updates

---

## Conclusion

The application uses a modern, well-structured technology stack. However, several critical updates are needed:

1. **Critical:** Migrate from EOL `@google/generative-ai` package
2. **Critical:** Standardize and upgrade Node.js to v24 LTS
3. **High Priority:** Major framework updates (Vite, React, NestJS)
4. **Medium Priority:** TypeScript, ESLint, and other tooling updates

Following the phased approach above will ensure a smooth transition while maintaining application stability.

---

**Report Generated:** January 17, 2026  
**Next Review:** After Phase 1 updates are complete
