import { calendarClientFromRefreshToken } from "../_lib/googleAuth.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { bestSlotForEvent } from "../_lib/slotMatch.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const channelId = req.headers["x-goog-channel-id"];
  const resourceState = req.headers["x-goog-resource-state"];
  const channelToken = req.headers["x-goog-channel-token"];

  if (!channelId) {
    res.status(200).end();
    return;
  }

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from("farm_google_calendars")
    .select("farm_id, refresh_token, calendar_id, sync_token, watch_channel_token")
    .eq("watch_channel_id", channelId)
    .maybeSingle();

  // Unknown channel or token mismatch — ack so Google stops retrying, but do nothing.
  if (!conn || conn.watch_channel_token !== channelToken) {
    res.status(200).end();
    return;
  }

  // Google requires a fast response; do the actual sync after acknowledging.
  res.status(200).end();

  if (resourceState === "sync") return; // initial handshake right after watch creation, no changes yet

  try {
    await syncFarmCalendar(db, conn);
  } catch (e) {
    console.error("Calendar webhook sync error:", e);
  }
}

async function syncFarmCalendar(db, conn) {
  const calendar = calendarClientFromRefreshToken(conn.refresh_token);
  const calendarId = conn.calendar_id || "primary";

  let events = [];
  let nextSyncToken = null;
  let pageToken;

  async function listAll(useSyncToken) {
    events = [];
    pageToken = undefined;
    do {
      const res = await calendar.events.list({
        calendarId,
        singleEvents: true,
        pageToken,
        syncToken: useSyncToken ? conn.sync_token || undefined : undefined,
      });
      events = events.concat(res.data.items || []);
      pageToken = res.data.nextPageToken || undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    } while (pageToken);
  }

  try {
    await listAll(true);
  } catch (e) {
    if (e.code === 410) {
      // Sync token expired on Google's side — fall back to a full listing.
      await listAll(false);
    } else {
      throw e;
    }
  }

  for (const event of events) {
    const isAppEvent = !!event.extendedProperties?.private?.farmsJoSlotKey;

    if (event.status === "cancelled") {
      // The event is gone from Google Calendar either way — free the slot on the site.
      await db.from("bookings").delete().eq("farm_id", conn.farm_id).eq("google_event_id", event.id);
      continue;
    }

    if (isAppEvent) continue; // driven by the app itself, already reflected in bookings

    const start = event.start?.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) continue; // skip all-day events, no slot to map them to

    const match = bestSlotForEvent(start, end);
    if (!match) continue;

    const { data: existing } = await db
      .from("bookings")
      .select("google_event_id")
      .eq("farm_id", conn.farm_id)
      .eq("slot_key", match.slotKey)
      .maybeSingle();
    // Slot already holds a different booking (a real customer booking, or another
    // Google event) — never clobber it, just leave the site's existing data as-is.
    if (existing && existing.google_event_id !== event.id) continue;

    // The event may have moved to a different date/slot since we last saw it.
    await db
      .from("bookings")
      .delete()
      .eq("farm_id", conn.farm_id)
      .eq("google_event_id", event.id)
      .neq("slot_key", match.slotKey);

    await db.from("bookings").upsert(
      {
        farm_id: conn.farm_id,
        slot_key: match.slotKey,
        customer: event.summary || "حجز من قوقل كالندر",
        phone: "",
        base: 0,
        start_date: match.startDate,
        start_time: match.startTime,
        end_date: match.endDate,
        end_time: match.endTime,
        guest_count: 0,
        google_event_id: event.id,
        source: "google",
      },
      { onConflict: "farm_id,slot_key" }
    );
  }

  if (nextSyncToken) {
    await db.from("farm_google_calendars").update({ sync_token: nextSyncToken }).eq("farm_id", conn.farm_id);
  }
}
