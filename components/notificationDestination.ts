export type NotificationDestination =
  | {tab:"provider";route:string}
  | { tab: "messages"; mode: "chats" | "town-hall"; chatRoomId?:string; townHallRoomId?:string }
  | { tab: "services"; mode: "messages" | "requests" | "explore"; conversationId?: string }
  | { tab: "support"; ticketId?: string }
  | { tab: "track"; orderId?: string }
  | { tab: "account"; rewards: boolean };

// Inbox notifications wrap data; Expo supplies the same data already flattened.
export function notificationDestination(notification: any): NotificationDestination {
  let nested = notification?.data;
  if (typeof nested === "string") { try { nested = JSON.parse(nested); } catch { nested = {}; } }
  const data = { ...notification, ...(nested && typeof nested === "object" ? nested : {}) };
  const type = String(data.notification_type || data.type || "").toLowerCase();
  const id = (key: string) => typeof data[key] === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data[key]) ? data[key] : undefined;
  const conversationId = id("conversation_id"), ticketId = id("ticket_id"), orderId = id("order_id");
  if(id('provider_event_id')){
    const views=['overview','profile','verification','subscription','products','listings','messages','support','driver','requests','merchant-orders'];
    const view=views.includes(data.provider_view)?data.provider_view:'overview';
    const query=new URLSearchParams({view,event:id('provider_event_id')!});
    if(view==='messages'&&conversationId)query.set('conversation',conversationId);
    if(view==='requests'&&id('request_id'))query.set('request',id('request_id')!);
    if(view==='support'&&ticketId)query.set('ticket',ticketId);
    return {tab:'provider',route:query.toString()};
  }
  if(id("town_hall_room_id"))return {tab:"messages",mode:"town-hall",townHallRoomId:id("town_hall_room_id")};
  if(id("chat_room_id") || type==="social_message")return {tab:"messages",mode:"chats",chatRoomId:id("chat_room_id")};
  if(type==="friend_request")return {tab:"messages",mode:"chats"};
  if (conversationId || type === "marketplace_message") return { tab: "messages", mode: "chats", chatRoomId:conversationId };
  if (ticketId || type === "ticket_reply") return { tab: "support", ticketId };
  if (type.startsWith("xp_") || type.includes("reward") || typeof data.xp === "number") return { tab: "account", rewards: true };
  if (orderId || /order|payment|shipment|batch|delivery|tracking/.test(type)) return { tab: "track", orderId };
  if (type === "marketplace_request") return { tab: "services", mode: "requests" };
  if (/listing|service/.test(type)) return { tab: "services", mode: "explore" };
  return { tab: "account", rewards: false };
}
