-- Phase: Add payment tracking columns to bills
alter table bills
  add column if not exists paid_at timestamptz,
  add column if not exists payment_mode varchar(20),
  add column if not exists cheque_number varchar(6);
