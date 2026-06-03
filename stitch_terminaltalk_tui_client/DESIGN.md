---
name: Terminal User Interface System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#ffd393'
  on-secondary: '#432c00'
  secondary-container: '#fdaf00'
  on-secondary-container: '#694600'
  tertiary: '#ecfcff'
  on-tertiary: '#00363d'
  tertiary-container: '#7fecff'
  on-tertiary-container: '#006b78'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#ffddaf'
  secondary-fixed-dim: '#ffba43'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#614000'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 24px
  panel-padding: 12px
---

## Brand & Style

This design system is built on a **Retro-Modern Terminal (TUI)** aesthetic. It celebrates the efficiency and raw utility of command-line interfaces while utilizing modern high-resolution displays for crispness and legibility. The UI is designed to evoke a sense of "power-user" agency, technical proficiency, and nostalgia for early computing.

The core style is **Brutalist and Functional**, characterized by:
- **High-Information Density:** Minimal negative space with structured data grids.
- **Monospaced Precision:** Relying on character alignment for visual order.
- **Panel-Based Navigation:** A rigid layout structure defined by visible borders rather than shadows or depth.
- **Cybernetic Contrast:** A deep obsidian base punctuated by luminous phosphors.

## Colors

The palette is rooted in a pure dark mode experience, simulating the phosphor glow of vintage CRT monitors.

- **Background (#0A0A0A):** A near-black obsidian provides the canvas for high-contrast elements.
- **Primary (Terminal Green):** Used for standard output, success states, and primary navigation focus.
- **Secondary (Amber):** Used for warnings, highlighted parameters, and active configuration settings.
- **Tertiary (Cyan):** Used for headers, informational tags, and secondary action highlights.
- **Danger (#FF4B2B):** A sharp red reserved for destructive actions or critical errors.
- **Muted (#4A4A4A):** Low-contrast gray used for secondary metadata and inactive border states.

## Typography

Typography in this design system is strictly monospaced. This ensures that columns, borders, and ASCII-style elements align perfectly regardless of content.

**JetBrains Mono** is the primary typeface, selected for its exceptional legibility and developer-friendly ligatures.

- **Headlines:** Should be used sparingly, often enclosed in brackets or decorated with ASCII dashes (e.g., `[ Settings ]`).
- **Body:** Standardized at 14px for optimal information density without sacrificing readability.
- **Labels:** Always uppercase or distinctively colored to separate metadata from user data.
- **ASCII Art:** All decorative logos or headers should be rendered using standard ASCII character sets to maintain the TUI aesthetic.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, dividing the screen into distinct functional panels.

- **Panel Model:** Content is divided into rectangular containers defined by 1px solid borders. Panels should not overlap; they "dock" against one another.
- **The Sidebar/Main split:** A common 30/70 or 25/75 split is used to separate navigation/settings from the primary terminal workspace.
- **Spacing Rhythm:** All margins and paddings are multiples of **4px**. This maintains a tight, technical feel.
- **Responsive Behavior:** On smaller screens, panels stack vertically. On mobile, the sidebar is hidden behind a command-driven menu (`Ctrl+M`).

## Elevation & Depth

This design system rejects shadows and blurs. Depth is communicated through **Tonal Layering** and **Active Outlines**:

- **Layer 0 (Background):** The base terminal surface (#0A0A0A).
- **Layer 1 (Panels):** Defined by 1px borders. Inactive panels use a muted gray border; active or focused panels use a primary color border.
- **Focus States:** Focused elements are indicated by a full-block background highlight (reversing the text color) rather than a shadow.
- **Overlays:** Modals or "Pop-ups" are rendered as high-contrast panels with a thick 2px border, placed directly over the content without a backdrop blur.

## Shapes

The design system uses a **Strictly Sharp** shape language.

- **No Rounded Corners:** All buttons, panels, and input fields have 0px border-radius to mimic the character-cell constraints of actual terminal emulators.
- **Selection Blocks:** Hover and selection states are perfectly rectangular blocks.
- **Borders:** Use thin 1px lines. For a more authentic retro feel, these can be replaced with Unicode box-drawing characters (┌ ┐ └ ┘ │ ─).

## Components

### Buttons & Keybindings
Buttons are styled as text inside brackets (e.g., `[ SUBMIT ]`). Hovering or focusing a button should invert the colors (Primary background, Neutral text). Labels often include a shortcut hint (e.g., `(s) Save`).

### Inputs
Input fields are indicated by a leading character prompt (e.g., `> ` or `$ `). The cursor should be a flashing block or underline in the primary color.

### Chips & Tags
Chips are rendered as solid blocks of color with black text, or outlined boxes. They are used for status indicators like `[ IDLE ]` or `[ BUSY ]`.

### Lists
Lists use bullet characters (squares or arrows) in the accent color. Active items in a list are highlighted with a full-width background bar.

### Cards & Panels
Every container must have a title. The title should be positioned either in the top-left corner of the border or inside the top border line itself (e.g., `───[ Settings ]──────`).

### Scrollbars
Scrollbars are minimal, 4px wide, and use a high-contrast thumb with no track styling, appearing only when content overflows.