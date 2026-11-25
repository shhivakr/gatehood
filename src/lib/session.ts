import { create } from "zustand";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Role = "builder" | "buyer" | "none";
export type Buyer = {
  tower: string;
  unit: string;
  name: string;
  phone: string;
  config: string;
  inviteCode: string;
};

type Session = {
  ready: boolean;
  uid: string | null;
  role: Role;
  buyer: Buyer | null;
  refresh: () => Promise<void>;
};

async function resolve(user: User | null) {
  if (!user) return { uid: null, role: "none" as Role, buyer: null };
  try {
    if (!user.isAnonymous) {
      const admin = await getDoc(doc(db, "admins", user.uid));
      return {
        uid: user.uid,
        role: (admin.exists() ? "builder" : "none") as Role,
        buyer: null,
      };
    }
    const snap = await getDoc(doc(db, "buyers", user.uid));
    if (snap.exists())
      return {
        uid: user.uid,
        role: "buyer" as Role,
        buyer: snap.data() as Buyer,
      };
  } catch (e) {
    console.warn("session resolve failed", e);
  }
  return { uid: user.uid, role: "none" as Role, buyer: null };
}

let resolveSeq = 0;

async function sync(user: User | null) {
  const id = ++resolveSeq;
  const next = await resolve(user);
  if (id === resolveSeq) {
    useSession.setState({ ...next, ready: true });
  }
}

export const useSession = create<Session>()(() => ({
  ready: false,
  uid: null,
  role: "none",
  buyer: null,
  refresh: () => sync(auth.currentUser),
}));

export function startSessionListener() {
  return onAuthStateChanged(auth, (user) => {
    void sync(user);
  });
}
