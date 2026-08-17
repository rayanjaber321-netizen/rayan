import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, CheckCircle2, Sprout } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { useLang, t } from "./i18n.js";
import { usePreventPinchZoom } from "./usePreventZoom.js";

export default function ListYourFarm() {
  const [lang, setLang] = useLang();
  usePreventPinchZoom();

  const [form, setForm] = useState({ name: "", phone: "", propertyName: "", propertyType: "farm", location: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const ready = form.name.trim() && form.phone.trim() && form.propertyName.trim();

  async function submit(e) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("owner_leads").insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      property_name: form.propertyName.trim(),
      property_type: form.propertyType,
      location: form.location.trim() || null,
      message: form.message.trim() || null,
    });
    setSubmitting(false);
    if (insertError) {
      console.error("owner lead insert error:", insertError);
      setError(t(lang, "listYourFarmError"));
      return;
    }
    setDone(true);
  }

  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap');
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      <div style={styles.topRow}>
        <Link to="/" style={styles.backLink}><BackIcon size={16} /> {t(lang, "backToList")}</Link>
        <div className="fj-glass" style={styles.langSwitch}>
          <button onClick={() => setLang("ar")} style={{ ...styles.langOption, ...(lang === "ar" ? styles.langOptionActive : {}) }} aria-label="العربية">🇯🇴</button>
          <button onClick={() => setLang("en")} style={{ ...styles.langOption, ...(lang === "en" ? styles.langOptionActive : {}) }} aria-label="English">🇺🇸</button>
        </div>
      </div>

      <div style={styles.wrap}>
        <div style={styles.iconBadge}><Sprout size={26} color="#BC6C25" /></div>
        <div style={styles.title}>{t(lang, "listYourFarmTitle")}</div>
        <div style={styles.subtitle}>{t(lang, "listYourFarmSubtitle")}</div>

        {done ? (
          <div style={styles.successBox}>
            <CheckCircle2 size={38} color="#4C7A3D" />
            <div style={styles.successTitle}>{t(lang, "listYourFarmSuccessTitle")}</div>
            <div style={styles.successText}>{t(lang, "listYourFarmSuccessText")}</div>
          </div>
        ) : (
          <form onSubmit={submit} style={styles.form}>
            <input className="fc-input" style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t(lang, "namePlaceholder")} />
            <input className="fc-input" style={styles.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t(lang, "phonePlaceholder")} type="tel" />
            <input className="fc-input" style={styles.input} value={form.propertyName} onChange={(e) => setForm({ ...form, propertyName: e.target.value })} placeholder={t(lang, "propertyNamePlaceholder")} />

            <div style={styles.typeRow}>
              <button type="button" onClick={() => setForm({ ...form, propertyType: "farm" })} style={{ ...styles.typeBtn, ...(form.propertyType === "farm" ? styles.typeBtnActive : {}) }}>{t(lang, "propertyTypeFarm")}</button>
              <button type="button" onClick={() => setForm({ ...form, propertyType: "chalet" })} style={{ ...styles.typeBtn, ...(form.propertyType === "chalet" ? styles.typeBtnActive : {}) }}>{t(lang, "propertyTypeChalet")}</button>
              <button type="button" onClick={() => setForm({ ...form, propertyType: "villa" })} style={{ ...styles.typeBtn, ...(form.propertyType === "villa" ? styles.typeBtnActive : {}) }}>{t(lang, "propertyTypeVilla")}</button>
            </div>

            <input className="fc-input" style={styles.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t(lang, "locationPlaceholder")} />
            <textarea className="fc-input" style={{ ...styles.input, minHeight: 80, resize: "vertical", paddingTop: 10 }} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t(lang, "notesPlaceholder")} />

            {error && <div style={styles.errorText}>{error}</div>}

            <button type="submit" disabled={!ready || submitting} style={{ ...styles.submitBtn, opacity: ready && !submitting ? 1 : 0.5 }}>
              {submitting ? t(lang, "loading") : t(lang, "listYourFarmSubmit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Tajawal', sans-serif",
    background: "radial-gradient(circle at 50% 0%, #F8F3E7 0%, #EFE7D2 45%, #E2D7BB 100%)",
    color: "#20261B",
    minHeight: "100svh",
    padding: "20px 16px 48px",
    boxSizing: "border-box",
    touchAction: "manipulation",
  },
  topRow: { maxWidth: 420, margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  backLink: { display: "inline-flex", alignItems: "center", gap: 5, color: "#6B6355", fontSize: 13.5, fontWeight: 600, textDecoration: "none" },
  langSwitch: {
    display: "flex", gap: 2, border: "1px solid rgba(255,255,255,0.7)", background: "rgba(250,246,236,0.7)",
    borderRadius: 26, padding: 4,
  },
  langOption: { display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "transparent", fontSize: 14, cursor: "pointer", opacity: 0.4 },
  langOptionActive: { opacity: 1, background: "#FFFFFF", boxShadow: "0 3px 8px rgba(35,41,31,0.2)" },
  wrap: { maxWidth: 420, margin: "0 auto", textAlign: "center" },
  iconBadge: {
    width: 60, height: 60, borderRadius: "50%", margin: "0 auto 14px",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#FFFFFF", border: "1px solid #E9DFC4", boxShadow: "0 10px 22px -10px rgba(35,29,16,0.35)",
  },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 21, color: "#23291F" },
  subtitle: { fontSize: 13.5, color: "#6B6355", marginTop: 8, lineHeight: 1.6 },
  form: { display: "flex", flexDirection: "column", gap: 10, marginTop: 24, textAlign: "start" },
  input: {
    width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
    border: "1px solid #DED4B8", background: "#FFFFFF", color: "#23291F", fontSize: 14.5,
    fontFamily: "'Tajawal', sans-serif", outline: "none",
  },
  typeRow: { display: "flex", gap: 8 },
  typeBtn: {
    flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid #DED4B8", background: "#FFFFFF",
    color: "#6B6355", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Tajawal', sans-serif",
  },
  typeBtnActive: { background: "linear-gradient(135deg, #E3A34E, #BC6C25)", color: "#FFFFFF", borderColor: "transparent" },
  errorText: { color: "#791F1F", fontSize: 12.5, textAlign: "center" },
  submitBtn: {
    marginTop: 6, padding: "13px 0", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #E3A34E, #BC6C25)", color: "#FFFFFF",
    fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo', sans-serif",
    boxShadow: "0 14px 26px -12px rgba(188,108,37,0.6)",
  },
  successBox: {
    marginTop: 26, background: "#FFFFFF", border: "1px solid #E9DFC4", borderRadius: 16,
    padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
  },
  successTitle: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 17, color: "#23291F" },
  successText: { fontSize: 13.5, color: "#6B6355", lineHeight: 1.6 },
};
