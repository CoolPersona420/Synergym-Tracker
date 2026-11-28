# Working on Synergym

- **Secrets:** never print or commit the Supabase secret or service keys or a Vercel token. Only the Supabase URL and
  publishable key ship in the app.
- **Show before building:** suggest the work, with examples or mockups, before implementing. Show a mockup
  (screenshots or a recording of the real build) before every deploy.
- **Release flow:** all work goes on the `dev` branch.
  1. `npx eslint .`, `npm test`, then the full browser suite:
     `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --reporter=line --trace off` (about 25 minutes).
  2. Push `dev`. Vercel deploys it to Dev: https://synergym-tracker-log-git-dev-synergym.vercel.app
  3. The owner tests on Dev. Ship only when they say "ship" and the suite has passed.
  4. Ship: fast-forward `main` to `dev`, push, then check that `/version.json` on the live site shows the new version.
- **Each release updates:** RELEASE_NOTES.md (newest first; its first three bold bullets feed the in-app update
  popup), the version line in README.md, the guide in `src/ui/guide.js`, and the version in `package.json` and
  `package-lock.json`.
