const ru = {
  start: {
    welcome: "Здравствуйте, добро пожаловать в клинику {clinicName}!",
    choose_language: "Пожалуйста, выберите язык:",
    register_prompt: "Для регистрации отправьте ваш номер телефона:",
    register_btn: "📱 Отправить номер",
    menu: "Главное меню"
  },
  menu: {
    book: "📅 Записаться на прием",
    my_appointments: "🕒 Мои записи",
    settings: "⚙️ Настройки",
    contact: "📞 Контакты"
  },
  registration: {
    success: "Вы успешно зарегистрировались!",
    error: "Произошла ошибка при регистрации."
  },
  booking: {
    select_service: "Выберите услугу:",
    select_doctor: "Выберите одного из наших врачей:",
    any_doctor: "👨‍⚕️ Любой врач",
    select_date: "Выберите дату приема:",
    select_time: "Свободное время на {date}:",
    confirm: "Вы записываетесь на {date} в {time} к врачу {doctor}. Подтверждаете?",
    btn_confirm: "✅ Подтвердить",
    btn_cancel: "❌ Отменить",
    success: "✅ Вы успешно записаны! Ждем вас.",
    error: "❌ Извините, это время уже занято или произошла ошибка.",
    no_slots: "Извините, на этот день нет свободного времени.",
    back: "⬅️ Назад"
  },
  appointments: {
    empty: "У вас нет предстоящих записей.",
    list_header: "📅 Ваши предстоящие записи:",
    item: "🕒 {date} в {time}\n👨‍⚕️ Врач: {doctor}\nСтатус: {status}",
    btn_cancel: "❌ Отменить",
    cancel_success: "Запись успешно отменена.",
    cancel_error: "Извините, эту запись нельзя отменить."
  },
  settings: {
    title: "⚙️ Настройки",
    choose_lang: "Изменить язык:",
    lang_changed: "✅ Язык изменен!"
  },
  reminders: {
    daily: "Уважаемый пациент, напоминаем о вашей записи в клинику {clinicName} на {date} в {time} к врачу {doctor}.",
    hourly: "Внимание! До вашего приема осталось 2 часа (в {time}).",
    btn_confirm: "✅ Подтверждаю",
    btn_cancel: "❌ Отменить",
    confirmed: "✅ Запись подтверждена. Ждем вас!",
    cancelled: "❌ Запись отменена.",
    feedback_req: "Уважаемый пациент, как прошел ваш визит в клинику {clinicName}? Пожалуйста, оцените:",
    feedback_thanks: "Спасибо за ваш отзыв!"
  },
  features: {
    disabled: "Эта функция в данный момент отключена."
  },
  balance: {
    empty: "Ваш баланс не найден.",
    item: "👤 {name}: Баланс {balance} сум"
  },
  chart: {
    empty: "Данные не найдены.",
    healthy: "👤 {name}: Все зубы здоровы! 🦷",
    status: {
      caries: "Кариес",
      pulpitis: "Пульпит",
      periodontitis: "Периодонтит",
      missing: "Отсутствует",
      crown: "Коронка",
      implant: "Имплант",
      filled: "Запломбирован"
    }
  }
};

export default ru;
