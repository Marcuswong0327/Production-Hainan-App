-- Azure SQL schema for MyHainan App (migrated from Supabase/PostgreSQL)
-- Run against your Azure SQL Database before data migration.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'dbo')
    EXEC('CREATE SCHEMA dbo');
GO

-- ---------------------------------------------------------------------------
-- Users (replaces Supabase auth.users for app-owned identity)
-- Password hashes optional — copy from Supabase via direct DB access if needed.
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_users PRIMARY KEY DEFAULT NEWID(),
        email           NVARCHAR(320)    NOT NULL,
        password_hash   NVARCHAR(255)    NULL,
        email_confirmed BIT              NOT NULL DEFAULT 0,
        created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        last_sign_in_at DATETIMEOFFSET   NULL,
        CONSTRAINT UQ_users_email UNIQUE (email)
    );
END;
GO

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.profiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.profiles (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_profiles PRIMARY KEY,
        email           NVARCHAR(320)    NOT NULL,
        name            NVARCHAR(255)    NULL,
        role            NVARCHAR(32)     NOT NULL DEFAULT N'public'
            CONSTRAINT CK_profiles_role CHECK (role IN (N'super_admin', N'sub_admin', N'sub_editor', N'public')),
        association_id  NVARCHAR(64)     NULL,
        points          INT              NOT NULL DEFAULT 0,
        created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_profiles_users FOREIGN KEY (id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.association_options', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.association_options (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_association_options PRIMARY KEY DEFAULT NEWID(),
        label       NVARCHAR(255)    NOT NULL,
        sort_order  INT              NOT NULL DEFAULT 0,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT UQ_association_options_label UNIQUE (label)
    );
    CREATE INDEX IX_association_options_sort ON dbo.association_options (sort_order, label);
END;
GO

IF OBJECT_ID(N'dbo.guarantor_relationship_options', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.guarantor_relationship_options (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_guarantor_relationship_options PRIMARY KEY DEFAULT NEWID(),
        label       NVARCHAR(255)    NOT NULL,
        sort_order  INT              NOT NULL DEFAULT 0,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT UQ_guarantor_relationship_options_label UNIQUE (label)
    );
    CREATE INDEX IX_guarantor_relationship_options_sort ON dbo.guarantor_relationship_options (sort_order, label);
END;
GO

-- ---------------------------------------------------------------------------
-- Study loan applications (public applicants)
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.study_loan_applications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.study_loan_applications (
        id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_study_loan_applications PRIMARY KEY DEFAULT NEWID(),
        user_id                     NVARCHAR(64)     NOT NULL,
        association                 NVARCHAR(255)    NOT NULL,
        full_name                   NVARCHAR(255)    NOT NULL,
        age                         NVARCHAR(16)     NOT NULL,
        email                       NVARCHAR(320)    NOT NULL,
        university                  NVARCHAR(255)    NOT NULL,
        courses                     NVARCHAR(255)    NOT NULL,
        admission_date              NVARCHAR(32)     NOT NULL,
        expected_graduation_date    NVARCHAR(32)     NOT NULL,
        phone_number                NVARCHAR(32)     NOT NULL,
        offer_letter_path           NVARCHAR(1024)   NULL,
        ic_front_path               NVARCHAR(1024)   NULL,
        ic_back_path                NVARCHAR(1024)   NULL,
        guarantor_ic_front_path     NVARCHAR(1024)   NULL,
        guarantor_ic_back_path      NVARCHAR(1024)   NULL,
        guarantor_relationship      NVARCHAR(128)    NOT NULL,
        guarantor_phone_number      NVARCHAR(32)     NOT NULL,
        loan_type                   NVARCHAR(64)     NOT NULL,
        loan_amount                 INT              NOT NULL,
        status                      NVARCHAR(16)     NOT NULL DEFAULT N'pending'
            CONSTRAINT CK_study_loan_applications_status CHECK (status IN (N'pending', N'approved', N'rejected')),
        applied_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        reviewed_at                 DATETIMEOFFSET   NULL,
        rejection_reason            NVARCHAR(MAX)    NULL,
        total_paid                  INT              NOT NULL DEFAULT 0,
        payments_made               INT              NOT NULL DEFAULT 0,
        created_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE INDEX IX_study_loan_applications_status ON dbo.study_loan_applications (status);
    CREATE INDEX IX_study_loan_applications_user_id ON dbo.study_loan_applications (user_id);
    CREATE INDEX IX_study_loan_applications_applied_at ON dbo.study_loan_applications (applied_at DESC);
END;
GO

-- ---------------------------------------------------------------------------
-- Manual loan recipients + guarantors
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.study_loan_recipients', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.study_loan_recipients (
        id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_study_loan_recipients PRIMARY KEY DEFAULT NEWID(),
        full_name_en                NVARCHAR(255)    NOT NULL,
        full_name_zh                NVARCHAR(255)    NULL,
        full_name                   NVARCHAR(255)    NULL,
        full_name_chinese           NVARCHAR(255)    NULL,
        email                       NVARCHAR(320)    NOT NULL,
        phone_number                NVARCHAR(32)     NOT NULL,
        association                 NVARCHAR(255)    NOT NULL,
        university                  NVARCHAR(255)    NOT NULL,
        course                      NVARCHAR(255)    NOT NULL,
        courses                     NVARCHAR(255)    NULL,
        loan_type                   NVARCHAR(64)     NULL,
        admission_date              NVARCHAR(32)     NULL,
        expected_graduation_date    NVARCHAR(32)     NULL,
        loan_amount                 INT              NOT NULL,
        total_paid                  INT              NOT NULL DEFAULT 0,
        payments_made               INT              NOT NULL DEFAULT 0,
        status                      NVARCHAR(16)     NOT NULL DEFAULT N'active'
            CONSTRAINT CK_study_loan_recipients_status CHECK (status IN (N'active', N'completed')),
        offer_letter_path           NVARCHAR(1024)   NULL,
        student_ic_front_back_path  NVARCHAR(1024)   NULL,
        ic_front_path               NVARCHAR(1024)   NULL,
        ic_back_path                NVARCHAR(1024)   NULL,
        notes                       NVARCHAR(MAX)    NULL,
        created_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at                  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE INDEX IX_study_loan_recipients_status ON dbo.study_loan_recipients (status);
END;
GO

IF OBJECT_ID(N'dbo.guarantors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.guarantors (
        id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_guarantors PRIMARY KEY DEFAULT NEWID(),
        student_id          UNIQUEIDENTIFIER NOT NULL,
        guarantor_1_zh      NVARCHAR(255)    NULL,
        guarantor_1_en      NVARCHAR(255)    NULL,
        guarantor_1_ic      NVARCHAR(64)     NULL,
        guarantor_1_address NVARCHAR(512)    NULL,
        guarantor_1_sign_date NVARCHAR(32)   NULL,
        guarantor_2_zh      NVARCHAR(255)    NULL,
        guarantor_2_en      NVARCHAR(255)    NULL,
        guarantor_2_ic      NVARCHAR(64)     NULL,
        guarantor_2_address NVARCHAR(512)    NULL,
        guarantor_2_sign_date NVARCHAR(32)   NULL,
        guarantor_2_age     INT              NULL,
        guarantor_info_pic  NVARCHAR(1024)   NULL,
        created_at          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_guarantors_recipient FOREIGN KEY (student_id) REFERENCES dbo.study_loan_recipients(id) ON DELETE CASCADE,
        CONSTRAINT UQ_guarantors_student_id UNIQUE (student_id)
    );
    CREATE INDEX IX_guarantors_student_id ON dbo.guarantors (student_id);
END;
GO

IF OBJECT_ID(N'dbo.study_loan_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.study_loan_payments (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_study_loan_payments PRIMARY KEY DEFAULT NEWID(),
        recipient_id    UNIQUEIDENTIFIER NOT NULL,
        amount          INT              NOT NULL,
        paid_at         DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        payment_date    DATE             NULL,
        payment_month   INT              NULL,
        receipt_path    NVARCHAR(1024)   NULL,
        notes           NVARCHAR(MAX)    NULL,
        CONSTRAINT FK_study_loan_payments_recipient FOREIGN KEY (recipient_id) REFERENCES dbo.study_loan_recipients(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_study_loan_payments_recipient ON dbo.study_loan_payments (recipient_id);
END;
GO

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.scheduled_notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.scheduled_notifications (
        id          NVARCHAR(64)     NOT NULL CONSTRAINT PK_scheduled_notifications PRIMARY KEY,
        target      NVARCHAR(16)     NOT NULL
            CONSTRAINT CK_scheduled_notifications_target CHECK (target IN (N'all', N'active', N'completed')),
        message     NVARCHAR(MAX)    NOT NULL,
        schedule_at DATETIMEOFFSET   NOT NULL,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        sent_at     DATETIMEOFFSET   NULL,
        sent_count  INT              NULL DEFAULT 0,
        error_log   NVARCHAR(MAX)    NULL
    );
    CREATE INDEX IX_scheduled_notifications_pending ON dbo.scheduled_notifications (schedule_at) WHERE sent_at IS NULL;
END;
GO

IF OBJECT_ID(N'dbo.fcm_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.fcm_tokens (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_fcm_tokens PRIMARY KEY DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER NOT NULL,
        token       NVARCHAR(512)    NOT NULL,
        device_name NVARCHAR(255)    NULL,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_fcm_tokens_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_fcm_tokens_token UNIQUE (token)
    );
    CREATE INDEX IX_fcm_tokens_user_id ON dbo.fcm_tokens (user_id);
END;
GO

IF OBJECT_ID(N'dbo.push_subscriptions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.push_subscriptions (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_push_subscriptions PRIMARY KEY DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER NOT NULL,
        endpoint    NVARCHAR(2048)   NOT NULL,
        p256dh      NVARCHAR(512)    NOT NULL,
        auth        NVARCHAR(512)    NOT NULL,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_push_subscriptions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_push_subscriptions_endpoint UNIQUE (endpoint)
    );
    CREATE INDEX IX_push_subscriptions_user_id ON dbo.push_subscriptions (user_id);
END;
GO

IF OBJECT_ID(N'dbo.user_notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_notifications (
        id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_user_notifications PRIMARY KEY DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER NOT NULL,
        title       NVARCHAR(255)    NOT NULL,
        message     NVARCHAR(MAX)    NOT NULL,
        type        NVARCHAR(16)     NOT NULL DEFAULT N'system'
            CONSTRAINT CK_user_notifications_type CHECK (type IN (N'event', N'donation', N'loan', N'system')),
        [read]      BIT              NOT NULL DEFAULT 0,
        created_at  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_user_notifications_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_user_notifications_user_id ON dbo.user_notifications (user_id);
    CREATE INDEX IX_user_notifications_created_at ON dbo.user_notifications (created_at DESC);
END;
GO

-- File metadata (replaces Supabase Storage object paths — blobs live in Azure Blob Storage)
IF OBJECT_ID(N'dbo.file_objects', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.file_objects (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_file_objects PRIMARY KEY DEFAULT NEWID(),
        storage_path    NVARCHAR(1024)   NOT NULL,
        container_name  NVARCHAR(128)    NOT NULL DEFAULT N'study-loan-documents',
        blob_url        NVARCHAR(2048)   NULL,
        content_type    NVARCHAR(128)    NULL,
        size_bytes      BIGINT           NULL,
        uploaded_at     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT UQ_file_objects_path UNIQUE (storage_path, container_name)
    );
END;
GO
