import { useEffect, useState } from "react";

const STORAGE_KEY = "farmsjo_lang";

export function useLang() {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || "ar");
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);
  return [lang, setLang];
}

export function t(lang, key) {
  return (translations[lang] && translations[lang][key]) || translations.ar[key] || key;
}

const FARM_NAME_EN = [
  { match: "جنات", en: "Jannat Farm" },
  { match: "سراء", en: "Al Israa Farm" },
  { match: "نخل", en: "Nakhla Farm" },
  { match: "نخيل", en: "Nakhla Farm" },
  { match: "هيثم", en: "Al Haitham Farm" },
];

export function translateFarmName(name, lang) {
  if (lang !== "en" || !name) return name;
  const found = FARM_NAME_EN.find((f) => name.includes(f.match));
  return found ? found.en : name;
}

export const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export const WEEKDAYS_T = {
  ar: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const translations = {
  ar: {
    subtitle: "اختر مزرعة لتشوف الأسعار والأيام المتوفرة",
    loading: "جاري التحميل...",
    noFarms: "لا يوجد مزارع حالياً",
    share: "مشاركة",
    shareText: "استمتع بصيفك مع Farms Jo",
    linkCopied: "تم نسخ الرابط",
    allFarms: "كل المزارع",
    noPhotos: "لا توجد صور بعد",
    readMore: "قراءة المزيد",
    showLess: "عرض أقل",
    prices: "الأسعار",
    sunWedGroup: "الأحد - الأربعاء",
    perPersonOver: (fee, limit, step) => (step > 1 ? `${fee} لكل ${step} أشخاص إضافيين فوق ${limit}` : `${fee} لكل شخص فوق ${limit}`),
    openMap: "افتح الموقع على الخارطة",
    paymentMethods: "طرق الدفع",
    cliqLabel: (bank) => `كليك (CliQ) — ${bank}`,
    copy: "نسخ",
    copied: "نسخ!",
    contactBooking: "للتواصل والحجز",
    whatsapp: "واتساب",
    call: "اتصال",
    instagram: "انستقرام",
    availability: "الأيام المتوفرة",
    morningLegend: (start, end) => `صباحي: من الساعة ${start} حتى ${end}`,
    eveningLegend: (start, end) => `سهرة: من الساعة ${start} حتى ${end}`,
    morning: "صباحي",
    evening: "سهرة",
    available: "متاح",
    booked: "محجوز",
    bookingPolicy: "طريقة الحجز",
    bookingRules: [
      "يجب دفع عربون لتأكيد الحجز",
      "يُدفع المبلغ المتبقي عند الوصول",
      "يوجد تأمين 50 دينار مسترد بالكامل عند الخروج",
    ],
    bookThisDate: "احجز هالتاريخ",
    pickSlotHint: "اختر فترة صباحي أو سهرة فوق أولاً",
    namePlaceholder: "الاسم",
    phonePlaceholder: "رقم الجوال",
    guestsPlaceholder: "عدد الأشخاص",
    basePrice: "السعر الأساسي",
    extraGuestsFee: (n, limit) => `رسوم ${n} أشخاص إضافيين فوق ${limit}`,
    finalPrice: "السعر النهائي",
    confirmBooking: "تأكيد الحجز عبر واتساب",
    farmNotFound: "المزرعة غير موجودة.",
    backToList: "رجوع للقائمة",
    shareFarmText: (name) => `شوف مزرعة ${name} على Farms Jo`,
    close: "إغلاق",
    next: "التالية",
    prev: "السابقة",
    listYourFarmTitle: "أضف مزرعتك أو الشاليه معنا",
    listYourFarmSubtitle: "عبّي بياناتك وبنتواصل معك خلال يوم لإضافة مزرعتك أو الشاليه على المنصة",
    propertyNamePlaceholder: "اسم المزرعة أو الشاليه",
    propertyTypeFarm: "مزرعة",
    propertyTypeChalet: "شاليه",
    propertyTypeVilla: "فيلا",
    locationPlaceholder: "المنطقة / الموقع",
    notesPlaceholder: "ملاحظات إضافية (اختياري)",
    listYourFarmSubmit: "إرسال الطلب",
    listYourFarmError: "صار خطأ، حاول مرة ثانية",
    listYourFarmSuccessTitle: "تم استلام طلبك",
    listYourFarmSuccessText: "شكراً إلك! بنتواصل معك قريباً لإضافة مزرعتك أو الشاليه على Farms Jo",
    ownerCta: "🌱 عندك مزرعة أو شاليه؟ سجّله معنا",
  },
  en: {
    subtitle: "Choose a farm to see prices and availability",
    loading: "Loading...",
    noFarms: "No farms available right now",
    share: "Share",
    shareText: "Enjoy your summer with Farms Jo",
    linkCopied: "Link copied",
    allFarms: "All farms",
    noPhotos: "No photos yet",
    readMore: "Read more",
    showLess: "Show less",
    prices: "Prices",
    sunWedGroup: "Sun - Wed",
    perPersonOver: (fee, limit, step) => (step > 1 ? `+${fee} per every ${step} extra guests over ${limit}` : `+${fee} per person over ${limit}`),
    openMap: "Open location on map",
    paymentMethods: "Payment Methods",
    cliqLabel: (bank) => `CliQ — ${bank}`,
    copy: "Copy",
    copied: "Copied!",
    contactBooking: "Contact & Booking",
    whatsapp: "WhatsApp",
    call: "Call",
    instagram: "Instagram",
    availability: "Availability",
    morningLegend: (start, end) => `Morning: ${start} – ${end}`,
    eveningLegend: (start, end) => `Evening: ${start} – ${end}`,
    morning: "Morning",
    evening: "Evening",
    available: "Available",
    booked: "Booked",
    bookingPolicy: "Booking Policy",
    bookingRules: [
      "A deposit is required to confirm the booking",
      "The remaining amount is paid on arrival",
      "There's a 50 JD security deposit, fully refunded on checkout",
    ],
    bookThisDate: "Book this date",
    pickSlotHint: "Pick Morning or Evening above first",
    namePlaceholder: "Name",
    phonePlaceholder: "Phone number",
    guestsPlaceholder: "Number of guests",
    basePrice: "Base price",
    extraGuestsFee: (n, limit) => `Fee for ${n} extra guests over ${limit}`,
    finalPrice: "Final price",
    confirmBooking: "Confirm booking via WhatsApp",
    farmNotFound: "Farm not found.",
    backToList: "Back to list",
    shareFarmText: (name) => `Check out ${name} on Farms Jo`,
    close: "Close",
    next: "Next",
    prev: "Previous",
    listYourFarmTitle: "List your farm or chalet with us",
    listYourFarmSubtitle: "Fill in your details and we'll reach out within a day to add your property to the platform",
    propertyNamePlaceholder: "Farm or chalet name",
    propertyTypeFarm: "Farm",
    propertyTypeChalet: "Chalet",
    propertyTypeVilla: "Villa",
    locationPlaceholder: "Area / Location",
    notesPlaceholder: "Additional notes (optional)",
    listYourFarmSubmit: "Send request",
    listYourFarmError: "Something went wrong, please try again",
    listYourFarmSuccessTitle: "Request received",
    listYourFarmSuccessText: "Thank you! We'll get in touch soon to add your farm or chalet to Farms Jo",
    ownerCta: "🌱 Have a farm or chalet? List it with us",
  },
};
