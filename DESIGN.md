# Haiku Messenger Design Specification (Noir Crimson & Black/White)

This document establishes the official design system, token taxonomy, and theme architecture for **Haiku Messenger**, ensuring tactile, weightless, and coherent interfaces across both the Web client and the React Native mobile application.

---

## 1. Design Philosophy: Pitch Obsidian Black, Pure White, & Red Glow

- **Default Theme (Noir & Red Glow)**: Pitch obsidian black canvas (`#000000`) complemented by stark porcelain white typography (`#FFFFFF`) and an incandescent crimson red glow (`#FF2A3B` / `#C91424`). Deep, non-distracting, cinematic negative space.
- **Structural Stitch**: Translucent hairline borders (`rgba(255, 255, 255, 0.09)`) with crimson stitch glows (`rgba(255, 42, 59, 0.45)`) framing elevated containers.
- **Tactile Hierarchy**: Strict surface layering from `canvas` (`#000000` base) → `panel` (`rgba(10, 10, 12, 0.96)`) → `card` (`rgba(18, 18, 22, 0.88)`) → `inputBg` (`rgba(8, 8, 10, 0.94)`).
- **Legible Contrast**: High contrast ink (`#FFFFFF`), soft secondary body (`#A3A3A3`), and subtle metadata muted (`#62626E`). Controls maintain a minimum 44pt touch target and 11pt minimum typography.
- **Unified Outgoing Bubbles**: Outgoing messages use the signature Crimson Red `#C91424` with `#FFFFFF` text and radiant red illumination on both Web and Mobile.

---

## 2. Token Architecture & Definitions

All tokens are defined in `@haiku/contracts` (`packages/contracts/src/theme.ts`) as the single source of truth for Web and Mobile.

### Color Tokens

| Token | Noir & Red Glow (Default) | Sumi & Rain | Komorebi (Forest) | Washi (Warm Light) | Purpose |
|---|---|---|---|---|---|
| `canvas` | `#000000` | `#0C1015` | `#0B120E` | `#F6F7F5` | Root background |
| `panel` | `rgba(10, 10, 12, 0.96)` | `rgba(18, 24, 32, 0.94)` | `rgba(16, 26, 20, 0.94)` | `rgba(255, 255, 255, 0.96)` | Nav rail, header overlays |
| `card` | `rgba(18, 18, 22, 0.88)` | `rgba(24, 33, 44, 0.85)` | `rgba(22, 36, 28, 0.85)` | `#FFFFFF` | Elevated cards, list rows |
| `cardHover` | `rgba(28, 28, 34, 0.98)` | `rgba(33, 45, 60, 0.95)` | `rgba(30, 48, 38, 0.95)` | `#F0F2EE` | Hover/pressed state |
| `inputBg` | `rgba(8, 8, 10, 0.94)` | `rgba(14, 19, 26, 0.92)` | `rgba(12, 20, 15, 0.92)` | `#FFFFFF` | Text fields & search inputs |
| `line` | `rgba(255, 255, 255, 0.09)` | `rgba(255, 255, 255, 0.08)` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.08)` | Structural 1px border |
| `stitch` | `rgba(255, 42, 59, 0.28)` | `rgba(78, 159, 134, 0.20)` | `rgba(88, 163, 121, 0.20)` | `rgba(55, 117, 97, 0.20)` | Accent seams & highlights |
| `stitchGlow` | `rgba(255, 42, 59, 0.45)` | `rgba(78, 159, 134, 0.25)` | `rgba(88, 163, 121, 0.25)` | `rgba(55, 117, 97, 0.15)` | Glowing halo aura |
| `ink` | `#FFFFFF` | `#EDF2F7` | `#EDF6F0` | `#1A2220` | Primary text and headlines |
| `body` | `#A3A3A3` | `#8C9DAE` | `#8CAE99` | `#4B5A54` | Secondary body text |
| `muted` | `#62626E` | `#556778` | `#50705E` | `#7D8B84` | Captions, dates, timestamps |
| `mint` | `#FF2A3B` | `#4E9F86` | `#58A379` | `#377561` | Primary action / accent |
| `mintDark` | `#C91424` | `#377561` | `#3F7B58` | `#265345` | Button hover / chat bubble me |
| `mintContrast`| `#FFFFFF` | `#071712` | `#07150D` | `#FFFFFF` | Text on top of `mint` |
| `bubbleMe` | `#C91424` | `#377561` | `#386F50` | `#377561` | Outgoing chat bubble |
| `bubbleMeText`| `#FFFFFF` | `#F4FAF7` | `#F0FAF4` | `#FFFFFF` | Outgoing chat bubble text |
| `red` | `#FF2A3B` | `#E06C75` | `#E06C75` | `#C94A53` | Destructive / error token |
| `amber` | `#E5A855` | `#D48259` | `#D48259` | `#BD683E` | Warning / caution token |
| `blue` | `#FFFFFF` | `#61AFEF` | `#61AFEF` | `#3884C7` | Neutral contrast accent |
| `scrim` | `rgba(0, 0, 0, 0.75)` | `rgba(0, 0, 0, 0.65)` | `rgba(0, 0, 0, 0.65)` | `rgba(0, 0, 0, 0.40)` | Modal backdrop |

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

1. **`noir` (Noir & Red Glow)**: Pitch obsidian black (`#000000`), porcelain white typography (`#FFFFFF`), and an incandescent crimson red glow (`#FF2A3B` / `#C91424`). Default dark theme.
2. **`sumi` (Sumi & Rain)**: Basalt ink canvas (`#0C1015`) with calm celadon jade (`#4E9F86`).
3. **`komorebi` (Forest Rain)**: Deep forest canopy dark (`#0B120E`) with vibrant foliage emerald (`#58A379`).
4. **`washi` (Japanese Paper)**: Warm fibrous light cream (`#F6F7F5`) with deep sumi ink text (`#1A2220`) and forest jade (`#377561`).
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
