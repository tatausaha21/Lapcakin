---
name: Government Enterprise Performance Matrix
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#3f4944'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f7973'
  outline-variant: '#bec9c2'
  surface-tint: '#1b6b51'
  primary: '#004532'
  on-primary: '#ffffff'
  primary-container: '#065f46'
  on-primary-container: '#8bd6b7'
  inverse-primary: '#8bd6b6'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#004063'
  on-tertiary: '#ffffff'
  tertiary-container: '#005887'
  on-tertiary-container: '#95cdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f2d1'
  primary-fixed-dim: '#8bd6b6'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513b'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  data-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  sidebar-width: 280px
  header-height: 64px
  container-padding-desktop: 2rem
  container-padding-mobile: 1rem
  gutter-grid: 1.5rem
---

## Brand & Style

This design system establishes a high-trust, institutional, yet undeniably modern administrative workspace tailored for government executives, section heads (Kepala Seksi), and ministry administrators within Kemenag (Kementerian Agama). The visual language bridges the solemn dignity of state governance with modern enterprise software clarity.

The aesthetic philosophy is **Corporate Modern with High-Order Tonal Structuring**. It sheds the cumbersome, visually cluttered tropes of legacy public sector portals in favor of:
- **Quiet Authority**: Deep emerald tones that echo state legitimacy and growth, paired with authoritative deep slate-navy neutrals rather than sterile grays.
- **Analytical Precision**: Crisp borders, deliberate typographic hierarchy, and carefully modulated information density that allows rapid scanning of Key Performance Indicators (IKU/IKP), budget absorption metrics, and compliance statuses.
- **Dignified Functionality**: Tactical elevations and clean glass/tonal card structures that create clear operational hierarchy without visual noise or gratuitous decoration.

The system communicates integrity, structural efficiency, and progressive public governance.

## Colors

The palette balances the institutional gravitas of the Ministry's classic emerald green with clean, modern enterprise neutrals.

### Palette Architecture
- **Primary (`#065F46` / `#047857`)**: The primary emerald green communicates institutional credibility, stability, and growth. Used for key navigational active states, primary CTA buttons, active tab indicators, and top-tier KPI highlights.
- **Secondary (`#0F172A`)**: Deep Forest Slate Navy serves as the structural foundation for dark sidebar navigation, critical table headers, and high-emphasis data figures.
- **Tertiary (`#0284C7`)**: Informational blue for neutral administrative cues, audit trails, and secondary action metrics.
- **Surface & Canvas (`#F8FAFC` to `#FFFFFF`)**: An ultra-clean canvas supplemented with subtle light emerald/slate tints (`#F0FDF4` and `#F1F5F9`) to gently isolate analytical blocks without heavy drop shadows.

### Status Badges & Alert Tokens
Performance indicators adhere to clear semantic thresholds:
- **Tercapai / Melebihi Target (Success)**: Background `#DCFCE7`, Text `#15803D`, Border `#86EFAC`
- **Dalam Pemantauan / Kritis (Warning)**: Background `#FEF3C7`, Text `#B45309`, Border `#FDE68A`
- **Belum Tercapai / Tertunda (Danger)**: Background `#FEE2E2`, Text `#B91C1C`, Border `#FCA5A5`
- **Terkirim / Verifikasi (Info)**: Background `#E0F2FE`, Text `#0369A1`, Border `#BAE6FD`

## Typography

Plus Jakarta Sans is utilized across all tiers for its crisp geometry, open counters, and legible rendering in complex Indonesian bureaucratic terminology and dense quantitative reports.

### Hierarchy Guidelines
- **Display & Headings**: Reserved for high-level aggregated dashboards (e.g., "Laporan Capaian Kinerja Triwulan IV"). Tight letter-spacing keeps titles structured and authoritative.
- **Body Text**: Tuned for prolonged scanning. `body-md` (14px) is the baseline workhorse for data grids, audit logs, and official remarks.
- **Labels & Badges**: Small sizes (`label-md` and `label-sm`) use uppercase or semi-bold treatment with slightly wider tracking for immediate readability on performance badges and table metadata.
- **Data Metrics**: Specially tracked tabular numbers ensure aligned budget and percentage totals across data columns.

## Layout & Spacing

The layout is engineered around an enterprise dashboard framework optimized for wide desktop viewports (1440px and up) while maintaining graceful degradation for tablets and mobile devices.

### Layout Mechanics
- **Structural Blueprint**: Fixed Left Sidebar (`280px`) with persistent global branding, primary navigation, and quick role switching (Admin vs. Kepala Seksi); Sticky Top Bar (`64px`) for active breadcrumbs, period selectors (Tahun Anggaran/Triwulan), notification trays, and export actions; Fluid Central Canvas with structured gutters.
- **Grid Density**: 12-column dynamic CSS grid with `1.5rem` (24px) gutters on desktop, collapsing to 6-column on tablet (768px - 1023px) and 1-column stack on mobile (<768px).
- **Rhythm**: 8px baseline grid system. Tight metric groupings inside cards use `0.5rem` and `0.75rem`, while container spacing enforces generous breathing room with `1.5rem` to `2rem`.

## Elevation & Depth

This design system favors **tonal clarity and low-contrast borders** over heavy drop shadows to prevent visual fatigue in data-rich reporting interfaces.

### Elevation Hierarchy
- **Level 0 (Flat / Canvas)**: Background canvas (`#F8FAFC`).
- **Level 1 (Card & Section Containers)**: `#FFFFFF` surface with a crisp 1px border (`#E2E8F0`) and an ambient, faint shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Interactive Cards, Filter Toolbars, & Active Panels)**: Slightly elevated with a tinted undertone: `0 4px 6px -1px rgba(6, 95, 70, 0.04), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, Export Drawers, & Dropdowns)**: Elevated overlay with sharp containment: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`, bordered by `#CBD5E1`.

### Surface Tinting
Summary KPI cards utilize a soft gradient tint—white blending into an ultra-subtle `#F0FDF4` (5% emerald tint) at the bottom corner—to establish subtle sector hierarchy without clutter.

## Shapes

The design system employs **Soft (`1`)** roundedness. This sharp-meets-subtle approach preserves the formal dignity of an official ministry instrument without appearing dated or strictly utilitarian.

### Corner Radius Standards
- **Buttons, Text Inputs, and Badges**: `rounded` (0.25rem / 4px) or `rounded-md` (0.375rem / 6px) to maintain structured edges.
- **KPI Summary Cards and Data Tables**: `rounded-lg` (0.5rem / 8px) with clean, unclipped borders.
- **Pills / Status Chips**: Subtly rounded rectangular geometry (`rounded-md`, 6px) rather than extreme circular pills, maintaining a serious, enterprise feel.

## Components

### Buttons & Export Actions
- **Primary CTA**: Emerald background (`#065F46`), crisp white text, bold weight, 40px height. On hover: `#047857`. Focus ring: 2px offset `#065F46`.
- **Export Actions (PDF / Excel)**: Dedicated paired action group. Crisp white background, `#0F172A` text, 1px border `#CBD5E1`. PDF exports include a subdued red accent icon; Excel exports feature a muted forest green accent icon. Provides direct dropdown for choosing "Full Report" or "Filtered View".
- **Secondary / Ghost**: Slate text (`#475569`), transparent background, interactive hover tint (`#F1F5F9`).

### Data Tables & High-Density Grids
- **Header**: `#F8FAFC` background, uppercase tracking with `label-sm`, text in `#475569`, bottom border 1.5px `#E2E8F0`.
- **Row Styling**: Alternating hover state (`#F0FDF4` at 40% opacity), cell padding `12px 16px`, standard line height for numeric metrics.
- **Progress Tracking Cells**: Inline progress bars for budget absorption (8px height, rounded ends, emerald for target fulfillment, amber for lag).

### Status Badges & Chips
- Compact dimensions (`22px` height), font size `11px`, font weight `600`.
- Strict semantic pairing (light background, darker saturated text, matched subtle border) to identify status flags: *Selesai Verifikasi*, *Perlu Revisi*, *Menunggu Persetujuan Kasi*.

### Input Fields & Filter Toolbars
- **Inputs & Selects**: Height `38px`, border 1px `#CBD5E1`, internal padding `0 12px`, background `#FFFFFF`. Focus: `#065F46` border with a subtle 3px ring of `rgba(6, 95, 70, 0.1)`.
- **Filter Toolbar**: A consolidated horizontal bar above tables housing multi-selects for Unit Kerja, Triwulan, and Status, paired with a real-time instant search input.

### KPI & Metric Cards
- White surface, 1px border `#E2E8F0`.
- Top header: Subdued section title with informational tooltip.
- Center value: Prominent bold figure (`data-metric`), flanked by trend indicators (e.g., `+12.4% vs Tahun Lalu` in emerald or rose).
- Bottom accent: Subtle 3px colored top border indicating the tier (Emerald for IKU Utama, Slate for Administrasi).