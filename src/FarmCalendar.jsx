import React, { useState, useMemo, useEffect, useRef } from "react";
import { Sun, Moon, X, Settings, ChevronRight, ChevronLeft, Banknote, CreditCard, Landmark, Trash2, User, Phone, StickyNote, Plus, MapPin, Pencil, RefreshCw } from "lucide-react";

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const WEEKDAYS = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
const PAYMENT_METHODS = [
  { id: "نقدي", label: "نقدي", icon: Banknote },
  { id: "كليك", label: "كليك", icon: CreditCard },
  { id: "تحويل بنكي", label: "تحويل بنكي", icon: Landmark },
];
const PRICE_GROUPS = [
  { key: "A", label: "الأحد – الأربعاء" },
  { key: "B", label: "الخميس والسبت" },
  { key: "C", label: "الجمعة" },
];
const DEFAULT_TIMES = {
  day: { start: "10:00", end: "21:00" },
  night: { start: "22:00", end: "08:00" },
};

const STORAGE_KEY = "farm-calendar-state-v1";

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function fmtMoney(n) { return `${(Math.round(n * 100) / 100).toLocaleString("en-US")} د.أ`; }
function fmtTime12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "صباحًا" : "مساءً";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}
function fmtDateShort(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${ARABIC_MONTHS[m - 1]}`;
}
function toDateTime(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi);
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function isBookingPending(b) {
  const final = Math.max(0, Number(b.base) + Number(b.extraGuestFee || 0) - Number(b.discount || 0));
  const remaining = Math.max(0, final - Number(b.depositAmount || 0));
  return remaining > 0 && !b.remainingSettled;
}
function groupForWeekday(weekday) {
  if (weekday === 5) return "C";
  if (weekday === 4 || weekday === 6) return "B";
  return "A";
}
function defaultPriceSet() {
  return { day: { A: 100, B: 130, C: 160 }, night: { A: 150, B: 180, C: 220 }, guestLimit: 15, guestFee: 5 };
}
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const emptyForm = { customer: "", phone: "", base: 0, discount: 0, discountReason: "", startDate: "", startTime: "", endDate: "", endTime: "", guestCount: "", extraGuestFee: 0, depositAmount: 0, depositMethod: "نقدي", remainingMethod: "نقدي", remainingSettled: false, notes: "" };
const emptyFarmDraft = { name: "", location: "" };

const initialDefaults = {
  farms: [{ id: "f1", name: "المزرعة الأولى", location: "" }],
  selectedFarmId: "f1",
  prices: { f1: defaultPriceSet() },
  bookings: { f1: {} },
};

export default function FarmCalendar() {
  const today = new Date();
  const persisted = useMemo(loadPersisted, []);

  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [farms, setFarms] = useState(persisted?.farms || initialDefaults.farms);
  const [selectedFarmId, setSelectedFarmId] = useState(persisted?.selectedFarmId || initialDefaults.selectedFarmId);
  const [prices, setPrices] = useState(persisted?.prices || initialDefaults.prices);
  const [bookings, setBookings] = useState(persisted?.bookings || initialDefaults.bookings);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("farms");
  const [farmDraft, setFarmDraft] = useState(emptyFarmDraft);
  const [editingFarmId, setEditingFarmId] = useState(null);
  const [pricingFarmId, setPricingFarmId] = useState(persisted?.selectedFarmId || initialDefaults.selectedFarmId);
  const [draftPrices, setDraftPrices] = useState({ ...defaultPriceSet(), ...((persisted?.prices || initialDefaults.prices)[persisted?.selectedFarmId || initialDefaults.selectedFarmId] || {}) });
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ farms, selectedFarmId, prices, bookings }));
    } catch {
      // storage unavailable (private mode / quota) — state stays in memory only
    }
  }, [farms, selectedFarmId, prices, bookings]);

  const year = current.getFullYear();
  const month = current.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const farm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const farmBookings = bookings[selectedFarmId] || {};
  const farmPrices = { ...defaultPriceSet(), ...(prices[selectedFarmId] || {}) };

  const stats = useMemo(() => {
    let count = 0, revenue = 0, remaining = 0;
    const prefix = `${year}-${pad(month + 1)}-`;
    Object.entries(farmBookings).forEach(([k, b]) => {
      if (!k.startsWith(prefix)) return;
      count += 1;
      const final = Math.max(0, Number(b.base) + Number(b.extraGuestFee || 0) - Number(b.discount || 0));
      revenue += final;
      remaining += Math.max(0, final - Number(b.depositAmount || 0));
    });
    return { count, revenue, remaining };
  }, [farmBookings, year, month]);

  function priceFor(day, slot) {
    const weekday = new Date(year, month, day).getDay();
    const group = groupForWeekday(weekday);
    return farmPrices[slot][group];
  }

  function findOccupyingBooking(dateStr, slot) {
    const exactKey = `${dateStr}_${slot}`;
    const exact = farmBookings[exactKey];
    if (exact) return { key: exactKey, booking: exact, isPrimary: true };

    const defaults = DEFAULT_TIMES[slot];
    const windowStart = toDateTime(dateStr, defaults.start);
    const windowEnd = toDateTime(dateStr, defaults.end);
    if (windowEnd <= windowStart) windowEnd.setDate(windowEnd.getDate() + 1);

    for (const [key, b] of Object.entries(farmBookings)) {
      if (!b.startDate || !b.startTime || !b.endDate || !b.endTime) continue;
      const bStart = toDateTime(b.startDate, b.startTime);
      const bEnd = toDateTime(b.endDate, b.endTime);
      if (bStart < windowEnd && bEnd > windowStart) {
        return { key, booking: b, isPrimary: false };
      }
    }
    return null;
  }

  function openModalByKey(key) {
    const existing = farmBookings[key];
    if (!existing) return;
    const [dateStr, slot] = key.split("_");
    const day = Number(dateStr.split("-")[2]);
    setForm({ ...emptyForm, ...existing });
    setModal({ key, slot, day });
  }

  function openModal(day, slot) {
    const dateStr = dateKey(year, month, day);
    const key = `${dateStr}_${slot}`;
    const existing = farmBookings[key];
    const defaults = DEFAULT_TIMES[slot];
    const endDateStr = defaults.end <= defaults.start ? addDays(dateStr, 1) : dateStr;
    setForm(existing ? { ...emptyForm, ...existing } : { ...emptyForm, base: priceFor(day, slot), startDate: dateStr, startTime: defaults.start, endDate: endDateStr, endTime: defaults.end });
    setModal({ key, slot, day });
  }
  function closeModal() { setModal(null); setForm(emptyForm); }

  function saveBooking() {
    if (!form.customer.trim()) return;
    setBookings((prev) => ({
      ...prev,
      [selectedFarmId]: {
        ...prev[selectedFarmId],
        [modal.key]: { ...form, base: Number(form.base) || 0, discount: Number(form.discount) || 0, guestCount: Number(form.guestCount) || 0, extraGuestFee: Number(form.extraGuestFee) || 0, depositAmount: Number(form.depositAmount) || 0, remainingSettled: !!form.remainingSettled },
      },
    }));
    closeModal();
  }
  function deleteBooking() {
    setBookings((prev) => {
      const copy = { ...prev[selectedFarmId] };
      delete copy[modal.key];
      return { ...prev, [selectedFarmId]: copy };
    });
    closeModal();
  }
  function changeMonth(delta) { setCurrent(new Date(year, month + delta, 1)); }

  const PULL_THRESHOLD = 60;
  const PULL_MAX = 90;
  function handleTouchStart(e) {
    if (modal || settingsOpen || refreshing) return;
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta, PULL_MAX));
  }
  function handleTouchEnd() {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    if (pullDistance > PULL_THRESHOLD) {
      setRefreshing(true);
      setTimeout(() => window.location.reload(), 300);
    } else {
      setPullDistance(0);
    }
  }

  function openFarmsTab() { setSettingsTab("farms"); setFarmDraft(emptyFarmDraft); setEditingFarmId(null); setSettingsOpen(true); }
  function openPricingTab(farmId) {
    setSettingsTab("pricing");
    setPricingFarmId(farmId);
    setDraftPrices({ ...defaultPriceSet(), ...(prices[farmId] || {}) });
    setSettingsOpen(true);
  }

  function addOrUpdateFarm() {
    if (!farmDraft.name.trim()) return;
    if (editingFarmId) {
      setFarms((prev) => prev.map((f) => (f.id === editingFarmId ? { ...f, ...farmDraft } : f)));
    } else {
      const id = "f" + Date.now();
      setFarms((prev) => [...prev, { id, name: farmDraft.name, location: farmDraft.location }]);
      setPrices((prev) => ({ ...prev, [id]: defaultPriceSet() }));
      setBookings((prev) => ({ ...prev, [id]: {} }));
      setSelectedFarmId(id);
    }
    setFarmDraft(emptyFarmDraft);
    setEditingFarmId(null);
  }
  function startEditFarm(f) { setEditingFarmId(f.id); setFarmDraft({ name: f.name, location: f.location }); }
  function deleteFarm(id) {
    if (farms.length === 1) return;
    setFarms((prev) => prev.filter((f) => f.id !== id));
    if (selectedFarmId === id) setSelectedFarmId(farms.find((f) => f.id !== id).id);
  }
  function savePricing() {
    setPrices((prev) => ({ ...prev, [pricingFarmId]: draftPrices }));
    setSettingsOpen(false);
  }

  const final = Math.max(0, Number(form.base || 0) + Number(form.extraGuestFee || 0) - Number(form.discount || 0));
  const remainingAmount = Math.max(0, final - Number(form.depositAmount || 0));

  let timeRangeLabel = "";
  if (modal && form.startDate && form.startTime && form.endDate && form.endTime) {
    timeRangeLabel = form.startDate === form.endDate
      ? `${fmtDateShort(form.startDate)} — ${fmtTime12(form.startTime)} ← ${fmtTime12(form.endTime)}`
      : `${fmtDateShort(form.startDate)} ${fmtTime12(form.startTime)} ← ${fmtDateShort(form.endDate)} ${fmtTime12(form.endTime)}`;
  }

  return (
    <div dir="rtl" style={styles.wrap} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Tajawal:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .fc-num { font-family: 'IBM Plex Mono', monospace; }
        .fc-btn { cursor: pointer; border: none; }
        .fc-btn:active { transform: scale(0.97); }
        .fc-input:focus, .fc-select:focus, .fc-textarea:focus { outline: 2px solid #BC6C25; outline-offset: 1px; }
        .fc-cellhalf { transition: filter 0.12s ease; }
        .fc-cellhalf:hover { filter: brightness(0.94); }
        .fc-chip { transition: background 0.12s ease; white-space: nowrap; }
        @keyframes fc-spin { to { transform: rotate(360deg); } }
        .fc-spin { animation: fc-spin 0.6s linear infinite; }
      `}</style>

      {(pullDistance > 0 || refreshing) && (
        <div style={{ ...styles.pullIndicator, height: refreshing ? 40 : pullDistance }}>
          <RefreshCw
            size={16}
            color="#6B6355"
            className={refreshing ? "fc-spin" : ""}
            style={refreshing ? {} : { transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 360, 360)}deg)` }}
          />
        </div>
      )}

      <div style={styles.header}>
        <div>
          <div style={styles.title}>كالندر حجوزات المزارع</div>
          <div style={styles.subtitle}>{farm?.location ? `${farm.name} — ${farm.location}` : farm?.name}</div>
        </div>
        <button className="fc-btn" onClick={openFarmsTab} style={styles.settingsBtn} aria-label="الإعدادات">
          <Settings size={18} color="#F7F3E9" />
        </button>
      </div>

      <div style={styles.farmChips}>
        {farms.map((f) => (
          <button
            key={f.id}
            className="fc-btn fc-chip"
            onClick={() => setSelectedFarmId(f.id)}
            style={{ ...styles.farmChip, ...(f.id === selectedFarmId ? styles.farmChipActive : {}) }}
          >
            {f.name}
          </button>
        ))}
        <button className="fc-btn fc-chip" onClick={openFarmsTab} style={styles.farmChipAdd} aria-label="إضافة مزرعة"><Plus size={13} /></button>
      </div>

      <div style={styles.monthNav}>
        <button className="fc-btn" onClick={() => changeMonth(1)} style={styles.navBtn}><ChevronRight size={18} /></button>
        <div style={styles.monthLabel}>{ARABIC_MONTHS[month]} {year}</div>
        <button className="fc-btn" onClick={() => changeMonth(-1)} style={styles.navBtn}><ChevronLeft size={18} /></button>
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}><Sun size={13} color="#4E5A31" /><span>نهاري 10ص–9م</span></div>
        <div style={styles.legendItem}><Moon size={13} color="#34345C" /><span>سهرة 10م–8ص</span></div>
        <button className="fc-btn" onClick={() => openPricingTab(selectedFarmId)} style={styles.legendPriceBtn}>الأسعار</button>
      </div>

      <div style={styles.weekRow}>
        {WEEKDAYS.map((w) => <div key={w} style={styles.weekDay}>{w}</div>)}
      </div>

      <div style={styles.grid}>
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} style={styles.blankCell} />;
          const k = dateKey(year, month, d);
          const dayResult = findOccupyingBooking(k, "day");
          const nightResult = findOccupyingBooking(k, "night");
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div key={idx} style={{ ...styles.dayCell, ...(isToday ? styles.dayCellToday : {}) }}>
              <div className="fc-num" style={styles.dayNum}>{d}</div>
              <div
                className="fc-cellhalf"
                onClick={() => (dayResult && !dayResult.isPrimary ? openModalByKey(dayResult.key) : openModal(d, "day"))}
                style={{ ...styles.slotHalf, background: dayResult ? "#C9D3A9" : "#F1EEE3" }}
                title={dayResult && !dayResult.isPrimary ? `امتداد حجز حتى ${fmtDateShort(dayResult.booking.endDate)} ${fmtTime12(dayResult.booking.endTime)}` : "فترة نهارية"}
              >
                <Sun size={11} color={dayResult ? "#3B4520" : "#A6A28E"} />
                {dayResult && <span style={styles.slotName}>{dayResult.booking.customer}</span>}
                {dayResult?.isPrimary && isBookingPending(dayResult.booking) && <span style={styles.pendingDot} title="بانتظار تحصيل الباقي" />}
              </div>
              <div
                className="fc-cellhalf"
                onClick={() => (nightResult && !nightResult.isPrimary ? openModalByKey(nightResult.key) : openModal(d, "night"))}
                style={{ ...styles.slotHalf, background: nightResult ? "#34345C" : "#E7E3D5" }}
                title={nightResult && !nightResult.isPrimary ? `امتداد حجز حتى ${fmtDateShort(nightResult.booking.endDate)} ${fmtTime12(nightResult.booking.endTime)}` : "فترة سهرة"}
              >
                <Moon size={11} color={nightResult ? "#DEDCEE" : "#A6A28E"} />
                {nightResult && <span style={{ ...styles.slotName, color: "#EDECF6" }}>{nightResult.booking.customer}</span>}
                {nightResult?.isPrimary && isBookingPending(nightResult.booking) && <span style={styles.pendingDot} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}><div style={styles.statLabel}>الحجوزات</div><div className="fc-num" style={styles.statValue}>{stats.count}</div></div>
        <div style={styles.statCard}><div style={styles.statLabel}>الإيرادات المتوقعة</div><div className="fc-num" style={{ ...styles.statValue, color: "#BC6C25" }}>{fmtMoney(stats.revenue)}</div></div>
        <div style={styles.statCard}><div style={styles.statLabel}>المبالغ المتبقية</div><div className="fc-num" style={styles.statValue}>{fmtMoney(stats.remaining)}</div></div>
      </div>

      {modal && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleWrap}>
                {modal.slot === "day" ? <Sun size={16} color="#4E5A31" /> : <Moon size={16} color="#34345C" />}
                <div style={styles.modalTitle}>{modal.slot === "day" ? "فترة نهارية" : "فترة سهرة"} — {modal.day} {ARABIC_MONTHS[month]}</div>
                {remainingAmount > 0 && !form.remainingSettled && <span style={styles.pendingBadge}>معلّق</span>}
              </div>
              <button className="fc-btn" onClick={closeModal} style={styles.iconBtn} aria-label="إغلاق"><X size={18} color="#6B6355" /></button>
            </div>
            <div style={styles.modalSub}>{timeRangeLabel}</div>

            <div style={styles.formGrid}>
              <div style={styles.twoCol}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>تاريخ البداية</label>
                  <input className="fc-input fc-num" type="date" style={styles.input} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>ساعة البداية</label>
                  <input className="fc-input fc-num" type="time" style={styles.input} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
              </div>

              <div style={styles.twoCol}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>تاريخ النهاية</label>
                  <input className="fc-input fc-num" type="date" style={styles.input} value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>ساعة النهاية</label>
                  <input className="fc-input fc-num" type="time" style={styles.input} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>

              <label style={styles.label}><User size={13} /> اسم العميل</label>
              <input className="fc-input" style={styles.input} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="اسم العميل" />

              <label style={styles.label}><Phone size={13} /> رقم الهاتف</label>
              <input className="fc-input" style={styles.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07XXXXXXXX" />

              <div style={styles.twoCol}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>السعر الأساسي (د.أ)</label>
                  <input className="fc-input fc-num" type="number" style={styles.input} value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>الخصم (د.أ)</label>
                  <input className="fc-input fc-num" type="number" style={styles.input} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                </div>
              </div>

              {Number(form.discount) > 0 && (
                <>
                  <label style={styles.label}>سبب الخصم</label>
                  <input className="fc-input" style={styles.input} value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} placeholder="مثلاً: زبون دائم، عطل بسيط، حجز مبكر" />
                </>
              )}

              <label style={styles.label}><User size={13} /> عدد الأشخاص</label>
              <input
                className="fc-input fc-num"
                type="number"
                style={styles.input}
                value={form.guestCount}
                onChange={(e) => {
                  const guestCount = e.target.value;
                  const extra = Math.max(0, Number(guestCount || 0) - farmPrices.guestLimit) * farmPrices.guestFee;
                  setForm({ ...form, guestCount, extraGuestFee: extra });
                }}
                placeholder={`حتى ${farmPrices.guestLimit} بدون رسوم إضافية`}
              />
              {Number(form.extraGuestFee) > 0 && (
                <div style={{ ...styles.modalSub, marginBottom: 0 }}>
                  + {fmtMoney(Number(form.extraGuestFee))} رسوم {Math.max(0, Number(form.guestCount || 0) - farmPrices.guestLimit)} أشخاص إضافيين (فوق {farmPrices.guestLimit})
                </div>
              )}

              <div style={styles.finalRow}><span style={styles.label}>السعر النهائي</span><span className="fc-num" style={styles.finalPrice}>{fmtMoney(final)}</span></div>

              <label style={styles.label}>مبلغ العربون (د.أ)</label>
              <input className="fc-input fc-num" type="number" style={styles.input} value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} />

              <label style={styles.label}>طريقة دفع العربون</label>
              <div style={styles.methodRow}>
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button key={id} className="fc-btn" onClick={() => setForm({ ...form, depositMethod: id })} style={{ ...styles.methodBtn, ...(form.depositMethod === id ? styles.methodBtnActive : {}) }}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>

              <div style={styles.finalRow}><span style={styles.label}>المبلغ المتبقي</span><span className="fc-num" style={styles.finalPrice}>{fmtMoney(remainingAmount)}</span></div>

              <label style={styles.label}>طريقة دفع الباقي</label>
              <div style={styles.methodRow}>
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button key={id} className="fc-btn" onClick={() => setForm({ ...form, remainingMethod: id })} style={{ ...styles.methodBtn, ...(form.remainingMethod === id ? styles.methodBtnActive : {}) }}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>

              {remainingAmount > 0 && (
                <label className="fc-btn" style={styles.checkboxRow}>
                  <input type="checkbox" checked={!!form.remainingSettled} onChange={(e) => setForm({ ...form, remainingSettled: e.target.checked })} />
                  تم استلام المبلغ المتبقي من الزبون
                </label>
              )}

              <label style={styles.label}><StickyNote size={13} /> ملاحظات</label>
              <textarea className="fc-textarea" style={styles.textarea} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية" rows={2} />

              <div style={styles.priceGroupBlock}>
                <div style={styles.priceGroupLabel}>تفصيل السعر النهائي</div>
                <div style={styles.breakdownRow}><span>السعر الأساسي</span><span className="fc-num">{fmtMoney(Number(form.base) || 0)}</span></div>
                {Number(form.extraGuestFee) > 0 && (
                  <div style={styles.breakdownRow}><span>رسوم الأشخاص الإضافيين</span><span className="fc-num">+ {fmtMoney(Number(form.extraGuestFee))}</span></div>
                )}
                {Number(form.discount) > 0 && (
                  <div style={styles.breakdownRow}><span>الخصم</span><span className="fc-num">- {fmtMoney(Number(form.discount))}</span></div>
                )}
                <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}><span>الإجمالي</span><span className="fc-num">{fmtMoney(final)}</span></div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              {farmBookings[modal.key] && (<button className="fc-btn" onClick={deleteBooking} style={styles.deleteBtn}><Trash2 size={14} /> حذف</button>)}
              <button className="fc-btn" onClick={saveBooking} style={styles.saveBtn} disabled={!form.customer.trim()}>حفظ الحجز</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={styles.overlay} onClick={() => setSettingsOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>الإعدادات</div>
              <button className="fc-btn" onClick={() => setSettingsOpen(false)} style={styles.iconBtn} aria-label="إغلاق"><X size={18} color="#6B6355" /></button>
            </div>

            <div style={styles.tabRow}>
              <button className="fc-btn" onClick={() => setSettingsTab("farms")} style={{ ...styles.tabBtn, ...(settingsTab === "farms" ? styles.tabBtnActive : {}) }}>المزارع</button>
              <button className="fc-btn" onClick={() => { setSettingsTab("pricing"); setPricingFarmId(selectedFarmId); setDraftPrices({ ...defaultPriceSet(), ...(prices[selectedFarmId] || {}) }); }} style={{ ...styles.tabBtn, ...(settingsTab === "pricing" ? styles.tabBtnActive : {}) }}>الأسعار</button>
            </div>

            {settingsTab === "farms" && (
              <div style={styles.formGrid}>
                {farms.map((f) => (
                  <div key={f.id} style={styles.farmRow}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.farmRowName}>{f.name}</div>
                      {f.location && <div style={styles.farmRowLoc}><MapPin size={11} /> {f.location}</div>}
                    </div>
                    <button className="fc-btn" onClick={() => startEditFarm(f)} style={styles.iconBtnSmall} aria-label="تعديل"><Pencil size={14} color="#6B6355" /></button>
                    {farms.length > 1 && <button className="fc-btn" onClick={() => deleteFarm(f.id)} style={styles.iconBtnSmall} aria-label="حذف"><Trash2 size={14} color="#791F1F" /></button>}
                  </div>
                ))}

                <label style={{ ...styles.label, marginTop: 12 }}>{editingFarmId ? "تعديل المزرعة" : "إضافة مزرعة جديدة"}</label>
                <input className="fc-input" style={styles.input} value={farmDraft.name} onChange={(e) => setFarmDraft({ ...farmDraft, name: e.target.value })} placeholder="اسم المزرعة" />
                <input className="fc-input" style={styles.input} value={farmDraft.location} onChange={(e) => setFarmDraft({ ...farmDraft, location: e.target.value })} placeholder="اللوكيشن (مثلاً: جرش)" />
                <button className="fc-btn" onClick={addOrUpdateFarm} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>{editingFarmId ? "حفظ التعديل" : "إضافة المزرعة"}</button>
              </div>
            )}

            {settingsTab === "pricing" && (
              <div style={styles.formGrid}>
                <label style={styles.label}>المزرعة</label>
                <select className="fc-select" style={styles.input} value={pricingFarmId} onChange={(e) => { setPricingFarmId(e.target.value); setDraftPrices({ ...defaultPriceSet(), ...(prices[e.target.value] || {}) }); }}>
                  {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {PRICE_GROUPS.map((g) => (
                  <div key={g.key} style={styles.priceGroupBlock}>
                    <div style={styles.priceGroupLabel}>{g.label}</div>
                    <div style={styles.twoCol}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}><Sun size={12} /> نهاري</label>
                        <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.day[g.key]} onChange={(e) => setDraftPrices({ ...draftPrices, day: { ...draftPrices.day, [g.key]: e.target.value } })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}><Moon size={12} /> سهرة</label>
                        <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.night[g.key]} onChange={(e) => setDraftPrices({ ...draftPrices, night: { ...draftPrices.night, [g.key]: e.target.value } })} />
                      </div>
                    </div>
                  </div>
                ))}

                <div style={styles.priceGroupBlock}>
                  <div style={styles.priceGroupLabel}>رسوم الأشخاص الإضافيين</div>
                  <div style={styles.twoCol}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}><User size={12} /> الحد بدون رسوم</label>
                      <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.guestLimit} onChange={(e) => setDraftPrices({ ...draftPrices, guestLimit: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>رسوم كل شخص إضافي (د.أ)</label>
                      <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.guestFee} onChange={(e) => setDraftPrices({ ...draftPrices, guestFee: e.target.value })} />
                    </div>
                  </div>
                </div>

                <button className="fc-btn" onClick={savePricing} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>حفظ الأسعار</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "'Tajawal', sans-serif", background: "#EAE4D6", color: "#23291F", borderRadius: 16, padding: "18px 14px 22px", maxWidth: 480, margin: "0 auto", boxSizing: "border-box" },
  pullIndicator: { display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "height 0.15s ease" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  title: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 20, color: "#23291F" },
  subtitle: { fontSize: 12, color: "#6B6355", marginTop: 2 },
  settingsBtn: { background: "#34345C", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  farmChips: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 4 },
  farmChip: { background: "#F1EEE3", border: "1px solid #DAD3BE", borderRadius: 20, padding: "6px 12px", fontSize: 12, color: "#4A453A" },
  farmChipActive: { background: "#BC6C25", borderColor: "#BC6C25", color: "#FFFFFF", fontWeight: 500 },
  farmChipAdd: { background: "transparent", border: "1px dashed #C9C0A8", borderRadius: 20, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
  navBtn: { background: "#F7F3E9", border: "1px solid #C9C0A8", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" },
  monthLabel: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 16 },
  legend: { display: "flex", gap: 14, marginBottom: 10, alignItems: "center", flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B6355" },
  legendPriceBtn: { marginRight: "auto", background: "transparent", border: "1px solid #C9C0A8", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#4A453A" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 },
  weekDay: { textAlign: "center", fontSize: 10, color: "#6B6355", fontWeight: 500, paddingBottom: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  blankCell: { minHeight: 68 },
  dayCell: { background: "#F7F3E9", borderRadius: 8, overflow: "hidden", border: "1px solid #DAD3BE", display: "flex", flexDirection: "column", minHeight: 68 },
  dayCellToday: { border: "1.5px solid #BC6C25" },
  dayNum: { textAlign: "right", fontSize: 9, color: "#6B6355", padding: "2px 4px 0 4px" },
  slotHalf: { height: 27, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", overflow: "hidden" },
  slotName: { fontSize: 8, fontWeight: 500, color: "#3B4520", maxWidth: 48, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pendingDot: { width: 6, height: 6, borderRadius: "50%", background: "#BC6C25", flexShrink: 0 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 },
  statCard: { background: "#F7F3E9", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: "1px solid #DAD3BE" },
  statLabel: { fontSize: 10, color: "#6B6355", marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: 500 },
  overlay: { position: "fixed", inset: 0, background: "rgba(35,41,31,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modal: { background: "#F7F3E9", borderRadius: 14, padding: 18, width: "100%", maxWidth: 380, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitleWrap: { display: "flex", alignItems: "center", gap: 6 },
  pendingBadge: { fontSize: 10, fontWeight: 500, color: "#7A4A12", background: "#F3D9B1", borderRadius: 10, padding: "2px 8px" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4A453A", background: "#FFFFFF", border: "1px solid #C9C0A8", borderRadius: 8, padding: "8px 10px", marginTop: 6, cursor: "pointer" },
  modalTitle: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15 },
  iconBtn: { background: "transparent", padding: 4 },
  iconBtnSmall: { background: "transparent", padding: 4, display: "flex" },
  modalSub: { fontSize: 11, color: "#6B6355", marginBottom: 14 },
  formGrid: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#4A453A", display: "flex", alignItems: "center", gap: 5, marginTop: 6 },
  input: { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", color: "#23291F", fontSize: 13, fontFamily: "'Tajawal', sans-serif" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", color: "#23291F", fontSize: 13, fontFamily: "'Tajawal', sans-serif", resize: "vertical" },
  twoCol: { display: "flex", gap: 8, marginTop: 6 },
  finalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EFE6D3", borderRadius: 8, padding: "8px 10px", marginTop: 6 },
  finalPrice: { fontSize: 16, fontWeight: 500, color: "#BC6C25" },
  methodRow: { display: "flex", gap: 6 },
  methodBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", fontSize: 10.5, color: "#4A453A" },
  methodBtnActive: { background: "#34345C", borderColor: "#34345C", color: "#EDECF6" },
  modalFooter: { display: "flex", gap: 8, marginTop: 16 },
  deleteBtn: { display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 9, border: "1px solid #C9645A", background: "#FCEBEB", color: "#791F1F", fontSize: 12.5, fontWeight: 500 },
  saveBtn: { flex: 1, padding: "10px 12px", borderRadius: 9, border: "none", background: "#BC6C25", color: "#FFFFFF", fontSize: 13, fontWeight: 500, marginRight: "auto" },
  tabRow: { display: "flex", gap: 6, margin: "10px 0 4px" },
  tabBtn: { flex: 1, padding: "7px 8px", borderRadius: 8, border: "1px solid #C9C0A8", background: "#FFFFFF", fontSize: 12.5, color: "#4A453A" },
  tabBtnActive: { background: "#34345C", borderColor: "#34345C", color: "#EDECF6" },
  farmRow: { display: "flex", alignItems: "center", gap: 4, background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 8, padding: "8px 10px" },
  farmRowName: { fontSize: 13, fontWeight: 500 },
  farmRowLoc: { fontSize: 11, color: "#6B6355", display: "flex", alignItems: "center", gap: 3, marginTop: 2 },
  priceGroupBlock: { background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 8, padding: "8px 10px", marginTop: 6 },
  priceGroupLabel: { fontSize: 12, fontWeight: 500, color: "#23291F" },
  breakdownRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4A453A", padding: "4px 0" },
  breakdownTotal: { borderTop: "1px solid #DAD3BE", marginTop: 4, paddingTop: 6, fontWeight: 500, color: "#BC6C25" },
};
