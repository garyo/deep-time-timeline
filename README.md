# Deep-Time Visualization Project

This is a simple web app to visualize world events through deep time.
It uses logarithmic scaling, so timescales to the right (toward the
present) are expanded, and older events are compressed.

# Dev Notes

It is built with Astro, using D3 for the timeline itself. Styling is
via tailwind CSS, widgets using solid-js.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun run dev`             | Starts local dev server at `localhost:4321`      |
| `bun run build`           | Build your production site to `./dist/`          |
| `bun run preview`         | Preview your build locally, before deploying     |
| `bun run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun run astro -- --help` | Get help using the Astro CLI                     |

