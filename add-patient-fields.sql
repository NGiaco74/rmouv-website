-- Script SQL pour ajouter la gestion des patients à la table profiles
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================
-- 1. AJOUTER LES CHAMPS PATIENTS À LA TABLE PROFILES
-- ============================================

-- Téléphone
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Date de naissance
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Genre
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Homme', 'Femme', 'Autre')) DEFAULT NULL;

-- Pathologies (tableau de textes)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pathologies TEXT[] DEFAULT NULL;

-- Contre-indications
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS contraindications TEXT DEFAULT NULL;

-- Contact d'urgence - Nom
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT NULL;

-- Contact d'urgence - Téléphone
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT NULL;

-- Statut patient (NULL = pas patient, 'active'/'inactive'/'archived' = patient)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS patient_status TEXT CHECK (patient_status IN ('active', 'inactive', 'archived')) DEFAULT NULL;

-- ============================================
-- 2. CRÉER LA TABLE PATIENT_COMMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS patient_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'general' CHECK (comment_type IN ('medical', 'administrative', 'follow_up', 'general')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_by_name TEXT NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_patient_comments_patient_id ON patient_comments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_comments_created_at ON patient_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_comments_created_by ON patient_comments(created_by);

-- ============================================
-- 3. ACTIVER RLS SUR PATIENT_COMMENTS
-- ============================================

ALTER TABLE patient_comments ENABLE ROW LEVEL SECURITY;

-- Politique : Les admins peuvent voir tous les commentaires
CREATE POLICY "Admins can view all patient comments" ON patient_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique : Les admins peuvent créer des commentaires
CREATE POLICY "Admins can create patient comments" ON patient_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Politique : Les admins peuvent modifier leurs propres commentaires
CREATE POLICY "Admins can update own patient comments" ON patient_comments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND created_by = auth.uid()
    );

-- Politique : Les admins peuvent supprimer leurs propres commentaires
CREATE POLICY "Admins can delete own patient comments" ON patient_comments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND created_by = auth.uid()
    );

-- ============================================
-- 4. COMMENTAIRES POUR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN profiles.phone IS 'Numéro de téléphone du patient';
COMMENT ON COLUMN profiles.date_of_birth IS 'Date de naissance du patient';
COMMENT ON COLUMN profiles.gender IS 'Genre du patient (Homme/Femme/Autre)';
COMMENT ON COLUMN profiles.pathologies IS 'Liste des pathologies du patient';
COMMENT ON COLUMN profiles.contraindications IS 'Contre-indications médicales';
COMMENT ON COLUMN profiles.emergency_contact_name IS 'Nom du contact d''urgence';
COMMENT ON COLUMN profiles.emergency_contact_phone IS 'Téléphone du contact d''urgence';
COMMENT ON COLUMN profiles.patient_status IS 'Statut du patient (active/inactive/archived), NULL si pas patient';

COMMENT ON TABLE patient_comments IS 'Commentaires associés aux patients';
COMMENT ON COLUMN patient_comments.comment_type IS 'Type de commentaire (medical/administrative/follow_up/general)';
COMMENT ON COLUMN patient_comments.created_by_name IS 'Nom de l''auteur du commentaire (pour affichage rapide)';

-- ============================================
-- 5. VÉRIFICATION
-- ============================================

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('phone', 'date_of_birth', 'gender', 'pathologies', 'contraindications', 'emergency_contact_name', 'emergency_contact_phone', 'patient_status')
ORDER BY column_name;

-- Vérifier que la table patient_comments a été créée
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'patient_comments';






