// Local emulator fixtures only. Never used by the deployed app.
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, setDoc, Timestamp } = require("firebase/firestore");
async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8089") throw new Error("Local Firestore emulator is required.");
  const env = await initializeTestEnvironment({ projectId: "demo-kabayan-social" });
  const people = [
    { username: "maya", displayName: "Maya Santos", email: "maya@example.test", bio: "Riyadh days, Manila heart. Coffee, little adventures, and good company.", text: "Small win today: ordered my coffee entirely in Arabic. The barista understood me on the first try! ☕\n\nProgress is progress, Kabayan." },
    { username: "paolo", displayName: "Paolo Reyes", email: "paolo@example.test", bio: "Finding pieces of home in Jeddah. Weekend cook and sunset chaser.", text: "Made sinigang after a long shift. One spoonful and suddenly the day feels a little lighter.\n\nAnong comfort food ninyo after work? 🍲" },
    { username: "ana", displayName: "Ana Cruz", email: "ana@example.test", bio: "One day at a time. Dammam 📍", text: "To everyone starting a new week far from home: ingat palagi. Someone back home is proud of you. 💙" },
  ];
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [index, person] of people.entries()) {
        let response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: person.email, password: "KabayanDemo123!", returnSecureToken: true }) });
        let account = await response.json();
        if (!response.ok) {
          response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: person.email, password: "KabayanDemo123!", returnSecureToken: true }) });
          account = await response.json();
        }
        if (!response.ok) throw new Error("Could not create local fixture account.");
        const uid = account.localId;
        await setDoc(doc(db, "users", uid), { username: person.username, displayName: person.displayName, email: person.email, role: index === 0 ? "admin" : "user", points: 20 });
        await setDoc(doc(db, "socialProfiles", uid), { username: person.username, displayName: person.displayName, bio: person.bio, photoPath: "", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        await setDoc(doc(db, "socialHandles", person.username), { uid });
        await setDoc(doc(db, "socialPosts", `preview-${index}`), { uid, text: person.text, createdAt: Timestamp.fromMillis(Date.now() - index * 3600000) });
      }
    });
    console.log("Local preview accounts and posts are ready. Login: maya@example.test / KabayanDemo123!");
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
