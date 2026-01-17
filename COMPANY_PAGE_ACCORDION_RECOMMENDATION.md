# Company Page Accordion Implementation Recommendation

## Current State

The `/companies` page currently shows all parent company groups (Mutterunternehmen) fully expanded by default, displaying:
- Hierarchy tree
- Company table
- All data cards

This can be overwhelming when there are multiple parent companies.

## Proposed Solution: Accordion/Collapsible Groups

### User Experience Flow

1. **Initial View (Collapsed State)**:
   - List of all parent companies (Mutterunternehmen)
   - Each shows summary information (name, company count, data stats)
   - Clickable header to expand/collapse
   - Visual indicator (chevron/arrow) showing expand/collapse state

2. **Expanded State**:
   - When a parent company is clicked/expanded:
     - Shows hierarchy tree
     - Shows company table
     - Shows data import cards
   - Other groups remain collapsed

3. **Multiple Expansion**:
   - Option to allow multiple groups expanded simultaneously
   - Or single-expand mode (expanding one collapses others)

## Implementation Approach

### Option 1: Accordion with Single Expand (Recommended)

**Behavior**: Only one group can be expanded at a time. Expanding a new group automatically collapses the previously expanded one.

**Benefits**:
- Cleaner interface
- Focuses user attention on one group at a time
- Reduces visual clutter
- Better for users managing multiple large groups

**Implementation**:
```typescript
// In CompanyManagement.tsx
const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

const handleToggleGroup = (groupId: string) => {
  setExpandedGroupId(prev => prev === groupId ? null : groupId);
};
```

### Option 2: Accordion with Multiple Expand

**Behavior**: Multiple groups can be expanded simultaneously. Each group toggles independently.

**Benefits**:
- Users can compare multiple groups side-by-side
- More flexible for power users
- Better for smaller datasets

**Implementation**:
```typescript
// In CompanyManagement.tsx
const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

const handleToggleGroup = (groupId: string) => {
  setExpandedGroupIds(prev => {
    const next = new Set(prev);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    return next;
  });
};
```

## Recommended Implementation: Option 1 (Single Expand) with Pin Feature

### Pin Feature

**Additional Requirement**: Allow users to "pin" a Mutterunternehmen so it stays always expanded, even when other groups are expanded.

**Behavior**:
- Pin icon/button in the header of each group
- Pinned groups remain expanded regardless of other expansions
- Only one group can be pinned at a time (optional: allow multiple pins)
- Pinned state is visually indicated (different icon, highlight, or badge)
- Clicking pin again unpins the group

**Benefits**:
- Users can keep their current work context visible
- Better workflow for users working on multiple groups
- Reduces need to re-expand frequently used groups

### Visual Design

#### Collapsed State Header:
```
┌─────────────────────────────────────────────────────────┐
│  ▶ MU GmbH (Mutterunternehmen)                          │
│     3 Unternehmen • 5 Jahresabschlüsse • 250 Kontensalden│
└─────────────────────────────────────────────────────────┘
```

#### Expanded State Header:
```
┌─────────────────────────────────────────────────────────┐
│  ▼ MU GmbH (Mutterunternehmen)                    📌    │
│     3 Unternehmen • 5 Jahresabschlüsse • 250 Kontensalden│
├─────────────────────────────────────────────────────────┤
│  [Hierarchy Tree]                                        │
│  [Company Table]                                         │
│  [Data Cards]                                            │
└─────────────────────────────────────────────────────────┘
```

#### Pinned State Header:
```
┌─────────────────────────────────────────────────────────┐
│  ▼ MU GmbH (Mutterunternehmen) [📌 Gepinnt]             │
│     3 Unternehmen • 5 Jahresabschlüsse • 250 Kontensalden│
├─────────────────────────────────────────────────────────┤
│  [Hierarchy Tree]                                        │
│  [Company Table]                                         │
│  [Data Cards]                                            │
└─────────────────────────────────────────────────────────┘
```

### Component Structure

#### 1. Update CompanyManagement Component

**Add state management:**
```typescript
const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
const [pinnedGroupId, setPinnedGroupId] = useState<string | null>(null);

const handleToggleGroup = (groupId: string) => {
  // Don't collapse if it's pinned
  if (pinnedGroupId === groupId) return;
  setExpandedGroupId(prev => prev === groupId ? null : groupId);
};

const handleTogglePin = (groupId: string) => {
  setPinnedGroupId(prev => {
    if (prev === groupId) {
      // Unpinning - also collapse if it was expanded
      setExpandedGroupId(null);
      return null;
    } else {
      // Pinning new group - expand it and unpin previous
      setExpandedGroupId(groupId);
      return groupId;
    }
  });
};
```

**Pass expanded and pinned state to CompanyGroupSection:**
```typescript
<CompanyGroupSection
  key={parentId}
  parentCompany={parentCompany}
  companies={groupCompanies}
  hierarchyData={hierarchyNode || null}
  companyData={companyData}
  expandedCompanyId={expandedCompanyId}
  isExpanded={expandedGroupId === parentId || pinnedGroupId === parentId}
  isPinned={pinnedGroupId === parentId}
  onToggle={() => handleToggleGroup(parentId)}
  onTogglePin={() => handleTogglePin(parentId)}
  // ... other props
/>
```

#### 2. Update CompanyGroupSection Component

**Add props:**
```typescript
interface CompanyGroupSectionProps {
  // ... existing props
  isExpanded: boolean;
  isPinned: boolean;
  onToggle: () => void;
  onTogglePin: () => void;
}
```

**Make header clickable with pin button:**
```typescript
<div 
  className="card-header" 
  style={{ cursor: 'pointer' }}
  onClick={onToggle}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
      <span style={{ 
        display: 'flex', 
        alignItems: 'center',
        transition: 'transform 0.2s',
        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
      }}>
        <ChevronRightIcon />
      </span>
      {/* Header content */}
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation(); // Prevent header toggle
        onTogglePin();
      }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 'var(--spacing-1)',
        display: 'flex',
        alignItems: 'center',
        color: isPinned ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      }}
      title={isPinned ? 'Anheften aufheben' : 'Anheften'}
    >
      <PinIcon filled={isPinned} />
    </button>
  </div>
</div>

{isExpanded && (
  <div style={{ padding: 'var(--spacing-4)' }}>
    {/* Hierarchy, table, and data cards */}
  </div>
)}
```

### Visual Indicators

1. **Chevron Icon**: 
   - Right-pointing (▶) when collapsed
   - Down-pointing (▼) when expanded
   - Smooth rotation animation

2. **Header Styling**:
   - Hover effect to indicate clickability
   - Subtle background change on hover
   - Clear visual separation between collapsed/expanded states

3. **Summary Stats** (always visible):
   - Company count
   - Financial statements count
   - Total balances count

### Accessibility

- Add `aria-expanded` attribute
- Add `aria-controls` to link header with content
- Keyboard navigation support (Enter/Space to toggle)
- Focus management

### Code Changes Summary

1. **CompanyManagement.tsx**:
   - Add `expandedGroupId` state
   - Add `pinnedGroupId` state
   - Add `handleToggleGroup` function (respects pinned state)
   - Add `handleTogglePin` function
   - Pass `isExpanded`, `isPinned`, `onToggle`, and `onTogglePin` to CompanyGroupSection

2. **CompanyGroupSection.tsx**:
   - Add `isExpanded`, `isPinned`, `onToggle`, and `onTogglePin` props
   - Make header clickable
   - Add pin button in header (stops event propagation)
   - Conditionally render content based on `isExpanded` (includes pinned)
   - Add chevron icon with rotation animation
   - Add pin icon (filled when pinned, outline when not)
   - Add hover states
   - Visual indicator for pinned state

3. **Styling**:
   - Add transition animations
   - Ensure smooth expand/collapse
   - Maintain visual hierarchy

## Alternative: Start with All Collapsed

**Option**: All groups start collapsed by default, requiring user to expand the one they're interested in.

**Pros**:
- Cleanest initial view
- Forces intentional selection
- Best for many parent companies

**Cons**:
- Requires extra click to see any data
- May be less discoverable

**Recommendation**: Start with all collapsed for better UX when there are multiple groups.

## Implementation Steps

1. ✅ Add state management for expanded groups
2. ✅ Update CompanyGroupSection to accept expanded state
3. ✅ Make header clickable with toggle functionality
4. ✅ Add chevron icon with rotation animation
5. ✅ Conditionally render content based on expanded state
6. ✅ Add hover states and transitions
7. ✅ Test with multiple parent companies
8. ✅ Add keyboard accessibility
9. ✅ Test expand/collapse behavior

## Benefits

- ✅ Cleaner initial view
- ✅ Focused attention on selected group
- ✅ Scalable for many parent companies
- ✅ Better information hierarchy
- ✅ Reduced cognitive load
- ✅ Maintains all existing functionality

## Questions to Consider

1. **Default State**: Should all groups start collapsed, or should the first one be expanded?
   - **Recommendation**: All collapsed for cleanest view

2. **Single vs Multiple Expand**: Should only one group be expanded at a time?
   - **Recommendation**: Single expand for better focus

3. **Animation**: Should expand/collapse be animated?
   - **Recommendation**: Yes, smooth transitions improve UX

4. **Persistence**: Should expanded state persist across page reloads?
   - **Recommendation**: No, start fresh each time for consistency

5. **Pin Feature**: Should pinned state persist across page reloads?
   - **Recommendation**: Yes, using localStorage for better UX

---

*Document created: 2025-01-27*
*Last updated: 2025-01-27*
