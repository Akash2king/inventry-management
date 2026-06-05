# Push notifications (OneSignal + Django)

Mobile push uses **OneSignal** (not Expo Push). The app calls `OneSignal.login(userId)` after sign-in; Django sends notifications via the **OneSignal REST API** using that external user id.

| Layer | Technology |
|-------|------------|
| Mobile app | `react-native-onesignal` + `onesignal-expo-plugin` |
| Backend | `apps/notifications/onesignal_push.py` → OneSignal Create Notification API |
| App ID (configured) | `e744024a-08b5-4703-a3ed-af0ac17e907f` |

## Credentials — what you need and where

### 1. OneSignal App ID (already in repo)

| Item | Location |
|------|----------|
| **App ID** | `app.json` → `expo.extra.oneSignalAppId` |
| Override | `EXPO_PUBLIC_ONESIGNAL_APP_ID` in `waste_oil_expo_app/.env` |

### 2. OneSignal REST API Key (Django backend)

| Credential | Where to get it | Where to put it |
|------------|-----------------|-----------------|
| **REST API Key** | [OneSignal Dashboard](https://dashboard.onesignal.com/) → your app → **Settings** → **Keys & IDs** → REST API Key | `waste_oil_backend/.env` as `ONESIGNAL_REST_API_KEY` |

```env
ONESIGNAL_APP_ID=e744024a-08b5-4703-a3ed-af0ac17e907f
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
ONESIGNAL_PUSH_ENABLED=true
```

### 3. Android FCM (OneSignal dashboard + native build)

| Credential | Where to get it | Where to put it |
|------------|-----------------|-----------------|
| **`google-services.json`** | Firebase Console → Android app `com.chemsolv.inventory` | `waste_oil_expo_app/google-services.json` |
| **FCM credentials** | Firebase service account OR FCM key | OneSignal dashboard → **Settings** → **Platforms** → Google Android (FCM) |

OneSignal delivers to Android via FCM. Configure FCM in the OneSignal dashboard; Django does **not** need Firebase credentials.

### 4. iOS APNs (when building for iOS)

Upload your APNs key (.p8) in OneSignal → **Settings** → **Platforms** → Apple iOS.

Set `mode` in `onesignal-expo-plugin` to `"production"` for App Store builds.

---

## Install & build

```bash
cd waste_oil_expo_app
npm install
npx expo prebuild --clean
npx expo run:android
```

Push does **not** work in Expo Go. Use a development build or EAS.

---

## Verification

1. Set backend `ONESIGNAL_*` env vars and restart Django.
2. Build and install the native app; log in and allow notifications.
3. `python manage.py list_notification_devices` — should show OneSignal subscription ids.
4. In app: **Workflow notifications** → **Send test push**, or forward a workflow record to trigger a push.
5. OneSignal dashboard → **Delivery** → confirm sends.

---

## Architecture

- **`native/oneSignalService.js`** — single wrapper for all SDK calls (init, login, permissions, welcome dialog).
- **`WorkflowPushRegistration.jsx`** — binds OneSignal session after login.
- **`PushNotificationDeeplink.jsx`** — opens the correct screen when a push is tapped.
- Backend targets users with `include_aliases.external_id` matching Django user UUID from `OneSignal.login(String(user.id))`.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No tray push | `ONESIGNAL_REST_API_KEY`, FCM/APNs on OneSignal dashboard, native build (not Expo Go) |
| User not targeted | User must log in so `OneSignal.login` runs with their UUID |
| Android build fails | Java 17, `google-services.json`, `npx expo prebuild --clean` |
| Welcome dialog | Shown once when push subscription id is first assigned (OneSignal integration test flow) |
