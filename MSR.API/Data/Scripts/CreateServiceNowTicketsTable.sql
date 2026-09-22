-- Standalone ServiceNow Tickets table.
-- NOTE: Sprint is an independent INT column. There is intentionally NO SprintId
-- column and NO foreign key to the existing Sprint table.
IF OBJECT_ID('dbo.ServiceNowTickets', 'U') IS NULL
BEGIN
    CREATE TABLE ServiceNowTickets
    (
        ServiceNowTicketId   INT IDENTITY(1,1) PRIMARY KEY,
        Sprint               INT NOT NULL,
        CriticalWeb          INT NOT NULL DEFAULT 0,
        Web                  INT NOT NULL DEFAULT 0,
        CriticalMobile       INT NOT NULL DEFAULT 0,
        Mobile               INT NOT NULL DEFAULT 0,
        CompletionPercentage DECIMAL(5,2) NOT NULL DEFAULT 0
    );
END
