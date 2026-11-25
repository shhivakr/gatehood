import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";

export default function BuilderLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useSession((s) => s.refresh);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await refresh();
      if (useSession.getState().role !== "builder") {
        await signOut(auth);
        setError("This account is not a builder account.");
        return;
      }
    } catch {
      setError("Wrong email or password.");
    } finally {
      setLoading(false);
    }
  }

  const input = {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
  };
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Builder login</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={input}
      />
      {!!error && <Text style={{ color: "#c0392b" }}>{error}</Text>}
      <Pressable
        onPress={submit}
        disabled={loading}
        style={{
          backgroundColor: "#222",
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
