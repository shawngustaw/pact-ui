---
name: Pact UI
description: Restrained developer workspace for inspecting Pact Broker evidence.
colors:
  bg: '#fafafa'
  surface: '#fff'
  surface-hover: '#f6f7f9'
  sidebar: '#f8f9fb'
  text: '#17191d'
  muted: '#626870'
  faint: '#6c727c'
  border: '#e5e7eb'
  accent: '#5263d6'
  accent-bg: '#eef0ff'
  success: '#227650'
  success-bg: '#edf7f0'
  failed: '#ba393c'
  failed-bg: '#fff0f0'
  unknown: '#936311'
  unknown-bg: '#fff8e8'
  graph-edge: '#b0b7c5'
  graph-minimap: '#c6cce5'
  graph-mask: '#ffffff99'
  json-key: '#7651ab'
  json-string: '#28704e'
  json-literal: '#a74e2b'
  json-number: '#3c64af'
  code-bg: '#f6f7f9'
  dark-bg: '#101113'
  dark-surface: '#17181c'
  dark-surface-hover: '#1e2026'
  dark-sidebar: '#141519'
  dark-text: '#eceef2'
  dark-muted: '#a0a5ae'
  dark-faint: '#9298a3'
  dark-border: '#2a2d33'
  dark-accent: '#a1abff'
  dark-accent-bg: '#262a43'
  dark-success: '#7dcea5'
  dark-success-bg: '#192e25'
  dark-failed: '#f28f92'
  dark-failed-bg: '#382024'
  dark-unknown: '#e6bd6e'
  dark-unknown-bg: '#332b1b'
  dark-graph-edge: '#515766'
  dark-graph-minimap: '#454e78'
  dark-graph-mask: '#101113bb'
  dark-json-key: '#c6a5f0'
  dark-json-string: '#94cfac'
  dark-json-literal: '#e9ad82'
  dark-json-number: '#a1bdff'
  dark-code-bg: '#121317'
  dark-primary-text: '#151626'
typography:
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '27px'
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: '-0.03em'
  title:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '17px'
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: '-0.015em'
  section:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 'normal'
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  secondary:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '11px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 'normal'
  code:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: '11px'
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: 'normal'
rounded:
  badge: '4px'
  control: '5px'
  code: '6px'
  mark: '7px'
  panel: '8px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  xxl: '24px'
  page: '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '34px'
  button-primary-dark:
    backgroundColor: '{colors.dark-accent}'
    textColor: '{colors.dark-primary-text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '34px'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '34px'
  button-outline-hover:
    backgroundColor: '{colors.surface-hover}'
    textColor: '{colors.text}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0 12px'
    height: '34px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '0 10px'
    height: '36px'
  nav-active:
    backgroundColor: '{colors.accent-bg}'
    textColor: '{colors.accent}'
    rounded: '{rounded.control}'
    padding: '9px 11px'
  status-success:
    backgroundColor: '{colors.success-bg}'
    textColor: '{colors.success}'
    rounded: '{rounded.badge}'
    padding: '3px 6px'
  panel:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.panel}'
---

# Design System: Pact UI

## Overview

**Creative North Star: "The Broker Workspace"**

Pact UI follows the user-pinned Linear, Vercel, and Datadog direction: a restrained developer workspace whose primary content is Broker evidence. Quiet neutral surfaces, persistent navigation, compact tables, and focused inspectors make relationships and deployment decisions legible.

Indigo signals interaction and selection. Status colors communicate evidence with an icon and a written label. Light and dark modes preserve the same hierarchy. The system is code-first, with no decorative charts, gradients, or motion.

**Key Characteristics:**

- Compact, readable developer-tool density.
- Neutral surfaces with thin structural dividers.
- Quiet indigo interaction and explicit status labels.
- Keyboard access and responsive table containment.

## Colors

The palette is cool and restrained; semantic token names in the frontmatter mirror the implemented CSS custom properties. Unprefixed colors are light mode; `dark-` entries are their dark-mode counterparts. CSS remains the implementation source.

### Primary

Quiet Indigo (`accent`) marks links, selection, focus, and primary actions. Its pale companion (`accent-bg`) supports active navigation, interaction selection, and the demo provenance banner. Dark primary buttons use `dark-primary-text` rather than the general surface color for their label.

### Secondary

Evidence Green (`success`), Failure Red (`failed`), and Uncertainty Amber (`unknown`) each have a paired tinted background. They identify verification, blockers, and missing evidence. JSON key, string, literal, and number colors serve syntax only; graph edge, minimap, and mask colors serve relationship inspection.

### Neutral

Workspace Ground (`bg`), Panel Surface (`surface`), Hover Surface (`surface-hover`), and Sidebar Ground (`sidebar`) establish hierarchy without decoration. Primary Ink (`text`), Secondary Ink (`muted`), and Quiet Ink (`faint`) carry text. `border` supplies structural separators; `code-bg` distinguishes code. Quiet Ink records the corrected light value from the finish review, with a separate dark counterpart.

**The Evidence Rule.** Use status color only with a written label and an icon; unknown remains distinct from failed.

## Typography

Interface typography uses the Inter-first system sans stack in the frontmatter; Inter is not bundled as a webfont. Technical content uses the recorded system monospace stack. Tabular numerals apply throughout the interface. No separate display face is introduced.

The hierarchy is an application heading (`headline`), section title (`title`), small section heading (`section`), interface body (`body`), secondary text (`secondary`), and control label (`label`). Code uses `code`; JSON line height is looser for inspection. The normal heading is 27px/650, reducing to 25px at narrower widths; the application detail title reaches 22px on mobile. Paragraph line height is 1.65. Small utility annotations exist below the core scale; they are not a new headline or promotional type role.

## Layout

The desktop shell has a fixed 224px sidebar and 54px top bar. The page container is capped at 1504px including its 32px horizontal padding, yielding 1440px of content. Tables and detail sections use dividers rather than a card grid. Toolbar padding is 12px by 16px; table header padding is 10px by 16px and data cells use 15px by 16px.

At 1150px the sidebar becomes 202px and page gutters 24px; at 900px it becomes 188px with 20px gutters and stacked detail/deployment layouts. At 680px the sidebar becomes an explicit menu drawer, the sticky top bar is 50px high, and page gutters are 17px. Table overflow stays inside labeled, focusable regions. Inspector columns stack; the interaction list becomes a bounded scrolling area. Above 1550px page top spacing and table row padding increase slightly.

## Elevation & Depth

The interface is flat by default. Tonal changes and single-pixel borders define most regions. Small shadows are functional exceptions: selected segmented controls, graph nodes and controls, and the mobile navigation drawer. There are no decorative lifting animations. Button background changes take 120ms; reduced-motion preferences disable transitions and animation.

**The Flat Surface Rule.** Separate ordinary content with tone and thin borders; reserve subtle shadows for controls, graph nodes, and the mobile drawer.

## Shapes

Control corners use the `control` radius, status chips the tighter `badge` radius, code panels the `code` radius, application marks the `mark` radius, and major bordered containers the `panel` radius. Circles identify dots and avatars. Borders remain thin and neutral; accent outlines indicate active environments or selected graph nodes.

## Components

### Buttons

Compact and quiet. The default API variant is outline, with a surface fill and neutral border; primary actions use indigo and ghost actions use muted text on transparent ground. Normal buttons are 34px high, small buttons 27px, and icon buttons 32px wide on desktop. Hover changes the background or darkens the primary fill. Disabled buttons use half opacity and a not-allowed cursor. Keyboard focus uses a 2px accent outline offset by 3px. At the mobile breakpoint buttons and other touch controls have a 40px minimum height; icon controls also have a 40px minimum width.

### Inputs / Fields

Surface-filled, thin bordered fields share control corners. Standard inputs are 36px high; directory search is 33px high and 285px wide before responsive expansion. Search focus outlines the containing field with a 1px offset. Placeholder text uses Quiet Ink. Filters remain native selects. Mobile fields expand to at least 40px high.

### Navigation

Sidebar items combine lucide icons and short labels. Muted text becomes primary text on hover; active items use indigo text and a tinted background. The mobile drawer is hidden from pointer and keyboard interaction while closed. Detail and explorer tabs use Radix tab semantics, associated panels, roving focus, and arrow/Home/End navigation. Role, environment, and candidate-type filters are pressed-button groups rather than tab panels. Active detail tabs show a thin indigo underline.

### Chips

Status badges combine a 13px icon, explicit text, and a semantic tint. They are informational, not controls. Count badges remain neutral. Status meanings persist across themes.

### Cards / Containers

Bordered table panels, forms, and inspectors use panel corners and the surface fill. They have no general card shadow. Padding is contextual: toolbar spacing, 20px inspector headings, 22px inspector bodies, and tighter mobile insets. Table rows reveal hover tone without competing with their content.

### Contract inspector

The inline inspector combines a searchable interaction list with syntax-colored JSON, structural comparisons, and verification history. JSON is contained in a code panel with a copy action and a keyboard-focusable scroll area. Version/path content remains monospace and wraps or scrolls within its own region.

## Do's and Don'ts

### Do:

- Do use the implemented light and dark semantic pairs together.
- Do keep technical identifiers in monospace and data numerals tabular.
- Do preserve visible focus, labeled scroll regions, and keyboard tab navigation.
- Do keep mobile controls at least 40px high and icon controls at least 40px wide.

### Don't:

- Don't use decorative charts, gradients, or motion.
- Don't communicate compatibility through color alone.
- Don't let wide tables force the whole page to scroll horizontally.
- Don't replace compact table structure with decorative card grids.
