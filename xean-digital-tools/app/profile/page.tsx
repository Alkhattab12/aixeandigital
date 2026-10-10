import Analytics from "@/components/dashboard/Analytics";

export const metadata = { title: "Profile — Xean Digital Tools" };

export default function ProfilePage() {
  return (
    <main className="page">
      <span className="blob b3" aria-hidden />
      <header className="hero rel"><span className="eyebrow">Profile</span><h1 style={{ fontSize: "clamp(32px,6vw,48px)" }}>Your activity</h1>
        <p>Anonymous and stored per browser. Sign-in isn&apos;t part of this version.</p></header>
      <div className="rel"><Analytics /></div>
    </main>
  );
}
