import { calendarClientFromRefreshToken } from "../_lib/googleAuth.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { createWatchChannel, stopWatchChannel } from "../_lib/calendarWatch.js";

const RENEW_WITHIN_MS = 2 * 24 * 60 * 60 * 1000; // renew anything expiring within 2 days

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).end();
      return;
    }
  }

  const db = supabaseAdmin();
  const { data: connections, error } = await db
    .from("farm_google_calendars")
    .select("farm_id, refresh_token, calendar_id, watch_channel_id, watch_resource_id, watch_expiration");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const now = Date.now();
  const results = [];

  for (const conn of connections || []) {
    const expiresAt = conn.watch_expiration ? new Date(conn.watch_expiration).getTime() : 0;
    if (expiresAt - now > RENEW_WITHIN_MS) {
      results.push({ farmId: conn.farm_id, renewed: false });
      continue;
    }
    try {
      const calendar = calendarClientFromRefreshToken(conn.refresh_token);
      const calendarId = conn.calendar_id || "primary";
      await stopWatchChannel(calendar, conn.watch_channel_id, conn.watch_resource_id);
      const watch = await createWatchChannel(calendar, calendarId, conn.farm_id);
      await db
        .from("farm_google_calendars")
        .update({
          watch_channel_id: watch.channelId,
          watch_resource_id: watch.resourceId,
          watch_channel_token: watch.channelToken,
          watch_expiration: watch.expiration,
        })
        .eq("farm_id", conn.farm_id);
      results.push({ farmId: conn.farm_id, renewed: true });
    } catch (e) {
      console.error(`Failed to renew calendar watch for farm ${conn.farm_id}:`, e.message);
      results.push({ farmId: conn.farm_id, renewed: false, error: e.message });
    }
  }

  res.status(200).json({ results });
}
