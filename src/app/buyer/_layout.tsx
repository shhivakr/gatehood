import { Tabs } from "expo-router";
import { AppIcon } from "@/components/app-icon";

export default function BuyerLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#208AEF" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "My Unit",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="updates" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
