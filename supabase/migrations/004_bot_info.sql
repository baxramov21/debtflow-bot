-- Cache Telegram getMe() result so cold starts don't need an extra API round-trip
ALTER TABLE bot_clinics ADD COLUMN IF NOT EXISTS bot_info JSONB;
