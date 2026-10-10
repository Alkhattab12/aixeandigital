import type { NormalizedDownload } from "@/types";
import { DownloadIcon } from "@/components/ui/Icons";

export default function FormatOption({ d, onDownload }: { d: NormalizedDownload; onDownload: (d: NormalizedDownload) => void }) {
  const badge = d.format ? d.format.toUpperCase() : d.type.toUpperCase();
  return (
    <a className="fmt" href={d.url} target="_blank" rel="noopener noreferrer" download onClick={() => onDownload(d)}>
      <span className="badge">{badge}</span>
      <span className="q">{d.quality ?? "Original"}</span>
      {d.size ? <span className="s">{d.size}</span> : null}
      <span className="go"><DownloadIcon /></span>
    </a>
  );
}
