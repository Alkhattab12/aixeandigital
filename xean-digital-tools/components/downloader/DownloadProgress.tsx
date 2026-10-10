interface Props { platformLabel: string; onCancel: () => void }

/**
 * The API is a single request, so only the stages we truly know are shown:
 * platform detection (done client-side, instantly) and extraction (in flight).
 * "Finding formats" completes the moment the response arrives.
 */
export default function DownloadProgress({ platformLabel, onCancel }: Props) {
  return (
    <section className="card progress" aria-live="polite" aria-busy="true">
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="orbit" aria-hidden />
        <div>
          <h3>Analyzing your link...</h3>
          <p style={{ margin: 0 }}>Analyzing {platformLabel} link — this can take a few seconds.</p>
        </div>
      </div>
      <ol className="steps">
        <li className="done"><span className="dot" />Detecting platform · {platformLabel}</li>
        <li className="active"><span className="dot" />Extracting media information</li>
        <li><span className="dot" />Finding available formats</li>
      </ol>
      <div className="bar" aria-hidden><i /></div>
      <div style={{ marginTop: 16 }}><button className="btn ghost small" onClick={onCancel}>Cancel</button></div>
    </section>
  );
}
