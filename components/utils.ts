import { API_URL } from "./config";

export function money(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0
  }).format(value);
}

export function normalizeMediaUrl(rawUrl: string): string {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("user-uploads/")) {
    return `${API_URL}/api/v1/public/images/view/${encodeS3Key(raw)}`;
  }
  const m = "/api/v1/public/images/view/";
  const i = raw.indexOf(m);
  if (i >= 0) return `${API_URL}${raw.slice(i)}`;
  if (/^https:\/\/[^/]+\.s3[.-][^/]*amazonaws\.com\//i.test(raw)) {
    try {
      return `${API_URL}/api/v1/public/images/view/${encodeS3Key(decodeURIComponent(new URL(raw).pathname.replace(/^\/+/, "")))}`;
    } catch { return raw; }
  }
  return raw;
}

export function normalizeMediaUrls(urls: string[]) {
  return urls.map(normalizeMediaUrl).filter(Boolean);
}

export function encodeS3Key(key: string) {
  return String(key || "").replace(/^\/+/, "").split("/").map(p => encodeURIComponent(p)).join("/");
}

export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function fetchWithTimeout(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Number.parseInt(process.env.EXPO_PUBLIC_AUTH_TIMEOUT_MS || "12000", 10));
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

export async function uploadReviewImage(token: string, uri: string, mimeType: string, filename: string) {
  const pr = await fetch(`${API_URL}/api/v1/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename, mimeType, scope: "reviews" })
  });
  const pj = await pr.json().catch(() => ({}));
  if (!pr.ok) throw new Error(pj.message || pj.error || "Prep failed");
  const fr = await fetch(uri);
  const blob = await fr.blob();
  const ur = await fetch(pj.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: blob });
  if (!ur.ok) throw new Error("Upload failed");
  return pj.viewUrl || pj.publicUrl;
}

export function mapProduct(raw: any): import("./types").Product {
  return {
    id: raw.id, sku: raw.sku, title: raw.title, description: raw.description ?? "",
    category_path: raw.category_path ?? [], image_urls: normalizeMediaUrls(raw.image_urls ?? []),
    currency: raw.currency ?? "NGN", price: raw.price ?? raw.local_selling_price ?? 0,
    compare_at_price: raw.compare_at_price, inventory_count: raw.inventory_count ?? 0,
    origin_hub: raw.origin_hub ?? { id: "", name: "", city: "" },
    is_flash_sale: raw.is_flash_sale, flash_sale_price: raw.flash_sale_price
  };
}