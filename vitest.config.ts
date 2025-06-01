import { defineConfig } from "vitest/config";
import { getViteConfig } from "astro/config";

export default defineConfig(
  getViteConfig({
    test: {
      globals: true,
      environment: "node",
      setupFiles: "./test/setup.ts",
      exclude: [
        '**/timeline-events-worker/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**'
      ],
    },
  })
);
