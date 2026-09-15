-- ============================================================
-- ImportHistory table for the Admin Data Import feature.
-- Run this ONCE against the existing MSRDatabase.
-- Existing tables and data are NOT modified.
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'ImportHistory'
)
BEGIN
    CREATE TABLE dbo.ImportHistory
    (
        ImportHistoryId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FileName        NVARCHAR(400) NOT NULL,
        ImportType      NVARCHAR(100) NOT NULL,
        UploadedBy      NVARCHAR(200) NULL,
        UploadedAt      DATETIME2     NOT NULL,
        TotalRows       INT           NOT NULL,
        InsertedRows    INT           NOT NULL,
        DuplicateRows   INT           NOT NULL,
        InvalidRows     INT           NOT NULL,
        Status          NVARCHAR(100) NOT NULL
    );
END
GO
