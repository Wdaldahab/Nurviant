# Nurviant review and launch notes

This revision was merged to `main` in PR #1 on 2026-10-23, and the GitHub Pages workflow publishes `main`.

## What changed
- Separate nurse and hospital intake fields; hidden fields are disabled and omitted from the inquiry.
- Accessible mobile menu, pressed states for inquiry choices, focus styling, and small-screen layout fixes.
- Email preparation and inquiry download work without automatically sending personal details.
- Online intake remains disabled until the destination inbox, service activation, and privacy arrangements are verified. `ONLINE_INTAKE_ENABLED` in `app.js` controls this gate. Do not enable it merely because an HTTP request succeeds.
- Future online delivery checks both HTTP status and the provider success payload, handles malformed responses/network errors/timeouts, and preserves entries on failure.
- No browser localStorage of contact details; no fabricated jobs, partners, testimonials, or sponsorship claims.
- Canonical and social text metadata use the existing CNAME domain, nurviant.com. Verify domain ownership/routing before release. The link-preview image is supplied (see Launch polish); verified social account links remain to be supplied.

## Launch polish
- The home page headline speaks to internationally educated nurses. It promises no sponsorship, placement, or eligibility; keep those caveats if the wording changes.
- Body text and form-field borders meet WCAG AA contrast (4.5:1 and 3:1). The browser suite fails if they regress.
- Icons (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`), a 1200×630 link-preview image (`og-image.png`), `robots.txt`, and `sitemap.xml`. The sitemap also lists `nurses.html`, which the home page does not link to yet; delete that line to keep the page unlisted.
- `tools/render-assets.cjs` regenerates the icons and the preview image. The image reuses the home page headline and illustration, so re-run the script (usage is in its header) whenever either changes.

## Settings and steps outside the code
- **Enforce HTTPS.** In the GitHub repository open Settings → Pages and tick "Enforce HTTPS". It is a repository setting, so no pull request can change it. Until it is on, `http://nurviant.com` serves the page instead of redirecting to `https://`, and browsers label plain-HTTP pages "Not secure", which matters on a page with a form. Verify with `curl -sI http://nurviant.com/`: expect a 301 with `location: https://nurviant.com/`.
- **Refresh link previews after a deploy.** Each network caches the preview it saw first. Re-scrape the URL with LinkedIn's Post Inspector and Facebook's Sharing Debugger; other apps update when their cache expires.

## Business decisions required before online intake
Confirm the legal operator name and contact address, inbox ownership and monitoring, retention/deletion period, access controls, intended sharing with hospitals or vendors, and the final privacy notice. The current page explicitly describes the email/download flow and says these arrangements are pending. Confirm recruitment claims, service geography, applicable business requirements, and any actual vacancies before advertising them.

No real inquiries were sent during development. Validate delivery end to end with an owner-approved test after the above decisions. Verify both initial service activation and subsequent receipt. A provider acceptance response is not proof that a human received an email.

## Preview and validation
Static site, no build step. Serve this directory with `python3 -m http.server 8765 --bind 127.0.0.1`, then open http://localhost:8765.

`node --check app.js` checks syntax. `tests/browser.cjs` uses Playwright with installed Chrome. Set `PLAYWRIGHT_PATH` to a Playwright installation if it is not on the module search path, and `OUTPUT_DIR` to a screenshot directory. The browser suite covers filtering, specialty choice, audience-specific payloads, mocked provider responses, mobile navigation, privacy notice links, responsive overflow, text and field-border contrast, role-card alignment, the icon, link-preview, and sitemap files, failed requests, and runtime errors. It intercepts delivery requests; it does not send inquiries.

Merging to `main` publishes the site through the GitHub Pages workflow, so review changes before merging.
