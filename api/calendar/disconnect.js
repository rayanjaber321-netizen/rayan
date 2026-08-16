import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

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
  const { error } = await db.from("farm_google_calendars").delete().eq("farm_id", farmId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
