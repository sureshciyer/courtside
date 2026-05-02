import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    // The thread pool ran out of heap once analytics + trends grew beyond
    // ~2k lines. Forked single-process keeps ~209 tests under 1s and
    // avoids the v8 OOM crash on small machines.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
