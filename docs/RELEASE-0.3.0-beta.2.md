# Location Energy cards — shared initial dates

Keeps all cards in one date group on the same initial period, even when their
native saved default periods differ. Includes a regression test for that case.

Live beta 1 testing verified automatic resource loading, both native distribution
diagrams on the new Energy Overview dashboard, shared previous-day selection,
location titles, and visual-editor switching to Frestia_2's native source table.
Recorded 11 November values match prior Recorder checks: Frestia_1 consumption
4.35 kWh; Frestia_2 consumption 37.9 kWh.

Local checks: 13 JavaScript tests, 15 backend tests, existing panel browser smoke,
new card/editor/lifecycle browser checks and syntax validation. This remains a
prerelease. The existing blank Configure panel is outside this card feature.
