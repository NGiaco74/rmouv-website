-- Permettre à patient_comments d'accepter aussi les id des patients liés (linked_patients)
-- En supprimant la FK sur patient_id, la colonne peut stocker soit un profiles.id soit un linked_patients.id.
-- À exécuter dans l'éditeur SQL de Supabase.

ALTER TABLE patient_comments
DROP CONSTRAINT IF EXISTS patient_comments_patient_id_fkey;

-- Optionnel : commentaire pour documenter (patient_id = id dans profiles OU linked_patients)
-- COMMENT ON COLUMN patient_comments.patient_id IS 'UUID du patient : profiles.id ou linked_patients.id';
