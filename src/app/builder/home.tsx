import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import * as DocumentPicker from "expo-document-picker";
import Papa from "papaparse";
import { z } from "zod";
import { auth, db } from "@/lib/firebase";
import { AppIcon } from "@/components/app-icon";

type Invite = {
  code: string;
  tower: string;
  unit: string;
  name: string;
  phone: string;
  claimed: boolean;
  expired: boolean;
};

const Row = z.object({
  tower: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(5),
  config: z.string().trim().optional(),
});

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rand3 = () =>
  Array.from(
    { length: 3 },
    () => ALPHA[Math.floor(Math.random() * ALPHA.length)],
  ).join("");

export default function BuyersScreen() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState(false);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, "invites"),
      (snap) => {
        setInvites(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              code: d.id,
              tower: x.tower,
              unit: x.unit,
              name: x.name,
              phone: x.phone,
              claimed: !!x.claimedBy,
              expired: !x.claimedBy && x.expiresAt.toMillis() < Date.now(),
            };
          }),
        );
        setError(false);
      },
      () => setError(true),
    );
  }, []);

  const byTower = useMemo(() => {
    const m: Record<string, Invite[]> = {};
    (invites ?? []).forEach((i) => (m[i.tower] ??= []).push(i));
    Object.values(m).forEach((l) =>
      l.sort((a, b) =>
        a.unit.localeCompare(b.unit, undefined, { numeric: true }),
      ),
    );
    return m;
  }, [invites]);

  async function importCsv() {
    setMsg("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      setImporting(true);

      const text = await (await fetch(res.assets[0].uri)).text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      const existing = await getDocs(collection(db, "invites"));
      const codes = new Set(existing.docs.map((d) => d.id));
      const units = new Set(
        existing.docs.map((d) => `${d.data().tower}-${d.data().unit}`),
      );

      const good: { code: string; data: any }[] = [];
      let bad = 0,
        dup = 0;
      for (const raw of parsed.data) {
        const r = Row.safeParse(raw);
        if (!r.success) {
          bad++;
          continue;
        }
        const tower = r.data.tower.toUpperCase();
        const unit = r.data.unit.toUpperCase();
        const key = `${tower}-${unit}`;
        if (units.has(key)) {
          dup++;
          continue;
        }
        let code = `${tower}${unit}-${rand3()}`;
        while (codes.has(code)) code = `${tower}${unit}-${rand3()}`;
        codes.add(code);
        units.add(key);
        good.push({
          code,
          data: {
            tower,
            unit,
            name: r.data.name,
            phone: r.data.phone,
            config: r.data.config || "3BHK",
            expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000),
            claimedBy: null,
            claimedAt: null,
          },
        });
      }

      for (let i = 0; i < good.length; i += 400) {
        const b = writeBatch(db);
        good
          .slice(i, i + 400)
          .forEach(({ code, data }) => b.set(doc(db, "invites", code), data));
        await b.commit();
      }
      setMsg(
        `Imported ${good.length} buyers. Skipped ${dup} duplicate units and ${bad} invalid rows.`,
      );
    } catch (e) {
      console.warn("import failed", e);
      setMsg(
        "Import failed. Check the file has tower, unit, name, phone columns.",
      );
    } finally {
      setImporting(false);
    }
  }

  const total = invites?.length ?? 0;
  const joined = (invites ?? []).filter((i) => i.claimed).length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Buyers</Text>
        <Pressable
          onPress={async () => {
            await signOut(auth);
            router.replace("/");
          }}
        >
          <Text style={{ color: "#208AEF" }}>Sign out</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={importCsv}
        disabled={importing}
        style={{
          backgroundColor: "#222",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {importing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            Import buyers from CSV
          </Text>
        )}
      </Pressable>
      <Text style={{ color: "#666", fontSize: 12 }}>
        Columns: tower, unit, name, phone (optional: config, e.g. 3BHK)
      </Text>
      {!!msg && <Text style={{ color: "#065f46" }}>{msg}</Text>}

      {error ? (
        <Text style={{ color: "#c0392b" }}>
          Couldn't load buyers. Check your connection.
        </Text>
      ) : invites === null ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : total === 0 ? (
        <Text style={{ color: "#666", marginTop: 20 }}>
          No buyers yet. Import a CSV to create invite codes.
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 15, color: "#444" }}>
            {joined} of {total} buyers have joined
          </Text>
          {Object.keys(byTower)
            .sort()
            .map((t) => {
              const list = byTower[t];
              const j = list.filter((i) => i.claimed).length;
              const isOpen = open === t;
              return (
                <View
                  key={t}
                  style={{ backgroundColor: "#f5f7fa", borderRadius: 12 }}
                >
                  <Pressable
                    onPress={() => setOpen(isOpen ? null : t)}
                    style={{
                      padding: 14,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ fontSize: 17, fontWeight: "700" }}>
                      Tower {t}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontWeight: "600" }}>
                        {j}/{list.length} joined
                      </Text>
                      <AppIcon
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#222"
                      />
                    </View>
                  </Pressable>
                  {isOpen &&
                    list.map((i) => (
                      <View
                        key={i.code}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: "#e5e7eb",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text style={{ fontWeight: "600" }}>
                            {i.tower}-{i.unit} · {i.name}
                          </Text>
                          <Text
                            style={{
                              color: i.claimed
                                ? "#065f46"
                                : i.expired
                                  ? "#c0392b"
                                  : "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {i.claimed
                              ? "Joined"
                              : i.expired
                                ? "Expired"
                                : "Invited"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginTop: 2,
                          }}
                        >
                          <Text style={{ color: "#666" }}>{i.phone}</Text>
                          {!i.claimed && (
                            <Pressable
                              onPress={() =>
                                Share.share({
                                  message: `Your Gatehood invite code: ${i.code}`,
                                })
                              }
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Text
                                selectable
                                style={{ color: "#208AEF", fontWeight: "700" }}
                              >
                                {i.code}
                              </Text>
                              <AppIcon name="share" size={14} color="#208AEF" />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    ))}
                </View>
              );
            })}
        </>
      )}
    </ScrollView>
  );
}
