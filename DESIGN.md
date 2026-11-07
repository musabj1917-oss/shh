# Haiku Messenger Design Specification (Sumi & Rain)

This document establishes the official design system, token taxonomy, and theme architecture for **Haiku Messenger**, ensuring tactile, weightless, and coherent interfaces across both the Web client and the React Native mobile application.

---

## 1. Design Philosophy: Weightless Celadon on Sumi Ink

- **Default Theme (Sumi & Rain)**: Basalt ink canvas (`#0C1015`) complemented by calm celadon jade accents (`#4E9F86` / `#377561`). Deep, non-distracting, weightless negative space.
- **Structural Stitch**: Subtle, translucent hairline borders (`rgba(255, 255, 255, 0.08)`) with jade stitch glows (`rgba(78, 159, 134, 0.20)`) framing elevated containers.
- **Tactile Hierarchy**: Strict surface layering from `canvas` (deepest base) → `panel` (translucent navigation and shells) → `card` (interactive items) → `inputBg` (recessed controls).
- **Legible Contrast**: High contrast ink (`#EDF2F7`), soft secondary body (`#8C9DAE`), and subtle metadata muted (`#556778`). Controls maintain a minimum 44pt touch target and 11pt minimum typography.
- **Unified Outgoing Bubbles**: Outgoing messages use the signature Celadon Dark `#377561` with `#F4FAF7` text on both Web and Mobile.

---

## 2. Token Architecture & Definitions

All tokens are defined in `@haiku/contracts` (`packages/contracts/src/theme.ts`) as the single source of truth for Web and Mobile.

### Color Tokens

| Token | Sumi & Rain (Default) | Komorebi (Forest) | Noir (Obsidian) | Washi (Warm Light) | Purpose |
|---|---|---|---|---|---|
| `canvas` | `#0C1015` | `#08100C` | `#000000` | `#F6F3ED` | Root background |
| `panel` | `rgba(18, 24, 32, 0.94)` | `rgba(14, 24, 18, 0.94)` | `rgba(16, 16, 16, 0.96)` | `rgba(255, 255, 255, 0.92)` | Nav rail, header overlays |
| `card` | `rgba(24, 33, 44, 0.85)` | `rgba(20, 36, 26, 0.82)` | `rgba(24, 24, 24, 0.85)` | `rgba(255, 255, 255, 0.96)` | Elevated cards, list rows |
| `cardHover` | `rgba(33, 45, 60, 0.95)` | `rgba(28, 48, 36, 0.92)` | `rgba(36, 36, 36, 0.95)` | `rgba(244, 240, 232, 0.98)` | Hover/pressed state |
| `inputBg` | `rgba(14, 19, 26, 0.92)` | `rgba(10, 18, 14, 0.92)` | `rgba(18, 18, 18, 0.95)` | `rgba(248, 245, 239, 0.95)` | Text fields & search inputs |
| `line` | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.07)` | `rgba(255, 255, 255, 0.10)` | `rgba(45, 41, 38, 0.10)` | Structural 1px border |
| `stitch` | `rgba(78, 159, 134, 0.20)` | `rgba(46, 160, 107, 0.22)` | `rgba(255, 255, 255, 0.15)` | `rgba(44, 106, 80, 0.22)` | Accent seams & highlights |
| `ink` | `#EDF2F7` | `#F0FDF4` | `#FFFFFF` | `#1C1917` | Primary text and headlines |
| `body` | `#8C9DAE` | `#86A795` | `#A0A0A0` | `#57534E` | Secondary body text |
| `muted` | `#556778` | `#4D6B5A` | `#666666` | `#8C867E` | Captions, dates, timestamps |
| `mint` | `#4E9F86` | `#2EA06B` | `#FFFFFF` | `#2C6A50` | Primary action / accent |
| `mintDark` | `#377561` | `#22754D` | `#CCCCCC` | `#1F4D3A` | Button hover / chat bubble me |
| `mintContrast`| `#071712` | `#03170E` | `#000000` | `#FFFFFF` | Text on top of `mint` |
| `bubbleMe` | `#377561` | `#22754D` | `#2A2A2A` | `#2C6A50` | Outgoing chat bubble |
| `bubbleMeText`| `#F4FAF7` | `#F0FDF4` | `#FFFFFF` | `#FFFFFF` | Outgoing chat bubble text |
| `red` | `#E06C75` | `#E06C75` | `#E06C75` | `#DC2626` | Destructive / error token |
| `amber` | `#E5C07B` | `#E5C07B` | `#E5C07B` | `#D97706` | Warning / caution token |
| `blue` | `#61AFEF` | `#61AFEF` | `#61AFEF` | `#2563EB` | Info / group accent token |
| `scrim` | `rgba(6, 9, 13, 0.78)` | `rgba(4, 10, 6, 0.78)` | `rgba(0, 0, 0, 0.85)` | `rgba(28, 25, 23, 0.50)` | Modal backdrop |

### Radii Tokens
- `radii.xs`: `4px`
- `radii.sm`: `8px`
- `radii.md`: `12px` (inputs, smaller action buttons)
- `radii.lg`: `16px` (navigation pills, sub-cards)
- `radii.xl`: `20px` (chat messages, list surfaces)
- `radii.xxl`: `24px` (modals, hero cards, full sheet views)
- `radii.pill`: `9999px` (capsule tags, badges)

### Typography & Sizes
- `sizes.micro`: `11px` (strict readable minimum across all screens)
- `sizes.caption`: `12px`
- `sizes.sub`: `13px`
- `sizes.body`: `14px`
- `sizes.bodyLarge`: `15px`
- `sizes.headline`: `16px`
- `sizes.titleSm`: `18px`
- `sizes.title`: `20px`
- `sizes.titleLg`: `24px`
- `sizes.display`: `28px`
- **Font Families**:
  - `sans`: Instrument Sans / Inter (`Instrument Sans`, -apple-system, sans-serif)
  - `serif`: Newsreader / Georgia
  - `mono`: JetBrains Mono / monospace

### Control Heights
- `controls.heights.sm`: `36px` (compact pills, small action buttons)
- `controls.heights.md`: `44px` (touch benchmark minimum: composer send, text fields, list actions)
- `controls.heights.lg`: `50px` (hero submit buttons)

---

## 3. Available Themes

1. **`sumi` (Sumi & Rain)**: Basalt ink canvas (`#0C1015`) with calm celadon jade (`#4E9F86`). Default dark theme.
2. **`komorebi` (Forest Rain)**: Deep forest canopy dark (`#08100C`) with vibrant spring foliage emerald (`#2EA06B`).
3. **`noir` (Monochrome Obsidian)**: Pitch black (`#000000`) with high-contrast grayscale and white accents.
4. **`washi` (Japanese Paper)**: Warm fibrous light cream (`#F6F3ED`) with deep sumi ink text (`#1C1917`) and forest jade (`#2C6A50`).
5. **`system`**: Matches the user's operating system dark/light preference automatically.

---

## 4. How to Add a New Theme

To add a new theme across both mobile and web:

1. **Define in `@haiku/contracts`**:
   - Open [`packages/contracts/src/theme.ts`](file:///packages/contracts/src/theme.ts).
   - Add your theme id to the `ThemeId` union type:
     ```ts
     export type ThemeId = 'sumi' | 'komorebi' | 'noir' | 'washi' | 'yourTheme';
     ```
   - Provide the complete `ThemeDefinition` with all `ThemeColors` in the `themes` record.
2. **Expose CSS Variables on Web**:
   - Open [`app/globals.css`](file:///app/globals.css) and [`public/app.css`](file:///public/app.css).
   - Add a `[data-theme='yourTheme']` block mapping the tokens to CSS custom properties:
     ```css
     [data-theme='yourTheme'] {
       --canvas: #...;
       --panel: #...;
       --card: #...;
       --ink: #...;
       --accent-primary: #...;
       --bubble-me: #...;
       /* ...all variables */
     }
     ```
3. **Register in Web Selectors**:
   - Add the `<option value="yourTheme">Your Theme Name</option>` to `#settingsThemeSelect` in [`public/index.html`](file:///public/index.html) and web settings.
4. **Mobile automatically picks it up**:
   - `ThemeProvider` and `ProfileScreen` read dynamically from the contracts `themes` object, rendering your new theme option immediately without needing mobile code modifications.
