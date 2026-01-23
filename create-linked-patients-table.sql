-- Script SQL pour créer la table linked_patients
-- Permet de créer des patients "sans compte personnel" mais liés à un compte existant
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================
-- 1. CRÉER LA TABLE linked_patients
-- ============================================

CREATE TABLE IF NOT EXISTS linked_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linked_to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT, -- Peut être différent ou identique au compte parent
    phone TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('Homme', 'Femme', 'Autre')),
    pathologies TEXT[],
    contraindications TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    patient_status TEXT CHECK (patient_status IN ('active', 'inactive', 'archived')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) -- Admin qui a créé ce patient
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_linked_patients_user_id ON linked_patients(linked_to_user_id);
CREATE INDEX IF NOT EXISTS idx_linked_patients_email ON linked_patients(email);
CREATE INDEX IF NOT EXISTS idx_linked_patients_status ON linked_patients(patient_status);

-- Activer RLS
ALTER TABLE linked_patients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. POLITIQUES RLS POUR linked_patients
-- ============================================

-- Les utilisateurs peuvent voir leurs patients liés
CREATE POLICY "Users can view own linked patients" ON linked_patients
    FOR SELECT USING (auth.uid() = linked_to_user_id);

-- Les admins peuvent tout faire sur linked_patients
CREATE POLICY "Admins can manage all linked patients" ON linked_patients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Les utilisateurs peuvent voir les patients liés à leur compte (pour leurs propres réservations)
CREATE POLICY "Users can view linked patients for bookings" ON linked_patients
    FOR SELECT USING (
        auth.uid() = linked_to_user_id OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 3. MODIFIER LA TABLE bookings
-- ============================================

-- Ajouter une colonne pour référencer les patients liés
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS linked_patient_id UUID REFERENCES linked_patients(id) ON DELETE CASCADE;

-- Supprimer l'ancienne contrainte si elle existe (si user_id était NOT NULL)
-- Note: On garde user_id comme nullable pour permettre les patients liés

-- Créer une contrainte CHECK pour s'assurer qu'au moins un des deux est présent
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_patient_check;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_patient_check 
CHECK (
    (user_id IS NOT NULL AND linked_patient_id IS NULL) OR 
    (user_id IS NULL AND linked_patient_id IS NOT NULL)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_bookings_linked_patient_id ON bookings(linked_patient_id);

-- ============================================
-- 4. MODIFIER LES POLITIQUES RLS POUR bookings
-- ============================================

-- Les utilisateurs peuvent voir les réservations de leurs patients liés
-- (en plus de leurs propres réservations)
-- Cette politique sera ajoutée en complément des politiques existantes

-- Note: Les politiques existantes pour bookings gèrent déjà user_id
-- On doit s'assurer que les utilisateurs peuvent aussi voir les bookings
-- de leurs patients liés

-- Fonction helper pour vérifier si un utilisateur peut voir une réservation
CREATE OR REPLACE FUNCTION can_user_view_booking(booking_user_id UUID, booking_linked_patient_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- L'utilisateur peut voir sa propre réservation
    IF booking_user_id = auth.uid() THEN
        RETURN TRUE;
    END IF;
    
    -- L'utilisateur peut voir les réservations de ses patients liés
    IF booking_linked_patient_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM linked_patients 
            WHERE id = booking_linked_patient_id 
            AND linked_to_user_id = auth.uid()
        );
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mettre à jour la politique "Users can view own bookings" pour inclure les patients liés
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;

CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (
        can_user_view_booking(user_id, linked_patient_id) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Mettre à jour la politique pour créer des réservations (inclure les patients liés)
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;

CREATE POLICY "Users can create own bookings" ON bookings
    FOR INSERT WITH CHECK (
        (user_id = auth.uid() AND linked_patient_id IS NULL) OR
        (user_id IS NULL AND linked_patient_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM linked_patients 
            WHERE id = linked_patient_id 
            AND linked_to_user_id = auth.uid()
        )) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Mettre à jour la politique pour modifier des réservations
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

CREATE POLICY "Users can update own bookings" ON bookings
    FOR UPDATE USING (
        can_user_view_booking(user_id, linked_patient_id) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        can_user_view_booking(user_id, linked_patient_id) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Mettre à jour la politique pour supprimer des réservations
DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;

CREATE POLICY "Users can delete own bookings" ON bookings
    FOR DELETE USING (
        can_user_view_booking(user_id, linked_patient_id) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 5. COMMENTAIRES
-- ============================================

COMMENT ON TABLE linked_patients IS 'Patients sans compte personnel mais liés à un compte existant';
COMMENT ON COLUMN linked_patients.linked_to_user_id IS 'ID du compte utilisateur auquel ce patient est lié';
COMMENT ON COLUMN linked_patients.email IS 'Email du patient (peut être différent du compte parent)';
COMMENT ON COLUMN linked_patients.created_by IS 'ID de l''admin qui a créé ce patient lié';
COMMENT ON COLUMN bookings.linked_patient_id IS 'ID du patient lié (si la réservation est pour un patient sans compte personnel)';
