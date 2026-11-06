import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { ensureBackend } from "./api-autostart";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // The platform edge 404s every /api/* path before it reaches this server,
      // so the Stripe webhook needs a public path that is not under /api. Vite's
      // proxy streams the request body byte-for-byte, which keeps Stripe's
      // signature valid. Mirrors stripe-ingress.ts, which does the same job when
      // the site runs in production mode (serve.ts) instead of dev.
      '/stripe/webhook': {
        target: 'http://127.0.0.1:8000',
        rewrite: () => '/api/webhooks/stripe',
        changeOrigin: true,
      },
      // Escape hatch for ordinary API calls, which the edge blocks at /api/*.
      '/svc': {
        target: 'http://127.0.0.1:8000',
        rewrite: (path) => path.replace(/^\/svc/, '/api'),
        changeOrigin: true,
      },
    },
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
    // The dev server is reachable through the TLS proxy, so the HMR websocket
    // must dial back on 443, not the dev port. If the socket can't connect,
    // pages still serve — hot reload degrades, never breaks.
    hmr: { clientPort: 443 },
    // The dev server can serve source files; never let it serve local secrets,
    // and never let it serve anything outside the site dir. Gotchas this list
    // encodes: a custom `deny` REPLACES Vite's defaults (so .git must be
    // restated), patterns containing "/" match the ABSOLUTE path (so dir
    // patterns need a leading **/), and `allow` left to its default widens to
    // the nearest workspace root — a stray .git or workspaces package.json in
    // /home/team/shared would expose the whole shared dir.
    fs: {
      strict: true,
      allow: [import.meta.dirname],
      deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.run/**", "**/.git/**"],
    },
  },
  plugins: [
    // Durable API autostart. The platform boots this dev server from /home on
    // every machine replacement; that boot is the only surviving trigger, so the
    // API start is hung off it. See api-autostart.ts.
    {
      name: "decipher-api-autostart",
      configureServer() {
        void ensureBackend("vite-dev");
      },
    },
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
