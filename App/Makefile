# Sproutly app build targets.
#
# The web build MUST pass --no-tree-shake-icons: the app builds IconData
# dynamically (notification icons resolved from stored values), which makes the
# Flutter icon tree-shaker abort ("value '0' … not a valid unicode codepoint").
# It is baked into the `web` target here so nobody has to remember it.

# Point this at the backend the built app should talk to. Override on the CLI:
#   make web API_BASE_URL=https://api.sproutly.duforge.tech/api
API_BASE_URL ?= https://api.sproutly.duforge.tech/api

# Local dev default (Android emulator alias for host localhost).
DEV_API_BASE_URL ?= http://10.0.2.2:3000/api

.PHONY: web web-profile apk appbundle run analyze test clean icons splash

## Build the web app (release) — flag baked in.
web:
	flutter build web --no-tree-shake-icons --dart-define=API_BASE_URL=$(API_BASE_URL)

## Web build in profile mode (for perf profiling in the browser).
web-profile:
	flutter build web --profile --no-tree-shake-icons --dart-define=API_BASE_URL=$(API_BASE_URL)

## Android APK (release).
apk:
	flutter build apk --release --dart-define=API_BASE_URL=$(API_BASE_URL)

## Android App Bundle (Play Store).
appbundle:
	flutter build appbundle --release --dart-define=API_BASE_URL=$(API_BASE_URL)

## Run on a connected device/emulator against a local backend.
run:
	flutter run --dart-define=API_BASE_URL=$(DEV_API_BASE_URL)

analyze:
	flutter analyze

test:
	flutter test

clean:
	flutter clean

## Regenerate launcher icons from the brand vector art.
icons:
	py tool/generate_icon.py && dart run flutter_launcher_icons

## Regenerate the splash Lottie from the brand animation.
splash:
	py tool/generate_splash.py
