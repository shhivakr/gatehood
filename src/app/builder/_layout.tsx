import { Tabs } from "expo-router";
import { AppIcon } from "@/components/app-icon";

export const unstable_settings = {
  anchor: "home",
};

export default function BuilderLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{ tabBarActiveTintColor: "#222" }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Buyers",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="buyers" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: "Post",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="compose" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: "Notices",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="notices" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
