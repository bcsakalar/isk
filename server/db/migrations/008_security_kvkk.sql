-- ============================================================
-- Migration 008: Güvenlik & KVKK Uyumu
-- Hesap kilitleme, KVKK tabloları, gizlilik onayı
-- ============================================================

-- ─── Hesap Kilitleme (Account Lockout) ───────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ─── KVKK: Gizlilik Onayı Takibi ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- ─── KVKK: Gizlilik Onay Kayıtları ──────────────────────────
CREATE TABLE IF NOT EXISTS privacy_consents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('privacy_policy', 'terms_of_service')),
  accepted BOOLEAN NOT NULL DEFAULT TRUE,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_consents_user ON privacy_consents(user_id);

-- ─── KVKK: Hesap Silme Talepleri ────────────────────────────
CREATE TABLE IF NOT EXISTS user_deletions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  reason TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_user_deletions_scheduled ON user_deletions(scheduled_for) WHERE completed_at IS NULL;
