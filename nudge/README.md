# nudge

One Android app (Flutter) with four sections: **Routines** (daily, repeated, to-do,
with half-life nagging), **Promises** (what you'll do today, with a morning reminder), **Goals** (time targets
fed by kept promises) and **Places** (location alarms), plus a **Manual** tab that opens
on the first run. Android 11+.

What it does and why: [docs/SPEC.md](docs/SPEC.md).

## Install on your phone

No Play Store needed: the APK installs directly.

1. On the phone, open https://github.com/sudolaw/pi_mono/releases (signed in to
   GitHub; the repo is private) and pick the newest **Nudge build**.
2. Tap `nudge-<n>.apk` under **Assets** (the `-32bit` one is only for old 32-bit phones,
   `-emulator` for a PC emulator), then open the download. Allow installing from your
   browser when Android asks.
3. On first run allow notifications. In **Settings** (gear icon) also allow
   "Ignore battery optimization" so reminders arrive on time.

Each time nudge changes land on `main` a new build is published there (also kept as
a zip artifact on the workflow run). To build without a change, start the
**nudge-android** workflow by hand from the repo's Actions tab.

New APKs install over the old one and keep your data, as long as they are signed with
the same key (see [Signing](#signing)).

## Develop

Work on the `nudge-dev` branch: pushes there don't build. Merge it into `main` now and
then; that runs the checks and publishes the APK.

Run commands from this directory.

```sh
flutter pub get
dart run build_runner build   # after changing lib/data/db.dart
flutter analyze
flutter test
flutter build apk --release   # needs the Android SDK
```

## Layout

- `lib/core/`: pure Dart logic with unit tests: coordinates and distance, repeat
  patterns, half-life nag timing, goal stats.
- `lib/data/db.dart`: SQLite tables (drift). `db.g.dart` is generated.
- `lib/services/engine.dart`: the reminder engine. Creates each day's occurrences,
  fires due nags, marks missed windows and returns when it next needs to run.
- `lib/services/scheduler.dart`: wakes the engine with one exact Android alarm
  (`android_alarm_manager_plus`) and handles notification buttons in the background.
- `lib/services/location_service.dart`: foreground service that checks the position
  on an adaptive schedule and rings location alarms.
- `lib/ui/`: screens.

## Signing

The GitHub workflow signs with a release key when these repository secrets exist:
`NUDGE_KEYSTORE_BASE64` (the `.jks` file, base64-encoded), `NUDGE_KEYSTORE_PASSWORD`,
`NUDGE_KEY_ALIAS`, `NUDGE_KEY_PASSWORD`. Without them it uses a debug key cached
between runs; if that cache expires (7 days without a build), the next APK has a new
signature and you must uninstall the old app first, which deletes its data.

Create a key once, on any computer with Java:

```sh
keytool -genkeypair -keystore nudge.jks -alias nudge -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 nudge.jks   # paste the output into the NUDGE_KEYSTORE_BASE64 secret
```
