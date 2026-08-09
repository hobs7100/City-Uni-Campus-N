-- Add the "assistant" role to the user_role enum.
-- Assistants have the same access as admin except they cannot modify student status.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant';
