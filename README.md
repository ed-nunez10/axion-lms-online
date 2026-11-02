# AXION LMS — Online MVP v0.1

MVP navegador-first, sin Node.js local, sin npm local y sin servidor local.

## Stack
- Frontend: HTML5 + CSS + JavaScript ES Modules
- Backend: Supabase (PostgreSQL + Auth + Storage + RLS)
- Repositorio: GitHub
- Desarrollo online: GitHub web editor / StackBlitz
- Hosting: GitHub Pages o Netlify

## Arquitectura
UI -> Services -> Engines -> Repositories -> Supabase
                 -> Rules

La UI no consulta tablas directamente.

## Flujo implementado
1. Administrador inicia sesión.
2. Crea participante.
3. Crea curso.
4. Agrega lecciones.
5. Crea evaluación y preguntas.
6. Asigna curso.
7. Participante activa cuenta usando el mismo email registrado por el administrador.
8. Participante inicia sesión.
9. Consume lecciones y las marca completadas.
10. Responde evaluación.
11. Assessment Engine solicita evaluación transaccional al backend.
12. Completion Engine determina finalización.
13. Certification Engine genera registro de certificado con folio.
14. Audit Engine registra eventos clave.

## Puesta en marcha 100% online

### 1. Supabase
Crea un proyecto gratuito en Supabase.
Abre SQL Editor y ejecuta, en orden:
- `sql/01_schema.sql`
- `sql/02_security.sql`
- `sql/03_functions.sql`
- `sql/04_seed_demo.sql` (opcional)

En Authentication > Providers deja Email habilitado.

### 2. Configuración frontend
Abre `js/config.js` y sustituye:
- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

La `anon key` puede estar en el frontend; la seguridad real debe estar en RLS.
Nunca coloques una `service_role` key en el navegador.

### 3. Publicación
Sube esta carpeta a un repositorio de GitHub y activa GitHub Pages, o arrástrala a Netlify.
No existe proceso de build.

## Primer administrador
1. Regístrate en la pantalla "Activar cuenta".
2. En Supabase SQL Editor ejecuta:

```sql
update public.app_users
set role = 'admin'
where email = 'TU_EMAIL';
```

3. Crea una organización y relación de membresía (si no usas seed).
Para acelerar la prueba inicial se recomienda ejecutar `04_seed_demo.sql` y adaptar el email.

## Alcance v0.1
Esta versión implementa el esqueleto funcional del MVP, no todos los módulos futuros.
Preparado para migrar posteriormente a Next.js + Supabase/PostgreSQL sin rediseñar el modelo de dominio.

## Próximas iteraciones
- Formulario visual para banco de preguntas.
- Certificado PDF y QR firmado.
- Vigencias y reentrenamiento.
- Matriz de competencias.
- DNC/PAC.
- DC-3.
- SCORM/xAPI.
- Storage para PDFs y archivos.
