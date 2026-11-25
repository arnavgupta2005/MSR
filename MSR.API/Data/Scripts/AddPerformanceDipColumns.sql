-- Add the DIP fields used by the SprintPerformance and QAPerformance models.
-- Safe to run more than once; existing data is not modified.

IF COL_LENGTH('dbo.SprintPerformance', 'Dip1Headcount') IS NULL
    ALTER TABLE dbo.SprintPerformance ADD Dip1Headcount nvarchar(max) NULL;
IF COL_LENGTH('dbo.SprintPerformance', 'Dip2Completion') IS NULL
    ALTER TABLE dbo.SprintPerformance ADD Dip2Completion nvarchar(max) NULL;
IF COL_LENGTH('dbo.SprintPerformance', 'Dip3Rollovers') IS NULL
    ALTER TABLE dbo.SprintPerformance ADD Dip3Rollovers nvarchar(max) NULL;
IF COL_LENGTH('dbo.SprintPerformance', 'Dip4PlannedItemsDeliveredItems') IS NULL
    ALTER TABLE dbo.SprintPerformance ADD Dip4PlannedItemsDeliveredItems nvarchar(max) NULL;
IF COL_LENGTH('dbo.SprintPerformance', 'Dip5AssignedDeliveredPointsVelocity') IS NULL
    ALTER TABLE dbo.SprintPerformance ADD Dip5AssignedDeliveredPointsVelocity nvarchar(max) NULL;

IF COL_LENGTH('dbo.QAPerformance', 'Dip1Headcount') IS NULL
    ALTER TABLE dbo.QAPerformance ADD Dip1Headcount nvarchar(max) NULL;
IF COL_LENGTH('dbo.QAPerformance', 'Dip2Completion') IS NULL
    ALTER TABLE dbo.QAPerformance ADD Dip2Completion nvarchar(max) NULL;
IF COL_LENGTH('dbo.QAPerformance', 'Dip3Rollovers') IS NULL
    ALTER TABLE dbo.QAPerformance ADD Dip3Rollovers nvarchar(max) NULL;
IF COL_LENGTH('dbo.QAPerformance', 'Dip4PlannedItemsDeliveredItems') IS NULL
    ALTER TABLE dbo.QAPerformance ADD Dip4PlannedItemsDeliveredItems nvarchar(max) NULL;
IF COL_LENGTH('dbo.QAPerformance', 'Dip5AssignedDeliveredPointsVelocity') IS NULL
    ALTER TABLE dbo.QAPerformance ADD Dip5AssignedDeliveredPointsVelocity nvarchar(max) NULL;
