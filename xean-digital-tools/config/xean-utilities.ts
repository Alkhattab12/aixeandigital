/**
 * Other Xean Digital utilities that are NOT backed by scrapr.
 * The Tools page lists these separately and never labels them as scrapr-powered.
 * Add real tools here when they exist, e.g.:
 *   { id: "qr", name: "QR Generator", description: "Create QR codes", href: "/tools/qr" }
 */
export interface XeanUtility { id: string; name: string; description: string; href: string }
export const XEAN_UTILITIES: XeanUtility[] = [];
