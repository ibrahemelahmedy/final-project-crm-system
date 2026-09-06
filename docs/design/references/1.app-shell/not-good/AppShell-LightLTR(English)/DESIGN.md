---
name: Wisal Design System
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b20'
  surface-container: '#1e1f24'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343439'
  on-surface: '#e3e2e7'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3035'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#bdc2ff'
  on-secondary: '#131e8c'
  secondary-container: '#2f3aa3'
  on-secondary-container: '#a8afff'
  tertiary: '#ffb695'
  on-tertiary: '#571f00'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bdc2ff'
  on-secondary-fixed: '#000767'
  on-secondary-fixed-variant: '#2f3aa3'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343439'
  success-light: '#34D399'
  success-dark: '#059669'
  warning-light: '#FBBF24'
  warning-dark: '#D97706'
  danger-light: '#F87171'
  danger-dark: '#DC2626'
  surface-elevated: '#1C1D24'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style
The brand is built on the concept of *Wisal* (Connection), serving as a bridge between data and relationships for small sales teams. The personality is calm, professional, and highly organized, avoiding the "noise" of traditional enterprise CRMs.

The design style is **Corporate / Modern** with a strong influence from the **Minimalism** of high-end developer tools. It prioritizes clarity, generous whitespace, and a high-density information architecture reminiscent of tools like Linear or Notion. The aesthetic is anchored by geometric precision, using interlocking rings to symbolize the union of Western and Arabic business workflows.

- **Tone:** Reliable, transparent, and efficient.
- **Visual Anchor:** The linked ring motif (7px stroke weight) is the primary symbol for connectivity and should be used as a recurring geometric theme in loaders and empty states.
- **Internationalization:** The system is built for full Bi-directional (BiDi) support, ensuring that the layout logic mirrors perfectly for RTL (Arabic) users while maintaining the same weight and rhythm as the LTR (Latin) version.

## Colors
The color strategy utilizes a sophisticated Indigo palette. The **Default Color Mode is Dark**, utilizing `#121317` as the base surface to avoid the harshness of pure black while providing deep contrast for text.

- **Interactive:** The Primary Indigo `#4F46E5` (Light mode) and `#818CF8` (Dark mode) are reserved for primary actions, focus states, and the brand mark.
- **Semantic:** Success, Warning, and Danger colors are provided in two shades to maintain accessibility (WCAG 2.2 AA) across both light and dark backgrounds.
- **Surface Strategy:** In dark mode, depth is created by lightening the surface rather than adding heavy shadows. Use `surface-elevated` for cards and modals.

## Typography
The typography system is bilingual by design. **Inter** is used for Latin body copy due to its exceptional legibility in SaaS interfaces. **IBM Plex Sans** provides a technical, authoritative feel for headings.

- **Arabic Pairing:** For Arabic locales, replace Inter with **IBM Plex Sans Arabic**.
- **Line Height:** A generous line-height (1.6) is mandatory for Arabic text to accommodate the vertical height of glyphs and prevent "clashing" between lines.
- **Weight:** Avoid using weights below 400 for dark mode to prevent text thinning (halpation).
- **Scale:** The scale is tight and functional, favoring information density over dramatic editorial sizing.

## Layout & Spacing
The system uses a **Fixed Grid** for desktop and a **Fluid Grid** for mobile. The layout is built on a 4px baseline shift to ensure all elements align to a consistent mathematical rhythm.

- **Desktop:** 12-column grid, 1440px max-width, 16px gutters, and 32px side margins.
- **Tablet:** 8-column grid, 16px gutters.
- **Mobile:** 4-column grid, 16px margins. 
- **Density:** Components should utilize a high-density layout (Linear-style), using padding rather than margins to define boundaries, facilitating a "contained" feel for CRM data tables and kanban boards.

## Elevation & Depth
Depth is conveyed primarily through **Tonal Layers** and **Low-contrast outlines**. 

- **Level 0 (Base):** `#121317`.
- **Level 1 (Cards/Containers):** `#1C1D24` with a 1px solid border at 10% opacity white.
- **Level 2 (Modals/Popovers):** `#25272F` with a soft ambient shadow (0px 8px 24px rgba(0,0,0,0.5)).
- **Focus States:** Use the Primary Indigo with a 2px offset and 2px blur to meet WCAG 2.2 AA standards. In dark mode, ensure the focus ring has sufficient contrast against the dark background.

## Shapes
The shape language is disciplined and geometric. While the brand mark uses perfect circles, UI components use a "Soft" radius to balance approachability with professional rigor.

- **Standard (6px):** Small components like buttons, input fields, and tags.
- **Large (12px):** Cards, containers, and secondary navigation panels.
- **X-Large (16px):** Main application wrappers and modals.
- **Interactive States:** When hovered, buttons should maintain their radius but may use a subtle scale-down (98%) to feel tactile.

## Components
- **Buttons:** Solid Indigo for primary actions. Ghost buttons with 1px borders for secondary actions. Use a minimum height of 40px for touch accessibility.
- **Input Fields:** Background should be a shade darker or lighter than the container. Use a 1px border that turns Primary Indigo on focus. Labels should be `label-md`.
- **Chips/Tags:** Rounded-sm (4px). Use semi-transparent fills (10% opacity) of the semantic colors (Success/Warning/Danger) with high-contrast text.
- **Cards:** No shadows for standard cards; use 1px subtle borders. Use shadows only for floating elements (modals).
- **RTL Support:** All components must mirror. Icons that denote direction (arrows, back buttons) must be flipped, while brand-sensitive icons (the Wisal logo) remain static.
- **Lists:** High-density lists with 1px dividers. Use `body-sm` for secondary metadata and `body-md` for primary list items.