-- 008: provider-side reference for bKash paymentID / Nagad paymentReferenceId,
-- used to confirm, query and reconcile online payments (FE-11, FIN-11).
ALTER TABLE gateway_transactions
  ADD COLUMN IF NOT EXISTS provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS provider_trx_id TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_gateway_provider_ref ON gateway_transactions(gateway, provider_ref);
