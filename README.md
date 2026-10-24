# Dhinam — Malayalam Calendar

**Dhinam** (ദിനം, "day") is a bilingual Malayalam calendar for the web. It shows the Gregorian and Malayalam Era (Kollavarsham) calendars side by side, with the day's nakshatram, tithi, inauspicious periods and Kerala festivals, all calculated in the browser.

## Features

- **Two calendar systems.** You can lay the month grid out in Gregorian months or in Kollavarsham months (Chingam … Karkidakam). Each day also shows its date in the other system.
- **English and Malayalam.** Use the language tabs to switch the whole UI between English and മലയാളം.
- **Day details** for the selected date:
  - Malayalam date and month
  - Nakshatram at sunrise, with end times in IST (e.g. "Pooram until 21:19 IST, then Uthram")
  - Tithi
  - Rahu Kalam, Gulika Kalam and Yamakandakam
  - Day of the year and ISO week number
- **Festivals.** Covers 47 festivals in 8 categories: Malayali, Hindu, Muslim, Christian, cultural, temple, boat races and national. It shows today's festivals, ongoing seasons and upcoming events, each with a details dialog that you can share through the Web Share API.
- **Shareable URLs.** Every month view has its own link (see [Routes](#routes)).

## Tech stack

- [Vue 3](https://vuejs.org/) (`<script setup>`) + [Vite](https://vite.dev/)
- [Pinia](https://pinia.vuejs.org/) for state, [Vue Router](https://router.vuejs.org/) for navigation
- [Bootstrap 5](https://getbootstrap.com/) and Bootstrap Icons
- SCSS with shared design tokens and mixins
- Noto Sans Malayalam and Outfit (Google Fonts)

## Getting started

Requires Node.js 20.19+ (or 22.12+), which is what Vite 8 needs.

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Routes

| Path | View |
| --- | --- |
| `/` | Current month |
| `/calendar/:year?/:month?` | Gregorian month view |
| `/kollavarsham/:year?/:month?` | Malayalam month view (year = Kollavarsham year, month 1 = Chingam … 12 = Karkidakam) |

The router uses HTML5 history mode, so in production the server has to fall back to `index.html` for unknown paths.

## How the calculations work

All astronomy runs client-side in [src/lib/malayalam.js](src/lib/malayalam.js). The app needs no APIs or lookup tables.

- **Sun position:** Meeus, *Astronomical Algorithms*, ch. 25 (≈0.01°, about 15 minutes of sankranti time).
- **Moon position:** Meeus ch. 47, full longitude series (≈0.003°, about 20 seconds of nakshatram time).
- **Ayanamsa:** Lahiri (Chitrapaksha).
- **Location:** sunrise and sunset are computed for Thiruvananthapuram, and times are shown in IST.
- **Month start (Kerala rule):** a Malayalam month begins when the Sun enters a sidereal sign. If that sankranti happens before 3/5 of the daytime has passed, that day is day 1 of the new month; otherwise the next day is.

> When a sankranti falls within a few minutes of the cut-off, the result can differ by a day from printed panchangams.

## Festival data

Festival rules are data, not code:

- [src/data/festivals.json](src/data/festivals.json) holds the categories and festival definitions. Each festival has a `date_rule` with a type such as `malayalam_calendar`, `nakshatra`, `lunar`, `ekadashi`, `islamic`, `easter_relative`, `gregorian_fixed`, `range` or `season`. The `$comment` at the top of the file documents the extra rule fields.
- [src/data/festival-overrides.json](src/data/festival-overrides.json) holds official dates for each Gregorian year. A date listed here replaces the calculated date for that festival in that year:

  ```json
  {
    "2026": {
      "onam": "2026-08-26"
    }
  }
  ```

- [src/lib/festivals.js](src/lib/festivals.js) is the engine that turns these rules into concrete dates. It contains no UI code.

## Project structure

```
src/
├── App.vue                  # App shell and brand header
├── main.js                  # App bootstrap (Pinia, router, Bootstrap, styles)
├── router/index.js          # Routes
├── stores/calenderStore.js  # Selected date, view month, language, calendar system
├── components/
│   ├── Home.vue             # Page layout; syncs the route with the store
│   ├── calender.vue         # Month grid, navigation, language tabs
│   ├── MonthPicker.vue      # Year/month picker
│   ├── DayDetails.vue       # Today/selected-day card, nakshatram, periods
│   ├── HolidaysCard.vue     # Festival list
│   └── FestivalDialog.vue   # Festival details and sharing
├── lib/
│   ├── malayalam.js         # Astronomy: Malayalam date, nakshatram, tithi, periods
│   └── festivals.js         # Festival date engine
├── data/                    # Festival definitions and yearly overrides
└── styles/                  # SCSS tokens, mixins and global styles
```

SCSS abstracts in `src/styles/abstracts` are injected into every SCSS file and `<style lang="scss">` block automatically (see [vite.config.js](vite.config.js)). `@` is an alias for `src/`.
