# Almath

Repository for **Almath — Active Learning Maths**, developed by Alberto Moro Carrera, which helps students and working engineers learn and review mathematics for Computer Science and Machine Learning through short explanations, worked examples and interactive exercises.

The app is designed for short learning sessions: understand a concept, try it yourself and continue from where you stopped. The Android version includes offline learning, daily goals, day streaks and optional local reminders.

**Screenshots:**

| Home and daily progress | Course selection |
| :---: | :---: |
| <img src="assets/screenshots/home.jpg" width="240" alt="Almath home screen with the daily goal and learning progress"> | <img src="assets/screenshots/courses.jpg" width="240" alt="Computer Science and Machine Learning course selection"> |
| **Theory and worked example** | **Exercise and answer feedback** |
| <img src="assets/screenshots/theory.jpg" width="240" alt="Dot product explanation, formula and worked example"> | <img src="assets/screenshots/practice.jpg" width="240" alt="Dot product exercise with a correct answer and its explanation"> |

**Daily goals and reminders:**

<img src="assets/screenshots/daily-goal.jpg" width="240" alt="Settings for the daily exercise target and optional reminder time">

**How it works:**

- Choose a course and module. Read the explanation and follow a worked example before moving on to the exercises.
- Submit an answer to receive feedback. Hints are optional: an incorrect answer invites you to request one, without duplicating the hint. Solutions include an explanation.
- Revisit the theory, resume an unfinished module or use review mode to practise again.
- Set a daily target between 1 and 100 exercises. Each correctly answered exercise counts once per day; revealed solutions do not count towards the goal.
- On Android, optionally enable a reminder at your chosen time. Reminders work offline and are skipped when the daily goal has been reached. Delivery time can vary with Android battery settings.
- Keep a streak by solving at least one exercise a day. Hints and review count; revealed solutions do not.
- From About, export a password-protected progress backup or import one. Imports merge saved history with existing progress. Files are encrypted locally; Almath does not upload your progress or keep your backup password.

**Current courses:**

**Mathematics for Computer Science:** 22 units, 97 active modules and 310 original exercises covering proofs, logic, sets, induction, algorithms, graphs, number theory, counting, probability, random walks and recurrences.

**Mathematics for Machine Learning:** 12 modules and 74 original exercises covering vectors, regression, optimization, classification, probability, regularization, evaluation, neural networks, attention and ML systems.

The interface and learning content are in English. An account is not required: progress is saved locally using IndexedDB, with no automatic cross-device synchronization. An encrypted backup can be imported on another device. Clearing browser/app data or uninstalling the app can remove your progress, so export a backup first. Android bundles the lessons and mathematical fonts for offline use; external reference links require an internet connection.

**Try the Android beta:**

Download the APK attached to an [Android release](https://github.com/albertoM02/Almath/releases) and install it on Android 7.0 or later. Android may ask you to allow installation from the app used to download it. Updates with the same application ID and signing certificate preserve app data.

**Run locally:**

Developed using TypeScript, React 19, Next.js 16 and Tailwind CSS 4, with KaTeX for mathematical notation. Android uses Capacitor 8 and Java for the native reminder scheduler.

Requires Node.js 22.13.0 or later and pnpm 11.25.0.

```bash
git clone https://github.com/albertoM02/Almath.git
cd Almath
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use `pnpm check` for lint, TypeScript, content validation and tests, or `pnpm build` for a production web build.

**Build Android:**

Requires JDK 21 and the Android SDK with API 36 and its build tools. Configure `JAVA_HOME` and the SDK location through `ANDROID_HOME` or `android/local.properties`. See the [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

```bash
pnpm android:apk
```

Official builds require the existing private PKCS12 release keystore. Set `ALMATH_RELEASE_KEYSTORE` (absolute file path), `ALMATH_RELEASE_KEY_ALIAS`, `ALMATH_RELEASE_STORE_PASSWORD` and `ALMATH_RELEASE_KEY_PASSWORD` privately in your build environment. Keep the keystore and passwords out of this repository and public releases. The public fingerprint in `android/signing-certificate.sha256` pins the release identity: builds fail if the key is missing or different.

This exports and verifies the offline web bundle, synchronizes Capacitor, builds a non-debuggable release, verifies its signature and copies it to `dist/Almath-<version>.apk`. Reuse the same key, application ID, WebView origin and progress database, and increase Android's version code for subsequent releases. Keep secure, independent backups of the keystore and its password.

For local development, use `pnpm android:apk:dev`. It creates an **Almath Dev** APK with a separate `.dev` application ID, so contributors' test keys cannot replace an official installation.

**Build an official APK on GitHub:**

The **Build Android APK** workflow runs manually from `main`. It checks the app, release metadata and existing progress storage, then signs with the original release key and verifies the APK's signature, application ID, version and label. The workflow produces an APK and checksum for download; publishing a GitHub release remains a separate step.

Before the first run, create an `android-release` environment in repository **Settings → Environments**. Allow deployments only from `main`, require approval from a release maintainer, and disable bypassing the protection rules. A solo maintainer needs self-review allowed to approve their own run. Add these four **environment secrets**:

- `ALMATH_RELEASE_KEYSTORE_BASE64`: Base64 encoding of the existing PKCS12 keystore.
- `ALMATH_RELEASE_KEY_ALIAS`: The existing signing alias.
- `ALMATH_RELEASE_STORE_PASSWORD`: The keystore password.
- `ALMATH_RELEASE_KEY_PASSWORD`: The private key password.

Base64 is an encoding; GitHub Secrets provides the protected storage. Never commit the keystore, its encoded value or passwords. The workflow decodes the key into a private temporary directory, removes it after signing, and uploads only the verified APK and checksum. Keep an independent encrypted backup of the signing files.

For each new release, update `package.json`, Android's `versionName`, the displayed version and notices, and increase Android's `versionCode`. Once the reviewed changes are in `main`, open **Actions → Build Android APK → Run workflow**, select `main` and approve the protected job. Download the artifact from the completed run. Install its APK over the existing compatible Almath installation to retain progress; uninstalling removes local data.

**Older test installations:**

The earlier temporary signing keys are unavailable. A new release key cannot update an APK signed with one of those keys. Keep the old app installed until its progress has been exported and the encrypted backup verified. Where the old APK exposes WebView debugging, `scripts/export-legacy-progress.mjs` can export its progress over a USB connection without changing the old app's data. It requires Node.js 22.13+, Android platform tools (`adb`), a trusted computer and explicit USB debugging authorization. If that export is unavailable, keep the old installation; this release cannot automatically recover its private data.

**Folder overview:**

**app:** Next.js entry point, page layout and global styles.

**screens:** Course, unit, lesson, review, completion and About screens.

**components:** Shared interface elements and Almath components, including mathematical text and daily goals.

**content:** Courses, modules, concepts, exercises, English text and reference metadata, separate from the interface.

**learning:** Answer checking, sessions, progress validation, local storage, navigation and daily goal calculations.

**platform:** Android integration, including Back navigation and reminders.

**android:** Native Capacitor project, resources and the local reminder scheduler.

**scripts / tests:** Build scripts, content validation and regression tests.

**public / assets:** App logo and README screenshots.

**Content and attribution:**

The explanations and exercises are written for Almath. The Computer Science curriculum is informed by [*Mathematics for Computer Science*](https://courses.csail.mit.edu/6.042/spring18/mcs.pdf) by Eric Lehman, F. Thomson Leighton and Albert R. Meyer (June 2018), published under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The book's text and exercises are not reproduced here. Machine Learning references include Google ML Crash Course, Stanford CS229 and other primary technical sources, listed in [content/sources.json](content/sources.json). The exercises are original practice material and are not presented as questions asked by a particular company.

**License:**

Copyright © 2026 Alberto Moro Carrera. Original Almath code, scripts, configuration and app assets are licensed under [GNU GPL version 3 only](LICENSE). Original educational material in `content/`, this README and the screenshots in `assets/screenshots/` are licensed under [CC BY-SA 4.0](content/LICENSE).

Third-party material retains its own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Almath is provided without warranty. The full licenses and notices are available offline in the app's About screen.

**Contributing:**

Suggestions, bug reports and corrections are welcome through [GitHub Issues](https://github.com/albertoM02/Almath/issues). For a content correction, include the course, module and exercise involved. If Almath is useful to you, a star helps others discover the project.

Alberto Moro Carrera
