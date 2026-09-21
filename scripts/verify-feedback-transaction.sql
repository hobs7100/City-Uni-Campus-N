-- Verification only: run manually against a disposable database. This script
-- always rolls back and does not leave demo records behind.
begin;
do $$
declare sid uuid; fid uuid; cid uuid; n int;
begin
  select id into sid from students limit 1;
  if sid is null then raise exception 'Feedback verification requires one student fixture'; end if;
  insert into feedback(student_id,category,other_issue,body)
  values(sid,'Other','Demo verification issue','transaction verification complaint')
  returning id into fid;
  insert into feedback_comments(feedback_id,author_id,author_role,body) values(fid,sid,'student','isolated student comment') returning id into cid;
  insert into feedback_status_history(feedback_id,status,changed_by) values(fid,'submitted',sid);
  select count(*) into n from feedback_comments where feedback_id=fid;
  if n <> 1 then raise exception 'comment isolation assertion failed'; end if;
  select count(*) into n from feedback_status_history where feedback_id=fid;
  if n <> 1 then raise exception 'history count assertion failed'; end if;
end $$;
rollback;