import { readdirSync, statSync } from 'fs';
import path, { sep } from 'path';
import { pathToFileURL } from 'url';
import * as React from 'react';
import { router } from './router';

const pagesDir = path.join(process.cwd(), "pages");

function walk(dir: string): string[] {
  const files = readdirSync(dir);
  return files.flatMap((file) => {
    const fullPath = path.join(dir, file);
    if (statSync(fullPath).isDirectory()) return walk(fullPath);
    if (!file.endsWith(".tsx")) return [];
    return [fullPath];
  });
}

function toRoutePath(filePath: string): string {
  const relPath = filePath.replace(pagesDir, "").replace(/\.tsx$/, "");
  const segments = relPath.split(sep).filter(Boolean);

  if (segments.length === 1 && segments[0] === "index") {
    return "/";
  }

  return (
    "/" +
    segments
      .map((seg) =>
        seg.startsWith("[") && seg.endsWith("]")
          ? `:${seg.slice(1, -1)}`
          : seg
      )
      .join("/")
  );
}

// Route parameters type
type RouteParams = Readonly<Record<string, string>>;


for (const filePath of walk(pagesDir)) {
  const routePath = toRoutePath(filePath);
  const fileName = path.basename(filePath);
  const isLayout = fileName === "_layout.tsx";
  const isGroup = filePath.includes(`${sep}(`);

  console.log(`✅ Registered route: ${routePath} → ${filePath}`);

  router.addRoute(
    routePath,
    async (req: Request, params: RouteParams): Promise<React.ReactElement> => {
      try {
        console.log(`⏳ Loading component for route: ${routePath}`);
        const { default: Component } = await import(pathToFileURL(filePath).href);
        console.log(`✅ Loaded component for route: ${routePath}`);

        const element = <Component {...params} />;

        // ⬇️ Inject layout wrappers
        const match = router.match(routePath);
        const layoutWrappers: Array<(child: React.ReactElement) => React.ReactElement> = [];

        if (match) {
          for (const layoutNode of match.layouts) {
            if (layoutNode.layoutHandler) {
              const layoutElement = await layoutNode.layoutHandler(req, params);
              layoutWrappers.push((child: React.ReactElement) =>
                React.cloneElement(layoutElement, { children: child, params })
              );
            }
          }
        }

        // Apply layouts if any
        let wrappedElement: React.ReactElement = element;
        for (const wrap of [...layoutWrappers].reverse()) {
          wrappedElement = wrap(wrappedElement);
        }
        
        return wrappedElement;
      } catch (e) {
        console.error(`❌ Error loading component for ${routePath}:`, e);
        throw e;
      }
    },
    { isLayout, isGroup }
  );
}
