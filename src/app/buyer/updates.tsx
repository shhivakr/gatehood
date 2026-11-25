import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSession } from "@/lib/session";
import { FeedFilter, Notice, PAGE, keysFor } from "@/lib/feed";
import { AppIcon } from "@/components/app-icon";

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tower", label: "My tower" },
  { key: "unit", label: "My unit" },
];

export default function Updates() {
  const buyer = useSession((s) => s.buyer);
  const uid = useSession((s) => s.uid);

  const [filter, setFilter] = useState<FeedFilter>("all");
  const [pages, setPages] = useState(1);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [online, setOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const cacheKey = uid ? `feed:${uid}:${filter}` : "";
  const keys = useMemo(
    () => (buyer ? keysFor(filter, buyer) : []),
    [filter, buyer],
  );

  // connectivity
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOnline(!!s.isConnected && s.isInternetReachable !== false),
      ),
    [],
  );

  // this buyer's read state (live)
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, "buyers", uid, "reads"),
      (snap) => {
        setReadIds(new Set(snap.docs.map((d) => d.id)));
      },
      () => {},
    );
  }, [uid]);

  // saved feed, shown immediately while the live query connects
  useEffect(() => {
    if (!cacheKey) return;
    let cancelled = false;
    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const cached: Notice[] = JSON.parse(raw);
        setNotices((cur) => (cur.length ? cur : cached));
        setFromCache(true);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  // live feed: pinned first, then newest, growing by 15 per page
  useEffect(() => {
    if (!uid || keys.length === 0) return;
    setError(false);
    setLoadingMore(pages > 1);
    const q = query(
      collection(db, "notices"),
      where("audienceKeys", "array-contains-any", keys),
      orderBy("pinned", "desc"),
      orderBy("createdAt", "desc"),
      limit(pages * PAGE),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: Notice[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            title: x.title,
            body: x.body,
            pinned: !!x.pinned,
            createdAt: x.createdAt?.toMillis?.() ?? 0,
            audienceType: x.audience?.type ?? "all",
          };
        });
        setNotices(list);
        setLoading(false);
        setLoadingMore(false);
        setError(false);
        setFromCache(snap.metadata.fromCache);
        if (!snap.metadata.fromCache && cacheKey) {
          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify(list.slice(0, PAGE)),
          ).catch(() => {});
        }
      },
      (err) => {
        console.warn("feed error", err);
        setLoading(false);
        setLoadingMore(false);
        setError(true);
      },
    );
  }, [uid, keys, pages, retryKey, cacheKey]);

  function changeFilter(f: FeedFilter) {
    if (f === filter) return;
    setFilter(f);
    setPages(1);
    setNotices([]);
    setLoading(true);
    setExpanded(null);
  }

  async function openNotice(n: Notice) {
    setExpanded((cur) => (cur === n.id ? null : n.id));
    if (!uid || readIds.has(n.id)) return;
    setReadIds((prev) => new Set(prev).add(n.id)); // optimistic
    try {
      const b = writeBatch(db);
      b.set(doc(db, "notices", n.id, "reads", uid), {
        readAt: serverTimestamp(),
      });
      b.set(doc(db, "buyers", uid, "reads", n.id), {
        readAt: serverTimestamp(),
      });
      await b.commit();
    } catch (e) {
      console.warn("mark read failed", e);
    }
  }

  if (!buyer || !uid) return null;

  const hasMore = notices.length >= pages * PAGE;
  const showOfflineBanner =
    !online || (fromCache && notices.length > 0 && error);

  function retry() {
    setLoading(true);
    setError(false);
    setRetryKey((k) => k + 1);
  }

  function renderBody() {
    if (loading && notices.length === 0) {
      if (!online)
        return (
          <Message
            title="You're offline"
            text="Connect to the internet to load updates."
            onRetry={retry}
          />
        );
      return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
    }
    if (error && notices.length === 0) {
      return (
        <Message
          title="Couldn't load updates"
          text="Check your connection and try again."
          onRetry={retry}
        />
      );
    }
    if (notices.length === 0) {
      return (
        <Message
          title="No updates yet"
          text="Notices meant for you will show up here."
        />
      );
    }
    return (
      <FlatList
        data={notices}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore && !loadingMore && !loading) setPages((p) => p + 1);
        }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ margin: 16 }} />
          ) : hasMore ? (
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
        renderItem={({ item }) => {
          const unread = !readIds.has(item.id);
          const open = expanded === item.id;
          return (
            <Pressable
              onPress={() => openNotice(item)}
              style={{
                backgroundColor: unread ? "#eef6ff" : "#f5f7fa",
                borderRadius: 12,
                padding: 14,
                borderLeftWidth: 4,
                borderLeftColor: unread ? "#208AEF" : "transparent",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                {item.pinned && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <AppIcon name="pin" size={12} color="#b45309" />
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#b45309",
                        fontWeight: "700",
                      }}
                    >
                      PINNED
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 12, color: "#666" }}>
                  {item.audienceType === "all"
                    ? "Everyone"
                    : item.audienceType === "towers"
                      ? "Your tower"
                      : "Your unit"}
                </Text>
                {unread && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <AppIcon name="dot" size={8} color="#208AEF" />
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#208AEF",
                        fontWeight: "700",
                      }}
                    >
                      NEW
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{ fontSize: 16, fontWeight: unread ? "700" : "500" }}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={open ? undefined : 2}
                style={{ color: "#444", marginTop: 4 }}
              >
                {item.body}
              </Text>
              <Text style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => changeFilter(f.key)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: filter === f.key ? "#208AEF" : "#e5e7eb",
            }}
          >
            <Text
              style={{
                color: filter === f.key ? "#fff" : "#222",
                fontWeight: "600",
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {showOfflineBanner && (
        <View style={{ backgroundColor: "#fff4e5", padding: 8 }}>
          <Text style={{ textAlign: "center", color: "#92400e" }}>
            Offline: showing your last saved feed
          </Text>
        </View>
      )}
      {renderBody()}
    </View>
  );
}

function Message({
  title,
  text,
  onRetry,
}: {
  title: string;
  text: string;
  onRetry?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#666", textAlign: "center" }}>{text}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 8,
            backgroundColor: "#208AEF",
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
