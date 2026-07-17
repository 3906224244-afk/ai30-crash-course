---
name: ui-ux-pro-max
description: UI/UX design intelligence. Searchable local database with 67 styles, 161 palettes, 57 font pairings, 25 charts, and 21 stacks (React, Next.js, Vue, Svelte, Astro, SwiftUI, React Native, Flutter, WPF, WinUI 3, UWP, Avalonia, Uno Platform, Nuxt, Nuxt UI, Tailwind, shadcn/ui, Jetpack Compose, Three.js, Angular, Laravel). Use when designing, building, or reviewing UI: pages, components, color schemes, typography, layout, accessibility, animation, or data visualization.
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web, mobile, and desktop applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 22 technology stacks. Searchable database with priority-based recommendations.

## Prerequisites

The bundled scripts require Python 3 (standard library only). Check:

```bash
python3 --version || python --version
```

If Python is not installed, stop and ask the user to install it.

## Search Command

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> [-n <max_results>]
```

### Domains: product, style, typography, color, landing, chart, ux, gsap, react, web, icons, google-fonts

### Design System (REQUIRED for new projects)

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system [-p "Project Name"]
```

### Stacks: react, nextjs, vue, svelte, astro, swiftui, react-native, flutter, nuxtjs, nuxt-ui, html-tailwind, shadcn, jetpack-compose, threejs, angular, laravel, javafx, wpf, winui, avalonia, uno, uwp

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

## Quick Reference

For detailed rules on icons, interaction, contrast, layout, and accessibility, search with `--domain ux` or `--domain style`.
