# Quick Start Guide - Using the New UI Components

## 🚀 Getting Started

All UI modernization components are ready to use. Here's a quick guide to the most important features.

---

## Essential Features

### 1. Command Palette (Cmd+K / Ctrl+K)
**What it does**: Quick navigation and actions

**How to use**:
- Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open
- Type to search commands
- Use ↑↓ arrows to navigate
- Press Enter to select
- Press Esc to close

**Available commands**:
- Navigate to Dashboard (⌘1 / Ctrl+1)
- Navigate to Companies (⌘2 / Ctrl+2)
- Navigate to Data Import (⌘3 / Ctrl+3)
- Navigate to Consolidation (⌘4 / Ctrl+4)
- Create New Company

**Note**: The shortcuts displayed in the palette automatically adapt to your platform (⌘ on Mac, Ctrl on Windows/Linux).

---

### 2. Toast Notifications
**What it does**: Professional notifications instead of alerts

**How to use**:
```tsx
import { useToastContext } from '../contexts/ToastContext';

const { success, error, info, warning } = useToastContext();

// Show notifications
success('Operation completed successfully');
error('Something went wrong');
info('Here is some information');
warning('Please be careful');
```

**Features**:
- Auto-dismiss (configurable)
- Manual dismiss button
- Action buttons support
- Smooth animations

---

### 3. Dark Mode
**What it does**: Complete dark theme

**How to use**:
- Click the 🌙/☀️ button in the top-right corner
- Preference is saved automatically
- Respects system preference on first visit

---

### 4. Advanced Tables
**What it does**: Sortable, selectable tables with context menus

**How to use**:
```tsx
import { AdvancedTable, TableColumn } from '../components/AdvancedTable';

const columns: TableColumn<YourType>[] = [
  {
    id: 'name',
    header: 'Name',
    accessor: (row) => row.name,
    sortable: true,
  },
  {
    id: 'value',
    header: 'Value',
    accessor: (row) => row.value,
    sortable: true,
    sparkline: {
      data: (row) => row.history, // Array of numbers
      color: 'var(--color-success)'
    }
  }
];

<AdvancedTable
  data={data}
  columns={columns}
  onRowClick={(row) => handleClick(row)}
  onRowContextMenu={(e, row) => showContextMenu(e, row)}
  selectable
/>
```

**Features**:
- Click column headers to sort
- Checkboxes for row selection
- Right-click for context menu
- Sparklines for trend visualization

---

### 5. Modals
**What it does**: Professional dialog windows

**How to use**:
```tsx
import { Modal } from '../components/Modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="lg" // sm, md, lg, xl, fullscreen
  footer={<button>Save</button>}
>
  Modal content here
</Modal>
```

**Features**:
- Multiple sizes
- Focus trap
- Escape to close
- Click outside to close
- Backdrop blur

---

### 6. Tooltips
**What it does**: Helpful hints on hover

**How to use**:
```tsx
import { Tooltip } from '../components/Tooltip';

<Tooltip content="Helpful information" position="top">
  <button>Hover me</button>
</Tooltip>
```

**Positions**: `top`, `bottom`, `left`, `right`
**Features**: Auto-positioning, rich content support

---

### 7. Smart Suggestions
**What it does**: Contextual tips and suggestions

**How to use**:
```tsx
import { useSmartSuggestions } from '../components/SmartSuggestions';

const { suggestions, addSuggestion, removeSuggestion } = useSmartSuggestions();

addSuggestion({
  id: 'unique-id',
  message: 'Helpful tip message',
  type: 'tip', // 'info', 'tip', 'warning'
  action: {
    label: 'Do it',
    onClick: () => handleAction()
  }
});

// Display suggestions
<SmartSuggestions suggestions={suggestions} />
```

---

### 8. Context Menus
**What it does**: Right-click menus

**How to use**:
```tsx
import { useContextMenu, ContextMenuItem } from '../components/ContextMenu';

const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

// In table row
onContextMenu={(e) => {
  e.preventDefault();
  showContextMenu([
    { label: 'Edit', onClick: () => handleEdit(row) },
    { separator: true },
    { label: 'Delete', onClick: () => handleDelete(row.id), variant: 'danger' }
  ], e.clientX, e.clientY);
}}

{contextMenu && (
  <ContextMenu
    items={contextMenu.items}
    onClose={hideContextMenu}
    x={contextMenu.x}
    y={contextMenu.y}
  />
)}
```

---

## Component Library

### Phase 1 Components
- ✅ `Toast` - Notifications
- ✅ `Skeleton` - Loading states
- ✅ `MetricCard` - Enhanced metrics
- ✅ `CommandPalette` - Quick actions
- ✅ `DarkModeToggle` - Theme switcher

### Phase 2 Components
- ✅ `AdvancedTable` - Enhanced tables
- ✅ `Modal` - Dialogs
- ✅ `Tooltip` - Hints
- ✅ `ContextMenu` - Right-click menus
- ✅ `FormInput` - Enhanced inputs
- ✅ `FormSelect` - Enhanced selects

### Phase 3 Components
- ✅ `ChartWrapper` - Chart container
- ✅ `Sparkline` - Mini trends
- ✅ `NetworkGraph` - Hierarchy visualization
- ✅ `Heatmap` - Data heatmaps
- ✅ `SankeyDiagram` - Flow diagrams

### Phase 4 Components
- ✅ `PageTransition` - Smooth transitions
- ✅ `ContextualHelp` - Help system
- ✅ `SmartSuggestions` - Contextual tips
- ✅ `useAdaptiveUI` - User preferences hook

---

## Common Patterns

### Replacing alert() with Toast
```tsx
// Before
alert('Success!');

// After
const { success } = useToastContext();
success('Success!');
```

### Adding Loading States
```tsx
// Before
{loading && <div>Loading...</div>}

// After
import { TableSkeleton } from '../components/Skeleton';
{loading && <TableSkeleton rows={5} columns={4} />}
```

### Adding Tooltips
```tsx
// Before
<button title="Helpful text">Click</button>

// After
<Tooltip content="Helpful text" position="top">
  <button>Click</button>
</Tooltip>
```

### Using Enhanced Forms
```tsx
// Before
<input type="text" placeholder="Name" />

// After
<FormInput
  label="Name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  floatingLabel
  error={errors.name}
/>
```

---

## Best Practices

1. **Always use Toast** instead of `alert()`
2. **Use Skeleton loaders** for better UX
3. **Add Tooltips** to complex features
4. **Use Advanced Table** for data display
5. **Wrap charts** with ChartWrapper for export
6. **Add Smart Suggestions** for onboarding
7. **Use Context Menus** for power users
8. **Test in dark mode** regularly

---

## Troubleshooting

### Command Palette not opening?
- Check if another element is capturing the key
- Try `Ctrl+K` on Windows/Linux

### Toast not showing?
- Ensure `ToastProvider` wraps your app
- Check if `useToastContext()` is called inside provider

### Dark mode not working?
- Check browser console for errors
- Verify CSS variables are loaded
- Clear localStorage and try again

### Table not sorting?
- Ensure `sortable: true` in column definition
- Check if data is an array
- Verify accessor function returns sortable values

---

## Support

For detailed documentation, see:
- `UI_MODERNIZATION_PLAN_2026.md` - Complete plan
- `UI_2026_IMPLEMENTATION_GUIDE.md` - Code examples
- `COMPREHENSIVE_REVIEW_AND_OPTIMIZATION.md` - Full review

---

*Happy coding! 🚀*