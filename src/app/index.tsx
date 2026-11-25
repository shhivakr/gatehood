import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function Index() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
      <Text style={{ fontSize: 30, fontWeight: "700" }}>Gatehood</Text>
      <Text style={{ color: "#555", marginBottom: 16 }}>
        Project updates, only the ones meant for you.
      </Text>
      <Pressable onPress={() => router.push("/join")} style={btn}>
        <Text style={btnText}>I'm a buyer: join with code</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/builder-login")}
        style={[btn, { backgroundColor: "#222" }]}
      >
        <Text style={btnText}>I'm the builder</Text>
      </Pressable>
    </View>
  );
}

const btn = {
  backgroundColor: "#208AEF",
  padding: 16,
  borderRadius: 12,
  alignItems: "center" as const,
};
const btnText = { color: "#fff", fontWeight: "600" as const, fontSize: 16 };
