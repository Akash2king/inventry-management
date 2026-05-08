import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, AuthGate, useAuth } from "./AuthContext.jsx";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme.js";
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
  const mustChange = Boolean(user?.must_change_password);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.surface },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.text,
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
        headerStyle: { backgroundColor: "#ffffff" },
        headerShadowVisible: false,
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
      <NavigationContainer theme={NavTheme}>
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
          <Inner />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
