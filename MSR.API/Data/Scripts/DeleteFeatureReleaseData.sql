-- ============================================================
-- Delete imported Feature Release data.
-- Use after testing an import to reset the FeatureRelease table.
-- ============================================================

-- Delete ALL Feature Release rows:
DELETE FROM FeatureRelease;

-- Reseed identity so new imports start at FeatureReleaseId = 1 again.
DBCC CHECKIDENT ('FeatureRelease', RESEED, 0);

-- ---- Optional: delete only one product's rows instead of all ----
-- DELETE FROM FeatureRelease WHERE ProductName = 'Intrics';
-- DELETE FROM FeatureRelease WHERE ProductName = 'InfoQuest';

-- ---- Optional: delete a single feature that was imported by mistake ----
-- DELETE FROM FeatureRelease
-- WHERE FeatureDescription = 'Brand Geo Market Report'
--   AND ProductName = 'Intrics'
--   AND PlannedSprint = 14;
