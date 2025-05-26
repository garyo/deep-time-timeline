# Deep-Time Visualization Project

This is a simple web app to visualize world events through deep time.
It uses logarithmic scaling, so timescales to the right (toward the
present) are expanded, and older events are compressed.

# Idea

This app is based on a paper log-scale geologic timeline I
created with a friend in junior high school in the 1970s, on an
adding-machine tape. We took the logarithms of the dates of all
kinds of paleological events, plotted them on the 40' long tape,
and hung it up in the classroom. We realized we could fit the
Big Bang, dinosaurs, and what we ate for breakfast that day on
the same scale! I still have that tape somewhere, and I've been
wanting to create an interactive version for many many years.

The idea of a <a href="https://en.wikipedia.org/wiki/Logarithm"
target="_blank">log-scaled</a>
timeline is that ancient events are compressed, and recent events
take up more space. We humans are naturally oriented toward short-term
thinking: tomorrow, next week, a human lifetime. This app puts that
in context, so you can see how the present smoothly fades into the
very deepest past.

With this app you can zoom in on any time period in the history
of the universe. Significant events from politics, art, science,
and nature fade in as you zoom into them. It also has a "news
feed" so new events will populate in on the right edge every now
and then.

For more on Deep Time thinking, check out
<a href="https://longnowboston.org" target="_blank">Long Now Boston</a>,
a group I work with to promote long-term thinking about some
of the biggest problems and ideas.

Of course any collection of historical events will be
opinionated; I chose this set, and their significances, based on
my own preferences. Since this is a completely open-source app
under an MIT license, you are welcome to inspect the data and code
and even make your own version.


# Dev Notes

It is built with Astro, using D3 for the timeline itself. Styling is
via plain CSS. It has solid-js enabled for reactivity, but it's not
using that yet.

The core of the code is the DeepTime class that represents any time as
a 64-bit float, which has enough precision to represent individual
minutes back at the Big Bang. That class does all the parsing and
stringifying of dates, as well as converting to and from log space.
The LogTimeline class represents the timeline itself.

## Cloud Worker: News Feed

I also wrote a simple news-feed scraper that feeds news items into the
timeline in real time. That's a Cloudflare Worker, in
`timeline-events-worker`. It currently uses Reddit's `/r/worldnews`
because it's free and simple to access.
See that dir for how to deploy.


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

