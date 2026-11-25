# Verdant — grow a living garden

A cosy watercolour botanical game **and** a gentle plant-care companion. 100% static, client-side, no accounts, no trackers.

Live: https://kumarnikhildeveloperaccount.github.io/verdant/

## Features
- **12 pots in 4 light zones** (shady corner, reading nook, bright window, sunny terrace) — match each plant's light needs.
- **30 real species** with care facts: light, watering rule of thumb, soil, humidity and pet toxicity (ASPCA lists where available).
- **Procedural watercolour plants**: branching species grow from real L-systems (rewrite rules → turtle → auto-fit), rosettes use golden-angle phyllotaxis, and each plant is painted with layered translucent washes, pigment-pooled edges and jittered bleeds. Monstera leaves fenestrate as they mature; the prayer plant folds its leaves at night.
- **Real-time growth** across days, driven by the actual clock, the seasons of your hemisphere, simulated weather (deterministic 3-hour blocks; rain waters the terrace, frost nips tender plants) and day/night.
- **Micro-interactions**: press-and-hold watering can with pour sound and droplets (overflowing saucers are bad for succulents), shears that snip only yellow leaves, mister, plant food (refused in winter and for the Venus flytrap).
- **Care calendar** with predicted watering/feeding/misting, reminders (optional Notification API while a tab is open) and **.ics export** for any calendar app.
- **Encyclopedia** with search and filters (light, pet-safe, easy-going) and botanical "plates".
- **"Which plant suits my room?" quiz** — 6 questions, top-3 matches with reasons, plant directly.
- Sky window: watercolour sky following local time, sun & moon arcs (moon phase computed locally), clouds, rain, snow, fog, lightning, petals, autumn leaves and summer fireflies.
- Synthesized Web Audio sounds (muted until you enable them): pouring, snips, mist, chimes, birds/crickets/rain ambience.
- Themes: Auto (follows the sun), Morning paper, Pressed herbarium, Moonlit greenhouse.

## Saving (Verdant's own mechanism)
- `localStorage` key `verdant:save` with a **versioned schema** (currently v3) and **step-by-step migrations** (v1 → v2 → v3).
- A backup (`verdant:save:backup`) is written before any upgrade, reset or import.
- **Time-delta growth**: on return, the garden is simulated hour by hour (capped at 90 days) and a "while you were away" report tells you what grew, got thirsty, flowered or got rained on.
- **Seed packets**: export/import your whole garden as JSON (`kind: "verdant.seedpacket"`, schema number, FNV-1a checksum). Old packets are migrated on import. Try the "vintage v1 packet" button for a migration demo.

## Easter eggs
Be nice to the ladybird in the header (tap it… a lot). And try typing a certain plant-powered word on the garden page.

## Files
`index.html`, `404.html`, `manifest.webmanifest`, `favicon.svg`, `css/base.css`, `css/garden.css`, `css/views.css`,
`js/data.js`, `js/store.js`, `js/sim.js`, `js/audio.js`, `js/plantart.js`, `js/habits.js`, `js/scene.js`, `js/garden.js`, `js/calendar.js`, `js/library.js`, `js/quiz.js`, `js/app.js`.

No libraries, no CDNs, no web fonts (system font stacks only).

## Honest limitations
- Care facts are general guidance for typical indoor conditions; watering intervals are rules of thumb — always check the soil.
- Weather and sunrise/sunset are **simulated/approximate**, not a forecast.
- Notifications only fire while Verdant is open in a tab (no service worker / push); some mobile browsers do not allow page notifications at all.
- Saves live in one browser; export a seed packet to move between devices.

---
Designed & built by Kumar Nikhil — [Portfolio](https://kumarnikhildeveloperaccount.github.io/) · [LinkedIn](https://www.linkedin.com/in/kumar-nikhil-1000a9192/) · [Email](mailto:nkashyapnikhilnk@gmail.com) · [More projects by Kumar Nikhil →](https://kumarnikhildeveloperaccount.github.io/)

With gratitude to God — Om Namah Paarvati Pateh, Har Har Mahadev. May God bless you and everyone.
