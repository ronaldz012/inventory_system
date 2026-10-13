---
trigger: model_decision
description: Guidance for generating HTML/Angular templates for DriveCore.System ERP using Tailwind CSS
---

# Tailwind CSS v4 & Angular Template Guidelines — DriveCore ERP

## Architecture in One Sentence

CSS variables in `styles.css` hold the values. `@theme inline` maps them to Tailwind utilities. Templates use only those utilities — never raw values, never `dark:` variants.

---

## The Three-Layer Stack

```---
trigger: model_decision
description: Guidance for generating HTML/Angular templates for DriveCore.System ERP using Tailwind CSS v4.
---
styles.css (:root / .dark)     →  defines raw values
styles.css (@theme inline)     →  maps to --color-* tokens
HTML templates                 →  consume bg-* / text-* / border-* utilities
```

**ThemeService** toggles `.dark` on `<html>`. CSS variables cascade automatically. No `dark:` needed anywhere in templates.

---

## Token Vocabulary

### Surfaces

| Utility          | Use                                                          |
| ---------------- | ------------------------------------------------------------ |
| `bg-bg-main`     | Page canvas — cream (light) / carbon `#141414` (dark)        |
| `bg-bg-surface`  | Cards, tables, panels — white (light) / `#1C1C1C` (dark)     |
| `bg-bg-elevated` | Modals, dropdowns                                            |
| `bg-bg-muted`    | Inputs, table headers — `#F4F4F4` (light) / `#2A2A2A` (dark) |

### Text

| Utility           | Use                 |
| ----------------- | ------------------- |
| `text-text-main`  | Primary content     |
| `text-text-muted` | Labels, metadata    |
| `text-text-soft`  | Placeholders, hints |

### Borders

| Utility                | Use                           |
| ---------------------- | ----------------------------- |
| `border-border`        | All dividers and cell borders |
| `border-border-strong` | Emphasized containers         |

### Buttons

| Utility                                                                            | Use                |
| ---------------------------------------------------------------------------------- | ------------------ |
| `bg-btn-primary-bg` + `text-btn-primary-text` + `hover:bg-btn-primary-hover`       | Primary CTA        |
| `bg-btn-secondary-bg` + `text-btn-secondary-text` + `hover:bg-btn-secondary-hover` | Supporting actions |

### Accent (brand navy — sidebar, CTAs, focus)

```
bg-accent-ui   text-accent-ui-text   hover:bg-accent-ui-hover
```

### Feedback (always paired — never mix surface with wrong text)

| State   | Surface               | Text                         |
| ------- | --------------------- | ---------------------------- |
| Error   | `bg-feedback-error`   | `text-feedback-error-text`   |
| Success | `bg-feedback-success` | `text-feedback-success-text` |
| Warning | `bg-feedback-warning` | `text-feedback-warning-text` |
| Info    | `bg-feedback-info`    | `text-feedback-info-text`    |

### Layout (sidebar always navy — both modes)

```
bg-layout-sidebar          text-layout-sidebar-text
bg-layout-sidebar-elevated text-layout-sidebar-text-muted
bg-layout-topbar
```

---

## Class Order (Concentric Model)

Every element follows this sequence — no exceptions:

```
1. Position/Layer     → relative absolute sticky z-50 top-0
2. Display/Box        → flex grid items-center justify-between gap-4 w-full h-14
3. Spacing            → px-4 py-3 mx-auto
4. Typography         → font-inter text-sm font-semibold
5. Visuals            → bg-bg-surface border border-border shadow-sm rounded-lg
6. Interactivity      → transition-colors duration-150 hover:bg-bg-muted focus-visible:outline-none
```

---

## Hard Rules

**NEVER** do this:

```html
<!-- Raw hex -->
<div class="bg-[#1C1C1C]">
  <!-- Atomic palette tokens -->
  <div class="bg-navy text-cream">
    <!-- dark: variant -->
    <div class="bg-white dark:bg-gray-900">
      <!-- Feedback cross-contamination -->
      <div class="bg-feedback-error text-text-muted"></div>
    </div>
  </div>
</div>
```

**ALWAYS** do this:

```html
<div class="bg-bg-surface text-text-main border border-border">
  <span class="bg-feedback-success text-feedback-success-text">
    <button class="bg-btn-primary-bg text-btn-primary-text hover:bg-btn-primary-hover"></button
  ></span>
</div>
```

---

## Sidebar Note

The sidebar uses `bg-layout-sidebar` (`#111827` navy) in **both light and dark mode**. It never changes. It is the constant brand anchor.

---

## Dinero (MoneyPipe canónico)

Toda cifra de dinero usa `MoneyPipe` (`@shared/pipes/money-pipe`) + `font-mono` (cifras tabulares):

- `{{ v | money }}` → número pelado con 2 decimales (`1,234.50`). El símbolo nunca va
  inline en tablas: el header lleva la moneda (`Precio (Bs)`).
- `{{ v | money: 'symbol' }}` → `Bs 1,234.50`. Solo para totales sueltos sin header
  cercano (botón de pago POS, dashboard, confirmaciones).
- En código TS (labels calculados): `formatMoney(v, inject(LOCALE_ID))` del mismo archivo.

Prohibido: `currency: 'BOB'`, `| number` para dinero, prefijos `Bs`/`BOB` hardcodeados
(excepto el modo `'symbol'` del pipe y prefijos de input con `Bs`).
