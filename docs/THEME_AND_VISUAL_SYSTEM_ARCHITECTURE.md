# Phoenix Theme & Visual System Architecture

## Status

**Architecture decision: FROZEN**

This document defines the global visual-theme contract for Phoenix. Theme switching is a system-level visual transformation, not a background/color toggle.

## 1. Core Principle

Changing the active theme must update every theme-aware visual element consistently across the product.

The visual system includes, at minimum:

- backgrounds and surfaces
- primary, secondary and muted text
- borders and dividers
- buttons and all button states
- inputs, selects, textareas, checkboxes, radios and switches
- hover, focus, active, selected and disabled states
- cards and containers
- tables and data grids
- dialogs, modals, drawers, popovers and tooltips
- badges, tags and chips
- alerts, banners and toasts
- navigation, sidebar, header and footer
- icons and icon states
- links
- shadows and elevation
- border radius and shape tokens
- typography hierarchy
- spacing where theme variation is intentionally supported
- success, warning, error and informational states
- loading and skeleton states
- empty states
- charts and data visualization
- AI interaction surfaces
- Marketplace surfaces
- dashboard-specific components

## 2. Theme Layers

The visual architecture follows this dependency chain:

**Theme → Design Tokens → Semantic Tokens → Components → Pages**

Components must consume semantic tokens rather than hard-coded visual values.

Example concept:

`Button` consumes `action.primary` rather than knowing a literal color such as blue.

The active theme resolves `action.primary` to its visual representation.

## 3. Token Model

### Primitive Tokens

Raw values such as color scales, typography scales, spacing scales, radii and elevation values.

### Semantic Tokens

Meaning-based values consumed by product components, including:

- `surface.base`
- `surface.raised`
- `text.primary`
- `text.secondary`
- `text.disabled`
- `border.default`
- `action.primary`
- `action.primary.hover`
- `action.primary.active`
- `focus.default`
- `status.success`
- `status.warning`
- `status.error`
- `status.info`

### Component Tokens

Component-specific semantic mappings may exist when necessary, but must ultimately resolve through the global token system.

## 4. State Completeness

A theme is incomplete if it changes only the default state.

Every interactive component must define theme behavior for applicable states:

**default → hover → focus → active → selected → disabled → loading → error**

The exact state set depends on the component.

## 5. No Hard-Coded Visual Ownership

Pages and business modules must not independently own global visual decisions.

A page may express semantic intent, but the Design System owns the visual implementation.

Business modules must not create competing versions of global controls merely to support a theme.

## 6. Theme vs Brand

Three concepts remain separate:

1. **System Theme** — global visual mode of Phoenix.
2. **Business Branding** — identity of an individual business inside Marketplace experiences.
3. **User Preferences** — user-level preferences that may select an available system theme.

Business branding must not mutate the global system theme.

## 7. Accessibility Contract

Every theme must preserve required accessibility contrast and interaction visibility.

A theme cannot be considered valid merely because its colors are visually attractive.

Focus indicators, disabled states, status meanings and text readability must remain distinguishable.

## 8. Dark/Light and Future Themes

The architecture must support multiple themes without requiring component rewrites.

Initial themes may include light and dark modes, while the token model must not assume only two themes.

Future themes must be added by defining token values and mappings, not by duplicating component implementations.

## 9. Non-Goals

This architecture does not prescribe a specific frontend framework, CSS library or implementation technique.

It does not require every visual property to vary between themes. It requires every theme-aware property to have one authoritative token owner.

## 10. Architectural Invariant

> **One visual concept, one token owner, one component implementation.**

Theme switching must propagate through the Design System rather than through page-by-page styling changes.

## Completion Gate

The Theme/Visual System architecture is considered complete when:

- all global visual categories have an authoritative token layer;
- components consume semantic tokens;
- interactive states are theme-aware;
- system theme and business branding are isolated;
- accessibility requirements are part of theme validity;
- adding a new theme does not require duplicating component implementations.
