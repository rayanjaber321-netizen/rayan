import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, MapPin, Sun, Moon, ArrowRight } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  ARABIC_MONTHS, WEEKDAYS, PRICE_GROUPS, DEFAULT_TIMES,
  dateKey, fmtMoney, toDateTime, groupForWeekday, defaultPriceSet, buildMonthGrid,
} from "./shared.js";

export default function PublicFarmDetail() {
  const { farmId } = useParams();
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [farm, setFarm] = useState(undefined);
  const [photos, setPhotos] = useState([]);
  const [prices, setPrices] = useState(defaultPriceSet());
  const [availability, setAvailability] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [farmRes, photosRes, pricesRes, availRes] = await Promise.all([
        supabase.from("farms").select("*").eq("id", farmId).single(),
        supabase.from("farm_photos").select("*").eq("farm_id", farmId).order("is_cover", { ascending: false }).order("created_at"),
        supabase.from("farm_prices").select("*").eq("farm_id", farmId).single(),
        supabase.from("public_availability").select("*").eq("farm_id", farmId),
      ]);
      if (cancelled) return;
      setFarm(farmRes.data || null);
      setPhotos(photosRes.data || []);
      if (pricesRes.data) {
        setPrices({
          day: { A: pricesRes.data.day_a, B: pricesRes.data.day_b, C: pricesRes.data.day_c },
          night: { A: pricesRes.data.night_a, B: pricesRes.data.night_b, C: pricesRes.data.night_c },
          guestLimit: pricesRes.data.guest_limit,
          guestFee: pricesRes.data.guest_fee,
        });
      }
      setAvailability(availRes.data || []);
    }
    load();
    return () => { cancelled = true; };
  }, [farmId]);

  const year = current.getFullYear();
  const month = current.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function isOccupied(dateStr, slot) {
    const defaults = DEFAULT_TIMES[slot];
    const windowStart = toDateTime(dateStr, defaults.start);
    const windowEnd = toDateTime(dateStr, defaults.end);
    if (windowEnd <= windowStart) windowEnd.setDate(windowEnd.getDate() + 1);
    return availability.some((row) => {
      if (!row.start_date || !row.start_time || !row.end_date || !row.end_time) return false;
      const bStart = toDateTime(row.start_date, row.start_time);
      const bEnd = toDateTime(row.end_date, row.end_time);
      return bStart < windowEnd && bEnd > windowStart;
    });
  }

  function priceFor(day, slot) {
    const weekday = new Date(year, month, day).getDay();
    const group = groupForWeekday(weekday);
    return prices[slot][group];
  }

  if (farm === undefined) {
    return <div dir="rtl" style={{ ...styles.page, textAlign: "center", padding: 60, color: "#6B6355" }}>جاري التحميل...</div>;
  }
  if (farm === null) {
    return (
      <div dir="rtl" style={{ ...styles.page, textAlign: "center", padding: 60 }}>
        المزرعة غير موجودة. <Link to="/" style={{ color: "#BC6C25" }}>رجوع للقائمة</Link>
      </div>
    );
  }

  return (
    <div dir="rtl" style={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Tajawal:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .fc-num { font-family: 'IBM Plex Mono', monospace; }
        .pf-nav { cursor: pointer; border: none; background: #F7F3E9; border: 1px solid #C9C0A8; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <div style={styles.wrap}>
        <Link to="/" style={styles.backLink}><ArrowRight size={14} /> كل المزارع</Link>

        {photos.length > 0 ? (
          <div style={styles.gallery}>
            {photos.map((p) => (
              <img key={p.id} src={p.url} alt={farm.name} style={styles.galleryImg} />
            ))}
          </div>
        ) : (
          <div style={styles.galleryPlaceholder}>لا توجد صور بعد</div>
        )}

        <div style={styles.title}>{farm.name}</div>
        {farm.location && <div style={styles.location}><MapPin size={13} /> {farm.location}</div>}

        <div style={styles.section}>
          <div style={styles.sectionTitle}>الأسعار</div>
          {PRICE_GROUPS.map((g) => (
            <div key={g.key} style={styles.priceRow}>
              <span style={styles.priceLabel}>{g.label}</span>
              <span style={styles.priceValues}>
                <span><Sun size={11} /> {fmtMoney(prices.day[g.key])}</span>
                <span><Moon size={11} /> {fmtMoney(prices.night[g.key])}</span>
              </span>
            </div>
          ))}
          <div style={styles.guestNote}>+{fmtMoney(prices.guestFee)} لكل شخص فوق {prices.guestLimit}</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>الأيام المتوفرة</div>
          <div style={styles.monthNav}>
            <button className="pf-nav" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
            <div style={styles.monthLabel}>{ARABIC_MONTHS[month]} {year}</div>
            <button className="pf-nav" onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          </div>
          <div style={styles.legend}>
            <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#C9D3A9" }} /> نهاري 10ص–9م</span>
            <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#34345C" }} /> سهرة 10م–8ص</span>
          </div>
          <div style={styles.weekRow}>
            {WEEKDAYS.map((w) => <div key={w} style={styles.weekDay}>{w}</div>)}
          </div>
          <div style={styles.grid}>
            {cells.map((d, idx) => {
              if (d === null) return <div key={idx} style={styles.blankCell} />;
              const k = dateKey(year, month, d);
              const dayFree = !isOccupied(k, "day");
              const nightFree = !isOccupied(k, "night");
              return (
                <div key={idx} style={styles.dayCell}>
                  <div className="fc-num" style={styles.dayNum}>{d}</div>
                  <div style={{ ...styles.slotHalf, background: dayFree ? "#C9D3A9" : "#E9C9C9" }} title={`نهاري — ${fmtMoney(priceFor(d, "day"))}`}>
                    <Sun size={10} color={dayFree ? "#3B4520" : "#7A2E2E"} />
                  </div>
                  <div style={{ ...styles.slotHalf, background: nightFree ? "#34345C" : "#7A2E2E" }} title={`سهرة — ${fmtMoney(priceFor(d, "night"))}`}>
                    <Moon size={10} color="#EDECF6" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Tajawal', sans-serif", background: "#EAE4D6", color: "#23291F", minHeight: "100svh", padding: "20px 14px", boxSizing: "border-box" },
  wrap: { maxWidth: 480, margin: "0 auto" },
  backLink: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6B6355", textDecoration: "none", marginBottom: 12 },
  gallery: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, borderRadius: 12 },
  galleryImg: { height: 180, width: 260, objectFit: "cover", borderRadius: 12, flexShrink: 0 },
  galleryPlaceholder: { height: 140, background: "#F1EEE3", border: "1px dashed #C9C0A8", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6355", fontSize: 12, marginBottom: 14 },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 22 },
  location: { fontSize: 13, color: "#6B6355", display: "flex", alignItems: "center", gap: 5, marginTop: 4 },
  section: { background: "#F7F3E9", border: "1px solid #DAD3BE", borderRadius: 12, padding: 14, marginTop: 14 },
  sectionTitle: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 8 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #EFE9DA", fontSize: 12.5 },
  priceLabel: { color: "#4A453A" },
  priceValues: { display: "flex", gap: 12, fontFamily: "'IBM Plex Mono', monospace" },
  guestNote: { fontSize: 11, color: "#6B6355", marginTop: 8 },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthLabel: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 14 },
  legend: { display: "flex", gap: 14, marginBottom: 8 },
  legendItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#6B6355" },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 },
  weekDay: { textAlign: "center", fontSize: 10, color: "#6B6355", fontWeight: 500, paddingBottom: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  blankCell: { minHeight: 54 },
  dayCell: { background: "#FFFFFF", borderRadius: 8, overflow: "hidden", border: "1px solid #DAD3BE", display: "flex", flexDirection: "column", minHeight: 54 },
  dayNum: { textAlign: "right", fontSize: 9, color: "#6B6355", padding: "2px 4px 0 4px" },
  slotHalf: { height: 20, display: "flex", alignItems: "center", justifyContent: "center" },
};
