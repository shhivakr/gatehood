import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppIcon } from "@/components/app-icon";

type N = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  audience: { type: string; towers: string[]; units: string[] };
  audienceKeys: string[];
};
type Who = {
  total: number;
  read: number;
  unread: {
    id: string;
    name: string;
    tower: string;
    unit: string;
    phone: string;
  }[];
};

const PAGE = 15;

function audienceLabel(n: N) {
  if (n.audience.type === "all") return "Whole project";
  if (n.audience.type === "towers")
    return `Towers ${n.audience.towers.join(", ")}`;
  return `Units ${n.audience.units.join(", ")}`;
}

function ReadCount({ id }: { id: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    getCountFromServer(collection(db, "notices", id, "reads"))
      .then((s) => setN(s.data().count))
      .catch(() => {});
  }, [id]);
  return <Text style={{ fontWeight: "700" }}>{n === null ? "…" : n} read</Text>;
}

export default function Notices() {
  const [pages, setPages] = useState(1);
  const [list, setList] = useState<N[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [who, setWho] = useState<Who | null>(null);
  const [whoLoading, setWhoLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "notices"),
      orderBy("pinned", "desc"),
      orderBy("createdAt", "desc"),
      limit(pages * PAGE),
    );
    return onSnapshot(
      q,
      (snap) => {
        setList(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              title: x.title,
              body: x.body,
              pinned: !!x.pinned,
              createdAt: x.createdAt?.toMillis?.() ?? Date.now(),
              audience: x.audience,
              audienceKeys: x.audienceKeys ?? [],
            };
          }),
        );
        setError(false);
      },
      () => setError(true),
    );
  }, [pages, retry]);

  async function toggle(n: N) {
    try {
      await updateDoc(doc(db, "notices", n.id), { pinned: !n.pinned });
    } catch (e) {
      console.warn(e);
    }
  }

  async function expand(n: N) {
    if (open === n.id) {
      setOpen(null);
      return;
    }
    setOpen(n.id);
    setWho(null);
    setWhoLoading(true);
    try {
      const [bs, rs] = await Promise.all([
        getDocs(collection(db, "buyers")),
        getDocs(collection(db, "notices", n.id, "reads")),
      ]);
      const read = new Set(rs.docs.map((d) => d.id));
      const inAudience = bs.docs.filter((d) => {
        const b = d.data();
        return (
          n.audienceKeys.includes("all") ||
          n.audienceKeys.includes(`tower:${b.tower}`) ||
          n.audienceKeys.includes(`unit:${b.tower}-${b.unit}`)
        );
      });
      setWho({
        total: inAudience.length,
        read: inAudience.filter((d) => read.has(d.id)).length,
        unread: inAudience
          .filter((d) => !read.has(d.id))
          .map((d) => ({ id: d.id, ...(d.data() as any) })),
      });
    } catch (e) {
      console.warn(e);
    } finally {
      setWhoLoading(false);
    }
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Text style={{ color: "#c0392b" }}>Couldn't load notices.</Text>
        <Pressable onPress={() => setRetry((r) => r + 1)}>
          <Text style={{ color: "#208AEF", fontWeight: "600" }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (list === null) return <ActivityIndicator style={{ marginTop: 60 }} />;
  if (list.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>No notices yet. Post one from the Post tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      ListFooterComponent={
        list.length >= pages * PAGE ? (
          <Pressable
            onPress={() => setPages((p) => p + 1)}
            style={{ alignItems: "center", padding: 14 }}
          >
            <Text style={{ color: "#208AEF", fontWeight: "600" }}>
              Load more
            </Text>
          </Pressable>
        ) : undefined
      }
      renderItem={({ item: n }) => (
        <View
          style={{ backgroundColor: "#f5f7fa", borderRadius: 12, padding: 14 }}
        >
          <Pressable onPress={() => expand(n)}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                }}
              >
                {n.pinned && <AppIcon name="pin" size={15} color="#b45309" />}
                <Text style={{ fontSize: 16, fontWeight: "700", flex: 1 }}>
                  {n.title}
                </Text>
              </View>
              <ReadCount id={n.id} />
            </View>
            <Text style={{ color: "#666", marginTop: 2 }}>
              {audienceLabel(n)} · {new Date(n.createdAt).toLocaleDateString()}
            </Text>
          </Pressable>

          {open === n.id && (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={{ color: "#444" }}>{n.body}</Text>
              <Pressable onPress={() => toggle(n)}>
                <Text style={{ color: "#208AEF", fontWeight: "600" }}>
                  {n.pinned ? "Unpin" : "Pin to top"}
                </Text>
              </Pressable>
              {whoLoading || !who ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Text style={{ fontWeight: "700", marginTop: 6 }}>
                    {who.read} of {who.total} joined buyers have read it
                  </Text>
                  {who.unread.length === 0 ? (
                    <Text style={{ color: "#065f46" }}>
                      Everyone has read this.
                    </Text>
                  ) : (
                    <>
                      <Text style={{ color: "#92400e", fontWeight: "600" }}>
                        Hasn't read ({who.unread.length}):
                      </Text>
                      {who.unread.map((b) => (
                        <Text key={b.id} style={{ color: "#444" }}>
                          {b.tower}-{b.unit} · {b.name} · {b.phone}
                        </Text>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      )}
    />
  );
}
