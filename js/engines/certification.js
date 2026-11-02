import { Repository } from "../repositories/supabase.js";
export const CertificationEngine={get:async enrollmentId=>Repository.certificate(enrollmentId)};
