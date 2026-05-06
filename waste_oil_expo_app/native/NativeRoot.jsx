import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, AuthGate, useAuth } from "./AuthContext.jsx";
import { LoginScreen } from "./screens/LoginScreen.jsx";
import { RecordsScreen } from "./screens/RecordsScreen.jsx";
import { RecordDetailScreen } from "./screens/RecordDetailScreen.jsx";
import { QueueScreen } from "./screens/QueueScreen.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";

const Stack = createNativeStackNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f8fafc",
  },
};

function AppStack() {
  const { isAuthenticated } = useAuth();

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
          <Stack.Screen
            name="Records"
            component={RecordsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="RecordDetail"
            component={RecordDetailScreen}
            options={({ route }) => ({
              title: route.params?.title || "Record",
            })}
          />
          <Stack.Screen
            name="Queue"
            component={QueueScreen}
            options={{
              title: "My queue",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "API Settings" }}
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
