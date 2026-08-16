import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Share, Check } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { useLang, t, translateFarmName } from "./i18n.js";
import { usePreventPinchZoom } from "./usePreventZoom.js";

export default function PublicFarmList() {
  const [farms, setFarms] = useState(null);
  const [shared, setShared] = useState(false);
  const [lang, setLang] = useLang();
  usePreventPinchZoom();

  async function shareSite() {
    const shareData = { title: "Farms Jo", text: t(lang, "shareText"), url: window.location.origin };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [farmsRes, photosRes] = await Promise.all([
        supabase.from("farms").select("*").order("created_at"),
        supabase.from("farm_photos").select("farm_id, url, is_cover, media_type, crop_position"),
      ]);
      if (cancelled) return;
      if (farmsRes.error) console.error("farms load error:", farmsRes.error);
      if (photosRes.error) console.error("photos load error:", photosRes.error);
      const photosByFarm = {};
      (photosRes.data || []).forEach((p) => {
        photosByFarm[p.farm_id] = photosByFarm[p.farm_id] || [];
        photosByFarm[p.farm_id].push(p);
      });
      const withPhotos = (farmsRes.data || []).map((f) => {
        // Videos can't render in a small <img> card thumbnail, so the list card only ever picks a photo.
        const farmPhotos = (photosByFarm[f.id] || []).filter((p) => p.media_type !== "video");
        const cover = farmPhotos.find((p) => p.is_cover) || farmPhotos[0] || null;
        return { ...f, coverPhoto: cover?.url || null, coverCropPosition: cover?.crop_position ?? 75 };
      });
      setFarms(withPhotos);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Playfair+Display:ital,wght@1,600&family=Tajawal:wght@400;500;700&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        @keyframes fjFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fjFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .fj-card { transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease; -webkit-tap-highlight-color: transparent; animation: fjFadeUp .7s cubic-bezier(.2,.8,.2,1) both; }
        .fj-card:active { transform: scale(0.955); }
        .fj-glass { transition: transform .2s ease, background .2s ease; -webkit-tap-highlight-color: transparent; }
        .fj-glass:active { transform: scale(0.9); }
        .fj-header { animation: fjFadeIn .7s ease both; }
      `}</style>

      <div className="fj-header" style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.logoGlow} />
          <div style={styles.logoRing}>
            <div style={styles.logoClip}>
              <img src="/icons/icon-192.png" alt="" style={styles.logo} />
              <div style={styles.logoScrim} />
              <div style={styles.logoBadge}>Farms Jo</div>
            </div>
          </div>
        </div>
        <div style={styles.subtitle}>{t(lang, "subtitle")}</div>
      </div>

      <button className="fj-glass" onClick={shareSite} style={styles.shareBtn} aria-label={t(lang, "share")}>
        {shared ? <Check size={16} /> : <Share size={16} />}
      </button>

      <div className="fj-glass" style={styles.langSwitch}>
        <button onClick={() => setLang("ar")} style={{ ...styles.langOption, ...(lang === "ar" ? styles.langOptionActive : {}) }} aria-label="العربية">🇯🇴</button>
        <button onClick={() => setLang("en")} style={{ ...styles.langOption, ...(lang === "en" ? styles.langOptionActive : {}) }} aria-label="English">🇺🇸</button>
      </div>

      {farms === null && <div style={styles.loading}>{t(lang, "loading")}</div>}
      {farms !== null && farms.length === 0 && <div style={styles.loading}>{t(lang, "noFarms")}</div>}

      <div style={styles.grid}>
        {(farms || []).map((f, idx) => (
          <div key={f.id} className="fj-card" style={{ ...styles.cardFrame, animationDelay: `${idx * 70}ms` }}>
            <Link to={`/farm/${f.id}`} style={styles.card}>
              {f.coverPhoto ? (
                <img src={f.coverPhoto} alt={f.name} style={{ ...styles.cardImg, objectPosition: `center ${f.coverCropPosition}%` }} />
              ) : (
                <div style={styles.cardImgPlaceholder} />
              )}
              <div style={styles.cardScrim} />
              <div style={styles.cardShine} />
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{translateFarmName(f.name, lang)}</div>
                {f.location && (
                  <div style={styles.cardLoc}>
                    <MapPin size={10} /> {f.location}
                  </div>
                )}
              </div>
            </Link>
          </div>
        ))}
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
    padding: "32px 16px 48px",
    boxSizing: "border-box",
    touchAction: "manipulation",
  },
  header: { maxWidth: 480, margin: "0 auto 30px", textAlign: "center" },
  brandRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 22 },
  logoGlow: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(130,173,87,0.4) 0%, rgba(188,108,37,0.12) 55%, rgba(130,173,87,0) 75%)",
  },
  logoRing: {
    position: "relative",
    padding: 4,
    borderRadius: 26,
    background: "linear-gradient(135deg, #E3A34E, #BC6C25)",
    boxShadow: "0 18px 34px -12px rgba(35,41,31,0.45)",
  },
  logoClip: { position: "relative", width: 92, height: 92, borderRadius: 22, overflow: "hidden", border: "2px solid #F8F3E7" },
  logo: { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "cover" },
  logoScrim: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,12,6,0) 45%, rgba(8,10,5,0.78) 100%)" },
  logoBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    textAlign: "center",
    whiteSpace: "nowrap",
    fontFamily: "'Playfair Display', serif",
    fontStyle: "italic",
    fontWeight: 600,
    fontSize: 13.5,
    color: "#FFFFFF",
    letterSpacing: "0.2px",
    textShadow: "0 2px 6px rgba(0,0,0,0.4)",
  },
  subtitle: { fontSize: 14, color: "#6B6355", marginTop: 4, fontWeight: 500, letterSpacing: "0.1px" },
  shareBtn: {
    position: "fixed", top: 16, left: 16, zIndex: 60,
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 42, height: 42, border: "1px solid rgba(255,255,255,0.7)",
    background: "rgba(250,246,236,0.55)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)",
    borderRadius: "50%", color: "#3A3428", cursor: "pointer",
    boxShadow: "0 10px 22px -8px rgba(35,29,16,0.35), inset 0 1px 0 rgba(255,255,255,0.6)",
  },
  langSwitch: {
    position: "fixed", top: 16, right: 16, zIndex: 60, display: "flex", gap: 2,
    border: "1px solid rgba(255,255,255,0.7)", background: "rgba(250,246,236,0.55)",
    backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)",
    borderRadius: 26, padding: 4,
    boxShadow: "0 10px 22px -8px rgba(35,29,16,0.35), inset 0 1px 0 rgba(255,255,255,0.6)",
  },
  langOption: { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", fontSize: 16, cursor: "pointer", opacity: 0.4, transition: "opacity .2s, background .2s" },
  langOptionActive: { opacity: 1, background: "#FFFFFF", boxShadow: "0 3px 8px rgba(35,41,31,0.2)" },
  loading: { textAlign: "center", color: "#6B6355", padding: 30 },
  grid: { maxWidth: 480, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 },
  cardFrame: {
    padding: 4, borderRadius: 29,
    background: "linear-gradient(135deg, #E3A34E, #BC6C25)",
    boxShadow: "0 3px 6px -2px rgba(30,25,12,0.2), 0 26px 40px -20px rgba(30,25,12,0.55)",
  },
  card: {
    position: "relative", display: "block", textDecoration: "none", color: "inherit",
    borderRadius: 25, overflow: "hidden", aspectRatio: "4 / 5",
    border: "2px solid #F8F3E7",
  },
  cardImg: { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 75%" },
  cardImgPlaceholder: { position: "absolute", inset: 0, background: "#DAD3BE" },
  cardScrim: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,12,6,0) 30%, rgba(9,10,5,0.55) 68%, rgba(7,8,4,0.92) 100%)" },
  cardShine: { position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))", pointerEvents: "none" },
  cardBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 13px" },
  cardName: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.2px", color: "#FFFFFF", textShadow: "0 2px 10px rgba(0,0,0,0.4)" },
  cardLoc: {
    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8,
    fontSize: 10.5, color: "rgba(255,255,255,0.92)", fontWeight: 500,
    background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
    borderRadius: 999, padding: "3px 9px",
  },
};
