import crypto from "crypto";

function siteUrl() {
  return (process.env.GOOGLE_REDIRECT_URI || "").replace(/\/api\/auth\/google\/callback$/, "") || "https://farmsjo.co";
}

export async function fetchInitialSyncToken(calendar, calendarId) {
  let pageToken;
  let syncToken = null;
  do {
    const res = await calendar.events.list({ calendarId, singleEvents: true, pageToken });
    pageToken = res.data.nextPageToken || undefined;
    if (res.data.nextSyncToken) syncToken = res.data.nextSyncToken;
  } while (pageToken);
  return syncToken;
}

export async function createWatchChannel(calendar, calendarId, farmId) {
  const channelId = `farmsjo-${farmId}-${Date.now()}`;
  const channelToken = crypto.randomBytes(24).toString("hex");
  const expirationMs = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6 days — renewed daily via cron before this runs out
  const res = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${siteUrl()}/api/calendar/webhook`,
      token: channelToken,
      expiration: String(expirationMs),
    },
  });
  return {
    channelId: res.data.id,
    resourceId: res.data.resourceId,
    channelToken,
    expiration: res.data.expiration ? new Date(Number(res.data.expiration)).toISOString() : new Date(expirationMs).toISOString(),
  };
}

export async function stopWatchChannel(calendar, channelId, resourceId) {
  if (!channelId || !resourceId) return;
  try {
    await calendar.channels.stop({ requestBody: { id: channelId, resourceId } });
  } catch (e) {
    console.error("stopWatchChannel failed:", e.message);
  }
}
