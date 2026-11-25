import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  INVALID: "That code doesn't exist. Check it and try again.",
  USED: "This code has already been used.",
  EXPIRED: "This code has expired. Ask your builder for a new one.",
};

export default function Join() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useSession((s) => s.refresh);

  async function submit() {
    Keyboard.dismiss();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]+-[A-Z0-9]{3}$/.test(clean)) {
      setError("Enter the code like A103-VSA.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous)
        await signOut(auth);
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser!.uid;

      await runTransaction(db, async (tx) => {
        const inviteRef = doc(db, "invites", clean);
        const snap = await tx.get(inviteRef);
        if (!snap.exists()) throw new Error("INVALID");
        const inv = snap.data();
        if (inv.claimedBy) throw new Error("USED");
        if (inv.expiresAt.toMillis() < Date.now()) throw new Error("EXPIRED");

        tx.update(inviteRef, { claimedBy: uid, claimedAt: serverTimestamp() });
        tx.set(doc(db, "buyers", uid), {
          inviteCode: clean,
          tower: inv.tower,
          unit: inv.unit,
          name: inv.name,
          phone: inv.phone,
          config: inv.config,
          joinedAt: serverTimestamp(),
        });
      });

      await refresh();
    } catch (e: any) {
      const known = MESSAGES[e?.message];
      if (!known) console.warn("join error", e);
      setError(
        known ?? "Something went wrong. Check your connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>
          Join your project
        </Text>
        <TextInput
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (error) setError("");
          }}
          placeholder="A103-VSA"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={{
            borderWidth: 1,
            borderColor: error ? "#c0392b" : "#ccc",
            borderRadius: 10,
            padding: 14,
            fontSize: 18,
          }}
        />
        {!!error && (
          <View
            style={{
              backgroundColor: "#fdecea",
              borderColor: "#f5c2c0",
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Text style={{ color: "#c0392b", fontWeight: "600" }}>{error}</Text>
          </View>
        )}
        <Pressable
          onPress={submit}
          disabled={loading}
          style={{
            backgroundColor: "#208AEF",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Join</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
