-- Campus Management System - Phase 19
-- Lab course flag + Re-Mid exam tracking

-- Add mid_absent, re_mid, re_mid_absent columns to results table
alter table results
  add column if not exists mid_absent   boolean     not null default false,
  add column if not exists re_mid       numeric(6,2),
  add column if not exists re_mid_absent boolean    not null default false;
