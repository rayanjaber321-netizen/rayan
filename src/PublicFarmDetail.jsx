import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, MapPin, Sun, Moon, ArrowRight, X, MessageCircle, Phone, Copy, Check, Landmark, Share } from "lucide-react";

const CONTACT_PHONE = "962788083859";
const CLIQ_ALIAS = "A24JAB";
const CLIQ_BANK = "البنك الإسلامي الأردني";
import { supabase } from "./supabaseClient.js";
import {
  ARABIC_MONTHS, WEEKDAYS, PRICE_GROUPS, DEFAULT_TIMES,
  dateKey, fmtMoney, fmtTime12, toDateTime, groupForWeekday, defaultPriceSet, buildMonthGrid,
} from "./shared.js";

const BOOKING_RULES = [
  "يجب دفع عربون لتأكيد الحجز",
  "يُدفع المبلغ المتبقي عند الوصول",
  "يوجد تأمين 50 دينار مسترد بالكامل عند الخروج",
];

export default function PublicFarmDetail() {
  const { farmId } = useParams();
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [farm, setFarm] = useState(undefined);
  const [photos, setPhotos] = useState([]);
  const [prices, setPrices] = useState(defaultPriceSet());
  const [availability, setAvailability] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [aliasCopied, setAliasCopied] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [shared, setShared] = useState(false);
  const touchStartX = React.useRef(null);

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
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function goPrevMonth() {
    if (isCurrentMonth) return;
    setCurrent(new Date(year, month - 1, 1));
  }

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

  function copyAlias() {
    navigator.clipboard.writeText(CLIQ_ALIAS).then(() => {
      setAliasCopied(true);
      setTimeout(() => setAliasCopied(false), 2000);
    });
  }

  async function shareFarm() {
    const shareData = { title: farm.name, text: `شوف مزرعة ${farm.name} على Jo Farms`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  function showNext() { setLightboxIndex((i) => (i + 1) % photos.length); }
  function showPrev() { setLightboxIndex((i) => (i - 1 + photos.length) % photos.length); }
  function handleLightboxTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleLightboxTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -40) showNext();
    else if (delta > 40) showPrev();
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

      <button onClick={shareFarm} style={styles.shareBtn} aria-label="مشاركة">
        {shared ? <Check size={16} /> : <Share size={16} />}
      </button>

      <div style={styles.wrap}>
        <Link to="/" style={styles.backLink}><ArrowRight size={14} /> كل المزارع</Link>

        {photos.length > 0 ? (
          <div style={styles.gallery}>
            {photos.map((p, idx) => (
              <img key={p.id} src={p.url} alt={farm.name} style={styles.galleryImg} onClick={() => setLightboxIndex(idx)} />
            ))}
          </div>
        ) : (
          <div style={styles.galleryPlaceholder}>لا توجد صور بعد</div>
        )}

        <div style={styles.title}>{farm.name}</div>
        {farm.location && <div style={styles.location}><MapPin size={13} /> {farm.location}</div>}
        {farm.description && (
          <div>
            <div style={{ ...styles.description, ...(descExpanded ? {} : styles.descriptionClamped) }}>{farm.description}</div>
            <button onClick={() => setDescExpanded((v) => !v)} style={styles.descToggle}>
              {descExpanded ? "عرض أقل" : "قراءة المزيد"}
            </button>
          </div>
        )}

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
          {farm.maps_url && (
            <a href={farm.maps_url} target="_blank" rel="noopener noreferrer" style={styles.mapsLink}>
              <MapPin size={13} /> افتح الموقع على الخارطة
            </a>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>الأيام المتوفرة</div>
          <div style={styles.monthNav}>
            <button className="pf-nav" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
            <div style={styles.monthLabel}>{ARABIC_MONTHS[month]} {year}</div>
            <button className="pf-nav" onClick={goPrevMonth} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.35, cursor: "default" } : undefined}>
              <ChevronLeft size={16} />
            </button>
          </div>
          <div style={styles.legend}>
            <div style={styles.legendItem}><Sun size={13} color="#7A6A2E" /> <b>صباحي</b>: من الساعة 10 صباحاً حتى 9 مساءً</div>
            <div style={styles.legendItem}><Moon size={13} color="#34345C" /> <b>سهرة</b>: من الساعة 10 مساءً حتى 8 صباحاً</div>
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
              const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <div
                  key={idx}
                  style={{ ...styles.dayCell, ...(isPast ? styles.dayCellPast : {}) }}
                  onClick={() => !isPast && setSelectedDay(d)}
                >
                  <div className="fc-num" style={styles.dayNum}>{d}</div>
                  <div style={{ ...styles.slotHalf, background: isPast ? "#DDD6C4" : (dayFree ? "#C9D3A9" : "#E9C9C9") }} title={`نهاري — ${fmtMoney(priceFor(d, "day"))}`}>
                    <Sun size={10} color={isPast ? "#A79F8C" : (dayFree ? "#3B4520" : "#7A2E2E")} />
                  </div>
                  <div style={{ ...styles.slotHalf, background: isPast ? "#CFC8B6" : (nightFree ? "#34345C" : "#7A2E2E") }} title={`سهرة — ${fmtMoney(priceFor(d, "night"))}`}>
                    <Moon size={10} color={isPast ? "#A79F8C" : "#EDECF6"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>طرق الدفع</div>
          <div style={styles.cliqRow}>
            <div style={styles.cliqIcon}><Landmark size={18} color="#34345C" /></div>
            <div style={{ flex: 1 }}>
              <div style={styles.cliqAlias}>{CLIQ_ALIAS}</div>
              <div style={styles.cliqBank}>كليك (CliQ) — {CLIQ_BANK}</div>
            </div>
            <button onClick={copyAlias} style={styles.copyBtn}>
              {aliasCopied ? <Check size={14} /> : <Copy size={14} />}
              {aliasCopied ? "نسخ!" : "نسخ"}
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>للتواصل والحجز</div>
          <div style={styles.contactRow}>
            <a
              href={`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(`مرحبا، بدي أستفسر عن حجز ${farm.name}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ ...styles.contactBtn, ...styles.whatsappBtn }}
            >
              <MessageCircle size={16} /> واتساب
            </a>
            <a href={`tel:+${CONTACT_PHONE}`} style={{ ...styles.contactBtn, ...styles.callBtn }}>
              <Phone size={16} /> اتصال
            </a>
          </div>
        </div>
      </div>

      {selectedDay !== null && (
        <div style={styles.dayModalOverlay} onClick={() => setSelectedDay(null)}>
          <div style={styles.dayModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dayModalHeader}>
              <div style={styles.sectionTitle}>{selectedDay} {ARABIC_MONTHS[month]} {year}</div>
              <button className="pf-nav" onClick={() => setSelectedDay(null)} aria-label="إغلاق"><X size={16} /></button>
            </div>

            {["day", "night"].map((slot) => {
              const free = !isOccupied(dateKey(year, month, selectedDay), slot);
              return (
                <div key={slot} style={styles.dayModalSlot}>
                  <div style={styles.dayModalSlotHead}>
                    <span style={styles.dayModalSlotLabelGroup}>
                      {slot === "day" ? <Sun size={14} color="#7A6A2E" /> : <Moon size={14} color="#34345C" />}
                      <span style={styles.dayModalSlotLabel}>{slot === "day" ? "صباحي" : "سهرة"}</span>
                    </span>
                    <span style={{ ...styles.dayModalStatus, color: free ? "#3B4520" : "#791F1F" }}>{free ? "متاح" : "محجوز"}</span>
                  </div>
                  <div style={styles.dayModalSlotRow}>
                    <span>{fmtTime12(DEFAULT_TIMES[slot].start)} – {fmtTime12(DEFAULT_TIMES[slot].end)}</span>
                    <span className="fc-num">{fmtMoney(priceFor(selectedDay, slot))}</span>
                  </div>
                </div>
              );
            })}

            <div style={styles.dayModalPolicy}>
              <div style={styles.sectionTitle}>طريقة الحجز</div>
              <ol style={styles.dayModalList}>
                {BOOKING_RULES.map((rule, i) => <li key={i}>{rule}</li>)}
              </ol>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div style={styles.lightboxOverlay} onClick={() => setLightboxIndex(null)}>
          <button className="pf-nav" style={styles.lightboxClose} onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }} aria-label="إغلاق">
            <X size={18} color="#fff" />
          </button>
          <div style={styles.lightboxCounter}>{lightboxIndex + 1} / {photos.length}</div>
          <div
            style={styles.lightboxImgWrap}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleLightboxTouchStart}
            onTouchEnd={handleLightboxTouchEnd}
          >
            <img src={photos[lightboxIndex].url} alt={farm.name} style={styles.lightboxImg} />
          </div>
          {photos.length > 1 && (
            <>
              <button style={{ ...styles.lightboxNav, ...styles.lightboxNavRight }} onClick={(e) => { e.stopPropagation(); showNext(); }} aria-label="التالية">
                <ChevronRight size={22} color="#fff" />
              </button>
              <button style={{ ...styles.lightboxNav, ...styles.lightboxNavLeft }} onClick={(e) => { e.stopPropagation(); showPrev(); }} aria-label="السابقة">
                <ChevronLeft size={22} color="#fff" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Tajawal', sans-serif", background: "#EAE4D6", color: "#23291F", minHeight: "100svh", padding: "20px 14px", boxSizing: "border-box" },
  wrap: { maxWidth: 480, margin: "0 auto" },
  backLink: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6B6355", textDecoration: "none", marginBottom: 12 },
  shareBtn: { position: "fixed", top: 16, left: 16, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, border: "1px solid #C9C0A8", background: "#F7F3E9", borderRadius: "50%", color: "#4A453A", cursor: "pointer" },
  gallery: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, borderRadius: 12 },
  galleryImg: { height: 180, width: 260, objectFit: "cover", borderRadius: 12, flexShrink: 0, cursor: "pointer" },
  galleryPlaceholder: { height: 140, background: "#F1EEE3", border: "1px dashed #C9C0A8", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6355", fontSize: 12, marginBottom: 14 },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 22 },
  location: { fontSize: 13, color: "#6B6355", display: "flex", alignItems: "center", gap: 5, marginTop: 4 },
  description: { fontSize: 13, color: "#4A453A", lineHeight: 1.7, marginTop: 10, whiteSpace: "pre-wrap" },
  descriptionClamped: { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" },
  descToggle: { border: "none", background: "none", padding: 0, marginTop: 6, fontSize: 12, fontWeight: 700, color: "#BC6C25", cursor: "pointer" },
  section: { background: "#F7F3E9", border: "1px solid #DAD3BE", borderRadius: 12, padding: 14, marginTop: 14 },
  sectionTitle: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 8 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #EFE9DA", fontSize: 12.5 },
  priceLabel: { color: "#4A453A" },
  priceValues: { display: "flex", gap: 12, fontFamily: "'IBM Plex Mono', monospace" },
  guestNote: { fontSize: 11, color: "#6B6355", marginTop: 8 },
  dayModalOverlay: { position: "fixed", inset: 0, background: "rgba(15,13,9,0.5)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  dayModal: { background: "#F7F3E9", borderRadius: 14, border: "1px solid #DAD3BE", padding: 16, width: "100%", maxWidth: 360, maxHeight: "85vh", overflowY: "auto" },
  dayModalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  dayModalSlot: { background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 10, padding: "10px 12px", marginBottom: 8 },
  dayModalSlotHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  dayModalSlotLabelGroup: { display: "flex", alignItems: "center", gap: 6 },
  dayModalSlotLabel: { fontWeight: 700, fontSize: 13 },
  dayModalStatus: { fontSize: 11.5, fontWeight: 700 },
  dayModalSlotRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#4A453A" },
  dayModalPolicy: { marginTop: 14 },
  dayModalList: { margin: 0, paddingRight: 18, fontSize: 12.5, color: "#4A453A", lineHeight: 1.9 },
  mapsLink: { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "#BC6C25", textDecoration: "none" },
  cliqRow: { display: "flex", alignItems: "center", gap: 10 },
  cliqIcon: { width: 38, height: 38, borderRadius: 10, background: "#EDECF6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cliqAlias: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16, letterSpacing: 0.5 },
  cliqBank: { fontSize: 11.5, color: "#6B6355", marginTop: 2 },
  copyBtn: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #C9C0A8", background: "#FFFFFF", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "#4A453A", cursor: "pointer", flexShrink: 0 },
  contactRow: { display: "flex", gap: 10 },
  contactBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none" },
  whatsappBtn: { background: "#25D366", color: "#fff" },
  callBtn: { background: "#34345C", color: "#fff" },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthLabel: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 14 },
  legend: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#4A453A" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 },
  weekDay: { textAlign: "center", fontSize: 10, color: "#6B6355", fontWeight: 500, paddingBottom: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  blankCell: { minHeight: 54 },
  dayCell: { background: "#FFFFFF", borderRadius: 8, overflow: "hidden", border: "1px solid #DAD3BE", display: "flex", flexDirection: "column", minHeight: 54, cursor: "pointer" },
  dayCellPast: { opacity: 0.55, cursor: "default" },
  dayNum: { textAlign: "right", fontSize: 9, color: "#6B6355", padding: "2px 4px 0 4px" },
  slotHalf: { height: 20, display: "flex", alignItems: "center", justifyContent: "center" },
  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(15,13,9,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  lightboxImgWrap: { maxWidth: "92vw", maxHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center" },
  lightboxImg: { maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8, userSelect: "none" },
  lightboxClose: { position: "fixed", top: 16, right: 16, border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  lightboxCounter: { position: "fixed", top: 22, left: 16, color: "#fff", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 12px" },
  lightboxNav: { position: "fixed", top: "50%", transform: "translateY(-50%)", border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  lightboxNavRight: { right: 14 },
  lightboxNavLeft: { left: 14 },
};
