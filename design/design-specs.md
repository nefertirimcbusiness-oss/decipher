# Decipher — Design Specifications

> Brand design guidelines for the Decipher app — a comforting, interactive space for users navigating trauma and memory loss.

---

## 1. Brand Overview

**Brand Personality:** Gentle, warm, insightful, non-judgemental, reassuring, hopeful.
**Visual Metaphor:** A lovingly kept scrapbook — handwritten notes, pressed flowers, soft textures, layered memories.
**Mascot:** Savid — a wise, cool owl mentor who guides without judgement.

---

## 2. Color Palette

### 2.1 Primary Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-lilac` | `#D4B8E0` | Primary brand color — buttons, accents, headers, Savid's feathers |
| `--color-lilac-deep` | `#B891C9` | Hover states, active elements, darker accents |
| `--color-lilac-light` | `#EDE0F4` | Subtle backgrounds, cards, hovered states |
| `--color-white` | `#FFFFFF` | Page backgrounds, card surfaces, text-on-dark |
| `--color-buttercream` | `#FFF5E1` | Warm background tone, scrapbook paper texture base |
| `--color-buttercream-dark` | `#F5E6C8` | Slightly deeper warm tone for contrast areas |

### 2.2 Secondary Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-sage` | `#B5C7A0` | Success states, natural accents, leaf/decorative elements |
| `--color-sage-light` | `#D4E3C4` | Success backgrounds, subtle growth indicators |
| `--color-coral` | `#E8A89A` | Gentle warnings, emotional warmth markers, heart accents |
| `--color-coral-light` | `#F5D0C6` | Warning backgrounds, soft callouts |
| `--color-sky` | `#A8D4E8` | Info hints, Savid's glasses reflections, calm tones |
| `--color-sky-light` | `#D4ECF5` | Info backgrounds, tooltips |

### 2.3 Neutral Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-charcoal` | `#2D2B3A` | Primary text color |
| `--color-graphite` | `#4A4858` | Secondary text, captions |
| `--color-stone` | `#8B8999` | Disabled text, placeholders |
| `--color-mist` | `#D6D4E0` | Borders, dividers, subtle separators |
| `--color-fog` | `#EBEAF0` | Background for disabled elements |

### 2.4 Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#7FB385` | Positive affirmations, streaks, completions |
| `--color-warning` | `#D4A65A` | Gentle caution, edit-reason prompts |
| `--color-error` | `#C97B7B` | Errors, important alerts (use sparingly) |

---

## 3. Typography

### 3.1 Font Families

| Usage | Font | Fallback |
|---|---|---|
| **Headings (display)** | `'Playfair Display'` | `Georgia, serif` |
| **Body text** | `'Quicksand'` | `'Segoe UI', 'Helvetica Neue', sans-serif` |
| **UI labels / buttons** | `'Nunito'` | `'Segoe UI', sans-serif` |
| **Scrapbook handwritten quotes** | `'Dancing Script'` | `cursive` |
| **Code / timestamps** | `'IBM Plex Mono'` | `'Courier New', monospace` |

### 3.2 Type Scale

| Level | Size | Weight | Line Height | Font |
|---|---|---|---|---|
| **Hero / h1** | 2.25rem (36px) | 700 | 1.2 | Playfair Display |
| **h2** | 1.75rem (28px) | 600 | 1.3 | Playfair Display |
| **h3** | 1.375rem (22px) | 600 | 1.35 | Quicksand |
| **h4** | 1.125rem (18px) | 600 | 1.4 | Quicksand |
| **Body large** | 1rem (16px) | 400 | 1.6 | Quicksand |
| **Body** | 0.9375rem (15px) | 400 | 1.6 | Quicksand |
| **Body small** | 0.8125rem (13px) | 400 | 1.5 | Quicksand |
| **Caption** | 0.75rem (12px) | 500 | 1.4 | Nunito |
| **Scrapbook heading** | 1.5rem (24px) | 700 | 1.3 | Dancing Script |
| **Button / Label** | 0.9375rem (15px) | 600 | 1 | Nunito |

### 3.3 Tone of Voice

- **Warm, conversational, and gentle** — like a friend sitting beside you.
- **Never clinical or cold.** Avoid overly formal language.
- **Use metaphors of nature, warmth, and memory.**
- **Savid speaks in short, thoughtful sentences** with occasional line breaks.
- **Edit history reasons must be factual but kind** — "I remembered a different detail" rather than "I was wrong."

---

## 4. Spacing System

Use a 4px base unit. All spacing scales by multiples of 4.

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 4px | Tight inner padding, icon gaps |
| `--space-sm` | 8px | Compact padding, button inner spacing |
| `--space-md` | 12px | Standard padding, card inner spacing |
| `--space-lg` | 16px | Section gap, card padding |
| `--space-xl` | 24px | Component margins, page section gaps |
| `--space-2xl` | 32px | Major sections, screen edges |
| `--space-3xl` | 48px | Hero spacing, large page sections |
| `--space-4xl` | 64px | Full-screen breathing room |

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Input fields, small UI elements |
| `--radius-md` | 8px | Cards, buttons, panels |
| `--radius-lg` | 12px | Modals, larger containers |
| `--radius-xl` | 16px | Feature cards, hero sections |
| `--radius-full` | 9999px | Avatars, pills, badges |

---

## 6. Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(45, 43, 58, 0.06)` | Subtle elevation, cards resting |
| `--shadow-md` | `0 4px 12px rgba(45, 43, 58, 0.08)` | Hovered cards, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(45, 43, 58, 0.10)` | Modals, drawers |
| `--shadow-xl` | `0 12px 36px rgba(45, 43, 58, 0.12)` | Full-screen overlays |
| `--shadow-glow-lilac` | `0 0 20px rgba(212, 184, 224, 0.3)` | Soft glow on active elements |
| `--shadow-glow-warm` | `0 0 20px rgba(255, 245, 225, 0.4)` | Warm glow on scrapbook pages |

---

## 7. Transitions & Animation

| Token | Value | Usage |
|---|---|---|
| `--transition-fast` | 150ms ease | Hover states, micro-interactions |
| `--transition-base` | 250ms ease | Button states, card reveals |
| `--transition-slow` | 400ms ease | Page transitions, scrapbook page turns |
| `--transition-spring` | 500ms cubic-bezier(0.34, 1.56, 0.64, 1) | Bouncy, joyful animations |

---

## 8. Component Specs

### 8.1 Entry Form (Create Memory)

```
┌────────────────────────────────────────┐
│  📖 New Memory                         │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Title your memory...             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ What happened?                   │  │
│  │                                  │  │
│  │  [text area - 4 lines min]      │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  📎 Add evidence (photo/audio)   │  │
│  │  [Upload area - drag & drop]     │  │
│  │  ┌──────────┐  ┌──────────┐     │  │
│  │  │ 🎤 Audio │  │ 📷 Photo │     │  │
│  │  └──────────┘  └──────────┘     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ❓ Any details you want to add?  │  │
│  │ (Savid's optional prompts)       │  │
│  │ • What season was it?            │  │
│  │ • Who was with you?              │  │
│  │ • How did it feel?               │  │
│  └──────────────────────────────────┘  │
│                                        │
│  🦉 Savid: "This sounds important.    │
│     Take your time."                   │
│                                        │
│  [ ✨ Save Memory ]                    │
│                                        │
│  *Your entry is private and yours only.*│
└────────────────────────────────────────┘
```

**States:**
- Default: Empty fields with placeholder text
- Filled: User has typed — save becomes active
- Error: Required field missing — gentle red border + message
- Saving: Button shows spinner "Saving your memory..."
- Saved: Brief confetti animation, transitions to scrapbook view

### 8.2 Scrapbook Page (Memory Display)

```
┌────────────────────────────────────────┐
│  ← Back to memories         📅 Jun 14  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ╔══════════════════════════════╗ │  │
│  │ ║    ✨ The Day We Met ✨      ║ │  │
│  │ ║    — Dancing Script —        ║ │  │
│  │ ╚══════════════════════════════╝ │  │
│  │                                  │  │
│  │  [Decorative tape/sticker top]   │  │
│  │                                  │  │
│  │  The park was golden that        │  │
│  │  afternoon. Leaves everywhere,   │  │
│  │  and the light through the       │  │
│  │  branches...                      │  │
│  │                                  │  │
│  │  ┌──────────────────────────┐   │  │
│  │  │  🎵 Audio Memory         │   │  │
│  │  │  "I remember the         │   │  │
│  │  │   crunch of leaves..."   │   │  │
│  │  │  [ ▶️ 0:32 ]             │   │  │
│  │  └──────────────────────────┘   │  │
│  │                                  │  │
│  │  [🌸 Decorative sticker]         │  │
│  │                                  │  │
│  │  --- Savid's Reflection ---      │  │
│  │  🦉 "Details like the light      │  │
│  │      through branches... those   │  │
│  │      are the colors of real      │  │
│  │      memories. This is a         │  │
│  │      beautiful record."          │  │
│  │                                  │  │
│  │  ✏️ Edited 2 times              │  │
│  │  [View edit history →]           │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 8.3 Audio Recorder

```
┌──────────────────────────────────┐
│  🎤 Record a Voice Memory        │
│                                  │
│  ┌──────────────────────────────┐│
│  │    🔊   ──●───────          ││
│  │    0:00         0:32        ││
│  │    [🎙️ Recording...]        ││
│  └──────────────────────────────┘│
│                                  │
│     ┌─────────────────────┐      │
│     │  ⏹️ Stop  ⏸️ Pause  │      │
│     └─────────────────────┘      │
│                                  │
│  🦉 Savid: "Whenever you're      │
│     ready. No rush."             │
│                                  │
│  [✓ Use Recording] [🗑️ Discard]  │
└──────────────────────────────────┘
```

**States:**
- Idle: Ready to record with Savid's prompt
- Recording: Red pulse animation, waveform visualization
- Paused: Paused indicator, resume option
- Done: Preview with playback controls

### 8.4 Edit History Tab

```
┌──────────────────────────────────────┐
│  📝 Edit History                     │
│  "The Day We Met"                    │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ 🕐 Jun 14, 2026 — 3:42 PM       ││
│  │ Reason: Added more sensory       ││
│  │ details I remembered             ││
│  │ [View version →]                 ││
│  └──────────────────────────────────┘│
│                                      │
│  ┌──────────────────────────────────┐│
│  │ 🕐 Jun 12, 2026 — 8:15 PM       ││
│  │ Reason: Corrected the date       ││
│  │ — it was June, not May           ││
│  │ [View version →]                 ││
│  └──────────────────────────────────┘│
│                                      │
│  ┌──────────────────────────────────┐│
│  │ 🕐 Jun 10, 2026 — 9:30 AM       ││
│  │ ★ Original entry                 ││
│  │ [View version →]                 ││
│  └──────────────────────────────────┘│
│                                      │
│  🦉 Savid: "Every edit is a step     │
│     in your story. Each version      │
│     matters."                        │
└──────────────────────────────────────┘
```

### 8.5 Dashboard / Home Screen

```
┌────────────────────────────────────────┐
│  Good morning, Alex ✨                 │
│                                        │
│  ┌─── 🦉 ─────────────────────────┐   │
│  │  "You've written 12 memories   │   │
│  │   this week. That's wonderful. │   │
│  │   How about we revisit one     │   │
│  │   from a rainy day?"           │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌───── Your Scrapbook ──────────┐    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐  │    │
│  │  │📖 Jun│ │📖 May│ │📖 Apr│  │    │
│  │  │  14  │ │  28  │ │  10  │  │    │
│  │  │  🎤  │ │  📷  │ │  🎤  │  │    │
│  │  └──────┘ └──────┘ └──────┘  │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐  │    │
│  │  │📖 Mar│ │📖 Feb│ │➕ New │  │    │
│  │  │  22  │ │  14  │ │Memory│  │    │
│  │  │  📎  │ │      │ │      │  │    │
│  │  └──────┘ └──────┘ └──────┘  │    │
│  └──────────────────────────────┘    │
│                                        │
│  ┌─── Your Progress ─────────────┐    │
│  │  🔥 5-day streak              │    │
│  │  🏆 12 entries this month     │    │
│  │  ⏳ Avg: 4 memories/week      │    │
│  └──────────────────────────────┘    │
│                                        │
│  [ ✨ New Memory ]                      │
└────────────────────────────────────────┘
```

### 8.6 Settings

```
┌────────────────────────────────────────┐
│  ⚙️ Settings                           │
│                                        │
│  ┌── Profile ──────────────────────┐   │
│  │  Name: Alex                     │   │
│  │  ✏️ Edit                        │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌── Account ──────────────────────┐   │
│  │  📧 alex@email.com              │   │
│  │  💳 Subscription: Active        │   │
│  │     Next billing: Jul 26, 2026  │   │
│  │     Plan: Premium ($24.99/mo)   │   │
│  │  [ Manage Subscription ]        │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌── Preferences ──────────────────┐   │
│  │  🌙 Dark mode (coming soon)     │   │
│  │  🔔 Reminders: On              │   │
│  │     • Daily check-in: 8:00 PM  │   │
│  │  🔊 Sound effects: Gentle      │   │
│  │  🎨 Theme: Lilac (default)     │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌── Privacy ──────────────────────┐   │
│  │  🔒 All data is encrypted       │   │
│  │  📤 Export my data              │   │
│  │  🗑️ Delete account              │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌── About ────────────────────────┐   │
│  │  🦉 Decipher v1.0.0            │   │
│  │  📋 Terms of Service           │   │
│  │  🔒 Privacy Policy             │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### 8.7 Signup / Free Trial Flow

```
┌────────────────────────────────────────┐
│       🦉 Welcome to Decipher           │
│                                        │
│  A gentle space for your memories.     │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  ✉️ Email                        │  │
│  │  [your@email.com]               │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  🔑 Password                     │  │
│  │  [························]      │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  👤 Display Name                 │  │
│  │  [Your name]                    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  🎁 Your first month is 50% off         │
│  ($12.49) — then $24.99/month           │
│  Cancel anytime. 7-day free trial.      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  💳 Card Number                  │  │
│  │  [1234 5678 9012 3456]          │  │
│  └──────────────────────────────────┘  │
│  ┌────────┐ ┌──────┐ ┌───────────┐   │
│  │ MM/YY  │ │ CVC  │ │ ZIP       │   │
│  └────────┘ └──────┘ └───────────┘   │
│                                        │
│  [ ✨ Start Your Journey ]             │
│                                        │
│  By signing up, you agree to our       │
│  Terms of Service and Privacy Policy.  │
│  This is not a substitute for          │
│  professional medical advice.          │
│                                        │
│  Already have an account? Log in       │
└────────────────────────────────────────┘
```

### 8.8 Savid Chat Bubble

```
┌──────────────────────────────────┐
│  🦉                               │
│  ╔══════════════════════════════╗ │
│  ║  Savid says...               ║ │
│  ║                              ║ │
│  ║  "That's a really good       ║ │
│  ║   detail to hold onto.       ║ │
│  ║   What do you remember       ║ │
│  ║   feeling right after?"      ║ │
│  ║                              ║ │
│  ║  [💬 Reply]                  ║ │
│  ╚══════════════════════════════╝ │
└──────────────────────────────────┘
```

---

## 9. Iconography

### 9.1 Icon Style
- **Style:** Line + fill hybrid — delicate outlines with occasional filled accents
- **Stroke width:** 1.5px
- **Corner style:** Rounded
- **Size:** 24×24px default (with 20×20 and 16×16 variants)
- **Color:** Inherits from current text color by default

### 9.2 Core Icon Set

| Icon | Usage |
|---|---|
| 🦉 Savid | Mascot avatar, chat bubbles |
| 📖 Book/Journal | Memory entries, scrapbook |
| 🎤 Microphone | Audio recording |
| 📷 Camera | Photo attachment |
| 📎 Paperclip | General attachment |
| ✏️ Pencil | Edit |
| 🗑️ Trash | Delete |
| 🔒 Lock | Privacy, encryption |
| ⭐ Star | Important memories |
| 🔥 Flame | Streaks |
| 🏆 Trophy | Achievements |
| 🎨 Palette | Theme settings |
| ⏪ Rewind | Playback |
| ▶️ Play | Audio play |
| ⏹️ Stop | Audio stop |
| ⏸️ Pause | Audio pause |
| 📅 Calendar | Date |
| 🔍 Search | Search memories |
| ❓ Question | Savid's prompts |
| 💬 Chat | Savid conversation |
| 🌸 Flower | Decorative element |
| 📌 Pin | Pinned memories |
| 📤 Export | Data export |
| ⚙️ Settings | Settings gear |

---

## 10. Scrapbook Page Design

### 10.1 Layout

Each scrapbook page has:
- **Header:** Playfair Display heading with decorative underline (hand-drawn style)
- **Body:** Quicksand text with generous line height
- **Evidence box:** Soft lilac background with rounded corners, tape/sticker effect at top
- **Savid's reflection:** A separate card with a subtle left border in lilac
- **Edit history link:** Small text at bottom with pencil icon
- **Decorations:** Subtle stickers, washi tape effects, page curl shadow

### 10.2 Paper Texture Effect
- Base: Buttercream (#FFF5E1) with subtle noise/grain
- Border: Slightly darker (#F5E6C8) with 1px inner shadow for page edges
- Corner fold: Subtle shadow in bottom-right

### 10.3 Decorative Elements
- Washi tape accent at top of evidence cards (semi-transparent lilac)
- Small flower/leaf doodle accents
- Hand-drawn underline on headings
- Polaroid-style photo frames for image evidence
- Timestamps in handwritten-style font (Dancing Script)

---

## 11. Audio Memory Card

```
┌──────────────────────────────────┐
│ ┌───── ─ ─ ─────────────────┐   │
│ │ 📻 Audio Memory            │   │
│ │ "What I remember most..."  │   │
│ │                            │   │
│ │  ═══●══════════○══════    │   │
│ │  0:12           1:47       │   │
│ │                            │   │
│ │  [⏪] [▶️/⏸️] [⏩]        │   │
│ │              🔊 ░░░▒▒▓▓    │   │
│ └────────────────────────────┘   │
│                                  │
│ 🦉 Savid's note: "The way your   │
│    voice changes when you talk   │
│    about this part..."           │
└──────────────────────────────────┘
```

---

## 12. Empty States

### 12.1 No Memories Yet
```
┌──────────────────────────────────┐
│  📖 Your scrapbook is empty...   │
│  (for now)                       │
│                                  │
│  🦉 "Every story starts with     │
│      a single page. Whenever     │
│      you're ready, I'm here."    │
│                                  │
│  [ ✨ Write Your First Memory ]  │
└──────────────────────────────────┘
```

### 12.2 No Search Results
```
┌──────────────────────────────────┐
│  🔍 No memories found            │
│                                  │
│  Try different words —           │
│  sometimes the details change    │
│  how we describe things.         │
│                                  │
│  [ ← Clear Search ]              │
└──────────────────────────────────┘
```

---

## 13. Loading & Transition States

- **Page load:** Gentle fade-in with slight upward movement (translateY 10px → 0)
- **Save action:** Savid's feather animation (soft pulse) + "Saving..." text
- **Scrapbook page turn:** Smooth horizontal slide with page curl shadow
- **Savid thinking:** Three dots bobbing animation in lilac
- **Audio recording:** Pulsing waveform with gradient from lilac to sage
- **Success animation:** Light confetti in lilac and buttercream tones

---

## 14. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Mobile | < 480px | Single column, full-width cards, bottom navigation |
| Tablet | 480-768px | 2-column scrapbook grid, side panel for Savid |
| Desktop | 769-1200px | 3-column grid, persistent sidebar |
| Wide | > 1200px | Max-width 1200px centered, optional expanded view |

---

## 15. Accessibility

- **Color contrast:** All text/background combos meet WCAG AA (4.5:1 for text, 3:1 for large text)
- **Focus indicators:** 2px lilac outline with 2px offset
- **Touch targets:** Minimum 44×44px for all interactive elements
- **Font scaling:** Supports browser font size adjustment (use rem/em)
- **Screen reader labels:** All icons have aria-labels, form fields have associated labels
- **Motion sensitivity:** Respects `prefers-reduced-motion` — disable animations, use smooth fades only
- **Keyboard navigation:** All features accessible via keyboard with visible focus order

---

## 16. Imagery & Photography Style

- Warm, soft-focus photography
- Nature themes: dappled light, leaves, soft textures, fabric, paper
- No harsh shadows or high contrast
- Color graded toward warm tones (slight amber/lilac tint)
- Photo evidence in scrapbook appears in polaroid-style frames with white borders

---

*End of Design Specifications — v1.0*
*Prepared for Decipher team implementation.*
