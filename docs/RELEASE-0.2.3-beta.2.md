# Native dashboard with generators — beta 2

Fixes dashboard initialization discovered during the beta 1 live test: publish the generator-aware configuration atomically, without first starting an ordinary native view. Keep translation-function identity stable across sensor updates so the native panel does not repeatedly rebuild.

The existing native dashboard remains the path for locations without generators. Generator electricity remains distinct from solar. Fuel consumption and efficiency use matching statistics periods.

Validation: 17 JavaScript tests, local browser isolation and atomic-publication regression checks, and real adapted native-card fixture tests passed. Live acceptance of this beta is pending. This is a prerelease; stable publication remains withheld until both locations pass live testing.
