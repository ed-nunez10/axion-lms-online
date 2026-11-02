import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { CONFIG } from "../config.js";

if (CONFIG.supabaseUrl.includes("YOUR_") || CONFIG.supabaseAnonKey.includes("YOUR_")) {
  console.warn("AXION LMS: configura js/config.js antes de usar Supabase.");
}

export const db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

export const Repository = {
  async session(){ return (await db.auth.getSession()).data.session; },
  onAuth(cb){ return db.auth.onAuthStateChange((_e,s)=>cb(s)); },
  async signIn(email,password){ return db.auth.signInWithPassword({email,password}); },
  async signUp(email,password){ return db.auth.signUp({email,password}); },
  async signOut(){ return db.auth.signOut(); },

  async me(){
    const {data:{user}} = await db.auth.getUser();
    if(!user) return null;
    const {data,error}=await db.from("app_users").select("*, person:persons(*)").eq("auth_user_id",user.id).single();
    if(error) throw error;
    return data;
  },

  async dashboardAdmin(orgId){
    const [p,c,e] = await Promise.all([
      db.from("persons").select("*",{count:"exact",head:true}).eq("organization_id",orgId),
      db.from("courses").select("*",{count:"exact",head:true}).eq("organization_id",orgId),
      db.from("enrollments").select("*",{count:"exact",head:true}).eq("organization_id",orgId)
    ]);
    return {participants:p.count||0,courses:c.count||0,enrollments:e.count||0};
  },
  async listPersons(orgId){
    return (await db.from("persons").select("*").eq("organization_id",orgId).order("created_at",{ascending:false})).data||[];
  },
  async createPerson(payload){ const {data,error}=await db.from("persons").insert(payload).select().single(); if(error) throw error; return data; },
  async listCourses(orgId){
    return (await db.from("courses").select("*, lessons(id,title,position,content_type)").eq("organization_id",orgId).order("created_at",{ascending:false})).data||[];
  },
  async createCourse(payload){ const {data,error}=await db.from("courses").insert(payload).select().single(); if(error) throw error; return data; },
  async createLesson(payload){ const {data,error}=await db.from("lessons").insert(payload).select().single(); if(error) throw error; return data; },
  async createAssessment(payload){ const {data,error}=await db.from("assessments").insert(payload).select().single(); if(error) throw error; return data; },
  async createQuestion(payload){ const {data,error}=await db.from("questions").insert(payload).select().single(); if(error) throw error; return data; },
  async createOptions(rows){ const {data,error}=await db.from("question_options").insert(rows).select(); if(error) throw error; return data; },
  async enroll(payload){ const {data,error}=await db.from("enrollments").insert(payload).select().single(); if(error) throw error; return data; },

  async myEnrollments(personId){
    const {data,error}=await db.from("enrollments")
      .select("*, course:courses(*, lessons(*), assessments(*, questions(*, question_options(*)))), lesson_progress(*)")
      .eq("person_id",personId).order("assigned_at",{ascending:false});
    if(error) throw error; return data||[];
  },
  async completeLesson(enrollmentId,lessonId){
    const {data,error}=await db.rpc("complete_lesson",{p_enrollment_id:enrollmentId,p_lesson_id:lessonId});
    if(error) throw error; return data;
  },
  async submitAssessment(enrollmentId,assessmentId,answers){
    const {data,error}=await db.rpc("submit_assessment",{
      p_enrollment_id:enrollmentId,p_assessment_id:assessmentId,p_answers:answers
    });
    if(error) throw error; return data;
  },
  async certificate(enrollmentId){
    const {data,error}=await db.from("certificates").select("*, course:courses(title), person:persons(first_name,last_name)").eq("enrollment_id",enrollmentId).maybeSingle();
    if(error) throw error; return data;
  },
  async audit(eventType,entityType,entityId,metadata={}){
    const {error}=await db.rpc("write_audit_event",{
      p_event_type:eventType,p_entity_type:entityType,p_entity_id:entityId,p_metadata:metadata
    });
    if(error) console.warn("Audit event failed",error.message);
  }
};
