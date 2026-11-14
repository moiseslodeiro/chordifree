---
name: Chordifree
description: Synchronized chord sheets that follow the song.
colors:
  accent: "#0052D6"
  accent-strong: "#0040AE"
  on-accent: "#FFFFFF"
  paper: "#F6F7F9"
  paper-warm: "#F7F6F2"
  panel: "#FFFFFF"
  panel-2: "#EEF1F6"
  line: "#E2E6ED"
  line-strong: "#C3CAD6"
  ink: "#0B0D12"
  ink-2: "#48505F"
  ink-3: "#60697C"
  positive: "#0C7A4A"
  warning: "#A65408"
  danger: "#BE2D26"
  print-ink: "#555"
  print-ink-soft: "#666"
  print-ink-faint: "#888"
  print-rule: "#DDD"
typography:
  display:
    fontFamily: "Manrope, Avenir Next, Segoe UI, sans-serif"
    fontSize: "3.052rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.5625rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title-sm:
    fontFamily: "Manrope, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Manrope, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Manrope, Avenir Next, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.62rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.14em"
  label-sm:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.56rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "999px"
spacing:
  3xs: "4px"
  2xs: "8px"
  xs: "12px"
  s: "16px"
  m: "24px"
  l: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  tab-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    padding: "2px 4px 8px"
  badge:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Chordifree

## Overview

**Creative North Star: "The Session Sheet"**

Chordifree looks like the sheet a musician marks up during a session: clean paper, sharp
ink, one electric blue that points at what to play next. The interface is a document first
and a dashboard never. Chords, beats and times are the content; controls recede into
hairline-separated tool cells, and the one saturated colour is reserved for the action, the
selected state and the current beat.

The system is deliberately quiet between the marks. Warm grey paper separates panels with
white surfaces; IBM Plex Mono appears only where a musician expects a figure (tune, time,
measure, chord name, keyboard hint). Manrope carries everything that is read as language.
Depth comes from a single soft card shadow, not from stacked elevation levels.

The marketing site keeps the same brand on a warmer paper stock. That is an intentional
second ground for a different surface, not a second brand.

**Key Characteristics:**
- One electric blue accent, used sparingly and always meaning action or position.
- Cool paper in the app, warm paper on the marketing site; never mixed within a screen.
- Hairline rules and generous white space instead of boxes inside boxes.
- Mono for data and labels, Manrope for prose and headings.
- Draft surfaces look editable: soft radii, visible focus, clear hover and active states.

## Colors

A single electric blue against near-black ink and two neutral papers; status colours appear
only when something needs attention.

### Primary
- **Electric Blue** (#0052D6): primary buttons, selected tabs, active beat underline, links
  and focus rings. In dark mode it lightens to #5D9CFF so it stays legible on #090B0F.
- **Electric Blue Deep** (#0040AE): hover and pressed state for primary actions, and link
  hover. Dark mode uses #89B7FF.

### Neutral
- **Cool Paper** (#F6F7F9): the app page ground.
- **Warm Paper** (#F7F6F2): the marketing site ground; a deliberate second stock.
- **Panel White** (#FFFFFF): cards, fields and tool surfaces.
- **Panel Tint** (#EEF1F6): secondary surfaces, badges and note backgrounds.
- **Hairline** (#E2E6ED): the default 1px separation.
- **Hairline Strong** (#C3CAD6): control borders, table rules and the window chrome.
- **Ink** (#0B0D12): headings and primary text.
- **Ink 2** (#48505F): body text and secondary labels.
- **Ink 3** (#60697C): metadata, timestamps and helper text.

### Status
- **Practice Green** (#0C7A4A): healthy analyzer, saved state and success notices.
- **Rehearsal Amber** (#A65408): warnings and destructive-range hints.
- **Take Red** (#BE2D26): errors and destructive actions.

### Print
- **Print Ink** (#555), **Print Ink Soft** (#666) and **Print Ink Faint** (#888): the grayscale
  ramp for metadata, section labels and the footer of the printed sheet.
- **Print Rule** (#DDD): the only rule colour in print.

### Named Rules
**The One Blue Rule.** Electric blue covers at most a tenth of any screen. It means action,
selection or the current position, never decoration.

**The Two Papers Rule.** The app runs on cool paper; the marketing site runs on warm paper.
A single surface never mixes both grounds.

## Typography

**Display Font:** Manrope (with Avenir Next, Segoe UI fallbacks)
**Body Font:** Manrope (same stack)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace and platform monospace fallbacks)

**Character:** Manrope gives the page a geometric, slightly technical voice without looking
like a system font. IBM Plex Mono is the musician's pencil: labels, times, measures and
chord figures are set in it so they read as data, not prose.

### Hierarchy
- **Display** (700, 3.052rem / 1.08, -0.03em): song titles, page heroes and the landing
  headline. One per screen.
- **Title** (700, 1.5625rem / 1.08, -0.03em): section and card headings.
- **Body** (400, 1rem / 1.55): lyrics, help text and notices. Keep the measure between 60
  and 75 characters.
- **Label LG** (500, 0.7rem, 0.12em uppercase): tabs, times and navigational labels.
- **Label** (500, 0.62rem, 0.14em uppercase): the default eyebrow, badge and tool label.
- **Label SM** (600, 0.56rem, 0.08em uppercase): the smallest loop and measure marks.
- **Body SM** (400, 0.875rem / 1.5): dense menu items, toasts and lyric chord chips.

### Named Rules
**The Mono Means Data Rule.** IBM Plex Mono is for figures, chord symbols, commands and
short labels. Never set a paragraph in it.

**The No Italic Rule.** Emphasis comes from weight, size or the accent colour. The app has
no italic voice.

## Layout

The app is a single vertical shell capped at 88rem with 20–32px side padding. Content sits
in white panels separated by cool-paper gutters. The song view is a two-column composition
on wide screens: the chord timeline takes the free space and the video, active chord diagram
and song details form a compact right rail; below 1024px everything stacks.

The toolbar is a row of equal-flex cells divided by 1px rules, each with a mono label above
its control. The beat grid is an eight-column rhythm (two bars of 4/4) with a fixed left
gutter for times and measure numbers. Spacing follows a 4/8/12/16/24/32/48 scale; 24px is
the default panel padding, 32–48px separates sections.

## Elevation & Depth

Depth is tonal first and shadow second. Panels sit on paper through a 1px hairline and a
single soft shadow (`0 1px 2px rgb(10 13 18 / 0.05), 0 10px 28px -22px rgb(10 13 18 /
0.35)`). Nothing floats above the page except cards, menus and the print window. Focus is a
2px accent outline with a 2px offset; fields add a 3px accent halo at 14% opacity.

### Named Rules
**The Hairline Rule.** Separation is a 1px line or empty space. Reach for a shadow only when
a surface genuinely leaves the page.

## Shapes

Corners are soft but not friendly: 3px for the smallest loop marks, 6px for badges and chips,
8px for buttons and fields, 10px for cards and panels, 14px for large windows. Full-round
(`999px`) is reserved for status dots, the play control, slider tracks and their thumbs.
Borders are always complete rectangles; no coloured side stripes.

## Components

### Buttons
- **Shape:** 8px radius, 40px minimum height, 16px horizontal padding.
- **Primary:** electric blue ground, white text, semibold; hover deepens to Electric Blue
  Deep; active nudges down 1px; disabled drops to 45% opacity.
- **Secondary:** panel ground, hairline-strong border, ink text; hover tints the ground with
  6% accent and colours the border.
- **Ghost:** no border or ground; 7% accent wash on hover. Destructive buttons use the red
  outline and a red-tinted hover.

### Tabs
- **Style:** mono uppercase label, transparent ground, 2px transparent bottom border.
- **State:** selected turns the border and label electric blue; hover only darkens the label
  to ink.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Panel White on Cool Paper.
- **Shadow Strategy:** the single card shadow from Elevation & Depth.
- **Border:** 1px Hairline.
- **Internal Padding:** 24px; 16px on compact rows.

### Inputs / Fields
- **Style:** panel ground, 1px Hairline, 8px radius, 12px horizontal padding.
- **Focus:** accent border plus a 3px accent halo at 14% opacity.
- **Placeholder:** Ink 3; disabled fields keep the hairline and drop text to 45% opacity.

### Badges and Chips
- **Style:** Panel Tint ground, 1px Hairline, 6px radius, mono uppercase at 0.62rem.
- **Use:** source and analyzer metadata, not actions. Action chips use the accent wash and
  accent text instead.

### Toolbar Cell
- **Style:** a flexible cell with a left hairline (removed on the first child), 16px side
  padding and 12px vertical padding.
- **Content:** a mono label with a 16px icon above the control or value.
- **State:** pressed chips take a 10% accent wash and accent text; the rest stay ink.

### Chord Cell (signature)
The timeline cell is the product's signature: measure and time in the left gutter, the chord
symbol in display weight at the top, and a thin accent underline on the active beat. Selected
bars use a 10% accent wash; the A/B practice range uses the same wash with a stronger border.
Never replace the chord with an icon or a coloured block.

## Do's and Don'ts

### Do:
- **Do** keep electric blue for action, selection and the current beat only.
- **Do** set every time, measure, chord figure and mono label in IBM Plex Mono with tabular
  numerals.
- **Do** separate with 1px hairlines and space before reaching for a shadow.
- **Do** keep focus visible: 2px accent outline, 2px offset, and the 3px field halo.
- **Do** make editable values look editable, with hover, active and disabled states.

### Don't:
- **Don't** mix the cool app paper and the warm marketing paper on one surface.
- **Don't** use the accent as a background wash for large areas or as decoration.
- **Don't** set prose in mono or add italics.
- **Don't** nest cards inside cards; use a note or a hairline-separated row instead.
- **Don't** introduce a second display typeface or a heavy shadow vocabulary.
