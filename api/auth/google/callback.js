import { google } from "googleapis";
import { oauthClient, calendarClientFromRefreshToken } from "../../_lib/googleAuth.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { fetchInitialSyncToken, createWatchChannel } from "../../_lib/calendarWatch.js";

export default async function handler(req, res) {
  const { code, state: farmId, error } = req.query;

  function redirectToAdmin(status) {
    res.writeHead(302, { Location: `/admin?calendar=${status}` });
    res.end();
  }

  if (error || !code || !farmId) {
    redirectToAdmin("error");
    return;
  }

  try {
    const auth = oauthClient();
    const { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token) {
      // Google only sends a refresh_token on first consent; if missing, the
      // farm's Google account already granted access before without revoking.
      redirectToAdmin("error");
      return;
    }
    auth.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth });
    const { data: profile } = await oauth2.userinfo.get();

    const calendarId = "primary";
    const calendar = calendarClientFromRefreshToken(tokens.refresh_token);
    const syncToken = await fetchInitialSyncToken(calendar, calendarId);
    const watch = await createWatchChannel(calendar, calendarId, farmId);

    const db = supabaseAdmin();
    const { error: dbError } = await db.from("farm_google_calendars").upsert({
      farm_id: farmId,
      refresh_token: tokens.refresh_token,
      connected_email: profile.email || null,
      calendar_id: calendarId,
      sync_token: syncToken,
      watch_channel_id: watch.channelId,
      watch_resource_id: watch.resourceId,
      watch_channel_token: watch.channelToken,
      watch_expiration: watch.expiration,
    });
    if (dbError) throw dbError;

    redirectToAdmin("connected");
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    redirectToAdmin("error");
  }
}
