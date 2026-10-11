import * as Notifications from "expo-notifications";

// Versioned once for the release: Android cannot change the sound or importance
// of a channel created by an earlier build. Never delete/recreate user channels.
export const ALERT_CHANNEL_ID = "atl-updates-v2";
export const SILENT_CHANNEL_ID = "orders-silent";

export async function ensureAndroidNotificationChannels() {
  const audible = {
    name: "Messages and updates",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 180, 250],
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  };
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, audible);
  // Keep the legacy channel for backend versions which predate negotiation.
  await Notifications.setNotificationChannelAsync("orders", { ...audible, name: "Order updates" });
  await Notifications.setNotificationChannelAsync(SILENT_CHANNEL_ID, {
    name: "Messages and updates (silent)",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}
