# Home Dashboard — Customization Guide

This guide explains how to change the look and feel of the dashboard: colors,
status-based styling (buttons that change color depending on whether something
is on/off/heating/etc.), icons, and layout. It's written so you can make changes
confidently without breaking anything.

Every example here uses real code already in the project, so you can find the
exact spot and copy the pattern.

---

## The one idea that makes everything else make sense

The dashboard separates **what something looks like** from **when it looks that
way**:

- **CSS** (in `client/src/styles.css`) defines *looks* — each "class" is a named
  bundle of styling (color, size, border, etc.).
- **Components** (in `client/src/Controls.jsx` and `App.jsx`) decide *which*
  class or icon to use, based on live device state.

So "make a button turn green when it's on" is always two steps:
1. Define a class in CSS that's green.
2. In the component, choose that class when the device is on.

Once this clicks, everything is customizable the same way. There is no separate
"theme system" to learn — it's just classes plus a little conditional logic.

After ANY change in this guide, you must rebuild and restart for it to show up
(see the last section).

---

## 1. Change the overall color scheme (easiest, highest impact)

At the very top of `client/src/styles.css` is a block called `:root` that holds
the dashboard's color palette as **variables**. Every color in the app refers
back to these, so changing one here changes it everywhere.

```css
:root {
  --bg: #0f1115;        /* page background */
  --bg-2: #161922;      /* secondary background */
  --panel: #1b1f2a;     /* card background */
  --panel-hi: #222736;  /* raised/lighter card background */
  --panel-bad: #2a1d1f; /* background for error/off states */
  --border: #2a2f3d;    /* card borders */
  --text: #eef1f6;      /* main text */
  --muted: #8b93a4;     /* secondary/label text */
  --accent: #e8a04b;    /* warm amber — the main highlight color */
  --accent-2: #5ad1a0;  /* mint — used for "on"/"live"/good */
  --error: #e2725b;     /* red — used for errors/off/bad */
  --radius: 14px;       /* how rounded corners are */
}
```

**To re-theme the whole dashboard:** change these values. For example, to swap
the amber highlight for a blue one, change `--accent: #e8a04b;` to
`--accent: #4a90d9;`. Every accent — toggle switches, active buttons, the brand
mark — shifts to blue at once.

Colors are hex codes (`#rrggbb`). Pick them with any online color picker. The
`--radius` value controls roundness — increase it (e.g. `20px`) for softer
cards, set it to `4px` for sharp corners.

---

## 2. Status-based color (the pattern you'll use most)

This is how a control changes appearance based on its live state — the
thermostat turning amber when heating, the air-quality pill turning red when bad,
a light toggle glowing when on.

**The pattern, in two parts:**

### Part A — the component picks a class from state

In `client/src/Controls.jsx`, the `ThermostatControl` does exactly this:

```js
const statusClass =
    action === "heating" ? "thermo-heating"
  : action === "cooling" ? "thermo-cooling"
  : mode === "off"       ? "thermo-off"
  :                        "thermo-idle";
```

This reads the live state (`action`, `mode`) and produces a class name. That
class is then applied to the element:

```jsx
<article className={`thermo ${statusClass}`}>
```

### Part B — CSS defines what each class looks like

In `styles.css`:

```css
.thermo-heating { border-color: #e8a04b; box-shadow: inset 0 0 40px rgba(232,160,75,0.12); }
.thermo-cooling { border-color: #5aa6d1; box-shadow: inset 0 0 40px rgba(90,166,209,0.14); }
.thermo-idle    { border-color: var(--border); }
.thermo-off     { border-color: var(--border); opacity: 0.7; }
```

**That's the entire mechanism.** Read state → choose class name → define class
in CSS. You'll see the same pattern in three places already:

- Light toggles: `className={`ctl ${isOn ? "ctl-on" : ""}`}` → `.ctl-on` is amber.
- Air quality pills: classes `aqi-good` / `aqi-mod` / `aqi-bad` chosen by number.
- WAN status dot: `state-on` / `state-off` classes.

### Worked example: make a temperature card turn red when too warm

Suppose you want a sensor card to go red above 75°. In the component that renders
the card (`SensorCard` in `App.jsx`), choose a class from the value:

```jsx
const hot = Number(device.value) > 75;
// then on the card element:
<article className={`card ${hot ? "card-hot" : ""}`}>
```

Then add the class to `styles.css`:

```css
.card-hot { background: #2a1d1f; border-color: var(--error); }
```

Rebuild, and any card over 75° turns red. The same approach works for humidity,
network speed, anything with a number or state.

---

## 3. Change or swap icons

Icons live in `client/src/Icon.jsx` as small inline SVG drawings, each with a
name. The names currently defined are:

`thermo`, `globe`, `camera`, `sofa`, `kitchen`, `stairs`, `bed`, `home`, `sun`.

### Use a different existing icon for a panel

Each panel in `layout.js` has an `icon:` field. Change it to any name above. For
example, to give the Loft a couch icon instead of stairs:

```js
{ id: "loft", title: "Loft", icon: "sofa", ... }
```

### Swap an icon based on status

Same pattern as colors — choose the icon *name* from state:

```jsx
<Icon name={device.value === "on" ? "lightbulb-on" : "lightbulb-off"} />
```

(This requires both icon names to exist in `Icon.jsx` first — see below.)

### Add a brand-new icon

In `Icon.jsx`, the `PATHS` object maps names to SVG drawing commands. To add one,
you need its SVG "path data." The easiest source is a free icon set like
[Lucide](https://lucide.dev) or [Tabler Icons](https://tabler.io/icons) — find an
icon, copy its SVG, and paste the inner `<path .../>` (or `<circle>`, etc.) under
a new name:

```js
const PATHS = {
  // ...existing...
  fan: <path d="M12 12c0-3 ... (path data from the icon site)" />,
};
```

All icons inherit color and size automatically (they use `currentColor`), so you
don't set those per-icon. Once added, use the name anywhere: a panel's `icon:`
field, or an `<Icon name="fan" />` in a component.

---

## 4. Change layout and spacing

### Grid density (how many cards per row)

Cards are laid out in CSS grids whose column count adapts to width. In
`styles.css`, look for rules like:

```css
.grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.ctl-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.tile-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
```

The `minmax(170px, 1fr)` means "each card is at least 170px wide, then stretch to
fill." **Lower** the first number for more, smaller cards per row; **raise** it
for fewer, larger cards. The `.tile-grid` controls the landing-screen buttons,
`.ctl-grid` the control widgets, `.grid` the sensor cards.

### Spacing

`gap:` controls space between cards (e.g. `gap: 0.8rem;`). Padding inside cards is
the `padding:` on `.card`, `.ctl`, `.tile`, etc. Increase for roomier cards,
decrease for denser layouts.

### Fonts

Two fonts are loaded at the top of `styles.css`: **Fraunces** (the serif used for
headings and the brand name) and **Spline Sans** (the body font). To change them,
swap the Google Fonts `@import` line at the top and update the `font-family`
values. The headings use Fraunces via the `.brand-name`, `.group-label`,
`.panel-title`, and `.sub` classes.

---

## 5. Rename things and reorder screens

This is in `client/src/layout.js`, not CSS.

- **Rename a panel:** change its `title:`.
- **Reorder the landing screen:** the order panels appear in the `PANELS` array
  is the order they show on screen (within their group). Move an entry up or down.
- **Move a panel between sections:** change its `group:` from `"room"` to
  `"global"` or vice versa.
- **Hide a panel:** set `status: "planned"` to show it as a "soon" placeholder,
  or remove its entry entirely to hide it.

---

## 6. A note on consistency

The dashboard's coherent look comes from reusing the palette variables
(`--accent`, etc.) rather than hardcoding colors. When adding a new status color,
prefer referencing a variable (`border-color: var(--accent);`) over a raw hex
where it makes sense — that way a future palette change carries through. Use raw
hex only when you genuinely want a one-off color (like the cooling-blue on the
thermostat, which isn't part of the core palette).

---

## 7. Applying any change

Every customization above is in the **client**, so the rebuild routine applies:

```powershell
cd C:\apps\iot-dashboard\client
npm run build
$nssm = "C:\apps\iot-dashboard\nssm.exe"
& $nssm restart IoTDashboard
```

Then **hard-refresh** the browser (Ctrl+Shift+R) — browsers cache the old styles
and JavaScript aggressively, so a normal refresh may show you the old look even
after a correct rebuild.

If something looks broken after a change, the most common causes are a missing
semicolon or brace in CSS, or a typo'd class name (the component asks for a class
that doesn't exist in CSS, so nothing styles). Undo the last change, rebuild, and
confirm it returns to normal — then reapply more carefully.

---

## Quick reference

| I want to… | Edit | What to change |
|---|---|---|
| Re-theme all colors | `styles.css` `:root` | the `--accent`, `--bg`, etc. variables |
| Color something by status | `Controls.jsx`/`App.jsx` + `styles.css` | pick a class from state, define the class |
| Change a panel's icon | `layout.js` | the `icon:` field |
| Swap icon by status | the component + `Icon.jsx` | choose icon name from state |
| Add a new icon | `Icon.jsx` | add SVG path under a new name |
| More/fewer cards per row | `styles.css` | the `minmax(...)` in the grid rules |
| Change fonts | `styles.css` top | the `@import` and `font-family` |
| Rename/reorder screens | `layout.js` | `title:`, array order, `group:` |
| Round corners | `styles.css` `:root` | `--radius` |
