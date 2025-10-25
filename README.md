# Bare Metal RSC

**Bun + Hono + React Server Components. Built for speed.**

A bare-metal RSC architecture with turbo-charged rendering, zero client bloat, and deterministic hydration.

---

## Features

- Ultra-fast RSC pipelines with zero hydration overhead
- Optimized for Bun runtime
- File-based auto-routing
- Preloaded components for instant render
- Server-first state management
- Minimal boilerplate, maximum control

---

## Architecture

| File | Responsibility | Status |
|------|---------------|--------|
| `action.ts` | Server actions and event pipeline | Node fixes applied |
| `cache.ts` | In-memory + persistent render caching | Bug fixes |
| `env.ts` | Environment variables & config | WIP |
| `metrics.ts` | Performance telemetry hooks | Node fixes applied |
| `preload.ts` | Preload heavy RSC components | Node fixes applied |
| `profiler.ts` | Profiler hooks for server & RSC | Node fixes applied |
| `queue.ts` | Action + render queue management | Node fixes applied |
| `render.ts` | Core rendering engine | Updated 10 mins ago |
| `router.ts` | RSC-aware router engine | Updated 10 mins ago |
| `routes.tsx` | Route definitions & SSR fallback | Bug fixes applied |
| `rsc-wrapper.ts` | HOC + context wrapper for RSC | WIP |
| `rsc.ts` | Core RSC utilities | Node fixes applied |
| `serveStatic.ts` | Auto-register file-based routes | Production ready |
| `start.ts` | Bun dev server entrypoint | Production ready |

---

## Quick Start

**Install Bun**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Clone and install**
```bash
git clone https://github.com/pavanscales/baremetal.git
cd baremetal/example
bun install
```

**Run**
```bash
bun run dev
```

Visit `http://localhost:3000`

---

## Contributing

1. Fork and clone
2. Create branch: `git checkout -b feature/name`
3. Commit: `git commit -m 'feat: description'`
4. Open PR

---

## License

MIT © pavanscales

---

**Server-first rendering. Predictive preloading. Zero-fluff architecture. Optimized for Bun.**
