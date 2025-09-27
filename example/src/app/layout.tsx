import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Bare Metal RSC Framework",
  description: "Ultra-fast Bun + Hono + React 19 RSC app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white font-mono antialiased min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-12 py-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/90 backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-blue-400">Bare Metal RSC</h1>
          <nav className="flex gap-6 text-lg">
            <Link href="/bare-metal" className="hover:text-blue-400" prefetch={false}>
              Bare Metal
            </Link>
            <Link href="/results" className="hover:text-blue-400">
              Results
            </Link>
          </nav>
        </header>

        {/* Main content */}
        <main className="flex-1 px-12 py-8 flex flex-col gap-6">
          {/* Features */}
          

          {/* Quick Start */}
          
          {children}
        </main>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4 border-t border-gray-800 bg-gray-900/90 backdrop-blur-md">
          Built with 💨 Bun + ⚡ Hono + ⚛ React 19 —{" "}
          <a
            href="https://github.com/pavanscales/baremetal"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
