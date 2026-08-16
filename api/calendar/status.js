import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const farmId = req.query.farmId;
  if (!farmId) {
    res.status(400).json({ error: "Missing farmId" });
    return;
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("farm_google_calendars")
    .select("connected_email")
    .eq("farm_id", farmId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ connected: !!data, email: data?.connected_email || null });
}
