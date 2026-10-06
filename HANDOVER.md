# DentFlow Telegram Bot - Project Handover

## Context for the Next Agent
Hello! If you are reading this, you are taking over the development of the **DentFlow Telegram Bot** project. 
The user already has an existing web app called **Dent Flow**. This project (`dentflow-bot`) is a **completely standalone Next.js 16 application** that integrates with the existing DentFlow Supabase instance. 

**CRITICAL RULES:**
1. **DO NOT MODIFY** the existing `Dent Flow` project folder. This bot is fully decoupled.
2. **NO RLS CHANGES**: The bot uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS entirely. All data scoping is done manually in the application layer (e.g., scoping by `clinic_id`).
3. **Multi-Tenant**: The architecture supports multiple Telegram bots (one per clinic). The webhook route (`src/app/api/bot/[botId]/route.js`) dynamically loads the bot token for the specific clinic from the `bot_clinics` table.

## What Has Been Done So Far (Phase 1 & 2 Completed)

1. **Project Scaffolding**: 
   - Created Next.js 16 project with `grammY` for Telegram bot logic.
   - Set up `@supabase/supabase-js`, `date-fns`, `date-fns-tz`.

2. **Database Migration**:
   - Written `supabase/migrations/001_bot_core.sql`.
   - **Tables Added**: `bot_clinics` (stores bot tokens), `bot_users` (Telegram user info), `bot_patient_links` (links TG user to DentFlow patient), `bot_sessions` (grammY session storage).
   - **Function Added**: `bot_find_patients_by_phone` to match patients by the last 9 digits of their phone number.

3. **Core Libraries (`src/lib/`)**:
   - `crypto.js`: AES-256-GCM encryption/decryption for securely storing Telegram bot tokens.
   - `phone.js`: Phone formatting and normalization (extracts last 9 digits).
   - `time.js`: Tashkent Timezone helpers using `date-fns-tz`.
   - `supabaseAdmin.js`: Supabase client utilizing the service role key.

4. **Bot Core & Registration Flow (`src/bot/`)**:
   - `createBot.js`: Initializes the grammY bot, injects the `clinic` context, user context, and `i18n` translation function (`ctx.t`).
   - `session.js`: Custom grammY session adapter connecting to the `bot_sessions` Supabase table.
   - `i18n/`: `uz` and `ru` translation strings.
   - `controllers/start.js`: Handles `/start`, checks if user is registered, asks for language.
   - `controllers/registration.js`: Handles contact sharing, matches phone number, creates `bot_users` and `bot_patient_links`.

## Next Steps to Implement (Where you should start)

Your job is to continue implementing the remaining phases. 

### Phase 3: Booking Flow (`src/bot/controllers/booking.js`)
- Add controller listening to "📅 Qabulga yozilish" (or inline callback queries).
- **Flow**:
  1. Fetch active doctors for the clinic.
  2. Prompt user to select a doctor.
  3. Show a calendar/list of available dates for the next 14 days (`generateSlots`).
  4. Show available timeslots for the chosen date.
  5. Create an `appointment` in Supabase with `status = 'scheduled'` and `notes = '[Telegram] ...'`.
  6. Use Postgres advisory locks or a transaction RPC if necessary to prevent double bookings.

### Phase 4: Appointments & Settings
- Add `src/bot/controllers/appointments.js`: Allow users to view upcoming appointments and cancel them (if `allow_cancel` is true and > 2 hours away).
- Add `src/bot/controllers/settings.js`: Allow users to change language or view profile.

### Phase 5: Notification Cron (`src/app/api/cron/bot-reminders/route.js`)
- Write a Vercel Cron route that runs hourly/daily.
- Find appointments happening tomorrow or in 2 hours.
- Use `bot.api.sendMessage()` to send reminders to the patient's Telegram.
- Important: Update the `notifications` table so the original DentFlow SMS cron skips sending an SMS if the Telegram message was successful.

### Phase 6: Admin Onboarding Page (`src/app/admin/page.js`)
- Create a simple Next.js frontend where clinic owners can:
  1. Input their Telegram Bot Token from BotFather.
  2. The server encrypts the token (`crypto.js`) and saves it to `bot_clinics`.
  3. Sets the Telegram webhook to `https://<bot-domain>.vercel.app/api/bot/<clinic-id>`.

---
*Note to Agent: You can test the bot locally using `npm run bot:poll <clinic_id>`, which bypasses webhooks and runs long-polling.*
