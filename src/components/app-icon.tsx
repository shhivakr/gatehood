import type { ColorValue } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";

const ICONS = {
  home: { ios: "house.fill", android: "home", web: "home" },
  updates: { ios: "megaphone.fill", android: "campaign", web: "campaign" },
  buyers: { ios: "person.2.fill", android: "group", web: "group" },
  compose: { ios: "square.and.pencil", android: "edit_square", web: "edit_square" },
  notices: { ios: "list.bullet.clipboard", android: "list_alt", web: "list_alt" },
  pin: { ios: "pin.fill", android: "push_pin", web: "push_pin" },
  "chevron-up": {
    ios: "chevron.up",
    android: "keyboard_arrow_up",
    web: "keyboard_arrow_up",
  },
  "chevron-down": {
    ios: "chevron.down",
    android: "keyboard_arrow_down",
    web: "keyboard_arrow_down",
  },
  share: { ios: "square.and.arrow.up", android: "share", web: "share" },
  dot: {
    ios: "circle.fill",
    android: "fiber_manual_record",
    web: "fiber_manual_record",
  },
} as const satisfies Record<string, SymbolViewProps["name"]>;

export type IconName = keyof typeof ICONS;

/** Cross-platform symbol wrapper backed by SF Symbols on iOS and Material Symbols on Android/Web. */
export function AppIcon({
  name,
  size = 20,
  color = "#222",
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}
