# Restore pre-generator Energy dashboards

Restores the application from commit 53cce92 (v0.1.4), the last version before
generator support was introduced. The version is 0.2.4 so Marketplace can offer
this rollback as an ordinary update.

Both locations use the native Home Assistant Energy dashboard. Removes the
Generators menu, generator configuration, custom generator cards and dashboard
replacement. Existing location preferences and Recorder history are retained.
Stored generator settings remain dormant and are not read by this version.

The current GitHub validation workflow and version-aware packaging are retained.
