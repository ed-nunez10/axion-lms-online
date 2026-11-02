import { Repository } from "./repositories/supabase.js";
import { Rules } from "./services/rules.js";
import { EnrollmentEngine } from "./engines/enrollment.js";
import { LearningEngine } from "./engines/learning.js";
import { AssessmentEngine } from "./engines/assessment.js";
import { CompletionEngine } from "./engines/completion.js";
import { CertificationEngine } from "./engines/certification.js";

const $=s=>document.querySelector(s);
const content=$("#content"), pageHeader=$("#pageHeader"), nav=$("#nav"), modal=$("#modal"), modalBody=$("#modalBody");
let currentUser=null, currentOrgId=null;

const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const header=(title,subtitle,action="")=>pageHeader.innerHTML=`<div class="page-title"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</div>`;
const showModal=html=>{modalBody.innerHTML=html;modal.showModal()};
$("#closeModal").onclick=()=>modal.close();

document.querySelectorAll("[data-auth-tab]").forEach(b=>b.onclick=()=>{
 document.querySelectorAll("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===b));
 $("#loginForm").classList.toggle("hidden",b.dataset.authTab!=="login");
 $("#signupForm").classList.toggle("hidden",b.dataset.authTab!=="signup");
});

$("#loginForm").onsubmit=async e=>{
 e.preventDefault(); $("#authMessage").textContent="Accediendo...";
 const {error}=await Repository.signIn($("#loginEmail").value,$("#loginPassword").value);
 $("#authMessage").textContent=error?error.message:"";
};
$("#signupForm").onsubmit=async e=>{
 e.preventDefault(); $("#authMessage").textContent="Activando...";
 const {error}=await Repository.signUp($("#signupEmail").value,$("#signupPassword").value);
 $("#authMessage").textContent=error?error.message:"Cuenta creada. Si la confirmación por email está activa, revisa tu correo.";
};

async function boot(session){
 $("#authView").classList.toggle("hidden",!!session);
 $("#appView").classList.toggle("hidden",!session);
 if(!session) return;
 try{
   currentUser=await Repository.me();
   currentOrgId=currentUser?.organization_id;
   $("#sessionArea").innerHTML=`<button class="ghost" id="logout">Salir</button>`;
   $("#logout").onclick=()=>Repository.signOut();
   $("#userBadge").innerHTML=`<strong>${escapeHtml(currentUser?.person?.first_name||currentUser.email)}</strong><small>${escapeHtml(currentUser.role)}</small>`;
   renderNav();
   if(Rules.isAdmin(currentUser)) adminDashboard(); else participantDashboard();
 }catch(err){ content.innerHTML=`<div class="card"><strong>Error de configuración</strong><p>${escapeHtml(err.message)}</p></div>`; }
}

function renderNav(){
 const admin=Rules.isAdmin(currentUser);
 nav.innerHTML=admin?`
 <button data-page="dashboard" class="active">Dashboard</button>
 <button data-page="participants">Participantes</button>
 <button data-page="courses">Cursos</button>
 <button data-page="assignments">Asignaciones</button>`:
 `<button data-page="learning" class="active">Mi aprendizaje</button>`;
 nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{
   nav.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));
   const p=b.dataset.page;
   ({dashboard:adminDashboard,participants:participantsPage,courses:coursesPage,assignments:assignmentsPage,learning:participantDashboard}[p])();
 });
}

async function adminDashboard(){
 header("Panel de control","Estado operativo del MVP");
 const k=await Repository.dashboardAdmin(currentOrgId);
 content.innerHTML=`<div class="grid cols-3">
 <div class="card kpi"><strong>${k.participants}</strong><span>Personas registradas</span></div>
 <div class="card kpi"><strong>${k.courses}</strong><span>Cursos</span></div>
 <div class="card kpi"><strong>${k.enrollments}</strong><span>Asignaciones</span></div></div>
 <div class="card section"><h3>Arquitectura activa</h3><p class="muted">UI → Services → Engines → Repository → PostgreSQL/RLS. Los eventos críticos se registran mediante Audit Engine.</p></div>`;
}

async function participantsPage(){
 header("Participantes","Personas de la empresa",`<button class="primary" id="newPerson">Nuevo participante</button>`);
 const rows=await Repository.listPersons(currentOrgId);
 content.innerHTML=`<div class="card table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Email</th><th>Estado</th></tr></thead><tbody>
 ${rows.map(p=>`<tr><td>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td><td>${escapeHtml(p.email)}</td><td><span class="badge">${escapeHtml(p.status)}</span></td></tr>`).join("")||`<tr><td colspan="3">Sin participantes.</td></tr>`}
 </tbody></table></div>`;
 $("#newPerson").onclick=()=>showModal(`<h3>Nuevo participante</h3><form id="personForm" class="stack">
 <label>Nombre<input name="first_name" required></label><label>Apellidos<input name="last_name" required></label>
 <label>Email<input name="email" type="email" required></label><button class="primary">Crear</button></form>`);
 setTimeout(() => {
  const f = $("#personForm");

  if (f) {
    f.onsubmit = async e => {
      e.preventDefault();

      const button = f.querySelector("button");
      const originalText = button.textContent;

      try {
        button.disabled = true;
        button.textContent = "Guardando...";

        const o = Object.fromEntries(new FormData(f));

        await Repository.createPerson({
          ...o,
          organization_id: currentOrgId,
          status: "active"
        });

        modal.close();
        await participantsPage();

      } catch (err) {
        alert(
          "No se pudo registrar al participante:\n\n" +
          err.message
        );

        console.error("AXION LMS createPerson:", err);

      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    };
  }
}, 0);
}
async function coursesPage(){
 header("Cursos","Catálogo y estructura de aprendizaje",`<button class="primary" id="newCourse">Nuevo curso</button>`);
 const rows=await Repository.listCourses(currentOrgId);
 content.innerHTML=`<div class="grid cols-2">${rows.map(c=>`<div class="card"><h3>${escapeHtml(c.code)} · ${escapeHtml(c.title)}</h3>
 <p class="muted">${escapeHtml(c.description||"")}</p><p><span class="badge">${c.lessons?.length||0} lecciones</span> <span class="badge">Aprobación ${c.pass_score}%</span></p>
 <div class="actions"><button class="ghost addLesson" data-id="${c.id}">Agregar lección</button><button class="ghost addAssessment" data-id="${c.id}">Evaluación rápida</button></div></div>`).join("")||`<div class="card">Aún no hay cursos.</div>`}</div>`;
 $("#newCourse").onclick=()=>showModal(`<h3>Nuevo curso</h3><form id="courseForm" class="stack">
 <label>Código<input name="code" required placeholder="COT-SEG-001"></label><label>Título<input name="title" required></label>
 <label>Descripción<textarea name="description"></textarea></label><label>Calificación mínima<input name="pass_score" type="number" min="0" max="100" value="80"></label>
 <button class="primary">Crear curso</button></form>`);
 setTimeout(()=>{const f=$("#courseForm");if(f)f.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));await Repository.createCourse({...o,pass_score:+o.pass_score,organization_id:currentOrgId,status:"published",created_by:currentUser.id});modal.close();coursesPage();}},0);
 content.querySelectorAll(".addLesson").forEach(b=>b.onclick=()=>lessonModal(b.dataset.id));
 content.querySelectorAll(".addAssessment").forEach(b=>b.onclick=()=>assessmentModal(b.dataset.id));
}

function lessonModal(courseId){
 showModal(`<h3>Agregar lección</h3><form id="lessonForm" class="stack">
 <label>Título<input name="title" required></label><label>Tipo<select name="content_type"><option value="text">Texto</option><option value="video">Video URL</option><option value="pdf">PDF URL</option></select></label>
 <label>Contenido / URL<textarea name="content_body" required></textarea></label><label>Posición<input name="position" type="number" min="1" value="1"></label><button class="primary">Guardar</button></form>`);
 setTimeout(()=>{$("#lessonForm").onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));await Repository.createLesson({...o,position:+o.position,course_id:courseId});modal.close();coursesPage();}},0);
}

function assessmentModal(courseId){
 showModal(`<h3>Evaluación rápida</h3><p class="muted">Crea una evaluación con una pregunta de opción múltiple para validar el flujo completo.</p>
 <form id="assessmentForm" class="stack"><label>Título<input name="title" value="Evaluación final" required></label>
 <label>Pregunta<textarea name="prompt" required></textarea></label><label>Opción A<input name="a" required></label><label>Opción B<input name="b" required></label>
 <label>Respuesta correcta<select name="correct"><option value="a">A</option><option value="b">B</option></select></label><button class="primary">Crear evaluación</button></form>`);
 setTimeout(()=>{$("#assessmentForm").onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));
   const a=await Repository.createAssessment({course_id:courseId,title:o.title,attempt_limit:3});
   const q=await Repository.createQuestion({assessment_id:a.id,prompt:o.prompt,question_type:"single_choice",points:1,position:1});
   await Repository.createOptions([{question_id:q.id,label:o.a,is_correct:o.correct==="a",position:1},{question_id:q.id,label:o.b,is_correct:o.correct==="b",position:2}]);
   modal.close();coursesPage();
 }},0);
}

async function assignmentsPage(){
 header("Asignaciones","Enrollment Engine",`<button class="primary" id="newAssign">Asignar curso</button>`);
 const [people,courses]=await Promise.all([Repository.listPersons(currentOrgId),Repository.listCourses(currentOrgId)]);
 content.innerHTML=`<div class="card"><h3>Flujo</h3><p class="muted">Una asignación crea el vínculo formal entre participante y curso. A partir de aquí todo progreso, intento, resultado y certificado queda ligado al enrollment.</p></div>`;
 $("#newAssign").onclick=()=>showModal(`<h3>Asignar curso</h3><form id="assignForm" class="stack">
 <label>Participante<select name="person_id">${people.map(p=>`<option value="${p.id}">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)} · ${escapeHtml(p.email)}</option>`).join("")}</select></label>
 <label>Curso<select name="course_id">${courses.map(c=>`<option value="${c.id}">${escapeHtml(c.code)} · ${escapeHtml(c.title)}</option>`).join("")}</select></label>
 <button class="primary">Asignar</button></form>`);
 setTimeout(()=>{const f=$("#assignForm");if(f)f.onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));await EnrollmentEngine.assign({organizationId:currentOrgId,personId:o.person_id,courseId:o.course_id,assignedBy:currentUser.id});modal.close();content.insertAdjacentHTML("beforeend",`<div class="card section"><span class="badge ok">Asignación creada</span></div>`);}},0);
}

async function participantDashboard(){
 header("Mi aprendizaje","Cursos asignados, progreso y evaluación");
 if(!currentUser.person_id){content.innerHTML=`<div class="card"><h3>Cuenta sin participante vinculado</h3><p>El email de esta cuenta debe coincidir con un participante creado por el administrador.</p></div>`;return;}
 const enrollments=await Repository.myEnrollments(currentUser.person_id);
 content.innerHTML=`<div class="grid">${enrollments.map(en=>courseCard(en)).join("")||`<div class="card">No tienes cursos asignados.</div>`}</div>`;
 content.querySelectorAll(".openCourse").forEach(b=>b.onclick=()=>openCourse(enrollments.find(x=>x.id===b.dataset.id)));
}

function courseCard(en){
 const pct=CompletionEngine.progress(en);
 return `<div class="card"><div class="page-title"><div><h3>${escapeHtml(en.course.title)}</h3><p>${escapeHtml(en.course.code)} · Estado: ${escapeHtml(en.status)}</p></div><span class="badge ${en.status==="completed"?"ok":""}">${pct}%</span></div>
 <div class="progress"><span style="width:${pct}%"></span></div><div class="actions section"><button class="primary openCourse" data-id="${en.id}">Abrir curso</button></div></div>`;
}

async function openCourse(en){
 header(en.course.title,"Learning Engine · seguimiento por enrollment");
 const completed=new Set((en.lesson_progress||[]).filter(x=>x.completed_at).map(x=>x.lesson_id));
 const lessons=[...(en.course.lessons||[])].sort((a,b)=>a.position-b.position);
 content.innerHTML=`<div class="card"><h3>Lecciones</h3>${lessons.map(l=>`<div class="lesson ${completed.has(l.id)?"done":""}">
 <strong>${l.position}. ${escapeHtml(l.title)}</strong><div class="muted section">${renderLessonContent(l)}</div>
 ${completed.has(l.id)?`<span class="badge ok">Completada</span>`:`<button class="primary completeLesson" data-id="${l.id}">Marcar completada</button>`}</div>`).join("")}</div>
 <div id="assessmentArea" class="section"></div>`;
 content.querySelectorAll(".completeLesson").forEach(b=>b.onclick=async()=>{await LearningEngine.completeLesson(en.id,b.dataset.id);openCourse((await Repository.myEnrollments(currentUser.person_id)).find(x=>x.id===en.id));});
 const fresh=(await Repository.myEnrollments(currentUser.person_id)).find(x=>x.id===en.id);
 renderAssessment(fresh);
}

function renderLessonContent(l){
 if(l.content_type==="video") return `<a href="${escapeHtml(l.content_body)}" target="_blank" rel="noopener">Abrir video</a>`;
 if(l.content_type==="pdf") return `<a href="${escapeHtml(l.content_body)}" target="_blank" rel="noopener">Abrir PDF</a>`;
 return `<p>${escapeHtml(l.content_body)}</p>`;
}

async function renderAssessment(en){
 const area=$("#assessmentArea"); if(!area)return;
 if(en.status==="completed"){
   const cert=await CertificationEngine.get(en.id);
   area.innerHTML=cert?certificateHtml(cert):`<div class="card"><span class="badge ok">Curso completado</span></div>`;return;
 }
 const assessment=(en.course.assessments||[])[0];
 if(!assessment){area.innerHTML=`<div class="card"><p>No hay evaluación configurada.</p></div>`;return;}
 if(!CompletionEngine.readyForAssessment(en)){area.innerHTML=`<div class="card"><p>Completa todas las lecciones para habilitar la evaluación.</p></div>`;return;}
 const questions=[...(assessment.questions||[])].sort((a,b)=>a.position-b.position);
 area.innerHTML=`<div class="card"><h3>${escapeHtml(assessment.title)}</h3><form id="quizForm" class="stack">
 ${questions.map(q=>`<fieldset><legend>${escapeHtml(q.prompt)}</legend>${(q.question_options||[]).sort((a,b)=>a.position-b.position).map(o=>`<label><input type="radio" name="${q.id}" value="${o.id}" required> ${escapeHtml(o.label)}</label>`).join("")}</fieldset>`).join("")}
 <button class="primary">Enviar evaluación</button></form><div id="quizResult"></div></div>`;
 $("#quizForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const answers=questions.map(q=>({question_id:q.id,option_id:fd.get(q.id)}));
   const result=await AssessmentEngine.submit(en.id,assessment.id,answers);
   $("#quizResult").innerHTML=`<p><strong>Resultado:</strong> ${result.score}% · ${result.passed?"APROBADO":"NO APROBADO"}</p>`;
   if(result.passed)setTimeout(()=>openCourse(en),500);
 };
}

function certificateHtml(c){
  return `<div class="certificate"><p>AXION LMS</p><h1>Certificado de finalización</h1><p>Se certifica que</p>
  <h2>${escapeHtml(c.person.first_name)} ${escapeHtml(c.person.last_name)}</h2><p>completó satisfactoriamente</p><h3>${escapeHtml(c.course.title)}</h3>
  <p class="folio">Folio: ${escapeHtml(c.folio)}</p><p>Emitido: ${new Date(c.issued_at).toLocaleString()}</p></div>`;
}

Repository.onAuth(boot);
boot(await Repository.session());
