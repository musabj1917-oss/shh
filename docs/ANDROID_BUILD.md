# Haiku Messenger — Android Cloud Build & Installation Guide

This document describes how to trigger cloud Android APK builds using GitHub Actions and install the app on an Android tablet directly from GitHub without needing a laptop or local Android SDK.

---

## 1. How to Build & Download the Android APK (From a Tablet)

1. Open the **Haiku Messenger** GitHub repository in Chrome, Samsung Internet, or GitHub App on your Android tablet.
2. Tap the **Actions** tab at the top of the repository navigation bar.
3. On the left sidebar, tap **Build Android APK**.
4. Tap the **Run workflow** dropdown button on the right side.
5. Select the `main` or development feature branch and tap the green **Run workflow** button.
6. Refresh the page after a few seconds. You will see a running build named **Build Android APK**.
7. Wait for the build workflow to finish (typically 3–5 minutes). A green checkmark indicates success.
8. Tap on the completed workflow run.
9. Scroll down to the **Artifacts** section at the bottom of the page.
10. Tap **haiku-messenger-android-apk** to download the generated `.zip` package.

---

## 2. Installing the APK on an Android Tablet

1. Open the **My Files** or **Files** app on your Android tablet and go to your **Downloads** folder.
2. Tap `haiku-messenger-android-apk.zip` and select **Extract** / **Unzip**.
3. Inside the extracted folder, locate `app-debug.apk`.
4. Tap `app-debug.apk` to begin installation.
5. If Android shows a prompt saying **"For your security, your phone/tablet is not allowed to install unknown apps from this source"**:
   - Tap **Settings** in the popup prompt.
   - Toggle **Allow from this source** to ON for My Files / Chrome.
   - Tap the Back button and tap **Install**.
6. Open **Haiku Messenger** from your app drawer.

---

## 3. Environment Variables & Public Client Configuration

- **Backend API URL**: The mobile app communicates with the deployed Express Vercel API. Server secrets (such as `DATABASE_URL` for Neon PostgreSQL, `CLERK_SECRET_KEY`, and `JWT_SECRET`) are kept strictly on the Vercel backend server and are NEVER bundled inside the mobile APK.
- **$0 Budget Compliance**: Direct database credentials and private API keys are omitted from client builds.

---

## 4. Debug vs. Release Signing

- **Debug Builds**: The workflow currently generates a debug APK (`./gradlew assembleDebug`) signed with standard Android debug credentials. This is optimal for owner tablet testing and internal distribution.
- **Production Release Signing**: To build a signed production release APK:
  1. Generate an Android keystore locally or securely in GitHub Secrets.
  2. Configure `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYALIAS`, `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD` in repository GitHub Secrets.
  3. Update `./gradlew assembleRelease` in the workflow file.
