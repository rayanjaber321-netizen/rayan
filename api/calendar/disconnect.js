import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { calendarClientFromRefreshToken } from "../_lib/googleAuth.js";
import { stopWatchChannel } from "../_lib/calendarWatch.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { farmId } = req.body || {};
  if (!farmId) {
    res.status(400).json({ error: "Missing farmId" });
    return;
  }

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from("farm_google_calendars")
    .select("refresh_token, watch_channel_id, watch_resource_id")
    .eq("farm_id", farmId)
    .maybeSingle();
  if (conn?.watch_channel_id) {
    const calendar = calendarClientFromRefreshToken(conn.refresh_token);
    await stopWatchChannel(calendar, conn.watch_channel_id, conn.watch_resource_id);
  }

  const { error } = await db.from("farm_google_calendars").delete().eq("farm_id", farmId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
