alter table public.organizations enable row level security;
alter table public.persons enable row level security;
alter table public.app_users enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.current_app_user()
returns public.app_users language sql stable security definer set search_path=public as $$
 select * from public.app_users where auth_user_id=auth.uid() limit 1
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path=public as $$
 select organization_id from public.app_users where auth_user_id=auth.uid() limit 1
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path=public as $$
 select role from public.app_users where auth_user_id=auth.uid() limit 1
$$;

drop policy if exists app_users_self on public.app_users;
create policy app_users_self on public.app_users for select using(auth_user_id=auth.uid());

drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select using(id=public.current_org_id());

drop policy if exists persons_org_select on public.persons;
create policy persons_org_select on public.persons for select using(organization_id=public.current_org_id());
drop policy if exists persons_admin_write on public.persons;
create policy persons_admin_write on public.persons for all using(organization_id=public.current_org_id() and public.current_role()='admin')
with check(organization_id=public.current_org_id() and public.current_role()='admin');

drop policy if exists courses_org_select on public.courses;
create policy courses_org_select on public.courses for select using(organization_id=public.current_org_id());
drop policy if exists courses_admin_write on public.courses;
create policy courses_admin_write on public.courses for all using(organization_id=public.current_org_id() and public.current_role() in ('admin','instructor'))
with check(organization_id=public.current_org_id() and public.current_role() in ('admin','instructor'));

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select using(exists(select 1 from public.courses c where c.id=course_id and c.organization_id=public.current_org_id()));
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons for all using(public.current_role() in ('admin','instructor')) with check(public.current_role() in ('admin','instructor'));

drop policy if exists assessments_read on public.assessments;
create policy assessments_read on public.assessments for select using(exists(select 1 from public.courses c where c.id=course_id and c.organization_id=public.current_org_id()));
drop policy if exists assessments_write on public.assessments;
create policy assessments_write on public.assessments for all using(public.current_role() in ('admin','instructor')) with check(public.current_role() in ('admin','instructor'));

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select using(exists(select 1 from public.assessments a join public.courses c on c.id=a.course_id where a.id=assessment_id and c.organization_id=public.current_org_id()));
drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all using(public.current_role() in ('admin','instructor')) with check(public.current_role() in ('admin','instructor'));

drop policy if exists options_read on public.question_options;
create policy options_read on public.question_options for select using(exists(select 1 from public.questions q join public.assessments a on a.id=q.assessment_id join public.courses c on c.id=a.course_id where q.id=question_id and c.organization_id=public.current_org_id()));
drop policy if exists options_write on public.question_options;
create policy options_write on public.question_options for all using(public.current_role() in ('admin','instructor')) with check(public.current_role() in ('admin','instructor'));

drop policy if exists enrollment_admin on public.enrollments;
create policy enrollment_admin on public.enrollments for all using(organization_id=public.current_org_id() and public.current_role()='admin')
with check(organization_id=public.current_org_id() and public.current_role()='admin');
drop policy if exists enrollment_self_read on public.enrollments;
create policy enrollment_self_read on public.enrollments for select using(person_id=(select person_id from public.app_users where auth_user_id=auth.uid()));

drop policy if exists progress_self_read on public.lesson_progress;
create policy progress_self_read on public.lesson_progress for select using(exists(select 1 from public.enrollments e where e.id=enrollment_id and (e.person_id=(select person_id from public.app_users where auth_user_id=auth.uid()) or public.current_role()='admin')));

drop policy if exists attempts_self_read on public.assessment_attempts;
create policy attempts_self_read on public.assessment_attempts for select using(exists(select 1 from public.enrollments e where e.id=enrollment_id and (e.person_id=(select person_id from public.app_users where auth_user_id=auth.uid()) or public.current_role()='admin')));

drop policy if exists answers_self_read on public.attempt_answers;
create policy answers_self_read on public.attempt_answers for select using(exists(select 1 from public.assessment_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=attempt_id and (e.person_id=(select person_id from public.app_users where auth_user_id=auth.uid()) or public.current_role()='admin')));

drop policy if exists certificates_read on public.certificates;
create policy certificates_read on public.certificates for select using(organization_id=public.current_org_id() and (person_id=(select person_id from public.app_users where auth_user_id=auth.uid()) or public.current_role()='admin'));

drop policy if exists audit_admin_read on public.audit_events;
create policy audit_admin_read on public.audit_events for select using(organization_id=public.current_org_id() and public.current_role()='admin');


-- Evita exponer la bandera is_correct al navegador.
revoke select on public.question_options from authenticated;
grant select(id,question_id,label,position) on public.question_options to authenticated;
