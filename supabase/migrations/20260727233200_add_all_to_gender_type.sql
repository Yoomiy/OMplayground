-- Add 'all' value to gender_type ENUM to allow unisex/all-gender game sessions (e.g. classroom whiteboards)
ALTER TYPE public.gender_type ADD VALUE IF NOT EXISTS 'all';
