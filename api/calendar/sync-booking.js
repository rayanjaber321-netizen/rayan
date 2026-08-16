import { calendarClientFromRefreshToken } from "../_lib/googleAuth.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { farmId, googleEventId, action, event } = req.body || {};
  if (!farmId || !action) {
    res.status(400).json({ error: "Missing farmId or action" });
    return;
  }

  const db = supabaseAdmin();
  const { data: conn, error: connError } = await db
    .from("farm_google_calendars")
    .select("refresh_token, calendar_id")
    .eq("farm_id", farmId)
    .maybeSingle();

  if (connError) {
    res.status(500).json({ error: connError.message });
    return;
  }
  if (!conn) {
    // Farm hasn't connected a Google Calendar — nothing to sync, not an error.
    res.status(200).json({ skipped: true });
    return;
  }

  const calendar = calendarClientFromRefreshToken(conn.refresh_token);
  const calendarId = conn.calendar_id || "primary";

  try {
    if (action === "delete") {
      if (googleEventId) {
        await calendar.events.delete({ calendarId, eventId: googleEventId }).catch((e) => {
          if (e.code !== 404 && e.code !== 410) throw e;
        });
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "upsert") {
      if (!event) {
        res.status(400).json({ error: "Missing event" });
        return;
      }
      const requestBody = {
        summary: event.title,
        description: event.description || "",
        start: { dateTime: event.startDateTime },
        end: { dateTime: event.endDateTime },
        extendedProperties: { private: { farmsJoSlotKey: event.slotKey || "" } },
      };

      let result;
      if (googleEventId) {
        result = await calendar.events.update({ calendarId, eventId: googleEventId, requestBody });
      } else {
        result = await calendar.events.insert({ calendarId, requestBody });
      }
      res.status(200).json({ googleEventId: result.data.id });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("Calendar sync error:", e);
    res.status(500).json({ error: e.message });
  }
}
