import type { ErrorCode } from "../types/index.ts";

export class DownloaderError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.name = "DownloaderError";
    this.code = code;
    this.status = status;
  }
}
