import { Repository } from "../repositories/supabase.js";
export const LearningEngine={completeLesson:async(enrollmentId,lessonId)=>{
 const result=await Repository.completeLesson(enrollmentId,lessonId);
 await Repository.audit("lesson.completed","enrollment",enrollmentId,{lesson_id:lessonId});
 return result;
}};
