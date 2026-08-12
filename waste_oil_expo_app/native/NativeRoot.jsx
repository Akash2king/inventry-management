import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { navigationRef } from "./navigationRef.js";
import { PushNotificationDeeplink } from "./PushNotificationDeeplink.jsx";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, AuthGate, useAuth } from "./AuthContext.jsx";
import { WorkflowPushRegistration } from "./WorkflowPushRegistration.jsx";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme.js";
import { BREAKPOINTS } from "./utils/responsive.js";
import { LoginScreen } from "./screens/LoginScreen.jsx";
import { RecordsScreen } from "./screens/RecordsScreen.jsx";
import { RecordDetailScreen } from "./screens/RecordDetailScreen.jsx";
import { QueueScreen } from "./screens/QueueScreen.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";
import { DashboardScreen } from "./screens/DashboardScreen.jsx";
import { VendorsScreen } from "./screens/VendorsScreen.jsx";
import { RecordFormScreen } from "./screens/RecordFormScreen.jsx";
import { WorkflowTimelineScreen } from "./screens/WorkflowTimelineScreen.jsx";
import { ChangePasswordScreen } from "./screens/ChangePasswordScreen.jsx";
import { AuditLogsScreen } from "./screens/AuditLogsScreen.jsx";
import { GmConsoleScreen } from "./screens/GmConsoleScreen.jsx";
import { SessionsScreen } from "./screens/SessionsScreen.jsx";
import { InAppNotificationsScreen } from "./screens/InAppNotificationsScreen.jsx";
import { ToastHost } from "./components/ui/ToastHost.jsx";
import { AppDialogHost } from "./components/ui/AppDialogHost.jsx";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    primary: theme.colors.accent,
    text: theme.colors.textBright,
  },
};

function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const mustChange = Boolean(user?.must_change_password);
  const bottomPad = Math.max(insets.bottom, 14);
  const tabBarSidePad = isTablet ? Math.max((width - 640) / 2, 24) : 0;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: (isTablet ? 62 : theme.layout.tabBarHeight) + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          paddingHorizontal: tabBarSidePad,
          ...theme.shadow.md,
        },
        tabBarLabelStyle: {
          fontSize: isTablet ? 11 : 10,
          fontWeight: "600",
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RecordsTab"
        component={RecordsScreen}
        options={{
          title: "Records",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      {!mustChange ? (
        <>
          <Tab.Screen
            name="QueueTab"
            component={QueueScreen}
            options={{
              title: "Queue",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="list-outline" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="VendorsTab"
            component={VendorsScreen}
            options={{
              title: "Vendors",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="business-outline" size={size} color={color} />
              ),
            }}
          />
        </>
      ) : null}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  const { isAuthenticated, user } = useAuth();
  const mustChange = Boolean(user?.must_change_password);

  return (
    <Stack.Navigator
      key={isAuthenticated ? "signed-in" : "signed-out"}
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surfaceStrong },
        headerTintColor: theme.colors.textBright,
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
        animation: "slide_from_right",
        animationDuration: theme.motion.normal,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "API Settings" }}
          />
        </>
      ) : (
        <>
          {mustChange ? (
            <>
              <Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{ title: "Change password", headerBackVisible: false }}
              />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
              <Stack.Screen
                name="Sessions"
                component={SessionsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="InAppNotifications"
                component={InAppNotificationsScreen}
                options={{ title: "Workflow notifications" }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{ title: "Change password" }}
              />
              <Stack.Screen
                name="AuditLogs"
                component={AuditLogsScreen}
                options={{ title: "Audit logs" }}
              />
              <Stack.Screen
                name="GmConsole"
                component={GmConsoleScreen}
                options={{ title: "GM console" }}
              />
              <Stack.Screen
                name="Sessions"
                component={SessionsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="InAppNotifications"
                component={InAppNotificationsScreen}
                options={{ title: "Workflow notifications" }}
              />
            </>
          )}
          {!mustChange ? (
            <Stack.Screen
              name="RecordForm"
              component={RecordFormScreen}
              options={({ route }) => ({
                title: route.params?.mode === "edit" ? "Edit record" : "New record",
              })}
            />
          ) : null}
          <Stack.Screen
            name="RecordDetail"
            component={RecordDetailScreen}
            options={({ route }) => ({
              title: route.params?.title || "Record",
            })}
          />
          <Stack.Screen
            name="WorkflowTimeline"
            component={WorkflowTimelineScreen}
            options={({ route }) => ({
              title: route.params?.title || "Workflow timeline",
            })}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

function Inner() {
  return (
    <>
      <StatusBar style="dark" />
      <ToastHost />
      <AppDialogHost />
      <NavigationContainer ref={navigationRef} theme={NavTheme}>
        <PushNotificationDeeplink />
        <AppStack />
      </NavigationContainer>
    </>
  );
}

export default function NativeRoot() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          <WorkflowPushRegistration />
          <Inner />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
