# v0.2.3-beta.1 — Native dashboard with generators

Prerelease for testing before a stable update. This replaces the simplified
generator dashboard with the native Energy panel and isolated generator-aware
cards. Generators remain distinct from solar in distribution, totals,
consumption and production charts, power charts, flow diagrams and CSV export.
Fuel consumption and efficiency follow the native date and comparison controls.
Locations without generators retain the native dashboard path.

Local validation passed: 17 JavaScript tests, 16 backend boundary tests,
syntax/JSON checks, location isolation browser checks, and real native-card
rendering for both location scenarios. Live Frestia_1 and Frestia_2 acceptance
testing is pending; this is not the stable release.

Generator destination attribution is estimated from each statistics bucket.
Fuel is not counted again in the location's native gas totals. Existing
location settings and Recorder history are preserved.

Install this prerelease through Marketplace with beta versions enabled, then
restart Home Assistant and reload the browser.
