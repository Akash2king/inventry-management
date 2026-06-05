import { createNavigationContainerRef } from "@react-navigation/native";

/** Shared ref so push-notification taps can navigate outside screen components. */
export const navigationRef = createNavigationContainerRef();
