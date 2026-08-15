import { createClient } from "@supabase/supabase-js";

// The anon/publishable key is safe to expose in client-side code —
// access is enforced by Postgres row-level security policies, not by hiding this key.
const SUPABASE_URL = "https://ztoqyunqkgeknzuiyfno.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XBYbrdPoxVczP8k7pTh7-Q_pBMHzgqd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
