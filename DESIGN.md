# Google Stitch Design Specification (DESIGN.md)

This document establishes the official Google Stitch design system and visual tokens for **Haiku Messenger**, maintaining cohesive, tactile, and weightless anti-gravity user interfaces across both the Web client and the React Native Android application.

---

## 1. Design Philosophy: Weightless Stitch

- **Tactile Seams & Stitches**: Subtle, luminous 1px outlines (`rgba(163, 230, 53, 0.16)`) that frame interface containers like fine structural stitches.
- **Obsidian Velvet Depth**: Multi-layered dark canvases (`#070D0A`, `rgba(14, 22, 17, 0.88)`, `rgba(20, 32, 25, 0.78)`) that create a deep, calm, non-distracting space.
- **Radiant Lime Accents**: Lime Velvet (`#A3E635` / `#BEF264`) used selectively for interactive focus, active states, and primary CTAs. Text atop lime is always dark obsidian (`#07120A`) for optimal contrast and readability.
- **Unified Left Navigation Rail**: Both desktop web and mobile Android utilize a persistent Left Rail navigation layout for consistent mental models and effortless thumb reach.

---

## 2. Core Tokens

### Color Palette
```css
/* Stitch Canvas & Panels */
--canvas: #070D0A;
--panel: rgba(14, 22, 17, 0.88);
--card: rgba(20, 32, 25, 0.78);
--card-hover: rgba(28, 44, 34, 0.88);
--input-bg: rgba(10, 16, 12, 0.88);

/* Stitch Lines & Borders */
--stitch-line: rgba(163, 230, 53, 0.16);
--stitch-subtle: rgba(255, 255, 255, 0.08);
--stitch-glow: rgba(163, 230, 53, 0.32);

/* Radiant Accents */
--accent-primary: #A3E635;
--accent-highlight: #BEF264;
--accent-dark: #65A30D;
--accent-contrast: #07120A;

/* Typography Ink */
--ink: #F4FBF7;
--body: #C2D6CC;
--muted: #7E968B;
```

### Elevation & Radius
- **Border Radius**:
  - Small / Pill: `12px` - `16px` (tags, filter pills, buttons)
  - Card: `20px` - `24px` (message containers, conversation cards, modals)
  - Rail / App Shell: `28px` - `32px`
- **Shadows**:
  - Card Float: `0 20px 50px rgba(0, 0, 0, 0.6)`
  - Active Glow: `0 0 16px rgba(163, 230, 53, 0.22)`

---

## 3. Left Rail Navigation Pattern

The Left Rail is the primary navigational spine of Haiku Messenger:
1. **Top Anchor**: The Haiku brand logo with a hairline stitch separator.
2. **Nav Stitches**:
   - 💬 **Chats**: Direct & group conversations
   - ✦ **Moments**: 24-hour ephemeral stories
   - 👥 **People**: Friends, requests, discover
   - ⚙ **Settings**: Theme, server status, security
3. **Active Indicator**: Glowing Lime Velvet pill with 16px radius and dark ink glyph.
4. **Bottom Anchor**: Live connectivity and presence status dot (`●`).

---

## 4. Components & States

- **Filter Pills**: Inactive state is translucent obsidian with stitch border; active state is radiant lime with `#07120A` text.
- **Message Bubbles**: Outgoing messages use the radiant Lime gradient with dark ink text (`#07120A`) and `✓✓` receipts; incoming messages use frosted obsidian glass (`rgba(22, 34, 27, 0.9)`).
- **Floating Modals**: Suspended in deep 3D space with `backdrop-filter: blur(24px)` and 1px stitch borders.
