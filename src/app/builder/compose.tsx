import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSession } from "@/lib/session";
import { AppIcon } from "@/components/app-icon";

type Kind = "all" | "towers" | "units";

export default function Compose() {
  const uid = useSession((s) => s.uid);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [allTowers, setAllTowers] = useState<string[]>([]);
  const [towers, setTowers] = useState<string[]>([]);
  const [unitsText, setUnitsText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "invites"))
      .then((s) => {
        setAllTowers(
          [...new Set(s.docs.map((d) => d.data().tower as string))].sort(),
        );
      })
      .catch(() => {});
  }, []);

  async function post() {
    setError("");
    if (!title.trim() || !body.trim())
      return setError("Add a title and a message.");

    let audience: any = { type: "all", towers: [], units: [] };
    let audienceKeys: string[] = ["all"];

    if (kind === "towers") {
      if (!towers.length) return setError("Pick at least one tower.");
      audience = { type: "towers", towers, units: [] };
      audienceKeys = towers.map((t) => `tower:${t}`);
    }
    if (kind === "units") {
      const units = [
        ...new Set(
          unitsText
            .split(/[,\s]+/)
            .map((u) => u.trim().toUpperCase())
            .filter(Boolean),
        ),
      ];
      if (!units.length)
        return setError("Enter at least one unit, like A-103.");
      if (units.some((u) => !/^[A-Z]+-\d+$/.test(u)))
        return setError("Use the format A-103, separated by commas.");
      audience = { type: "units", towers: [], units };
      audienceKeys = units.map((u) => `unit:${u}`);
    }
    if (audienceKeys.length > 30)
      return setError("Too many targets in one notice (max 30).");

    setSending(true);
    try {
      await addDoc(collection(db, "notices"), {
        title: title.trim(),
        body: body.trim(),
        pinned,
        audience,
        audienceKeys,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      setTitle("");
      setBody("");
      setPinned(false);
      setTowers([]);
      setUnitsText("");
      setKind("all");
      router.navigate("/builder/notices");
    } catch (e) {
      console.warn("post failed", e);
      setError("Could not post. Check your connection and retry.");
    } finally {
      setSending(false);
    }
  }

  const input = {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
  } as const;
  const chip = (on: boolean) =>
    ({
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: on ? "#222" : "#e5e7eb",
    }) as const;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 22, fontWeight: "700" }}>New notice</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        style={input}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Message"
        multiline
        style={[input, { minHeight: 110, textAlignVertical: "top" }]}
      />

      <Text style={{ fontWeight: "600" }}>Send to</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(
          [
            ["all", "Whole project"],
            ["towers", "Towers"],
            ["units", "Units"],
          ] as [Kind, string][]
        ).map(([k, l]) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={chip(kind === k)}
          >
            <Text
              style={{ color: kind === k ? "#fff" : "#222", fontWeight: "600" }}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      {kind === "towers" && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {allTowers.map((t) => {
            const on = towers.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() =>
                  setTowers(on ? towers.filter((x) => x !== t) : [...towers, t])
                }
                style={chip(on)}
              >
                <Text
                  style={{ color: on ? "#fff" : "#222", fontWeight: "600" }}
                >
                  Tower {t}
                </Text>
              </Pressable>
            );
          })}
          {allTowers.length === 0 && (
            <Text style={{ color: "#666" }}>
              Import buyers first to see towers.
            </Text>
          )}
        </View>
      )}

      {kind === "units" && (
        <TextInput
          value={unitsText}
          onChangeText={setUnitsText}
          placeholder="A-103, B-204"
          autoCapitalize="characters"
          style={input}
        />
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppIcon name="pin" size={16} color="#444" />
          <Text style={{ fontWeight: "600" }}>Pin this notice</Text>
        </View>
        <Switch value={pinned} onValueChange={setPinned} />
      </View>

      {!!error && <Text style={{ color: "#c0392b" }}>{error}</Text>}
      <Pressable
        onPress={post}
        disabled={sending}
        style={{
          backgroundColor: "#208AEF",
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>Post notice</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
