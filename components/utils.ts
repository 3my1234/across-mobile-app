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
    return withPortableImageFormat(`${API_URL}/api/v1/public/images/view/${encodeS3Key(raw)}`);
  }
  const m = "/api/v1/public/images/view/";
  const i = raw.indexOf(m);
  if (i >= 0) return withPortableImageFormat(`${API_URL}${raw.slice(i)}`);
  if (/^https:\/\/[^/]+\.s3[.-][^/]*amazonaws\.com\//i.test(raw)) {
    try {
      return withPortableImageFormat(`${API_URL}/api/v1/public/images/view/${encodeS3Key(decodeURIComponent(new URL(raw).pathname.replace(/^\/+/, "")))}`);
    } catch { return raw; }
  }
  return raw;
}

function withPortableImageFormat(url: string) {
  // Older catalogue objects may be AVIF. The public media endpoint converts
  // them to Android/iOS-safe JPEG; this versioned query also avoids a stale
  // Cloudflare entry that may still contain the original AVIF bytes.
  if (!/\.avif(?:$|\?)/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}format=portable-v1`;
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
    is_flash_sale: raw.is_flash_sale, flash_sale_price: raw.flash_sale_price,
    review_count: Number(raw.review_count || 0), average_rating: Number(raw.average_rating || 0),
    provider_id: raw.provider_id || "", fulfillment_mode: raw.fulfillment_mode || "atlantic_import",
    inventory_country_code: raw.inventory_country_code || raw.factory_details?.inventory_country_code || "",
    inventory_city: raw.inventory_city || raw.factory_details?.inventory_city || "",
    inventory_location: raw.inventory_location || raw.factory_details?.inventory_location || "",
    stock_state: raw.stock_state || raw.factory_details?.stock_state,
    handling_time_hours: Number(raw.handling_time_hours ?? raw.factory_details?.handling_time_hours ?? 0),
    delivery_min_days: Number(raw.delivery_min_days ?? raw.factory_details?.delivery_min_days ?? 0),
    delivery_max_days: Number(raw.delivery_max_days ?? raw.factory_details?.delivery_max_days ?? 0),
    delivery_methods: raw.delivery_methods ?? raw.factory_details?.delivery_methods ?? [],
    atlantic_last_mile: Boolean(raw.atlantic_last_mile ?? raw.factory_details?.atlantic_last_mile)
  };
}
