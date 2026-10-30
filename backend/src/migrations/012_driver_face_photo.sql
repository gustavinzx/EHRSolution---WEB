-- Migration 012: Add face_photo column to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_photo TEXT;
