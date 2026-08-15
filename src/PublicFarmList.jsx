import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { supabase } from "./supabaseClient.js";

export default function PublicFarmList() {
  const [farms, setFarms] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("farms")
      .select("*, farm_photos(url)")
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setFarms(data || []);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div dir="rtl" style={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Tajawal:wght@400;500;700&display=swap');`}</style>
      <div style={styles.header}>
        <div style={styles.title}>مزارع للإيجار</div>
        <div style={styles.subtitle}>اختر مزرعة لتشوف الصور، الأسعار، والأيام المتوفرة</div>
      </div>

      {farms === null && <div style={styles.loading}>جاري التحميل...</div>}
      {farms !== null && farms.length === 0 && <div style={styles.loading}>لا يوجد مزارع حالياً</div>}

      <div style={styles.grid}>
        {(farms || []).map((f) => {
          const photo = f.farm_photos?.[0]?.url;
          return (
            <Link key={f.id} to={`/farm/${f.id}`} style={styles.card}>
              <div style={{ ...styles.cardImg, backgroundImage: photo ? `url(${photo})` : "none" }}>
                {!photo && <div style={styles.cardImgPlaceholder}>لا توجد صورة</div>}
              </div>
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{f.name}</div>
                {f.location && (
                  <div style={styles.cardLoc}>
                    <MapPin size={12} /> {f.location}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
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
  cardImg: { height: 150, backgroundSize: "cover", backgroundPosition: "center", background: "#DAD3BE", display: "flex", alignItems: "center", justifyContent: "center" },
  cardImgPlaceholder: { color: "#6B6355", fontSize: 12 },
  cardBody: { padding: "12px 14px" },
  cardName: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 16 },
  cardLoc: { fontSize: 12, color: "#6B6355", display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
};
