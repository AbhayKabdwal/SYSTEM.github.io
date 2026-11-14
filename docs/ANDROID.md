# SYSTEM for Android

The Android app (Android 8 or newer) is the same React app as the website, wrapped with [Capacitor](https://capacitorjs.com). GitHub Actions builds the APK, so you don't need Android Studio or the Android SDK on your computer.

On top of the website, the app adds:

- **Quest reminders** that work offline: "Daily quest has arrived" in the morning and "Streak at risk" in the evening if today isn't cleared. The app asks for notification permission on first launch. Set the times, or send a test notification, under **More → Reminders**.
- **Native camera** for proof and progress photos.
- **Android back button**: closes dialogs first, then goes back, then minimises the app.
- **Haptics** on quest clears, level-ups and rank-ups.
- **Home-screen widget**: long-press your home screen → Widgets → SYSTEM. Shows your streak, rank and today's quest progress; tap to open the app.
- **Health Connect** (Android 9+; built in on Android 14): on the quest page, **Import from Health Connect** fills run, walk and ride tasks from workouts your watch or phone recorded. Read-only: the app never writes health data. Needs the Health Connect app on Android 13 and older.
- **Sign-in links that open the app**: email confirmation and password reset come back into the app.

Your data lives in the app's own storage. Logs, settings and photos sync with the website through your encrypted vault, the same as between two browsers.

## 1. One-time: create a signing key

Android only installs an update over an existing app if both are signed with the same key. Make one key, keep it forever, and give it to GitHub as secrets.

Run these on your computer. `keytool` comes with Java. It asks for a password: pick a long one and save it in your password manager.

```bash
keytool -genkeypair -v -keystore ~/system-release.keystore -alias system -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SYSTEM"
```

```bash
base64 -w0 ~/system-release.keystore | gh secret set ANDROID_KEYSTORE_B64
```

```bash
gh secret set ANDROID_KEY_ALIAS --body system
```

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD
```

```bash
gh secret set ANDROID_KEY_PASSWORD
```

The last two prompt for the password; paste the same one into both. Back up `~/system-release.keystore` somewhere safe (not in the repo). If you lose it, the next APK can't update the installed app: you'd have to uninstall, which deletes on-device data that isn't synced.

Without these secrets the workflow still builds, but a debug APK signed by a throwaway key. It installs fine once; every later build needs an uninstall first.

## 2. Allow auth emails to open the app

Sign-up confirmation and password-reset emails send the app to `io.github.abhaykabdwal.system://auth`. Supabase only redirects to URLs on its allow-list, which `supabase/config.toml` already includes. Push it once:

```bash
npx supabase config push
```

## 3. Build and install

Every push to `main` that touches `app/` builds a new APK. To build without pushing: GitHub → **Actions → Android APK → Run workflow**, or:

```bash
gh workflow run "Android APK"
```

On your phone:

1. Open `https://github.com/AbhayKabdwal/SYSTEM.github.io/releases/tag/android-latest` and tap **SYSTEM.apk**. (Without the signing key, download the **SYSTEM-apk** artifact from the workflow run instead; it's a zip containing the APK.)
2. Open the downloaded file. Android asks to allow installs from your browser or Files app: allow it for that app only.
3. Tap **Install**. For updates, repeat: it installs over the old version and keeps your data.

If notifications never arrive, check Android Settings → Apps → SYSTEM → Notifications is on, and that battery optimisation isn't set to "Restricted" for SYSTEM.

Play Protect may warn that the app is from an unknown developer, because it isn't from the Play Store. Choose **Install anyway**.

## 4. Moving from the website

The app has its own storage, separate from Chrome. Bring your data over either way:

- **With an account:** sign in and unlock your vault in the app. Everything syncs, including private photos.
- **Without an account:** on the website, **Data Vault → Export** (tick "include photos"), then in the app **Restore from backup** during setup, or **Data Vault → Import** later.

## Developing locally (optional)

You only need this to build an APK on your own machine instead of in GitHub Actions: Node 20+, JDK 21 and the Android command-line tools (SDK platform 36) ("Command line tools only" from developer.android.com/studio, no Android Studio needed).

```bash
cd app
```

```bash
npm run build && npx cap sync android
```

```bash
cd android && ./gradlew assembleDebug
```

The APK lands in `app/android/app/build/outputs/apk/debug/`.

## How it fits together

| Piece | Where |
|---|---|
| Native project (manifest, icons, Gradle) | `app/android/` |
| Capacitor config (app id, name) | `app/capacitor.config.ts` |
| Native features | `app/src/native/` |
| Build workflow | `.github/workflows/android.yml` |

The website's service worker is turned off inside the app: the files already ship in the APK, and a new version arrives as a new APK.
