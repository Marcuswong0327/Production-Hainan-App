-- Seed lookup data (matches Supabase migrations)

MERGE dbo.association_options AS t
USING (VALUES
    (N'Selangor Hainan Association', 10),
    (N'Kuala Lumpur Hainan Association', 20),
    (N'Perak Hainan Association', 30)
) AS s (label, sort_order)
ON t.label = s.label
WHEN NOT MATCHED THEN
    INSERT (id, label, sort_order) VALUES (NEWID(), s.label, s.sort_order);
GO

MERGE dbo.guarantor_relationship_options AS t
USING (VALUES
    (N'Dad (父亲)', 10),
    (N'Mom (母亲)', 20),
    (N'Uncle (叔叔/舅舅)', 30),
    (N'Aunty (阿姨/姑姑)', 40),
    (N'Brother (兄弟)', 50),
    (N'Sister (姐妹)', 60),
    (N'Other (其他)', 70)
) AS s (label, sort_order)
ON t.label = s.label
WHEN NOT MATCHED THEN
    INSERT (id, label, sort_order) VALUES (NEWID(), s.label, s.sort_order);
GO
