
````markdown
# Bare Metal RSC ⚡

**The ultimate Bun + Hono + React Server Components framework for high-performance web apps**  

Bare Metal RSC is **not your average starter** — it’s a **bare-metal React Server Components architecture** with **turbo-charged rendering, zero client bloat, and deterministic hydration**. Designed for engineers who care about **true performance at scale**.  

---

## 🚀 Core Features

- 💨 **Ultra-fast RSC pipelines** with zero hydration overhead  
- 🏎 **Optimized for Bun runtime**, leveraging its native performance  
- 📂 **File-based auto-routing** (`/pages`)  
- ⚡ **Preloaded components** for instant render (next-pair style)  
- 🧩 **Server-first state management** with cookies and RSC props  
- 🛠 **Minimal boilerplate, maximum control**  

> Designed for **engineers who think in components, fibers, and pipelines**, not CSS hacks.  

---

## 🗂 File Architecture & Engineering Notes

| File | Responsibility | Status / Notes |
|------|---------------|----------------|
| `action.ts` | Server actions and event pipeline | Node version fixes applied |
| `cache.ts` | In-memory + persistent render caching | Rendering bug fixes |
| `env.ts` | Environment variables & config | WIP local changes |
| `metrics.ts` | Performance telemetry / profiler hooks | Node fixes applied |
| `preload.ts` | Preload heavy RSC components for instant render | Node fixes applied |
| `profiler.ts` | Profiler hooks for server & RSC | Node fixes applied |
| `queue.ts` | Action + render queue management | Node fixes applied |
| `render.ts` | Core rendering engine — turbo-charged | Updated 10 mins ago |
| `router.ts` | RSC-aware router engine | Updated 10 mins ago |
| `routes.tsx` | Route definitions & SSR fallback | Bug fixes applied |
| `rsc-wrapper.ts` | HOC + context wrapper for RSC | WIP local changes |
| `rsc.ts` | Core RSC utilities | Node fixes applied |
| `serveStatic.ts` | Auto-register file-based routes | Production-ready |
| `start.ts` | Bun dev server entrypoint | Instantly starts dev environment |

> Every file is **engineered for speed**, **predictable hydration**, and **maximal RSC throughput**.  

---

## ⚡ Installation (Meta-Ready)

**Step 1 — Install Bun**  

```bash
curl -fsSL https://bun.sh/install | bash
````

**Step 2 — Clone repo**

```bash
git clone https://github.com/pavanscales/baremetal.git
cd baremetal/example
```

**Step 3 — Install dependencies**

```bash
bun install
```

---

## 🏃 Usage

Start dev server (instant hot reload):

```bash
bun run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

> Watch your **RSC components render faster than React hydration could dream of**.

---

## 🛠 Contributing (Pro Mode)

1. Fork → `git clone`
2. Branch → `git checkout -b feature/mega-render`
3. Code → follow **RSC best practices**
4. Commit → `git commit -m 'feat: turbo RSC pipeline'`
5. PR → open and **meta-review**

> Only serious engineers who care about **performance, RSC pipelines, and server-first state**.

---

## 📜 License

MIT © [pavanscales](https://github.com/pavanscales)

---

## 🔥 Meta Notes

* **Server-first rendering**: Everything is computed server-side — no unnecessary client JS.
* **Predictive preloading**: Next-pair assets are preloaded for instant interaction.
* **Zero-fluff architecture**: No CRA, no Next.js bloat, pure RSC.
* **Optimized for Bun**: Native speed, minimal GC overhead, fiber-level control.

> This is **not just a framework**, it’s **a high-performance RSC engine**. Perfect for engineers who want **speed, control, and pure meta-level optimization**.

---

> Ready to **turbo-charge your RSC apps**? Clone, run, and experience **bare-metal rendering at the edge of web performance**. 



```
