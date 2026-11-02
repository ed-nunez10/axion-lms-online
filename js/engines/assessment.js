import { Repository } from "../repositories/supabase.js";
export const AssessmentEngine={submit:async(enrollmentId,assessmentId,answers)=>{
 const result=await Repository.submitAssessment(enrollmentId,assessmentId,answers);
 await Repository.audit("assessment.submitted","enrollment",enrollmentId,{assessment_id:assessmentId,result});
 return result;
}};
