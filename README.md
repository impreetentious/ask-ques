# Ask Ques

Ask Ques is a one-page question that only accepts yes for an answer. The No button runs, shrinks,
and eventually admits the obvious. It is a fully static Next.js app: no server, database, cookies,
analytics, or third-party requests.

The deployed default asks “Will you be my valentine?”, but every word is configurable. Edit one
small TypeScript object for a permanent version, or visit `/make` to produce a shareable link that
carries a custom question entirely in its URL hash.

## What ships

- A ten-rung escalation ladder: each No press advances the copy, scales both buttons, and changes
  the escape behaviour.
- A keyboard-accessible button that stops fleeing while it has keyboard focus. Refusal always
  registers; the final No becomes “fine, yes”, so nobody is trapped in the joke.
- A self-hosted variable-font surface, canvas motes, cursor parallax, low-cost particle finale,
  optional Web Audio chime, and a reduced-motion mode that keeps the whole interaction usable.
- `/make`, a no-backend builder that writes the question into a shareable hash. Hashes never reach
  the server.
- Static export, Vercel headers, strict TypeScript, deterministic unit tests, and a single local
  verification command.

## Run it locally

Ask Ques pins Node 22.22.2 in [`.nvmrc`](./.nvmrc).

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The builder is at
[http://localhost:3000/make](http://localhost:3000/make).

## Make it yours

For a deployed default, edit [`src/ask/config.ts`](./src/ask/config.ts). It contains every sentence
shown by the experience: the eyebrow, question, initial note, button labels, refusal ladder,
whispers, finale, theme, and chime setting. Numbers are derived from each rung’s position, so
changing the words is normally all that is needed.

For a one-off question, use `/make`. Enter one refusal per line; append `| a note` to put new copy
under the question at that rung. The builder gives you a link like `/#a=...`. It can be sent as-is,
and the custom content remains local until somebody opens that link.

## Verify

```sh
npm run verify
```

This checks version coherence, the Vercel header contract, types, lint, formatting, the codec,
ladder and physics tests, and the static production build. CI runs the same command on Node
22.22.2, then audits production dependencies.

## Deploy to Vercel

The repository is ready for a normal Vercel import—no environment variables or service setup are
needed.

1. Initialize and push this folder to the Git repository you want to use.
2. Import that repository in Vercel.
3. Leave the framework preset as **Next.js** and deploy.

`next.config.ts` uses a static export; `vercel.json` supplies a restrictive CSP and standard
hardening headers. The app has no API routes, server actions, storage, or secrets. If hosting under
a project subpath instead of Vercel’s domain root, build with `BASE_PATH=/your-path`.

## Accessibility and privacy

The primary controls are real buttons. The No button pauses on keyboard focus, changes are announced
politely, and reduced motion disables running, whispers, and the finale burst without removing the
ladder or scaling. Sound only starts after a Yes click.

There is no telemetry, analytics, cookie banner, local storage, external font CDN, or backend.
Custom builder content is encoded in the hash fragment, which browsers do not send to web servers.

## License

Ask Ques is available under the [MIT License](./LICENSE).

---

**Version:** v0.2.2
