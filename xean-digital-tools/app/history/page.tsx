import HistoryList from "@/components/dashboard/HistoryList";

export const metadata = { title: "History — Xean Digital Tools" };

export default function HistoryPage() {
  return (
    <main className="page">
      <span className="blob b2" aria-hidden />
      <header className="hero rel"><span className="eyebrow">History</span><h1 style={{ fontSize: "clamp(32px,6vw,48px)" }}>Your downloads</h1>
        <p>Only metadata is kept — never the temporary direct links.</p></header>
      <div className="rel"><HistoryList /></div>
    </main>
  );
}
