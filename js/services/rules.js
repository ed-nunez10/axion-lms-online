export const Rules = {
  canTakeAssessment(enrollment){
    const lessons=enrollment.course?.lessons||[];
    const done=new Set((enrollment.lesson_progress||[]).filter(x=>x.completed_at).map(x=>x.lesson_id));
    return lessons.length>0 && lessons.every(l=>done.has(l.id));
  },
  progress(enrollment){
    const total=(enrollment.course?.lessons||[]).length;
    const done=(enrollment.lesson_progress||[]).filter(x=>x.completed_at).length;
    return total ? Math.round(done/total*100) : 0;
  },
  isAdmin(user){ return user?.role==="admin"; }
};
