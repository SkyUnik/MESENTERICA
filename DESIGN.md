---
name: Clinical Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#5b403d'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#8f6f6c'
  outline-variant: '#e4beb9'
  surface-tint: '#b91c1c'
  primary: '#93000b'
  on-primary: '#ffffff'
  primary-container: '#b91c1c'
  on-primary-container: '#ffcdc7'
  inverse-primary: '#ffb4ab'
  secondary: '#555f6f'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f3'
  on-secondary-container: '#596373'
  tertiary: '#454749'
  on-tertiary: '#ffffff'
  tertiary-container: '#5c5f61'
  on-tertiary-container: '#d8d9db'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#d9e3f6'
  secondary-fixed-dim: '#bdc7d9'
  on-secondary-fixed: '#121c2a'
  on-secondary-fixed-variant: '#3d4756'
  tertiary-fixed: '#e1e2e4'
  tertiary-fixed-dim: '#c5c6c8'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The design system is engineered for high-stakes clinical environments where clarity, speed of data acquisition, and professional trust are paramount. The brand personality is authoritative, sterile, and hyper-functional, intentionally stripping away "consumer-grade" marketing flourishes to focus on diagnostic utility.

The aesthetic follows a **Modern Corporate** approach with a heavy emphasis on **High-Contrast** functionalism. It prioritizes a "white-coat" aesthetic—clean, organized, and structurally rigid—to evoke the emotional response of a specialized medical instrument. Every interface element exists to support data density and emergency legibility.

## Colors

This design system utilizes a high-contrast palette designed for immediate visual hierarchy.

- **Primary Clinical Red (#B91C1C):** Reserved strictly for critical alerts, emergency actions, and vital biological data markers. It must be used sparingly to maintain its urgency.
- **Dark Charcoal (#1F2937):** Used for primary typography and structural navigation elements to ensure maximum AA/AAA accessibility compliance.
- **Light Neutral Grey (#F3F4F6):** Defines the background of the clinical environment, providing a soft but clean canvas that reduces eye strain during long shifts.
- **Surface White (#FFFFFF):** Used for cards and input areas to signify interactive zones and "clean" data entry points.

## Typography

Note: While the user requested Poppins, **Plus Jakarta Sans** is utilized as the closest available high-readability professional geometric sans-serif to maintain the modern clinical aesthetic.

The typographic scale is optimized for "at-a-glance" scanning. Headlines are bold and dark charcoal to anchor sections. Body text uses a standard weight for patient records and notes. A specific `label-bold` style is used for table headers and metadata categories, often presented in all-caps to differentiate labels from user-generated data. For numeric values (vitals, dosages), use the `data-mono` style to ensure character alignment and rapid comparison.

## Layout & Spacing

This design system employs a **Fixed Grid** model for desktop and tablet to ensure diagnostic tools remain in predictable screen locations.

- **Grid:** A 12-column grid with a 24px gutter.
- **Margins:** 40px outer margins on desktop; 24px on tablet.
- **Rhythm:** A strict 4px baseline grid governs all vertical spacing.
- **Density:** High-density layouts are preferred. Information should be grouped into logical "Modules" (Cards) with 16px internal padding. Related data points should use 8px spacing, while distinct sections use 24px or 40px to prevent visual bleeding.

## Elevation & Depth

To maintain a sterile and focused environment, this design system uses **Tonal Layers** supplemented by **Low-Contrast Outlines**.

- **Level 0 (Background):** Light Neutral Grey (#F3F4F6).
- **Level 1 (Surface):** Pure White (#FFFFFF) cards. These use a 1px border of #E5E7EB rather than heavy shadows to define their boundaries.
- **Level 2 (Interaction):** When an element is hovered or active, a very subtle, extra-diffused shadow (0px 4px 12px rgba(0,0,0,0.05)) is applied to indicate lift without cluttering the interface.
- **Separators:** Use 1px solid lines in #F3F4F6 for internal card divisions.

## Shapes

The shape language balances the rigidity of medical software with the approachability of modern healthcare. UI elements use a **Rounded** (0.5rem) base.

- **Cards & Modals:** Use `rounded-lg` (1rem) to soften the large data containers.
- **Inputs & Buttons:** Use the standard 0.5rem radius.
- **Status Badges:** Use `rounded-xl` (1.5rem) to create a "pill" effect, making them easily distinguishable from interactive buttons.

## Components

### Buttons
- **Primary:** Dark Charcoal (#1F2937) background with White text. High contrast for standard actions.
- **Critical:** Primary Red (#B91C1C) background. Reserved for "Delete", "Stop Treatment", or "Emergency Alert".
- **Ghost:** No background, 1px grey border. Used for secondary navigation.

### Input Fields
- White background with a 1px #D1D5DB border. On focus, the border shifts to Dark Charcoal. Labels always sit above the field in `label-bold`.

### Cards
- The primary container for patient data. White background, 1rem rounded corners, 1px light grey border. Header sections within cards should have a subtle bottom border.

### Status Chips
- Small, pill-shaped indicators.
- **Alert:** Red background (10% opacity) with Red text.
- **Stable:** Green background (10% opacity) with Green text.
- **Pending:** Charcoal background (10% opacity) with Charcoal text.

### Data Tables
- Zebra-striping is prohibited. Use 1px horizontal dividers only. Headers are `label-bold` with a #F3F4F6 background fill to anchor the data columns.