import { Platform } from "react-native";
import { initializeApp, getApps } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import type { Auth, Persistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { initializeAuth, getAuth } = firebaseAuth;
const getReactNativePersistence = (
  firebaseAuth as typeof firebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  });

let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(
      app,
      getReactNativePersistence
        ? { persistence: getReactNativePersistence(AsyncStorage) }
        : undefined,
    );
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/already-initialized") {
      auth = getAuth(app); // already initialised (fast refresh)
    } else {
      throw err;
    }
  }
}

export { auth };
export const db = getFirestore(app);
