import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { supabase } from "./supabaseClient.js";

export default function PublicFarmList() {
  const [farms, setFarms] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [farmsRes, photosRes] = await Promise.all([
        supabase.from("farms").select("*").order("created_at"),
        supabase.from("farm_photos").select("farm_id, url, is_cover"),
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
        const farmPhotos = photosByFarm[f.id] || [];
        const cover = farmPhotos.find((p) => p.is_cover)?.url || farmPhotos[0]?.url || null;
        return { ...f, coverPhoto: cover };
      });
      setFarms(withPhotos);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div dir="rtl" style={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Tajawal:wght@400;500;700&display=swap');`}</style>
      <div style={styles.header}>
        <div style={styles.title}>مزارع للإيجار</div>
        <div style={styles.subtitle}>اختر مزرعة لتشوف الأسعار والأيام المتوفرة</div>
      </div>

      {farms === null && <div style={styles.loading}>جاري التحميل...</div>}
      {farms !== null && farms.length === 0 && <div style={styles.loading}>لا يوجد مزارع حالياً</div>}

      <div style={styles.grid}>
        {(farms || []).map((f) => (
          <Link key={f.id} to={`/farm/${f.id}`} style={styles.card}>
            {f.coverPhoto ? (
              <img src={f.coverPhoto} alt={f.name} style={styles.cardImg} />
            ) : (
              <div style={styles.cardImgPlaceholder} />
            )}
            <div style={styles.cardBody}>
              <div style={styles.cardName}>{f.name}</div>
              {f.location && (
                <div style={styles.cardLoc}>
                  <MapPin size={12} /> {f.location}
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
  page: { fontFamily: "'Tajawal', sans-serif", background: "#EAE4D6", color: "#23291F", minHeight: "100svh", padding: "24px 16px", boxSizing: "border-box" },
  header: { maxWidth: 480, margin: "0 auto 18px", textAlign: "center" },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 24 },
  subtitle: { fontSize: 13, color: "#6B6355", marginTop: 4 },
  loading: { textAlign: "center", color: "#6B6355", padding: 30 },
  grid: { maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 },
  card: { display: "block", textDecoration: "none", color: "inherit", background: "#F7F3E9", border: "1px solid #DAD3BE", borderRadius: 14, overflow: "hidden" },
  cardImg: { display: "block", width: "100%", height: 180, objectFit: "cover", objectPosition: "center 75%" },
  cardImgPlaceholder: { width: "100%", height: 180, background: "#DAD3BE" },
  cardBody: { padding: "12px 14px" },
  cardName: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 16 },
  cardLoc: { fontSize: 12, color: "#6B6355", display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
};
