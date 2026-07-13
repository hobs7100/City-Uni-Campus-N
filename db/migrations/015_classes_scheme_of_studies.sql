-- Add scheme of studies PDF URL to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS scheme_of_studies_url TEXT;
