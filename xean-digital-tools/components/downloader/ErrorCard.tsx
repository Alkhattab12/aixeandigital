export default function ErrorCard({ title, message, onRetry, requestId }: { title: string; message: string; onRetry?: () => void; requestId?: string }) {
  return (
    <section className="card err" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? <button className="btn" onClick={onRetry}>Try Again</button> : null}
      {requestId ? <small>Reference: {requestId}</small> : null}
    </section>
  );
}
