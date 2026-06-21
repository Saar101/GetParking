import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  initializeAuth,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTPAW0HtLGrznGcmCn0eTSNnJJG8ZA8Ak",
  authDomain: "getparking-81f41.firebaseapp.com",
  projectId: "getparking-81f41",
  storageBucket: "getparking-81f41.firebasestorage.app",
  messagingSenderId: "179171539484",
  appId: "1:179171539484:web:e55e9777d90a7b726b3dd9",
  measurementId: "G-MZ6YV657YY",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// ✅ Force long polling (stronger than auto-detect)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, browserSessionPersistence],
});
