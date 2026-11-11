# Isolated Home Assistant development environment

Run `npm run build` in the project, then from this directory run:

```sh
docker compose up -d
```

Open `http://localhost:18123`, complete onboarding with a test account, then add
**Multi-location Energy** under Devices & services. The configuration has two
synthetic grid meters and power sensors. These provide separate locations for
initial integration and Recorder testing. Energy statistics need time to collect.

The container is pinned to Home Assistant 2026.11.0. Its port binds only to the
local machine, its configuration is independent, and it does not access either
existing installation or control any equipment.

Stop with `docker compose down`. Configuration/history remain in `dev/config`.
Do not commit the generated authentication/database files. Use the full checklist
in `docs/VALIDATION.md`; these few demo sensors are not a parity dataset.
