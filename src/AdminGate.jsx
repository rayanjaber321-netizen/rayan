import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

export default function AdminGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError("خطأ بالإيميل أو كلمة السر");
  }

  if (session === undefined) {
    return <div style={styles.wrap}><div style={styles.card}>...جاري التحميل</div></div>;
  }

  if (!session) {
    return (
      <div dir="rtl" style={styles.wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');`}</style>
        <form onSubmit={handleLogin} style={styles.card}>
          <div style={styles.title}>تسجيل دخول الإدارة</div>
          <input
            type="email"
            required
            placeholder="الإيميل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            required
            placeholder="كلمة السر"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.btn}>{loading ? "..." : "دخول"}</button>
        </form>
      </div>
    );
  }

  return children;
}

const styles = {
  wrap: { fontFamily: "'Tajawal', sans-serif", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAE4D6", padding: 16 },
  card: { background: "#F7F3E9", borderRadius: 14, padding: 24, width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box", border: "1px solid #DAD3BE" },
  title: { fontSize: 17, fontWeight: 700, color: "#23291F", marginBottom: 6, textAlign: "center" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", color: "#23291F", fontSize: 14, fontFamily: "'Tajawal', sans-serif" },
  error: { color: "#791F1F", fontSize: 12.5, textAlign: "center" },
  btn: { padding: "10px 12px", borderRadius: 9, border: "none", background: "#BC6C25", color: "#FFFFFF", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
