-- A fine payment need not reactivate the student. Existing reactivation
-- receipts retain their dates; ordinary attendance payments leave this NULL.
alter table student_fines alter column reactivated_on drop not null;
