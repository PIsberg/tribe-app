# Workflows

All CI/CD is handled by GitHub Actions. This document describes each workflow, when it runs, what it does, and the secrets it needs.

---

## Overview

```
push / PR → main
│
├── ci.yml             Lint → Type-check → Build → E2E
├── build-native.yml   Android APK + iOS simulator build
├── deploy.yml         Convex backend deploy (main only)
├── dependency-review.yml   Block PRs that introduce vulnerable deps
├── codeql.yml         Static security analysis
└── scorecards.yml     OSSF supply-chain scorecard
```

---

## CI (`ci.yml`)

**Triggers:** push to `main`/`develop`, PR targeting `main`

**Jobs (run in sequence):**

| Job | Runner | What it does |
|---|---|---|
| `lint-and-typecheck` | ubuntu-latest | `eslint` + `tsc --noEmit` |
| `build` | ubuntu-latest | `convex deploy --cmd 'npm run build'`, uploads `dist/` artifact |
| `e2e` | ubuntu-latest | Downloads `dist/`, runs Playwright (Chromium only), uploads report |

**Required secrets:**

| Secret | Where to get it |
|---|---|
| `CONVEX_DEPLOY_KEY` | Convex dashboard → Settings → Deploy Keys |
| `CONVEX_DEPLOYMENT` | Convex dashboard → project name |
| `VITE_CONVEX_URL` | Convex dashboard → deployment URL |
| `VITE_TRIBE_LAT` | Any latitude (default start location) |
| `VITE_TRIBE_LNG` | Any longitude |
| `VITE_ADSENSE_PUB_ID` | Google AdSense publisher ID (optional) |

---

## Build Native Apps (`build-native.yml`)

**Triggers:** push to `main`, PR targeting `main`, manual (`workflow_dispatch`)

### Android job

**Runner:** `ubuntu-latest`  
**Runs on:** every trigger (PRs included)

Steps:
1. `npm ci` + Convex codegen (generates TypeScript types)
2. `npm run build` — Vite production build → `dist/`
3. `npx cap sync android` — copies `dist/` into `android/app/src/main/assets/public/`
4. `./gradlew assembleDebug` — compiles the Android project
5. Uploads `app-debug.apk` as a workflow artifact (retained 14 days)

The debug APK is unsigned and can be installed on any Android device with **Unknown sources** enabled. Download it from the **Actions** tab → pick a workflow run → **Artifacts**.

### iOS job

**Runner:** `macos-latest`  
**Runs on:** push to `main` and `workflow_dispatch` only (PRs skipped — macOS runners are ~12× more expensive than Linux)

Steps:
1. `npm ci` + Convex codegen
2. `npm run build` → `dist/`
3. `npx cap sync ios` — copies `dist/` into `ios/App/App/public/`
4. `xcodebuild -resolvePackageDependencies` — fetches Swift packages (Capacitor runtime)
5. `xcodebuild build` targeting `generic/platform=iOS Simulator` with code signing disabled

This build validates that the iOS project compiles correctly. It does **not** produce an installable IPA — see [iOS Release Signing](#ios-release-signing) below.

**Required secrets** (same as CI):

`CONVEX_DEPLOY_KEY`, `VITE_CONVEX_URL`, `VITE_TRIBE_LAT`, `VITE_TRIBE_LNG`, `VITE_ADSENSE_PUB_ID`

---

## Deploy Convex (`deploy.yml`)

**Triggers:** push to `main`, manual (`workflow_dispatch`)

Runs `npx convex deploy` to push any schema or function changes to the production Convex deployment. This is a fast standalone job — the full CI build also deploys Convex, so this workflow exists for hotfixes and manual re-deploys.

**Required secrets:** `CONVEX_DEPLOY_KEY`

---

## Dependency Review (`dependency-review.yml`)

Blocks PRs that introduce npm packages with known high/critical CVEs. No secrets required.

---

## CodeQL (`codeql.yml`)

Runs GitHub's static analysis on JavaScript/TypeScript. Findings appear in the **Security** tab. No secrets required.

---

## Scorecards (`scorecards.yml`)

OSSF Supply-chain Levels for Software Artifacts scorecard — checks branch protection, pinned actions, dependency update tooling, etc. Runs weekly and on push to `main`.

---

## iOS Release Signing

To build a signed IPA for TestFlight or the App Store, you need:

1. **Apple Developer account** with an App ID registered for `com.tribe.app`
2. **Distribution certificate** + **provisioning profile** exported from Xcode / Apple Developer portal
3. Add these GitHub secrets:

| Secret | Description |
|---|---|
| `IOS_CERTIFICATE_BASE64` | p12 certificate, base64-encoded (`base64 -i cert.p12`) |
| `IOS_CERTIFICATE_PASSWORD` | p12 export password |
| `IOS_PROVISION_PROFILE_BASE64` | `.mobileprovision` file, base64-encoded |
| `APP_STORE_CONNECT_API_KEY` | App Store Connect API key JSON (for `altool` / `notarytool`) |

The recommended approach is to use [Fastlane](https://fastlane.tools) with [match](https://docs.fastlane.tools/actions/match/) for certificate management, then add a `fastlane beta` lane to the iOS job.

---

## Android Release Signing

To build a release AAB for the Play Store:

1. Generate a keystore: `keytool -genkey -v -keystore tribe-release.jks -alias tribe -keyalg RSA -keysize 2048 -validity 10000`
2. Add these GitHub secrets:

| Secret | Description |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (`tribe`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Then replace `assembleDebug` with `bundleRelease` in the workflow and add a signing step using `gradle-play-publisher` or the `sign-android-release` action.

---

## Local dev workflow

```
# Daily loop
npm run convex:dev     # terminal 1
npm run dev            # terminal 2

# After changing code and wanting to test on device
npm run cap:sync       # rebuild + sync both native projects
npx cap open android   # open Android Studio → Run
npx cap open ios       # open Xcode → Run (Mac only)

# Before pushing a PR
npm run type-check
npm run lint
npm run test:e2e
```
