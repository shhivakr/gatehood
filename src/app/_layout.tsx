import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { startSessionListener, useSession } from "@/lib/session";

export default function RootLayout() {
  const ready = useSession((s) => s.ready);
  const role = useSession((s) => s.role);
  useEffect(() => startSessionListener(), []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={ready && role === "buyer"}>
          <Stack.Screen name="buyer" />
        </Stack.Protected>
        <Stack.Protected guard={ready && role === "builder"}>
          <Stack.Screen name="builder" />
        </Stack.Protected>
        <Stack.Protected guard={!ready || role === "none"}>
          <Stack.Screen name="index" />
          <Stack.Screen name="join" />
          <Stack.Screen name="builder-login" />
          <Stack.Screen name="explore" />
        </Stack.Protected>
      </Stack>
      {!ready && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
            },
          ]}
        >
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
}
