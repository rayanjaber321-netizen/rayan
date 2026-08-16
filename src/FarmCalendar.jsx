import React, { useState, useMemo, useEffect, useRef } from "react";
import { Sun, Moon, X, Settings, ChevronRight, ChevronLeft, Banknote, CreditCard, Landmark, Trash2, User, Phone, StickyNote, Plus, MapPin, Pencil, RefreshCw, Wallet, LogOut, Star, CalendarDays, Link2, Unlink, Play } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  ARABIC_MONTHS, WEEKDAYS, WEEKDAY_KEYS, DEFAULT_TIMES, farmTimes,
  pad, dateKey, fmtMoney, fmtTime12, fmtTime12Short, fmtDateShort, toDateTime, addDays,
  priceForWeekday, extraGuestFeeFor, defaultPriceSet, buildMonthGrid,
} from "./shared.js";

const PAYMENT_METHODS = [
  { id: "نقدي", label: "نقدي", icon: Banknote },
  { id: "كليك", label: "كليك", icon: CreditCard },
  { id: "تحويل بنكي", label: "تحويل بنكي", icon: Landmark },
];
const REFERRAL_FEE = 5;
// علي مالوش أي علاقة بهاي المزارع أساساً — ما بتظهر عمولته إلها بالإعدادات.
const NO_ALI_COMMISSION_FARMS = ["نخل", "هيثم"];
function farmHasNoAliCommission(farmName) {
  return NO_ALI_COMMISSION_FARMS.some((m) => (farmName || "").includes(m));
}

function bookingFinal(b) {
  return Math.max(0, Number(b.base) + Number(b.extraGuestFee || 0) - Number(b.discount || 0));
}
function isBookingSettled(b) {
  const remaining = Math.max(0, bookingFinal(b) - Number(b.depositAmount || 0));
  return remaining <= 0 || !!b.remainingSettled;
}

function priceRowToApp(row) {
  const day = {}, night = {};
  WEEKDAY_KEYS.forEach((k) => { day[k] = row[`day_${k}`]; night[k] = row[`night_${k}`]; });
  return {
    day, night,
    guestLimit: row.guest_limit,
    guestFee: row.guest_fee,
    guestStep: row.guest_step || 1,
    dayStart: row.day_start || DEFAULT_TIMES.day.start,
    dayEnd: row.day_end || DEFAULT_TIMES.day.end,
    nightStart: row.night_start || DEFAULT_TIMES.night.start,
    nightEnd: row.night_end || DEFAULT_TIMES.night.end,
  };
}
function priceAppToRow(farmId, p) {
  const dayNightCols = {};
  WEEKDAY_KEYS.forEach((k) => {
    dayNightCols[`day_${k}`] = Number(p.day[k]) || 0;
    dayNightCols[`night_${k}`] = Number(p.night[k]) || 0;
  });
  return {
    farm_id: farmId,
    ...dayNightCols,
    guest_limit: Number(p.guestLimit) || 0, guest_fee: Number(p.guestFee) || 0, guest_step: Number(p.guestStep) || 1,
    day_start: p.dayStart || DEFAULT_TIMES.day.start, day_end: p.dayEnd || DEFAULT_TIMES.day.end,
    night_start: p.nightStart || DEFAULT_TIMES.night.start, night_end: p.nightEnd || DEFAULT_TIMES.night.end,
  };
}
function bookingRowToApp(row) {
  return {
    customer: row.customer || "", phone: row.phone || "",
    base: row.base || 0, discount: row.discount || 0, discountReason: row.discount_reason || "",
    startDate: row.start_date || "", startTime: row.start_time || "", endDate: row.end_date || "", endTime: row.end_time || "",
    guestCount: row.guest_count || 0, extraGuestFee: row.extra_guest_fee || 0,
    depositAmount: row.deposit_amount || 0, depositMethod: row.deposit_method || "نقدي",
    remainingMethod: row.remaining_method || "نقدي", remainingSettled: !!row.remaining_settled,
    excludeCommission: !!row.exclude_commission, excludeRayanCommission: !!row.exclude_rayan_commission, notes: row.notes || "",
    googleEventId: row.google_event_id || null,
    source: row.source || "app",
  };
}
function bookingAppToRow(farmId, slotKey, b) {
  return {
    farm_id: farmId, slot_key: slotKey,
    customer: b.customer, phone: b.phone,
    base: Number(b.base) || 0, discount: Number(b.discount) || 0, discount_reason: b.discountReason || "",
    start_date: b.startDate || null, start_time: b.startTime || null, end_date: b.endDate || null, end_time: b.endTime || null,
    guest_count: Number(b.guestCount) || 0, extra_guest_fee: Number(b.extraGuestFee) || 0,
    deposit_amount: Number(b.depositAmount) || 0, deposit_method: b.depositMethod,
    remaining_method: b.remainingMethod, remaining_settled: !!b.remainingSettled,
    exclude_commission: !!b.excludeCommission, exclude_rayan_commission: !!b.excludeRayanCommission, notes: b.notes || "",
    google_event_id: b.googleEventId || null,
  };
}

async function syncBookingToCalendar(farmId, slotKey, farmName, booking) {
  try {
    const res = await fetch("/api/calendar/sync-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId,
        googleEventId: booking.googleEventId || null,
        action: "upsert",
        event: {
          slotKey,
          title: `حجز: ${booking.customer} — ${farmName}`,
          description: [booking.phone && `الهاتف: ${booking.phone}`, booking.notes].filter(Boolean).join("\n"),
          startDateTime: `${booking.startDate}T${booking.startTime}:00`,
          endDateTime: `${booking.endDate}T${booking.endTime}:00`,
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.googleEventId || null;
  } catch (e) {
    console.error("Calendar sync failed:", e);
    return null;
  }
}

async function deleteBookingFromCalendar(farmId, googleEventId) {
  if (!googleEventId) return;
  try {
    await fetch("/api/calendar/sync-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId, googleEventId, action: "delete" }),
    });
  } catch (e) {
    console.error("Calendar delete failed:", e);
  }
}

const emptyForm = { customer: "", phone: "", base: 0, discount: 0, discountReason: "", startDate: "", startTime: "", endDate: "", endTime: "", guestCount: "", extraGuestFee: 0, depositAmount: 0, depositMethod: "نقدي", remainingMethod: "نقدي", remainingSettled: false, excludeCommission: false, excludeRayanCommission: false, notes: "" };
const emptyFarmDraft = { name: "", location: "", maps_url: "", description: "" };
const emptyFinanceDraft = { label: "", amount: "" };

export default function FarmCalendar() {
  const today = new Date();

  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [prices, setPrices] = useState({});
  const [bookings, setBookings] = useState({});
  const [finances, setFinances] = useState({});
  const [photos, setPhotos] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState(emptyFinanceDraft);
  const [salaryDraft, setSalaryDraft] = useState(emptyFinanceDraft);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("farms");
  const [farmDraft, setFarmDraft] = useState(emptyFarmDraft);
  const [editingFarmId, setEditingFarmId] = useState(null);
  const [pricingFarmId, setPricingFarmId] = useState(null);
  const [draftPrices, setDraftPrices] = useState(defaultPriceSet());
  const [commissionSettings, setCommissionSettings] = useState({});
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState({});
  const touchStartY = useRef(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [accountDraft, setAccountDraft] = useState({ email: "", password: "", confirmPassword: "" });
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [farmsRes, pricesRes, bookingsRes, financeRes, photosRes, commissionRes] = await Promise.all([
        supabase.from("farms").select("*").order("created_at"),
        supabase.from("farm_prices").select("*"),
        supabase.from("bookings").select("*"),
        supabase.from("finance_items").select("*"),
        supabase.from("farm_photos").select("*").order("created_at"),
        supabase.from("farm_commission_settings").select("*"),
      ]);
      if (cancelled) return;

      const loadedFarms = farmsRes.data || [];
      const pricesById = {};
      (pricesRes.data || []).forEach((row) => { pricesById[row.farm_id] = priceRowToApp(row); });
      const bookingsById = {};
      (bookingsRes.data || []).forEach((row) => {
        bookingsById[row.farm_id] = bookingsById[row.farm_id] || {};
        bookingsById[row.farm_id][row.slot_key] = bookingRowToApp(row);
      });
      const financesById = {};
      (financeRes.data || []).forEach((row) => {
        financesById[row.farm_id] = financesById[row.farm_id] || {};
        financesById[row.farm_id][row.month_key] = financesById[row.farm_id][row.month_key] || { expenses: [], salaries: [] };
        const list = row.item_type === "expense" ? "expenses" : "salaries";
        financesById[row.farm_id][row.month_key][list].push({ id: row.id, label: row.label, amount: Number(row.amount) });
      });
      const photosById = {};
      (photosRes.data || []).forEach((row) => {
        photosById[row.farm_id] = photosById[row.farm_id] || [];
        photosById[row.farm_id].push({ id: row.id, url: row.url, isCover: !!row.is_cover, mediaType: row.media_type || "photo" });
      });
      const commissionById = {};
      (commissionRes.data || []).forEach((row) => { commissionById[row.farm_id] = { aliFee: row.ali_fee ?? REFERRAL_FEE, rayanFee: row.rayan_fee ?? REFERRAL_FEE }; });

      setFarms(loadedFarms);
      setPrices(pricesById);
      setBookings(bookingsById);
      setFinances(financesById);
      setPhotos(photosById);
      setCommissionSettings(commissionById);
      if (loadedFarms.length) {
        setSelectedFarmId(loadedFarms[0].id);
        setPricingFarmId(loadedFarms[0].id);
        setDraftPrices(pricesById[loadedFarms[0].id] || defaultPriceSet());
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email || "";
      setCurrentEmail(email);
      setAccountDraft((prev) => ({ ...prev, email }));
    });
  }, []);

  async function refreshCalendarStatus(farmIds) {
    const entries = await Promise.all(
      farmIds.map(async (id) => {
        try {
          const res = await fetch(`/api/calendar/status?farmId=${encodeURIComponent(id)}`);
          const data = await res.json();
          return [id, data];
        } catch {
          return [id, { connected: false }];
        }
      })
    );
    setCalendarStatus((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }

  useEffect(() => {
    if (!farms.length) return;
    refreshCalendarStatus(farms.map((f) => f.id));
  }, [farms.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (!result) return;
    if (result === "connected") alert("تم ربط قوقل كالندر بنجاح");
    else if (result === "error") alert("صار خطأ بربط قوقل كالندر، حاول مرة ثانية");
    window.history.replaceState({}, "", window.location.pathname);
    setSettingsOpen(true);
    setSettingsTab("farms");
  }, []);

  function connectGoogleCalendar(farmId) {
    window.location.href = `/api/auth/google/start?farmId=${encodeURIComponent(farmId)}`;
  }

  async function disconnectGoogleCalendar(farmId) {
    if (!confirm("متأكد بدك تفصل قوقل كالندر عن هاي المزرعة؟")) return;
    await fetch("/api/calendar/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId }),
    });
    setCalendarStatus((prev) => ({ ...prev, [farmId]: { connected: false } }));
  }

  async function saveAccount() {
    const updates = {};
    if (accountDraft.email.trim() && accountDraft.email.trim() !== currentEmail) updates.email = accountDraft.email.trim();
    if (accountDraft.password) {
      if (accountDraft.password.length < 6) { alert("كلمة المرور لازم تكون 6 أحرف على الأقل"); return; }
      if (accountDraft.password !== accountDraft.confirmPassword) { alert("كلمتا المرور غير متطابقتين"); return; }
      updates.password = accountDraft.password;
    }
    if (!Object.keys(updates).length) return;
    setSavingAccount(true);
    const { error } = await supabase.auth.updateUser(updates);
    setSavingAccount(false);
    if (error) { console.error(error); alert("صار خطأ: " + error.message); return; }
    setAccountDraft((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    alert(updates.email ? "تم التحديث. إذا تغيّر البريد الإلكتروني ممكن تحتاج تأكيده من صندوق الوارد قبل ما يفعّل." : "تم تغيير كلمة المرور بنجاح");
  }

  const year = current.getFullYear();
  const month = current.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const farm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const farmBookings = bookings[selectedFarmId] || {};
  const farmPrices = { ...defaultPriceSet(), ...(prices[selectedFarmId] || {}) };
  const financeMonthKey = `${year}-${pad(month + 1)}`;
  const farmFinances = finances[selectedFarmId] || {};
  const curFinances = farmFinances[financeMonthKey] || { expenses: [], salaries: [] };

  const stats = useMemo(() => {
    let count = 0, revenue = 0, remaining = 0;
    const prefix = `${year}-${pad(month + 1)}-`;
    Object.entries(farmBookings).forEach(([k, b]) => {
      if (!k.startsWith(prefix)) return;
      count += 1;
      if (b.excludeCommission) return; // حجز خاص — ما بينحسب بالإيرادات ولا المبالغ المتوقعة
      const final = bookingFinal(b);
      revenue += final;
      remaining += Math.max(0, final - Number(b.depositAmount || 0));
    });
    return { count, revenue, remaining };
  }, [farmBookings, year, month]);

  const totalExpenses = curFinances.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalSalaries = curFinances.salaries.reduce((s, e) => s + Number(e.amount || 0), 0);

  const aliFee = commissionSettings[selectedFarmId]?.aliFee ?? REFERRAL_FEE;
  const rayanFee = commissionSettings[selectedFarmId]?.rayanFee ?? REFERRAL_FEE;

  const { aliEligibleCount, rayanEligibleCount } = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}-`;
    let ali = 0, rayan = 0;
    Object.entries(farmBookings).forEach(([k, b]) => {
      if (!k.startsWith(prefix) || b.excludeCommission) return;
      ali += 1;
      if (!b.excludeRayanCommission) rayan += 1;
    });
    return { aliEligibleCount: ali, rayanEligibleCount: rayan };
  }, [farmBookings, year, month]);
  const referralCommissions = [
    { label: "راتب علي", count: aliEligibleCount, fee: aliFee, amount: aliEligibleCount * aliFee },
    { label: "راتب ريان", count: rayanEligibleCount, fee: rayanFee, amount: rayanEligibleCount * rayanFee },
  ];
  const totalCommissions = referralCommissions.reduce((s, r) => s + r.amount, 0);

  const netIncome = stats.revenue - totalExpenses - totalSalaries - totalCommissions;

  function priceFor(day, slot) {
    const weekday = new Date(year, month, day).getDay();
    return priceForWeekday(farmPrices, weekday, slot);
  }

  function findOccupyingBooking(dateStr, slot) {
    const exactKey = `${dateStr}_${slot}`;
    const exact = farmBookings[exactKey];
    if (exact) return { key: exactKey, booking: exact, isPrimary: true };

    const defaults = farmTimes(farmPrices)[slot];
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
    const defaults = farmTimes(farmPrices)[slot];
    const endDateStr = defaults.end <= defaults.start ? addDays(dateStr, 1) : dateStr;
    setForm(existing ? { ...emptyForm, ...existing } : { ...emptyForm, base: priceFor(day, slot), startDate: dateStr, startTime: defaults.start, endDate: endDateStr, endTime: defaults.end });
    setModal({ key, slot, day });
  }
  function closeModal() { setModal(null); setForm(emptyForm); }

  async function saveBooking() {
    if (!form.customer.trim()) return;
    const key = modal.key;
    const farmId = selectedFarmId;
    const farmName = farm?.name || "";
    const clean = { ...form, base: Number(form.base) || 0, discount: Number(form.discount) || 0, guestCount: Number(form.guestCount) || 0, extraGuestFee: Number(form.extraGuestFee) || 0, depositAmount: Number(form.depositAmount) || 0, remainingSettled: !!form.remainingSettled, excludeCommission: !!form.excludeCommission, excludeRayanCommission: !!form.excludeRayanCommission };
    setBookings((prev) => ({
      ...prev,
      [farmId]: { ...prev[farmId], [key]: clean },
    }));
    closeModal();
    const { error } = await supabase.from("bookings").upsert(bookingAppToRow(farmId, key, clean), { onConflict: "farm_id,slot_key" });
    if (error) { console.error(error); alert("صار خطأ بحفظ الحجز، تأكد من الاتصال بالإنترنت وحاول مرة ثانية"); return; }

    const googleEventId = await syncBookingToCalendar(farmId, key, farmName, clean);
    if (googleEventId && googleEventId !== clean.googleEventId) {
      setBookings((prev) => ({ ...prev, [farmId]: { ...prev[farmId], [key]: { ...prev[farmId][key], googleEventId } } }));
      await supabase.from("bookings").update({ google_event_id: googleEventId }).eq("farm_id", farmId).eq("slot_key", key);
    }
  }
  async function deleteBooking() {
    const key = modal.key;
    const farmId = selectedFarmId;
    const existingGoogleEventId = bookings[farmId]?.[key]?.googleEventId || null;
    setBookings((prev) => {
      const copy = { ...prev[farmId] };
      delete copy[key];
      return { ...prev, [farmId]: copy };
    });
    closeModal();
    const { error } = await supabase.from("bookings").delete().eq("farm_id", farmId).eq("slot_key", key);
    if (error) console.error(error);
    deleteBookingFromCalendar(farmId, existingGoogleEventId);
  }
  function changeMonth(delta) { setCurrent(new Date(year, month + delta, 1)); }

  async function addFinanceItem(type, label, amount) {
    if (!label.trim() || !Number(amount)) return;
    const farmId = selectedFarmId;
    const mk = financeMonthKey;
    const itemType = type === "expenses" ? "expense" : "salary";
    const { data, error } = await supabase
      .from("finance_items")
      .insert({ farm_id: farmId, month_key: mk, item_type: itemType, label, amount: Number(amount) })
      .select()
      .single();
    if (error) { console.error(error); alert("صار خطأ بالإضافة، حاول مرة ثانية"); return; }
    setFinances((prev) => {
      const farmFin = prev[farmId] || {};
      const cur = farmFin[mk] || { expenses: [], salaries: [] };
      return { ...prev, [farmId]: { ...farmFin, [mk]: { ...cur, [type]: [...cur[type], { id: data.id, label, amount: Number(amount) }] } } };
    });
  }
  async function removeFinanceItem(type, id) {
    const farmId = selectedFarmId;
    const mk = financeMonthKey;
    setFinances((prev) => {
      const farmFin = prev[farmId] || {};
      const cur = farmFin[mk] || { expenses: [], salaries: [] };
      return { ...prev, [farmId]: { ...farmFin, [mk]: { ...cur, [type]: cur[type].filter((it) => it.id !== id) } } };
    });
    const { error } = await supabase.from("finance_items").delete().eq("id", id);
    if (error) console.error(error);
  }

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
    setDraftPrices({ ...defaultPriceSet(), aliFee: REFERRAL_FEE, rayanFee: REFERRAL_FEE, ...(prices[farmId] || {}), ...(commissionSettings[farmId] || {}) });
    setSettingsOpen(true);
  }

  async function addOrUpdateFarm() {
    if (!farmDraft.name.trim()) return;
    if (editingFarmId) {
      const id = editingFarmId;
      setFarms((prev) => prev.map((f) => (f.id === id ? { ...f, ...farmDraft } : f)));
      setFarmDraft(emptyFarmDraft);
      setEditingFarmId(null);
      const { error } = await supabase.from("farms").update({ name: farmDraft.name, location: farmDraft.location, maps_url: farmDraft.maps_url, description: farmDraft.description }).eq("id", id);
      if (error) { console.error(error); alert("صار خطأ بتعديل المزرعة"); }
    } else {
      const id = "f" + Date.now();
      const newFarm = { id, name: farmDraft.name, location: farmDraft.location, maps_url: farmDraft.maps_url, description: farmDraft.description };
      setFarms((prev) => [...prev, newFarm]);
      setPrices((prev) => ({ ...prev, [id]: defaultPriceSet() }));
      setBookings((prev) => ({ ...prev, [id]: {} }));
      setSelectedFarmId(id);
      setFarmDraft(emptyFarmDraft);
      setEditingFarmId(null);
      const { error: farmErr } = await supabase.from("farms").insert(newFarm);
      if (farmErr) { console.error(farmErr); alert("صار خطأ بإضافة المزرعة"); return; }
      const { error: priceErr } = await supabase.from("farm_prices").insert(priceAppToRow(id, defaultPriceSet()));
      if (priceErr) console.error(priceErr);
    }
  }
  function startEditFarm(f) { setEditingFarmId(f.id); setFarmDraft({ name: f.name, location: f.location, maps_url: f.maps_url || "", description: f.description || "" }); }
  async function deleteFarm(id) {
    if (farms.length === 1) return;
    const nextFarms = farms.filter((f) => f.id !== id);
    setFarms(nextFarms);
    if (selectedFarmId === id) setSelectedFarmId(nextFarms[0].id);
    const { error } = await supabase.from("farms").delete().eq("id", id);
    if (error) console.error(error);
  }
  async function savePricing() {
    const day = {}, night = {};
    WEEKDAY_KEYS.forEach((k) => { day[k] = Number(draftPrices.day[k]) || 0; night[k] = Number(draftPrices.night[k]) || 0; });
    const clean = {
      day, night,
      guestLimit: Number(draftPrices.guestLimit) || 0,
      guestFee: Number(draftPrices.guestFee) || 0,
      guestStep: Number(draftPrices.guestStep) || 1,
      dayStart: draftPrices.dayStart || DEFAULT_TIMES.day.start,
      dayEnd: draftPrices.dayEnd || DEFAULT_TIMES.day.end,
      nightStart: draftPrices.nightStart || DEFAULT_TIMES.night.start,
      nightEnd: draftPrices.nightEnd || DEFAULT_TIMES.night.end,
    };
    // Number.isNaN check (not ||) so a deliberate 0 — meaning "no commission for this farm" — isn't overwritten by the default.
    const pricingFarmName = farms.find((f) => f.id === pricingFarmId)?.name;
    const aliFee = farmHasNoAliCommission(pricingFarmName) ? 0 : (Number.isNaN(Number(draftPrices.aliFee)) ? REFERRAL_FEE : Number(draftPrices.aliFee));
    const rayanFee = Number.isNaN(Number(draftPrices.rayanFee)) ? REFERRAL_FEE : Number(draftPrices.rayanFee);
    setPrices((prev) => ({ ...prev, [pricingFarmId]: clean }));
    setCommissionSettings((prev) => ({ ...prev, [pricingFarmId]: { aliFee, rayanFee } }));
    setSettingsOpen(false);
    const { error } = await supabase.from("farm_prices").upsert(priceAppToRow(pricingFarmId, clean), { onConflict: "farm_id" });
    if (error) { console.error(error); alert("صار خطأ بحفظ الأسعار"); }
    const { error: commErr } = await supabase.from("farm_commission_settings").upsert({ farm_id: pricingFarmId, ali_fee: aliFee, rayan_fee: rayanFee }, { onConflict: "farm_id" });
    if (commErr) { console.error(commErr); alert("صار خطأ بحفظ العمولات"); }
  }

  async function uploadPhoto(farmId, file) {
    if (!file) return;
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";
    setUploadingPhoto(true);
    const path = `${farmId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("farm-photos").upload(path, file);
    if (upErr) { console.error(upErr); alert("صار خطأ برفع الملف: " + upErr.message); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from("farm-photos").getPublicUrl(path);
    const { data, error } = await supabase.from("farm_photos").insert({ farm_id: farmId, url: urlData.publicUrl, media_type: mediaType }).select().single();
    setUploadingPhoto(false);
    if (error) { console.error(error); alert("صار خطأ بحفظ الملف: " + error.message); return; }
    setPhotos((prev) => ({ ...prev, [farmId]: [...(prev[farmId] || []), { id: data.id, url: data.url, mediaType }] }));
  }
  async function deletePhoto(farmId, photoId) {
    setPhotos((prev) => ({ ...prev, [farmId]: (prev[farmId] || []).filter((p) => p.id !== photoId) }));
    const { error } = await supabase.from("farm_photos").delete().eq("id", photoId);
    if (error) console.error(error);
  }
  async function setCoverPhoto(farmId, photoId) {
    setPhotos((prev) => ({
      ...prev,
      [farmId]: (prev[farmId] || []).map((p) => ({ ...p, isCover: p.id === photoId })),
    }));
    const { error: clearErr } = await supabase.from("farm_photos").update({ is_cover: false }).eq("farm_id", farmId);
    if (clearErr) { console.error(clearErr); alert("صار خطأ بتعيين صورة الغلاف: " + clearErr.message); return; }
    const { error: setErr } = await supabase.from("farm_photos").update({ is_cover: true }).eq("id", photoId);
    if (setErr) { console.error(setErr); alert("صار خطأ بتعيين صورة الغلاف: " + setErr.message); }
  }

  const final = Math.max(0, Number(form.base || 0) + Number(form.extraGuestFee || 0) - Number(form.discount || 0));
  const remainingAmount = Math.max(0, final - Number(form.depositAmount || 0));

  let timeRangeLabel = "";
  if (modal && form.startDate && form.startTime && form.endDate && form.endTime) {
    timeRangeLabel = form.startDate === form.endDate
      ? `${fmtDateShort(form.startDate)} — ${fmtTime12(form.startTime)} ← ${fmtTime12(form.endTime)}`
      : `${fmtDateShort(form.startDate)} ${fmtTime12(form.startTime)} ← ${fmtDateShort(form.endDate)} ${fmtTime12(form.endTime)}`;
  }

  if (loading) {
    return (
      <div dir="rtl" style={{ ...styles.wrap, textAlign: "center", padding: "60px 20px", color: "#6B6355" }}>
        جاري تحميل البيانات...
      </div>
    );
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
        <div style={styles.headerBtns}>
          <button className="fc-btn" onClick={() => setFinanceOpen(true)} style={styles.settingsBtn} aria-label="الحسابات">
            <Wallet size={18} color="#F7F3E9" />
          </button>
          <button className="fc-btn" onClick={openFarmsTab} style={styles.settingsBtn} aria-label="الإعدادات">
            <Settings size={18} color="#F7F3E9" />
          </button>
        </div>
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
        <div style={styles.legendItem}><Sun size={13} color="#4E5A31" /><span>نهاري {fmtTime12Short(farmTimes(farmPrices).day.start)}–{fmtTime12Short(farmTimes(farmPrices).day.end)}</span></div>
        <div style={styles.legendItem}><Moon size={13} color="#34345C" /><span>سهرة {fmtTime12Short(farmTimes(farmPrices).night.start)}–{fmtTime12Short(farmTimes(farmPrices).night.end)}</span></div>
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
                {dayResult?.isPrimary && (
                  <span
                    style={{ ...styles.pendingDot, background: isBookingSettled(dayResult.booking) ? "#4E7A3D" : "#BC6C25" }}
                    title={isBookingSettled(dayResult.booking) ? "تم استلام المبلغ بالكامل" : "بانتظار تحصيل الباقي"}
                  />
                )}
              </div>
              <div
                className="fc-cellhalf"
                onClick={() => (nightResult && !nightResult.isPrimary ? openModalByKey(nightResult.key) : openModal(d, "night"))}
                style={{ ...styles.slotHalf, background: nightResult ? "#34345C" : "#E7E3D5" }}
                title={nightResult && !nightResult.isPrimary ? `امتداد حجز حتى ${fmtDateShort(nightResult.booking.endDate)} ${fmtTime12(nightResult.booking.endTime)}` : "فترة سهرة"}
              >
                <Moon size={11} color={nightResult ? "#DEDCEE" : "#A6A28E"} />
                {nightResult && <span style={{ ...styles.slotName, color: "#EDECF6" }}>{nightResult.booking.customer}</span>}
                {nightResult?.isPrimary && (
                  <span
                    style={{ ...styles.pendingDot, background: isBookingSettled(nightResult.booking) ? "#4E7A3D" : "#BC6C25" }}
                    title={isBookingSettled(nightResult.booking) ? "تم استلام المبلغ بالكامل" : "بانتظار تحصيل الباقي"}
                  />
                )}
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
                {final > 0 && (
                  <span style={{ ...styles.pendingBadge, ...(remainingAmount > 0 && !form.remainingSettled ? {} : styles.settledBadge) }}>
                    {remainingAmount > 0 && !form.remainingSettled ? "معلّق" : "مؤكد"}
                  </span>
                )}
              </div>
              <button className="fc-btn" onClick={closeModal} style={styles.iconBtn} aria-label="إغلاق"><X size={18} color="#6B6355" /></button>
            </div>
            <div style={styles.modalSub}>{timeRangeLabel}</div>
            {form.source === "google" && (
              <div style={styles.googleSourceNote}>
                <CalendarDays size={12} /> مضاف تلقائياً من قوقل كالندر — عدّل وحفظ لو بدك تربطه بحجز حقيقي
              </div>
            )}

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

              <label className="fc-btn" style={styles.checkboxRow}>
                <input type="checkbox" checked={!!form.excludeCommission} onChange={(e) => setForm({ ...form, excludeCommission: e.target.checked })} />
                حجز خاص (بدون عمولة علي وريان) — مثلاً لأصحاب المزرعة
              </label>

              <label className="fc-btn" style={styles.checkboxRow}>
                <input type="checkbox" checked={!!form.excludeRayanCommission} onChange={(e) => setForm({ ...form, excludeRayanCommission: e.target.checked })} />
                بدون عمولة ريان
              </label>

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
                  setForm({ ...form, guestCount, extraGuestFee: extraGuestFeeFor(farmPrices, guestCount) });
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
              <button className="fc-btn" onClick={() => { setSettingsTab("pricing"); setPricingFarmId(selectedFarmId); setDraftPrices({ ...defaultPriceSet(), aliFee: REFERRAL_FEE, rayanFee: REFERRAL_FEE, ...(prices[selectedFarmId] || {}), ...(commissionSettings[selectedFarmId] || {}) }); }} style={{ ...styles.tabBtn, ...(settingsTab === "pricing" ? styles.tabBtnActive : {}) }}>الأسعار</button>
              <button className="fc-btn" onClick={() => { setSettingsTab("photos"); setPricingFarmId(selectedFarmId); }} style={{ ...styles.tabBtn, ...(settingsTab === "photos" ? styles.tabBtnActive : {}) }}>الصور</button>
              <button className="fc-btn" onClick={() => setSettingsTab("account")} style={{ ...styles.tabBtn, ...(settingsTab === "account" ? styles.tabBtnActive : {}) }}>الحساب</button>
            </div>

            {settingsTab === "farms" && (
              <div style={styles.formGrid}>
                {farms.map((f) => (
                  <div key={f.id} style={styles.farmCard}>
                    <div style={styles.farmRow}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.farmRowName}>{f.name}</div>
                        {f.location && <div style={styles.farmRowLoc}><MapPin size={11} /> {f.location}</div>}
                      </div>
                      <button className="fc-btn" onClick={() => startEditFarm(f)} style={styles.iconBtnSmall} aria-label="تعديل"><Pencil size={14} color="#6B6355" /></button>
                      {farms.length > 1 && <button className="fc-btn" onClick={() => deleteFarm(f.id)} style={styles.iconBtnSmall} aria-label="حذف"><Trash2 size={14} color="#791F1F" /></button>}
                    </div>
                    <div style={styles.calendarRow}>
                      <CalendarDays size={13} color="#6B6355" />
                      {calendarStatus[f.id]?.connected ? (
                        <>
                          <span style={styles.calendarConnectedText}>متصل: {calendarStatus[f.id].email}</span>
                          <button className="fc-btn" onClick={() => disconnectGoogleCalendar(f.id)} style={styles.calendarLinkBtn}>
                            <Unlink size={12} /> فصل
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={styles.calendarDisconnectedText}>غير مربوط بقوقل كالندر</span>
                          <button className="fc-btn" onClick={() => connectGoogleCalendar(f.id)} style={styles.calendarLinkBtn}>
                            <Link2 size={12} /> ربط
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <label style={{ ...styles.label, marginTop: 12 }}>{editingFarmId ? "تعديل المزرعة" : "إضافة مزرعة جديدة"}</label>
                <input className="fc-input" style={styles.input} value={farmDraft.name} onChange={(e) => setFarmDraft({ ...farmDraft, name: e.target.value })} placeholder="اسم المزرعة" />
                <input className="fc-input" style={styles.input} value={farmDraft.location} onChange={(e) => setFarmDraft({ ...farmDraft, location: e.target.value })} placeholder="اللوكيشن (مثلاً: جرش)" />
                <input className="fc-input" style={styles.input} value={farmDraft.maps_url} onChange={(e) => setFarmDraft({ ...farmDraft, maps_url: e.target.value })} placeholder="رابط الموقع (خرائط قوقل)" />
                <textarea className="fc-input" style={{ ...styles.input, minHeight: 70, resize: "vertical", paddingTop: 8 }} value={farmDraft.description} onChange={(e) => setFarmDraft({ ...farmDraft, description: e.target.value })} placeholder="وصف المزرعة (يظهر للعميل)" />
                <button className="fc-btn" onClick={addOrUpdateFarm} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>{editingFarmId ? "حفظ التعديل" : "إضافة المزرعة"}</button>

                <button className="fc-btn" onClick={() => supabase.auth.signOut()} style={{ ...styles.tabBtn, marginTop: 16, color: "#791F1F", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <LogOut size={13} /> تسجيل خروج
                </button>
              </div>
            )}

            {settingsTab === "pricing" && (
              <div style={styles.formGrid}>
                <label style={styles.label}>المزرعة</label>
                <select className="fc-select" style={styles.input} value={pricingFarmId} onChange={(e) => { setPricingFarmId(e.target.value); setDraftPrices({ ...defaultPriceSet(), aliFee: REFERRAL_FEE, rayanFee: REFERRAL_FEE, ...(prices[e.target.value] || {}), ...(commissionSettings[e.target.value] || {}) }); }}>
                  {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {WEEKDAY_KEYS.map((k, i) => (
                  <div key={k} style={styles.priceGroupBlock}>
                    <div style={styles.priceGroupLabel}>يوم {WEEKDAYS[i]}</div>
                    <div style={styles.twoCol}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}><Sun size={12} /> نهاري</label>
                        <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.day[k]} onChange={(e) => setDraftPrices({ ...draftPrices, day: { ...draftPrices.day, [k]: e.target.value } })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}><Moon size={12} /> سهرة</label>
                        <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.night[k]} onChange={(e) => setDraftPrices({ ...draftPrices, night: { ...draftPrices.night, [k]: e.target.value } })} />
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
                      <label style={styles.label}>كل كم شخص إضافي</label>
                      <input className="fc-input fc-num" type="number" min="1" style={styles.input} value={draftPrices.guestStep} onChange={(e) => setDraftPrices({ ...draftPrices, guestStep: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={styles.label}>رسوم كل {draftPrices.guestStep > 1 ? `${draftPrices.guestStep} أشخاص` : "شخص"} إضافي (د.أ)</label>
                    <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.guestFee} onChange={(e) => setDraftPrices({ ...draftPrices, guestFee: e.target.value })} />
                  </div>
                </div>

                <div style={styles.priceGroupBlock}>
                  <div style={styles.priceGroupLabel}>مواعيد الفترتين</div>
                  <div style={styles.twoCol}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}><Sun size={12} /> بداية النهاري</label>
                      <input className="fc-input fc-num" type="time" style={styles.input} value={draftPrices.dayStart} onChange={(e) => setDraftPrices({ ...draftPrices, dayStart: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}><Sun size={12} /> نهاية النهاري</label>
                      <input className="fc-input fc-num" type="time" style={styles.input} value={draftPrices.dayEnd} onChange={(e) => setDraftPrices({ ...draftPrices, dayEnd: e.target.value })} />
                    </div>
                  </div>
                  <div style={styles.twoCol}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}><Moon size={12} /> بداية السهرة</label>
                      <input className="fc-input fc-num" type="time" style={styles.input} value={draftPrices.nightStart} onChange={(e) => setDraftPrices({ ...draftPrices, nightStart: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}><Moon size={12} /> نهاية السهرة</label>
                      <input className="fc-input fc-num" type="time" style={styles.input} value={draftPrices.nightEnd} onChange={(e) => setDraftPrices({ ...draftPrices, nightEnd: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div style={styles.priceGroupBlock}>
                  <div style={styles.priceGroupLabel}>عمولة {farmHasNoAliCommission(farms.find((f) => f.id === pricingFarmId)?.name) ? "ريان" : "علي وريان"} لهاي المزرعة</div>
                  {farmHasNoAliCommission(farms.find((f) => f.id === pricingFarmId)?.name) ? (
                    <div>
                      <label style={styles.label}>عمولة ريان لكل حجز (د.أ)</label>
                      <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.rayanFee} onChange={(e) => setDraftPrices({ ...draftPrices, rayanFee: e.target.value })} />
                      <div style={styles.photoNote}>علي مالوش عمولة بهاي المزرعة أساساً</div>
                    </div>
                  ) : (
                    <>
                      <div style={styles.twoCol}>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>عمولة علي لكل حجز (د.أ)</label>
                          <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.aliFee} onChange={(e) => setDraftPrices({ ...draftPrices, aliFee: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>عمولة ريان لكل حجز (د.أ)</label>
                          <input className="fc-input fc-num" type="number" style={styles.input} value={draftPrices.rayanFee} onChange={(e) => setDraftPrices({ ...draftPrices, rayanFee: e.target.value })} />
                        </div>
                      </div>
                      <div style={styles.photoNote}>حط 0 عشان تلغي عمولة أي واحد فيهم لهاي المزرعة تحديداً</div>
                    </>
                  )}
                </div>

                <button className="fc-btn" onClick={savePricing} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>حفظ الأسعار</button>
              </div>
            )}

            {settingsTab === "photos" && (
              <div style={styles.formGrid}>
                <label style={styles.label}>المزرعة</label>
                <select className="fc-select" style={styles.input} value={pricingFarmId} onChange={(e) => setPricingFarmId(e.target.value)}>
                  {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                <div style={styles.photoNote}>دوس نجمة الصورة عشان تصير هي صورة الغلاف يلي بتظهر بالواجهة العامة</div>
                <div style={styles.photoGrid}>
                  {(photos[pricingFarmId] || []).map((p) => (
                    <div key={p.id} style={{ ...styles.photoThumbWrap, ...(p.isCover ? styles.photoThumbWrapCover : {}) }}>
                      {p.mediaType === "video" ? (
                        <>
                          <video src={p.url} muted playsInline style={styles.photoThumb} />
                          <div style={styles.videoThumbBadge}><Play size={11} color="#fff" fill="#fff" /></div>
                        </>
                      ) : (
                        <img src={p.url} alt="" style={styles.photoThumb} />
                      )}
                      <button
                        className="fc-btn"
                        onClick={() => setCoverPhoto(pricingFarmId, p.id)}
                        style={{ ...styles.photoStarBtn, ...(p.isCover ? styles.photoStarBtnActive : {}) }}
                        aria-label="تعيين كصورة رئيسية"
                        title="تعيين كصورة رئيسية"
                      >
                        <Star size={12} color={p.isCover ? "#BC6C25" : "#FFFFFF"} fill={p.isCover ? "#BC6C25" : "none"} />
                      </button>
                      <button className="fc-btn" onClick={() => deletePhoto(pricingFarmId, p.id)} style={styles.photoDeleteBtn} aria-label="حذف">
                        <X size={12} color="#FFFFFF" />
                      </button>
                    </div>
                  ))}
                </div>

                <label className="fc-btn" style={{ ...styles.saveBtn, marginTop: 10, marginRight: 0, textAlign: "center", opacity: uploadingPhoto ? 0.6 : 1 }}>
                  {uploadingPhoto ? "...جاري الرفع" : "رفع صورة أو فيديو"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    disabled={uploadingPhoto}
                    onChange={(e) => { uploadPhoto(pricingFarmId, e.target.files[0]); e.target.value = ""; }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            )}

            {settingsTab === "account" && (
              <div style={styles.formGrid}>
                <label style={styles.label}>البريد الإلكتروني (اسم الدخول)</label>
                <input className="fc-input" style={styles.input} value={accountDraft.email} onChange={(e) => setAccountDraft({ ...accountDraft, email: e.target.value })} placeholder="بريد إلكتروني" />

                <label style={{ ...styles.label, marginTop: 10 }}>كلمة مرور جديدة (اتركها فاضية إذا ما بدك تغييرها)</label>
                <input className="fc-input" type="password" style={styles.input} value={accountDraft.password} onChange={(e) => setAccountDraft({ ...accountDraft, password: e.target.value })} placeholder="كلمة المرور الجديدة" />
                <input className="fc-input" type="password" style={styles.input} value={accountDraft.confirmPassword} onChange={(e) => setAccountDraft({ ...accountDraft, confirmPassword: e.target.value })} placeholder="تأكيد كلمة المرور الجديدة" />

                <button className="fc-btn" onClick={saveAccount} disabled={savingAccount} style={{ ...styles.saveBtn, marginTop: 10, marginRight: 0, opacity: savingAccount ? 0.6 : 1 }}>
                  {savingAccount ? "...جاري الحفظ" : "حفظ بيانات الدخول"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {financeOpen && (
        <div style={styles.overlay} onClick={() => setFinanceOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>الحسابات — {farm?.name}</div>
              <button className="fc-btn" onClick={() => setFinanceOpen(false)} style={styles.iconBtn} aria-label="إغلاق"><X size={18} color="#6B6355" /></button>
            </div>

            <div style={styles.monthNav}>
              <button className="fc-btn" onClick={() => changeMonth(1)} style={styles.navBtn}><ChevronRight size={18} /></button>
              <div style={styles.monthLabel}>{ARABIC_MONTHS[month]} {year}</div>
              <button className="fc-btn" onClick={() => changeMonth(-1)} style={styles.navBtn}><ChevronLeft size={18} /></button>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.priceGroupBlock}>
                <div style={styles.priceGroupLabel}>دخل المزرعة</div>
                <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}><span>الإيرادات</span><span className="fc-num">{fmtMoney(stats.revenue)}</span></div>
              </div>

              <div style={styles.priceGroupBlock}>
                <div style={styles.priceGroupLabel}>المصاريف الشهرية</div>
                {curFinances.expenses.map((e) => (
                  <div key={e.id} style={styles.breakdownRow}>
                    <span>{e.label}</span>
                    <span style={styles.financeItemRight}>
                      <span className="fc-num">{fmtMoney(e.amount)}</span>
                      <button className="fc-btn" onClick={() => removeFinanceItem("expenses", e.id)} style={styles.iconBtnSmall} aria-label="حذف"><Trash2 size={12} color="#791F1F" /></button>
                    </span>
                  </div>
                ))}
                <div style={styles.twoCol}>
                  <input className="fc-input" style={styles.input} placeholder="اسم المصروف" value={expenseDraft.label} onChange={(e) => setExpenseDraft({ ...expenseDraft, label: e.target.value })} />
                  <input className="fc-input fc-num" type="number" style={styles.input} placeholder="المبلغ" value={expenseDraft.amount} onChange={(e) => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} />
                </div>
                <button className="fc-btn" onClick={() => { addFinanceItem("expenses", expenseDraft.label, expenseDraft.amount); setExpenseDraft(emptyFinanceDraft); }} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>إضافة مصروف</button>
                <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}><span>مجموع المصاريف</span><span className="fc-num">{fmtMoney(totalExpenses)}</span></div>
              </div>

              <div style={styles.priceGroupBlock}>
                <div style={styles.priceGroupLabel}>الرواتب</div>
                {curFinances.salaries.map((s) => (
                  <div key={s.id} style={styles.breakdownRow}>
                    <span>{s.label}</span>
                    <span style={styles.financeItemRight}>
                      <span className="fc-num">{fmtMoney(s.amount)}</span>
                      <button className="fc-btn" onClick={() => removeFinanceItem("salaries", s.id)} style={styles.iconBtnSmall} aria-label="حذف"><Trash2 size={12} color="#791F1F" /></button>
                    </span>
                  </div>
                ))}
                <div style={styles.twoCol}>
                  <input className="fc-input" style={styles.input} placeholder="اسم الموظف" value={salaryDraft.label} onChange={(e) => setSalaryDraft({ ...salaryDraft, label: e.target.value })} />
                  <input className="fc-input fc-num" type="number" style={styles.input} placeholder="المبلغ" value={salaryDraft.amount} onChange={(e) => setSalaryDraft({ ...salaryDraft, amount: e.target.value })} />
                </div>
                <button className="fc-btn" onClick={() => { addFinanceItem("salaries", salaryDraft.label, salaryDraft.amount); setSalaryDraft(emptyFinanceDraft); }} style={{ ...styles.saveBtn, marginTop: 6, marginRight: 0 }}>إضافة راتب</button>
                <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}><span>مجموع الرواتب</span><span className="fc-num">{fmtMoney(totalSalaries)}</span></div>
              </div>

              <div style={styles.priceGroupBlock}>
                <div style={styles.priceGroupLabel}>رواتب علي وريان</div>
                {referralCommissions.filter((r) => r.fee > 0).map((r) => (
                  <div key={r.label} style={styles.breakdownRow}><span>{r.label} ({r.count} حجز × {fmtMoney(r.fee)})</span><span className="fc-num">{fmtMoney(r.amount)}</span></div>
                ))}
                <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}><span>المجموع</span><span className="fc-num">{fmtMoney(totalCommissions)}</span></div>
              </div>

              <div style={styles.finalRow}>
                <span style={styles.label}>الصافي</span>
                <span className="fc-num" style={{ ...styles.finalPrice, color: netIncome >= 0 ? "#1F5C2E" : "#791F1F" }}>{fmtMoney(netIncome)}</span>
              </div>
            </div>
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
  headerBtns: { display: "flex", gap: 6, flexShrink: 0 },
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
  settledBadge: { color: "#1F5C2E", background: "#CFE8D1" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4A453A", background: "#FFFFFF", border: "1px solid #C9C0A8", borderRadius: 8, padding: "8px 10px", marginTop: 6, cursor: "pointer" },
  modalTitle: { fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15 },
  iconBtn: { background: "transparent", padding: 4 },
  iconBtnSmall: { background: "transparent", padding: 4, display: "flex" },
  modalSub: { fontSize: 11, color: "#6B6355", marginBottom: 14 },
  googleSourceNote: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#4A5A8C", background: "#EDECF6", border: "1px solid #C9C7DE", borderRadius: 8, padding: "6px 10px", marginBottom: 12 },
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
  farmCard: { background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 },
  farmRow: { display: "flex", alignItems: "center", gap: 4 },
  farmRowName: { fontSize: 13, fontWeight: 500 },
  farmRowLoc: { fontSize: 11, color: "#6B6355", display: "flex", alignItems: "center", gap: 3, marginTop: 2 },
  calendarRow: { display: "flex", alignItems: "center", gap: 6, paddingTop: 6, borderTop: "1px solid #EFE9DA", fontSize: 11 },
  calendarConnectedText: { color: "#3B4520", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  calendarDisconnectedText: { color: "#6B6355", flex: 1 },
  calendarLinkBtn: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #C9C0A8", background: "#F7F3E9", color: "#4A453A", flexShrink: 0 },
  priceGroupBlock: { background: "#FFFFFF", border: "1px solid #DAD3BE", borderRadius: 8, padding: "8px 10px", marginTop: 6 },
  priceGroupLabel: { fontSize: 12, fontWeight: 500, color: "#23291F" },
  breakdownRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4A453A", padding: "4px 0" },
  breakdownTotal: { borderTop: "1px solid #DAD3BE", marginTop: 4, paddingTop: 6, fontWeight: 500, color: "#BC6C25" },
  financeItemRight: { display: "flex", alignItems: "center", gap: 6 },
  photoNote: { fontSize: 11, color: "#6B6355", marginTop: 6 },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 },
  photoThumbWrap: { position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1 / 1", border: "2px solid transparent" },
  photoThumbWrapCover: { borderColor: "#BC6C25" },
  photoThumb: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  videoThumbBadge: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,13,9,0.25)", pointerEvents: "none" },
  photoDeleteBtn: { position: "absolute", top: 3, left: 3, background: "rgba(35,41,31,0.65)", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" },
  photoStarBtn: { position: "absolute", top: 3, right: 3, background: "rgba(35,41,31,0.65)", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" },
  photoStarBtnActive: { background: "rgba(247,243,233,0.9)" },
};
