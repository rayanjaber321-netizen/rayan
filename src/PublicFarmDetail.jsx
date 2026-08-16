import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, MapPin, Sun, Moon, ArrowRight, X, MessageCircle, Phone, Copy, Check, Landmark, Share, Play } from "lucide-react";

const CONTACT_PHONE = "962788083859";
const CLIQ_ALIAS = "A24JAB";
const CLIQ_BANK = "البنك الإسلامي الأردني";
import { supabase } from "./supabaseClient.js";
import {
  ARABIC_MONTHS, WEEKDAYS, WEEKDAY_KEYS, DEFAULT_TIMES, farmTimes,
  dateKey, fmtMoney, fmtTime12, toDateTime, priceForWeekday, extraGuestFeeFor, farmUsesGroupedPricing, defaultPriceSet, buildMonthGrid, pad,
} from "./shared.js";
import { useLang, t, MONTHS, WEEKDAYS_T, translateFarmName } from "./i18n.js";
import { usePreventPinchZoom } from "./usePreventZoom.js";

function fmtMoneyL(n, lang) {
  const num = (Math.round(n * 100) / 100).toLocaleString("en-US");
  return lang === "ar" ? `${num} د.أ` : `${num} JD`;
}
function fmtTime12L(hhmm, lang) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const period = lang === "ar" ? (h < 12 ? "صباحًا" : "مساءً") : (h < 12 ? "AM" : "PM");
  return `${h12}:${pad(m)} ${period}`;
}

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
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({ name: "", phone: "", guests: "" });
  const [shared, setShared] = useState(false);
  const [lang, setLang] = useLang();
  usePreventPinchZoom();
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
        const day = {}, night = {};
        WEEKDAY_KEYS.forEach((k) => { day[k] = pricesRes.data[`day_${k}`]; night[k] = pricesRes.data[`night_${k}`]; });
        setPrices({
          day, night,
          guestLimit: pricesRes.data.guest_limit,
          guestFee: pricesRes.data.guest_fee,
          guestStep: pricesRes.data.guest_step || 1,
          dayStart: pricesRes.data.day_start || DEFAULT_TIMES.day.start,
          dayEnd: pricesRes.data.day_end || DEFAULT_TIMES.day.end,
          nightStart: pricesRes.data.night_start || DEFAULT_TIMES.night.start,
          nightEnd: pricesRes.data.night_end || DEFAULT_TIMES.night.end,
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
    const defaults = farmTimes(prices)[slot];
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
    return priceForWeekday(prices, weekday, slot);
  }

  function copyAlias() {
    navigator.clipboard.writeText(CLIQ_ALIAS).then(() => {
      setAliasCopied(true);
      setTimeout(() => setAliasCopied(false), 2000);
    });
  }

  const bookingReady = bookingSlot && bookingForm.name.trim() && bookingForm.phone.trim() && bookingForm.guests;

  function bookingPriceBreakdown() {
    const base = priceFor(selectedDay, bookingSlot);
    const guests = Number(bookingForm.guests) || 0;
    const extraGuests = Math.max(0, guests - prices.guestLimit);
    const extraFee = extraGuestFeeFor(prices, guests);
    return { base, extraGuests, extraFee, total: base + extraFee };
  }

  function confirmBooking() {
    if (!bookingReady) return;
    const slotLabel = bookingSlot === "day" ? "صباحي" : "سهرة";
    const { base, extraGuests, extraFee, total } = bookingPriceBreakdown();
    const message = [
      `مرحبا، بدي أأكد حجز:`,
      `المزرعة: ${farm.name}`,
      `التاريخ: ${selectedDay} ${ARABIC_MONTHS[month]} ${year}`,
      `الفترة: ${slotLabel}`,
      `الاسم: ${bookingForm.name.trim()}`,
      `رقم الجوال: ${bookingForm.phone.trim()}`,
      `عدد الأشخاص: ${bookingForm.guests}`,
      `السعر الأساسي: ${fmtMoney(base)}`,
      ...(extraGuests > 0 ? [`رسوم ${extraGuests} أشخاص إضافيين: ${fmtMoney(extraFee)}`] : []),
      `السعر النهائي: ${fmtMoney(total)}`,
    ].join("\n");
    window.open(`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function shareFarm() {
    const displayName = translateFarmName(farm.name, lang);
    const shareData = { title: displayName, text: t(lang, "shareFarmText")(displayName), url: window.location.href };
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
    return <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ ...styles.page, textAlign: "center", padding: 60, color: "#6B6355" }}>{t(lang, "loading")}</div>;
  }
  if (farm === null) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ ...styles.page, textAlign: "center", padding: 60 }}>
        {t(lang, "farmNotFound")} <Link to="/" style={{ color: "#BC6C25" }}>{t(lang, "backToList")}</Link>
      </div>
    );
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Tajawal:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .fc-num { font-family: 'IBM Plex Mono', monospace; }
        .pf-nav { cursor: pointer; border: none; background: #F7F3E9; border: 1px solid #C9C0A8; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <button onClick={shareFarm} style={styles.shareBtn} aria-label={t(lang, "share")}>
        {shared ? <Check size={16} /> : <Share size={16} />}
      </button>

      <div style={styles.langSwitch}>
        <button onClick={() => setLang("ar")} style={{ ...styles.langOption, ...(lang === "ar" ? styles.langOptionActive : {}) }} aria-label="العربية">🇯🇴</button>
        <button onClick={() => setLang("en")} style={{ ...styles.langOption, ...(lang === "en" ? styles.langOptionActive : {}) }} aria-label="English">🇺🇸</button>
      </div>

      <div style={styles.wrap}>
        <Link to="/" style={styles.backLink}><ArrowRight size={14} /> {t(lang, "allFarms")}</Link>

        {photos.length > 0 ? (
          <div style={styles.gallery}>
            {photos.map((p, idx) =>
              p.media_type === "video" ? (
                <div key={p.id} style={{ ...styles.galleryImg, position: "relative", padding: 0 }} onClick={() => setLightboxIndex(idx)}>
                  <video src={p.url} muted playsInline style={{ ...styles.galleryImg, pointerEvents: "none" }} />
                  <div style={styles.videoPlayBadge}><Play size={16} color="#fff" fill="#fff" /></div>
                </div>
              ) : (
                <img key={p.id} src={p.url} alt={translateFarmName(farm.name, lang)} style={{ ...styles.galleryImg, objectPosition: `center ${p.crop_position ?? 50}%` }} onClick={() => setLightboxIndex(idx)} />
              )
            )}
          </div>
        ) : (
          <div style={styles.galleryPlaceholder}>{t(lang, "noPhotos")}</div>
        )}

        <div style={styles.title}>{translateFarmName(farm.name, lang)}</div>
        {farm.location && <div style={styles.location}><MapPin size={13} /> {farm.location}</div>}
        {farm.description && (
          <div>
            <div style={{ ...styles.description, ...(descExpanded ? {} : styles.descriptionClamped) }}>{farm.description}</div>
            <button onClick={() => setDescExpanded((v) => !v)} style={styles.descToggle}>
              {descExpanded ? t(lang, "showLess") : t(lang, "readMore")}
            </button>
          </div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t(lang, "prices")}</div>
          {farmUsesGroupedPricing(farm.name) ? (
            <>
              <div style={styles.priceRow}>
                <span style={styles.priceLabel}>{t(lang, "sunWedGroup")}</span>
                <span style={styles.priceValues}>
                  <span><Sun size={11} /> {fmtMoneyL(prices.day.sun, lang)}</span>
                  <span><Moon size={11} /> {fmtMoneyL(prices.night.sun, lang)}</span>
                </span>
              </div>
              {[4, 5, 6].map((i) => {
                const k = WEEKDAY_KEYS[i];
                return (
                  <div key={k} style={styles.priceRow}>
                    <span style={styles.priceLabel}>{WEEKDAYS_T[lang][i]}</span>
                    <span style={styles.priceValues}>
                      <span><Sun size={11} /> {fmtMoneyL(prices.day[k], lang)}</span>
                      <span><Moon size={11} /> {fmtMoneyL(prices.night[k], lang)}</span>
                    </span>
                  </div>
                );
              })}
            </>
          ) : (
            WEEKDAY_KEYS.map((k, i) => (
              <div key={k} style={styles.priceRow}>
                <span style={styles.priceLabel}>{WEEKDAYS_T[lang][i]}</span>
                <span style={styles.priceValues}>
                  <span><Sun size={11} /> {fmtMoneyL(prices.day[k], lang)}</span>
                  <span><Moon size={11} /> {fmtMoneyL(prices.night[k], lang)}</span>
                </span>
              </div>
            ))
          )}
          <div style={styles.guestNote}>{t(lang, "perPersonOver")(fmtMoneyL(prices.guestFee, lang), prices.guestLimit, prices.guestStep)}</div>
          {farm.maps_url && (
            <a href={farm.maps_url} target="_blank" rel="noopener noreferrer" style={styles.mapsLink}>
              <MapPin size={13} /> {t(lang, "openMap")}
            </a>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t(lang, "availability")}</div>
          <div style={styles.monthNav}>
            <button className="pf-nav" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
            <div style={styles.monthLabel}>{MONTHS[lang][month]} {year}</div>
            <button className="pf-nav" onClick={goPrevMonth} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.35, cursor: "default" } : undefined}>
              <ChevronLeft size={16} />
            </button>
          </div>
          <div style={styles.legend}>
            <div style={styles.legendItem}><Sun size={13} color="#7A6A2E" /> {t(lang, "morningLegend")(fmtTime12L(farmTimes(prices).day.start, lang), fmtTime12L(farmTimes(prices).day.end, lang))}</div>
            <div style={styles.legendItem}><Moon size={13} color="#34345C" /> {t(lang, "eveningLegend")(fmtTime12L(farmTimes(prices).night.start, lang), fmtTime12L(farmTimes(prices).night.end, lang))}</div>
          </div>
          <div style={styles.weekRow}>
            {WEEKDAYS_T[lang].map((w) => <div key={w} style={styles.weekDay}>{w}</div>)}
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
                  onClick={() => {
                    if (isPast) return;
                    setSelectedDay(d);
                    setBookingSlot(null);
                    setBookingForm({ name: "", phone: "", guests: "" });
                  }}
                >
                  <div className="fc-num" style={styles.dayNum}>{d}</div>
                  <div style={{ ...styles.slotHalf, background: isPast ? "#DDD6C4" : (dayFree ? "#C9D3A9" : "#E9C9C9") }} title={`${t(lang, "morning")} — ${fmtMoneyL(priceFor(d, "day"), lang)}`}>
                    <Sun size={10} color={isPast ? "#A79F8C" : (dayFree ? "#3B4520" : "#7A2E2E")} />
                  </div>
                  <div style={{ ...styles.slotHalf, background: isPast ? "#CFC8B6" : (nightFree ? "#34345C" : "#7A2E2E") }} title={`${t(lang, "evening")} — ${fmtMoneyL(priceFor(d, "night"), lang)}`}>
                    <Moon size={10} color={isPast ? "#A79F8C" : "#EDECF6"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t(lang, "paymentMethods")}</div>
          <div style={styles.cliqRow}>
            <div style={styles.cliqIcon}><Landmark size={18} color="#34345C" /></div>
            <div style={{ flex: 1 }}>
              <div style={styles.cliqAlias}>{CLIQ_ALIAS}</div>
              <div style={styles.cliqBank}>{t(lang, "cliqLabel")(CLIQ_BANK)}</div>
            </div>
            <button onClick={copyAlias} style={styles.copyBtn}>
              {aliasCopied ? <Check size={14} /> : <Copy size={14} />}
              {aliasCopied ? t(lang, "copied") : t(lang, "copy")}
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t(lang, "contactBooking")}</div>
          <div style={styles.contactRow}>
            <a
              href={`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(`مرحبا، بدي أستفسر عن حجز ${farm.name}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ ...styles.contactBtn, ...styles.whatsappBtn }}
            >
              <MessageCircle size={16} /> {t(lang, "whatsapp")}
            </a>
            <a href={`tel:+${CONTACT_PHONE}`} style={{ ...styles.contactBtn, ...styles.callBtn }}>
              <Phone size={16} /> {t(lang, "call")}
            </a>
          </div>
        </div>
      </div>

      {selectedDay !== null && (
        <div style={styles.dayModalOverlay} onClick={() => setSelectedDay(null)}>
          <div style={styles.dayModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dayModalHeader}>
              <div style={styles.sectionTitle}>{selectedDay} {MONTHS[lang][month]} {year}</div>
              <button className="pf-nav" onClick={() => setSelectedDay(null)} aria-label={t(lang, "close")}><X size={16} /></button>
            </div>

            {["day", "night"].map((slot) => {
              const free = !isOccupied(dateKey(year, month, selectedDay), slot);
              const isSelected = bookingSlot === slot;
              return (
                <div
                  key={slot}
                  style={{ ...styles.dayModalSlot, ...(free ? styles.dayModalSlotClickable : {}), ...(isSelected ? styles.dayModalSlotSelected : {}) }}
                  onClick={() => free && setBookingSlot(slot)}
                >
                  <div style={styles.dayModalSlotHead}>
                    <span style={styles.dayModalSlotLabelGroup}>
                      {slot === "day" ? <Sun size={14} color="#7A6A2E" /> : <Moon size={14} color="#34345C" />}
                      <span style={styles.dayModalSlotLabel}>{slot === "day" ? t(lang, "morning") : t(lang, "evening")}</span>
                    </span>
                    <span style={{ ...styles.dayModalStatus, color: free ? "#3B4520" : "#791F1F" }}>{free ? t(lang, "available") : t(lang, "booked")}</span>
                  </div>
                  <div style={styles.dayModalSlotRow}>
                    <span>{fmtTime12L(farmTimes(prices)[slot].start, lang)} – {fmtTime12L(farmTimes(prices)[slot].end, lang)}</span>
                    <span className="fc-num">{fmtMoneyL(priceFor(selectedDay, slot), lang)}</span>
                  </div>
                </div>
              );
            })}

            <div style={styles.dayModalPolicy}>
              <div style={styles.sectionTitle}>{t(lang, "bookingPolicy")}</div>
              <ol style={styles.dayModalList}>
                {t(lang, "bookingRules").map((rule, i) => <li key={i}>{rule}</li>)}
              </ol>
            </div>

            <div style={styles.dayModalBookingForm}>
              <div style={styles.sectionTitle}>{t(lang, "bookThisDate")}</div>
              {!bookingSlot && <div style={styles.bookingHint}>{t(lang, "pickSlotHint")}</div>}
              <input
                style={styles.bookingInput}
                placeholder={t(lang, "namePlaceholder")}
                value={bookingForm.name}
                onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
              />
              <input
                type="tel"
                style={styles.bookingInput}
                placeholder={t(lang, "phonePlaceholder")}
                value={bookingForm.phone}
                onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
              />
              <input
                type="number"
                min="1"
                style={styles.bookingInput}
                placeholder={t(lang, "guestsPlaceholder")}
                value={bookingForm.guests}
                onChange={(e) => setBookingForm({ ...bookingForm, guests: e.target.value })}
              />
              {bookingSlot && bookingForm.guests > 0 && (() => {
                const { base, extraGuests, extraFee, total } = bookingPriceBreakdown();
                return (
                  <div style={styles.bookingPriceBox}>
                    <div style={styles.dayModalSlotRow}><span>{t(lang, "basePrice")}</span><span className="fc-num">{fmtMoneyL(base, lang)}</span></div>
                    {extraGuests > 0 && (
                      <div style={styles.dayModalSlotRow}><span>{t(lang, "extraGuestsFee")(extraGuests, prices.guestLimit)}</span><span className="fc-num">{fmtMoneyL(extraFee, lang)}</span></div>
                    )}
                    <div style={{ ...styles.dayModalSlotRow, ...styles.bookingTotalRow }}><span>{t(lang, "finalPrice")}</span><span className="fc-num">{fmtMoneyL(total, lang)}</span></div>
                  </div>
                );
              })()}
              <button
                onClick={confirmBooking}
                disabled={!bookingReady}
                style={{ ...styles.contactBtn, ...styles.whatsappBtn, ...styles.bookingConfirmBtn, opacity: bookingReady ? 1 : 0.5 }}
              >
                <MessageCircle size={16} /> {t(lang, "confirmBooking")}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div style={styles.lightboxOverlay} onClick={() => setLightboxIndex(null)}>
          <button className="pf-nav" style={styles.lightboxClose} onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }} aria-label={t(lang, "close")}>
            <X size={18} color="#fff" />
          </button>
          <div style={styles.lightboxCounter}>{lightboxIndex + 1} / {photos.length}</div>
          <div
            style={styles.lightboxImgWrap}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleLightboxTouchStart}
            onTouchEnd={handleLightboxTouchEnd}
          >
            {photos[lightboxIndex].media_type === "video" ? (
              <video src={photos[lightboxIndex].url} controls autoPlay playsInline style={styles.lightboxImg} />
            ) : (
              <img src={photos[lightboxIndex].url} alt={translateFarmName(farm.name, lang)} style={styles.lightboxImg} />
            )}
          </div>
          {photos.length > 1 && (
            <>
              <button style={{ ...styles.lightboxNav, ...styles.lightboxNavRight }} onClick={(e) => { e.stopPropagation(); showNext(); }} aria-label={t(lang, "next")}>
                <ChevronRight size={22} color="#fff" />
              </button>
              <button style={{ ...styles.lightboxNav, ...styles.lightboxNavLeft }} onClick={(e) => { e.stopPropagation(); showPrev(); }} aria-label={t(lang, "prev")}>
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
  page: { fontFamily: "'Tajawal', sans-serif", background: "#EAE4D6", color: "#23291F", minHeight: "100svh", padding: "20px 14px", boxSizing: "border-box", touchAction: "manipulation" },
  wrap: { maxWidth: 480, margin: "0 auto" },
  backLink: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6B6355", textDecoration: "none", marginTop: 42, marginBottom: 12 },
  shareBtn: { position: "fixed", top: 16, left: 16, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, border: "1px solid #C9C0A8", background: "#F7F3E9", borderRadius: "50%", color: "#4A453A", cursor: "pointer" },
  langSwitch: { position: "fixed", top: 16, right: 16, zIndex: 60, display: "flex", gap: 2, border: "1px solid #C9C0A8", background: "#F7F3E9", borderRadius: 22, padding: 3 },
  langOption: { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", fontSize: 16, cursor: "pointer", opacity: 0.4 },
  langOptionActive: { opacity: 1, background: "#FFFFFF", boxShadow: "0 1px 4px rgba(35,41,31,0.15)" },
  gallery: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, borderRadius: 12 },
  galleryImg: { height: 180, width: 260, objectFit: "cover", borderRadius: 12, flexShrink: 0, cursor: "pointer" },
  videoPlayBadge: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,13,9,0.25)", borderRadius: 12, pointerEvents: "none" },
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
  dayModalSlotClickable: { cursor: "pointer" },
  dayModalSlotSelected: { borderColor: "#BC6C25", borderWidth: 2, boxShadow: "0 0 0 1px #BC6C25 inset" },
  dayModalSlotHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  dayModalSlotLabelGroup: { display: "flex", alignItems: "center", gap: 6 },
  dayModalSlotLabel: { fontWeight: 700, fontSize: 13 },
  dayModalStatus: { fontSize: 11.5, fontWeight: 700 },
  dayModalSlotRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#4A453A" },
  dayModalPolicy: { marginTop: 14 },
  dayModalList: { margin: 0, paddingRight: 18, fontSize: 12.5, color: "#4A453A", lineHeight: 1.9 },
  dayModalBookingForm: { marginTop: 14 },
  bookingHint: { fontSize: 11.5, color: "#6B6355", marginBottom: 8 },
  bookingInput: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", color: "#23291F", fontSize: 13.5, fontFamily: "'Tajawal', sans-serif", marginBottom: 8 },
  bookingConfirmBtn: { width: "100%", marginTop: 4 },
  bookingPriceBox: { background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 },
  bookingTotalRow: { fontWeight: 800, borderTop: "1px solid #EFE9DA", paddingTop: 4, marginTop: 2 },
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
