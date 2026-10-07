export function servicePriceLabel(listing: {price: number | null; currency_code: string; attributes?: {price_mode?: string}}) {
  if(listing.price == null || listing.attributes?.price_mode === "quote") return "Ask for a quote";
  const amount=new Intl.NumberFormat("en-NG",{style:"currency",currency:listing.currency_code || "NGN",maximumFractionDigits:0}).format(listing.price);
  return listing.attributes?.price_mode === "from" ? `From ${amount}` : amount;
}
