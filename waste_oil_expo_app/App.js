/**
 * Chem-Solv Inventory — native Expo shell (React Navigation + REST API).
 * OneSignal: https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup
 */
import { useEffect } from "react";
import { initializeOneSignal } from "./native/oneSignalService.js";
import NativeRoot from "./native/NativeRoot.jsx";

export default function App() {
  useEffect(() => {
    initializeOneSignal();
  }, []);

  return <NativeRoot />;
}
