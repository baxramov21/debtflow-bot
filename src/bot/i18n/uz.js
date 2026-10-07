const uz = {
  start: {
    welcome: "Assalomu alaykum, {clinicName} klinikasiga xush kelibsiz!",
    choose_language: "Iltimos, tilni tanlang:",
    register_prompt: "Ro'yxatdan o'tish uchun telefon raqamingizni yuboring:",
    register_btn: "📱 Raqamni yuborish",
    menu: "Asosiy menyu"
  },
  menu: {
    book: "📅 Qabulga yozilish",
    my_appointments: "🕒 Mening qabullarim",
    settings: "⚙️ Sozlamalar",
    contact: "📞 Aloqa"
  },
  registration: {
    success: "Siz muvaffaqiyatli ro'yxatdan o'tdingiz!",
    error: "Ro'yxatdan o'tishda xatolik yuz berdi."
  },
  booking: {
    select_doctor: "Klinikamiz shifokorlaridan birini tanlang:",
    any_doctor: "👨‍⚕️ Ixtiyoriy shifokor",
    select_date: "Qabul kunini tanlang:",
    select_time: "{date} uchun bo'sh vaqtlar:",
    confirm: "Siz {date} kuni soat {time} da {doctor} qabuliga yozilmoqdasiz. Tasdiqlaysizmi?",
    btn_confirm: "✅ Tasdiqlash",
    btn_cancel: "❌ Bekor qilish",
    success: "✅ Qabulga muvaffaqiyatli yozildingiz! Sizni kutamiz.",
    error: "❌ Kechirasiz, bu vaqt allaqachon band qilingan yoki xatolik yuz berdi.",
    no_slots: "Kechirasiz, bu kunda bo'sh vaqtlar yo'q.",
    back: "⬅️ Orqaga"
  },
  appointments: {
    empty: "Sizda kelgusi qabullar yo'q.",
    list_header: "📅 Sizning kelgusi qabullaringiz:",
    item: "🕒 {date} soat {time}\n👨‍⚕️ Shifokor: {doctor}\nHolat: {status}",
    btn_cancel: "❌ Bekor qilish",
    cancel_success: "Qabul muvaffaqiyatli bekor qilindi.",
    cancel_error: "Kechirasiz, bu qabulni bekor qilib bo'lmaydi."
  },
  settings: {
    title: "⚙️ Sozlamalar",
    choose_lang: "Tilni o'zgartirish:",
    lang_changed: "✅ Til o'zgartirildi!"
  },
  reminders: {
    daily: "Hurmatli bemor, sizning {clinicName} klinikasiga {date} kuni soat {time} da {doctor} qabuliga yozilganingizni eslatib o'tamiz.",
    hourly: "Diqqat! Qabulingizga 2 soat qoldi ({time} da).",
    btn_confirm: "✅ Kelaman",
    btn_cancel: "❌ Kelolmayman",
    confirmed: "✅ Qabul tasdiqlandi. Sizni kutamiz!",
    cancelled: "❌ Qabul bekor qilindi.",
    feedback_req: "Hurmatli bemor, {clinicName} klinikasiga tashrifingiz qanday o'tdi? Iltimos, baholang:",
    feedback_thanks: "Fikringiz uchun rahmat!"
  },
  features: {
    disabled: "Bu xususiyat hozirda faol emas."
  },
  balance: {
    empty: "Sizning hisobingiz topilmadi.",
    item: "👤 {name}: Qoldiq {balance} so'm"
  },
  chart: {
    empty: "Ma'lumot topilmadi.",
    healthy: "👤 {name}: Barcha tishlar sog'lom! 🦷",
    status: {
      caries: "Karies",
      pulpitis: "Pulpit",
      periodontitis: "Periodontit",
      missing: "Yo'q tish",
      crown: "Qoplama",
      implant: "Implant",
      filled: "Plomba qilingan"
    }
  }
};

export default uz;
