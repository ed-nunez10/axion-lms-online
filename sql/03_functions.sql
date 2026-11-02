create or replace function public.write_audit_event(
 p_event_type text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare u public.app_users%rowtype;
begin
 select * into u from public.app_users where auth_user_id=auth.uid();
 insert into public.audit_events(organization_id,actor_user_id,event_type,entity_type,entity_id,metadata)
 values(u.organization_id,u.id,p_event_type,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb));
end $$;

create or replace function public.complete_lesson(p_enrollment_id uuid,p_lesson_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.enrollments%rowtype; total int; done int;
begin
 select * into e from public.enrollments where id=p_enrollment_id;
 if e.id is null then raise exception 'Enrollment no encontrado'; end if;
 if e.person_id <> (select person_id from public.app_users where auth_user_id=auth.uid()) then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.lessons where id=p_lesson_id and course_id=e.course_id) then raise exception 'Lección inválida'; end if;

 insert into public.lesson_progress(enrollment_id,lesson_id,started_at,completed_at)
 values(p_enrollment_id,p_lesson_id,now(),now())
 on conflict(enrollment_id,lesson_id) do update set completed_at=coalesce(public.lesson_progress.completed_at,now());

 update public.enrollments set status='in_progress',started_at=coalesce(started_at,now()) where id=p_enrollment_id and status='assigned';

 select count(*) into total from public.lessons where course_id=e.course_id;
 select count(*) into done from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.enrollment_id=p_enrollment_id and lp.completed_at is not null and l.course_id=e.course_id;
 return jsonb_build_object('completed',done,'total',total,'progress',case when total=0 then 0 else round(done::numeric/total*100,2) end);
end $$;

create or replace function public.submit_assessment(p_enrollment_id uuid,p_assessment_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 e public.enrollments%rowtype; c public.courses%rowtype; a public.assessments%rowtype;
 total_points numeric:=0; earned numeric:=0; score numeric:=0; is_passed boolean:=false;
 next_attempt int; att_id uuid; ans jsonb; q public.questions%rowtype; opt public.question_options%rowtype;
 lesson_total int; lesson_done int; cert_folio text;
begin
 select * into e from public.enrollments where id=p_enrollment_id;
 if e.id is null then raise exception 'Enrollment no encontrado'; end if;
 if e.person_id <> (select person_id from public.app_users where auth_user_id=auth.uid()) then raise exception 'No autorizado'; end if;
 select * into c from public.courses where id=e.course_id;
 select * into a from public.assessments where id=p_assessment_id and course_id=e.course_id;
 if a.id is null then raise exception 'Evaluación inválida'; end if;

 select count(*) into lesson_total from public.lessons where course_id=e.course_id;
 select count(*) into lesson_done from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id and lp.completed_at is not null and l.course_id=e.course_id;
 if lesson_total=0 or lesson_done < lesson_total then raise exception 'Lecciones incompletas'; end if;

 select coalesce(max(attempt_no),0)+1 into next_attempt from public.assessment_attempts where enrollment_id=e.id and assessment_id=a.id;
 if next_attempt > a.attempt_limit then raise exception 'Límite de intentos alcanzado'; end if;

 select coalesce(sum(points),0) into total_points from public.questions where assessment_id=a.id;
 for ans in select * from jsonb_array_elements(p_answers)
 loop
   select * into q from public.questions where id=(ans->>'question_id')::uuid and assessment_id=a.id;
   select * into opt from public.question_options where id=(ans->>'option_id')::uuid and question_id=q.id;
   if opt.is_correct then earned:=earned+q.points; end if;
 end loop;

 score:=case when total_points=0 then 0 else round(earned/total_points*100,2) end;
 is_passed:=score>=c.pass_score;

 insert into public.assessment_attempts(enrollment_id,assessment_id,attempt_no,score,passed)
 values(e.id,a.id,next_attempt,score,is_passed) returning id into att_id;

 for ans in select * from jsonb_array_elements(p_answers)
 loop
   select * into q from public.questions where id=(ans->>'question_id')::uuid and assessment_id=a.id;
   select * into opt from public.question_options where id=(ans->>'option_id')::uuid and question_id=q.id;
   insert into public.attempt_answers(attempt_id,question_id,option_id,is_correct,points_awarded)
   values(att_id,q.id,opt.id,opt.is_correct,case when opt.is_correct then q.points else 0 end);
 end loop;

 if is_passed then
   update public.enrollments set status='completed',completed_at=now(),final_score=score where id=e.id;
   cert_folio:='AX-'||to_char(now(),'YYYYMM')||'-'||upper(substr(replace(e.id::text,'-',''),1,10));
   insert into public.certificates(organization_id,enrollment_id,person_id,course_id,folio)
   values(e.organization_id,e.id,e.person_id,e.course_id,cert_folio)
   on conflict(enrollment_id) do nothing;
 else
   update public.enrollments set status='in_progress',final_score=score where id=e.id;
 end if;

 return jsonb_build_object('attempt',next_attempt,'score',score,'passed',is_passed,'pass_score',c.pass_score);
end $$;

grant execute on function public.complete_lesson(uuid,uuid) to authenticated;
grant execute on function public.submit_assessment(uuid,uuid,jsonb) to authenticated;
grant execute on function public.write_audit_event(text,text,uuid,jsonb) to authenticated;
