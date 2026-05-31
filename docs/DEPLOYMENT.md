# Deployment notes

## Vercel

Ask Ques is an ordinary static Next.js deployment. Vercel detects the framework, runs `npm run
build`, and serves the exported output. There are no environment variables, secrets, data stores, or
server functions to configure.

`vercel.json` applies the response headers. The CSP only permits local scripts, styles, fonts and
network connections; the sole data URI is the CSS grain texture. It intentionally retains
`'unsafe-inline'` for Next’s static runtime and inline styles. Do not remove it without checking the
exported page in a browser.

## Subpath hosts

Vercel at a custom domain serves the app at `/`, which is the default. For a static project host,
set `BASE_PATH` before building:

```sh
BASE_PATH=/ask-ques npm run build
```

The builder derives the site root from its current route, so its shared links work at either a domain
root or an exported subpath.

## Cache behaviour

There is no mutable content. Vercel’s static asset caching is appropriate for the JavaScript, CSS and
self-hosted fonts; each deployment publishes a new HTML document and hashed asset paths.
