# Onyx

Offline-first daily OS for training, nutrition, supplements, and execution.
Currently Single-page React app with localStorage persistence.
Will be a full fledged application with backend, custom UI, training helping system and more.

## Tech

- React 19 + Vite
- TypeScript (strict)
- Plain CSS (no CSS-in-JS)

## Getting started

```bash
npm install
npm run dev
```

App runs at http://localhost:5173

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
npm run format:write
npm run typecheck
```

## Data

State is stored in localStorage under `andi_weekday_os_v1`.

## Project structure

- `src/App.tsx`: App shell, global state, view routing
- `src/views/`: View-level components
- `src/components/`: Shared UI components
- `src/hooks/`: Custom hooks
- `src/data/weekdayData.ts`: Static schedule/program/nutrition/supplement data
- `src/utils/`: Utilities (storage/time/formatting)
- `src/styles/`: Global, component, and utility styles

## Notes

- No external UI libraries.
- No spread/rest operators.
