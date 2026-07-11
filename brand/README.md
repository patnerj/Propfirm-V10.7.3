# Brand assets → Android icons

Source of truth: `../public/favicon.svg` (the brand mark).
Regenerate the Android launcher icons + splash with:

    python3 brand/generate-android-icons.py

This writes into `android/app/src/main/res/**` and those files ARE COMMITTED to the
project source — so every future `gradlew assembleDebug` carries the branding
automatically. (V10.7.3's branded icons were hand-patched into a one-off build and
never committed, which is why the icon silently reverted to the Capacitor default on
every subsequent rebuild — see V10.7.5 BUG 8.)
