# Theming & Component Guidelines

This document is the canonical reference for theming, color contrast, and UI styling in **The Playground (OMplayground)**.

Every new component, page, modal, or game UI must follow these rules to ensure consistent appearance and readability across both **Light** and **Dark** themes.

---

## 1. Architecture Overview

- **Default Theme**: **Light mode** is the default theme across the application.
- **Switchable**: Users can toggle between `light` and `dark` modes at any time.
- **Persistence**: User preference is stored in `localStorage` under key `playground-theme`.
- **Implementation**: Powered by Tailwind CSS class strategy.
  - Light mode: `<html>` has no `dark` class (e.g. `<html class="">` or `<html class="light">`).
  - Dark mode: `<html>` has class `dark` (`<html class="dark">`).
- **Context API**: `useTheme()` from [`@/context/ThemeContext`](../apps/web/src/context/ThemeContext.tsx) exposes `{ theme, setTheme, toggleTheme }`.
- **Pre-built Toggle**: [`<ThemeToggle />`](../apps/web/src/components/ThemeToggle.tsx) is available for placing in navigation bars or headers.

---

## 2. Core Rules for Future Components

### Rule 1: Never use bare `text-white` or `text-white/*` on panel surfaces

On light backgrounds (`bg-white`, `bg-slate-50`, `bg-slate-100`), bare `text-white` produces invisible or low-contrast text.

| Role | ❌ Incorrect | ✅ Correct |
| :--- | :--- | :--- |
| **Primary Text / Headings** | `text-white` | `text-slate-900 dark:text-white` |
| **Secondary / Body Text** | `text-white/80` or `text-white/70` | `text-slate-700 dark:text-white/80` (or `text-slate-600 dark:text-white/70`) |
| **Muted Text / Labels / Dates** | `text-white/50` or `text-white/40` | `text-slate-500 dark:text-white/50` |
| **Subtle borders** | `border-white/10` | `border-slate-200 dark:border-white/10` |

> [!NOTE]
> **Exception**: Elements with permanently saturated/dark backgrounds (such as purple/indigo gradient buttons `bg-gradient-to-r from-violet-600 to-indigo-600 text-white` or solid red danger buttons `bg-rose-600 text-white`) should retain `text-white`.

---

### Rule 2: Never use dark-only glassy cards without light counterparts

In dark mode, glassy transparency (`bg-white/5 border-white/10 backdrop-blur-md`) looks great. In light mode, that same styling renders as a muddy, washed-out grey over light backdrops.

```tsx
// ❌ INCORRECT (unreadable in light mode)
<div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
  <h4>Title</h4>
</div>

// ✅ CORRECT
<div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md p-4">
  <h4 className="text-slate-900 dark:text-white font-bold">Title</h4>
</div>

// ✅ EVEN BETTER: Use the shared helper
import { desktopPanelClass } from "@/components/KidDesktopShell";

<div className={desktopPanelClass("p-4")}>
  <h4 className="text-slate-900 dark:text-white font-bold">Title</h4>
</div>
```

---

### Rule 3: High-Contrast Alert, Badge & Status Colors

Bright pastel text (such as `text-emerald-300` or `text-amber-300`) designed for dark backgrounds fails WCAG contrast on light surfaces. Always provide responsive pairings:

| State | Background & Border | Text Color |
| :--- | :--- | :--- |
| **Success** | `bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-400/30` | `text-emerald-800 dark:text-emerald-300 font-semibold` |
| **Warning** | `bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-400/30` | `text-amber-800 dark:text-amber-300 font-semibold` |
| **Error / Danger** | `bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-400/30` | `text-rose-700 dark:text-rose-400 font-semibold` |
| **Info / Purple** | `bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-400/30` | `text-indigo-800 dark:text-indigo-300 font-semibold` |
| **Neutral / Inactive** | `bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10` | `text-slate-600 dark:text-white/50 font-medium` |

---

### Rule 4: Form Inputs & Native Select Dropdowns

Always use the standard helpers from [`@/lib/fieldStyles`](../apps/web/src/lib/fieldStyles.ts):

```tsx
import { kidFieldInputClass, kidFieldLabelClass } from "@/lib/fieldStyles";

<label className={kidFieldLabelClass}>
  שם משתמש
  <input className={kidFieldInputClass} placeholder="הכנס שם..." />
</label>
```

When rendering native `<select>` dropdowns, explicitly style `<option>` elements to prevent OS-level render glitches (e.g. white text on white menu popups):

```tsx
<select className={kidFieldInputClass} value={val} onChange={...}>
  <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="1">
    אפשרות 1
  </option>
</select>
```

---

### Rule 5: Modals, Drawers & Dialogs

- **Modal Surface**: Use `bg-white dark:bg-slate-900` or `bg-white dark:bg-slate-950` with `border border-slate-200 dark:border-slate-800 shadow-2xl`.
- **Backdrop**: Use `bg-black/60 backdrop-blur-sm` or `bg-black/70`.
- **Close Button**: `text-slate-400 hover:text-slate-700 dark:text-white/60 dark:hover:text-white`.
- **Action Buttons**:
  - Primary: Vibrant gradient button (`bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm`).
  - Secondary/Cancel: `border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/15`.

---

### Rule 6: Game Boards, Canvases & Whiteboards

- **Excalidraw / Whiteboard**: The whiteboard drawing canvas is naturally white (`#ffffff`). Never apply inverted filters or global CSS overrides that disrupt drawing canvas colors.
- **Stage Wrappers**: The canvas stage container must be neutral (`bg-slate-100 dark:bg-black` or `bg-slate-200/70 dark:bg-slate-950`) so canvas boundaries and aspect ratio frames are clearly visible in both light and dark themes.
- **Board Games (Chess, TicTacToe, Memory, Connect Four)**:
  - Game tiles must provide high-contrast borders and cell backgrounds in both themes.
  - Active turn indicator / player badges must be readable in both modes.

---

### Rule 7: Console Logs, Terminals & Code Blocks

In light mode, pitch-black containers (`bg-black` or `bg-[#0b071e]`) look out of place when placed inside light cards.
Use light-responsive code blocks:

```tsx
<div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0b071e] p-4 font-mono text-xs text-slate-800 dark:text-slate-200 shadow-sm" dir="ltr">
  {/* Log messages with theme-aware colors */}
</div>
```

---

## 3. Reusable Primitives Quick Reference

| Primitive | Path | Usage |
| :--- | :--- | :--- |
| `useTheme()` | [`apps/web/src/context/ThemeContext.tsx`](../apps/web/src/context/ThemeContext.tsx) | Hook returning `{ theme, setTheme, toggleTheme }` |
| `<ThemeToggle />` | [`apps/web/src/components/ThemeToggle.tsx`](../apps/web/src/components/ThemeToggle.tsx) | Sun/Moon toggle button |
| `desktopPanelClass` | [`apps/web/src/components/KidDesktopShell.tsx`](../apps/web/src/components/KidDesktopShell.tsx) | Standard card container with borders and shadows |
| `kidFieldInputClass` | [`apps/web/src/lib/fieldStyles.ts`](../apps/web/src/lib/fieldStyles.ts) | Styled input/select/textarea |
| `kidFieldLabelClass` | [`apps/web/src/lib/fieldStyles.ts`](../apps/web/src/lib/fieldStyles.ts) | Styled label for inputs |

---

## 4. Contributor & Agent PR Checklist

Before submitting code with new UI components or page modifications, verify:

- [ ] **Light Mode Verification**: Switched to Light theme and confirmed no white-on-white text, invisible borders, or unreadable badges.
- [ ] **Dark Mode Verification**: Switched to Dark theme and confirmed no dark-on-dark text or glaring white backgrounds.
- [ ] **No bare `text-white`**: Checked that `text-white` is not used directly without `dark:` unless on a permanently dark button or gradient.
- [ ] **Form inputs**: All `<input>`, `<select>`, and `<textarea>` elements are legible in both themes.
- [ ] **Modals & Toolbars**: Floating dialogs, toolbars, and popups have proper borders and shadows in both themes.
- [ ] **Resource rule**: Followed `AGENTS.md` (no concurrent `npm build` or `tsc` runs).
