-- Script pour ajouter la colonne updated_at à la table patient_comments
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE patient_comments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Optionnel : Mettre à jour les valeurs existantes avec created_at si NULL
UPDATE patient_comments 
SET updated_at = created_at 
WHERE updated_at IS NULL;






