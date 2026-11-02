-- OPCIONAL. Crea una empresa demo.
insert into public.organizations(name,slug)
values('AXION Demo','axion-demo')
on conflict(slug) do nothing;

-- Después de registrarte con tu email desde la app:
-- update public.app_users
-- set role='admin',
--     organization_id=(select id from public.organizations where slug='axion-demo')
-- where email='TU_EMAIL';

-- Si quieres que tu propia cuenta admin esté vinculada también a una persona:
-- 1) crea esa persona desde SQL
-- 2) actualiza app_users.person_id con su id.
