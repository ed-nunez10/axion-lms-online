create extension if not exists pgcrypto;

create table if not exists public.organizations(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.persons(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  employee_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(organization_id,email)
);

create table if not exists public.app_users(
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  person_id uuid references public.persons(id) on delete set null,
  email text not null,
  role text not null default 'participant' check(role in ('admin','instructor','participant')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  pass_score numeric(5,2) not null default 80,
  status text not null default 'draft',
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table if not exists public.lessons(
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content_type text not null check(content_type in ('text','video','pdf','file')),
  content_body text,
  position int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.assessments(
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  attempt_limit int not null default 3,
  created_at timestamptz not null default now()
);

create table if not exists public.questions(
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'single_choice',
  points numeric(8,2) not null default 1,
  position int not null default 1
);

create table if not exists public.question_options(
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position int not null default 1
);

create table if not exists public.enrollments(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assigned_by uuid references public.app_users(id),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'assigned' check(status in ('assigned','in_progress','completed','failed','cancelled')),
  final_score numeric(5,2),
  unique(person_id,course_id)
);

create table if not exists public.lesson_progress(
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  started_at timestamptz,
  completed_at timestamptz,
  unique(enrollment_id,lesson_id)
);

create table if not exists public.assessment_attempts(
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  attempt_no int not null,
  score numeric(5,2) not null,
  passed boolean not null,
  submitted_at timestamptz not null default now()
);

create table if not exists public.attempt_answers(
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id uuid references public.question_options(id),
  is_correct boolean not null,
  points_awarded numeric(8,2) not null default 0
);

create table if not exists public.certificates(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  enrollment_id uuid unique not null references public.enrollments(id) on delete cascade,
  person_id uuid not null references public.persons(id),
  course_id uuid not null references public.courses(id),
  folio text unique not null,
  issued_at timestamptz not null default now(),
  valid_until timestamptz
);

create table if not exists public.audit_events(
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_user_id uuid,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_persons_org on public.persons(organization_id);
create index if not exists idx_courses_org on public.courses(organization_id);
create index if not exists idx_enrollments_person on public.enrollments(person_id);
create index if not exists idx_audit_org_time on public.audit_events(organization_id,created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.persons%rowtype;
begin
  select * into p from public.persons where lower(email)=lower(new.email) order by created_at desc limit 1;
  insert into public.app_users(auth_user_id,organization_id,person_id,email,role)
  values(new.id,p.organization_id,p.id,new.email,'participant');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
