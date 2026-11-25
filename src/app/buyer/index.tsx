import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useSession } from "@/lib/session";

type Project = { name: string; possessionDate: number; progress: number };

export default function MyUnit() {
  const buyer = useSession((s) => s.buyer);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!buyer) return;
    setLoading(true);
    setError(false);
    try {
      const snap = await getDoc(doc(db, "projects", "main"));
      if (!snap.exists()) throw new Error("missing");
      const d = snap.data();
      setProject({
        name: d.name,
        possessionDate: d.possessionDate.toMillis(),
        progress: d.towerProgress?.[buyer.tower] ?? 0,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [buyer]);

  useEffect(() => {
    load();
  }, [load]);

  if (!buyer) return null;
  const days = project
    ? Math.max(0, Math.ceil((project.possessionDate - Date.now()) / 86400000))
    : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 15, color: "#666" }}>Welcome, {buyer.name}</Text>

      <View style={card}>
        <Text style={label}>Unit</Text>
        <Text style={big}>
          {buyer.tower}-{buyer.unit}
        </Text>
        <View style={{ flexDirection: "row", gap: 24, marginTop: 8 }}>
          <View>
            <Text style={label}>Tower</Text>
            <Text style={val}>{buyer.tower}</Text>
          </View>
          <View>
            <Text style={label}>Configuration</Text>
            <Text style={val}>{buyer.config}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : error || !project ? (
        <View style={card}>
          <Text style={{ color: "#c0392b", marginBottom: 8 }}>
            Couldn't load project details.
          </Text>
          <Pressable onPress={load}>
            <Text style={{ color: "#208AEF", fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={card}>
            <Text style={label}>
              Construction progress, Tower {buyer.tower}
            </Text>
            <Text style={big}>{project.progress}%</Text>
            <View
              style={{
                height: 10,
                backgroundColor: "#e5e7eb",
                borderRadius: 5,
                marginTop: 8,
              }}
            >
              <View
                style={{
                  height: 10,
                  width: `${project.progress}%`,
                  backgroundColor: "#208AEF",
                  borderRadius: 5,
                }}
              />
            </View>
          </View>
          <View style={card}>
            <Text style={label}>Days to possession</Text>
            <Text style={big}>{days}</Text>
            <Text style={{ color: "#666" }}>{project.name}</Text>
          </View>
        </>
      )}

      <Pressable
        onPress={async () => {
          await signOut(auth);
          router.replace("/");
        }}
        style={{ alignItems: "center", padding: 12 }}
      >
        <Text style={{ color: "#208AEF" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const card = {
  backgroundColor: "#f5f7fa",
  borderRadius: 14,
  padding: 16,
} as const;
const label = { color: "#666", fontSize: 13 } as const;
const big = { fontSize: 34, fontWeight: "700" } as const;
const val = { fontSize: 18, fontWeight: "600" } as const;
