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
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap');
        .fj-card { transition: transform .25s ease, box-shadow .25s ease; -webkit-tap-highlight-color: transparent; }
        .fj-card:active { transform: scale(0.96); }
        .fj-glass { transition: transform .2s ease; -webkit-tap-highlight-color: transparent; }
        .fj-glass:active { transform: scale(0.92); }
      `}</style>

      <div style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.logoGlow} />
          <img src="/icons/icon-192.png" alt="" style={styles.logo} />
        </div>
        <div style={styles.title}>Farms Jo</div>
        <div style={styles.titleRule} />
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
        {(farms || []).map((f) => (
          <Link key={f.id} to={`/farm/${f.id}`} className="fj-card" style={styles.card}>
            {f.coverPhoto ? (
              <img src={f.coverPhoto} alt={f.name} style={{ ...styles.cardImg, objectPosition: `center ${f.coverCropPosition}%` }} />
            ) : (
              <div style={styles.cardImgPlaceholder} />
            )}
            <div style={styles.cardScrim} />
            <div style={styles.cardBody}>
              <div style={styles.cardName}>{translateFarmName(f.name, lang)}</div>
              {f.location && (
                <div style={styles.cardLoc}>
                  <MapPin size={11} /> {f.location}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Tajawal', sans-serif",
    background: "linear-gradient(180deg, #F6F1E5 0%, #EBE3CD 55%, #E4DABF 100%)",
    color: "#20261B",
    minHeight: "100svh",
    padding: "28px 16px 44px",
    boxSizing: "border-box",
    touchAction: "manipulation",
  },
  header: { maxWidth: 480, margin: "0 auto 26px", textAlign: "center" },
  brandRow: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  logoGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(130,173,87,0.35) 0%, rgba(130,173,87,0) 70%)",
  },
  logo: { position: "relative", width: 84, height: 84, borderRadius: 22, boxShadow: "0 14px 28px -10px rgba(35,41,31,0.4)", border: "1px solid rgba(255,255,255,0.6)" },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 30, letterSpacing: "-0.3px", color: "#1D2317" },
  titleRule: { width: 40, height: 3, borderRadius: 3, background: "linear-gradient(90deg, #BC6C25, #E3A34E)", margin: "10px auto 0" },
  subtitle: { fontSize: 13.5, color: "#6B6355", marginTop: 10, fontWeight: 500 },
  shareBtn: {
    position: "fixed", top: 16, left: 16, zIndex: 60,
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 40, height: 40, border: "1px solid rgba(255,255,255,0.6)",
    background: "rgba(247,243,233,0.65)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    borderRadius: "50%", color: "#3A3428", cursor: "pointer",
    boxShadow: "0 6px 16px -6px rgba(35,29,16,0.3)",
  },
  langSwitch: {
    position: "fixed", top: 16, right: 16, zIndex: 60, display: "flex", gap: 2,
    border: "1px solid rgba(255,255,255,0.6)", background: "rgba(247,243,233,0.65)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    borderRadius: 24, padding: 3, boxShadow: "0 6px 16px -6px rgba(35,29,16,0.3)",
  },
  langOption: { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", fontSize: 16, cursor: "pointer", opacity: 0.4, transition: "opacity .2s, background .2s" },
  langOptionActive: { opacity: 1, background: "#FFFFFF", boxShadow: "0 2px 6px rgba(35,41,31,0.18)" },
  loading: { textAlign: "center", color: "#6B6355", padding: 30 },
  grid: { maxWidth: 480, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 },
  card: {
    position: "relative", display: "block", textDecoration: "none", color: "inherit",
    borderRadius: 20, overflow: "hidden", aspectRatio: "4 / 5",
    boxShadow: "0 16px 30px -14px rgba(30,25,12,0.45)",
    border: "1px solid rgba(255,255,255,0.5)",
  },
  cardImg: { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 75%" },
  cardImgPlaceholder: { position: "absolute", inset: 0, background: "#DAD3BE" },
  cardScrim: { position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(16,13,6,0.88) 0%, rgba(16,13,6,0.32) 42%, rgba(16,13,6,0) 65%)" },
  cardBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 12px" },
  cardName: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15.5, color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.35)" },
  cardLoc: { fontSize: 11, color: "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
};
