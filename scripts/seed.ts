import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "gatehood-db981";
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;

initializeApp(
  emulator ? { projectId } : { projectId, credential: applicationDefault() },
);
const db = getFirestore();

const TOWERS = ["A", "B", "C"];
const CONFIGS = ["2BHK", "3BHK", "3BHK", "4BHK"];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const rand = (n: number) =>
  Array.from(
    { length: n },
    () => ALPHA[Math.floor(Math.random() * ALPHA.length)],
  ).join("");
const NAMES = [
  "Aarav",
  "Diya",
  "Rohan",
  "Isha",
  "Kabir",
  "Meera",
  "Vikram",
  "Anaya",
  "Arjun",
  "Saanvi",
];

async function commitAll(ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function main() {
  const now = Date.now();
  const day = 86400000;

  await db.doc("projects/main").set({
    name: "Gatehood Residences",
    possessionDate: Timestamp.fromMillis(now + 240 * day),
    towerProgress: { A: 68, B: 45, C: 22 },
  });

  const invites: { code: string; data: any }[] = [];
  for (const t of TOWERS) {
    for (let floor = 1; floor <= 5; floor++) {
      for (let u = 1; u <= 4; u++) {
        const unit = `${floor}${String(u).padStart(2, "0")}`;
        const code = `${t}${unit}-${rand(3)}`;
        invites.push({
          code,
          data: {
            tower: t,
            unit,
            name: NAMES[(floor + u) % NAMES.length],
            phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
            config: CONFIGS[u - 1],
            expiresAt: Timestamp.fromMillis(now + 30 * day),
            claimedBy: null,
            claimedAt: null,
          },
        });
      }
    }
  }
  invites[0].data.expiresAt = Timestamp.fromMillis(now - day); // expired
  invites[1].data.claimedBy = "seed-user"; // already used
  invites[1].data.claimedAt = Timestamp.fromMillis(now - day);
  await commitAll(
    invites.map(
      ({ code, data }) =>
        (b) =>
          b.set(db.doc(`invites/${code}`), data),
    ),
  );

  const topics = [
    "Site progress update",
    "Payment reminder",
    "Lift maintenance",
    "Water supply shutdown",
    "Possession timeline",
    "Parking allocation",
    "Society meeting",
    "Safety drill",
    "Handover documents",
    "Festival notice",
  ];
  const notices: any[] = [];
  for (let i = 0; i < 60; i++) {
    const kind = i % 3;
    const tower = TOWERS[i % 3];
    const audience =
      kind === 0
        ? { type: "all", towers: [], units: [] }
        : kind === 1
          ? { type: "towers", towers: [tower], units: [] }
          : {
              type: "units",
              towers: [],
              units: [`${tower}-${1 + (i % 5)}0${1 + (i % 4)}`],
            };
    const audienceKeys =
      kind === 0
        ? ["all"]
        : kind === 1
          ? audience.towers.map((t) => `tower:${t}`)
          : audience.units.map((u) => `unit:${u}`);
    notices.push({
      title: `${topics[i % topics.length]} #${i + 1}`,
      body: "Please read this notice carefully. Contact the site office for any questions.",
      pinned: i % 15 === 0,
      createdAt: Timestamp.fromMillis(now - i * 6 * 3600000),
      createdBy: "seed",
      audience,
      audienceKeys,
    });
  }
  await commitAll(
    notices.map((n) => (b) => b.set(db.collection("notices").doc(), n)),
  );

  let builderUid = process.env.BUILDER_UID;
  if (!builderUid && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const u = await getAuth()
      .createUser({ email: "builder@gatehood.test", password: "Shiva@123" })
      .catch(() => getAuth().getUserByEmail("builder@gatehood.test"));
    builderUid = u.uid;
  }
  if (builderUid) await db.doc(`admins/${builderUid}`).set({});

  console.log(`Seeded ${invites.length} invites, ${notices.length} notices.`);
  console.log(
    `Expired: ${invites[0].code} | Used: ${invites[1].code} | Valid: ${invites[2].code}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
