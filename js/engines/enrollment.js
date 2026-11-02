import { Repository } from "../repositories/supabase.js";
export const EnrollmentEngine={assign:async({organizationId,personId,courseId,assignedBy})=>{
 const row=await Repository.enroll({organization_id:organizationId,person_id:personId,course_id:courseId,assigned_by:assignedBy,status:"assigned"});
 await Repository.audit("enrollment.assigned","enrollment",row.id,{course_id:courseId,person_id:personId});
 return row;
}};
