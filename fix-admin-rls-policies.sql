-- Script pour corriger les politiques RLS pour que les admins voient tous les profils
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer les politiques admin existantes (si elles existent)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. Créer la politique SELECT pour les admins
-- Les admins peuvent voir tous les profils
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- 3. Créer la politique UPDATE pour les admins
-- Les admins peuvent modifier tous les profils
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- 4. Vérifier toutes les politiques sur profiles
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- Note: Les politiques doivent être dans cet ordre :
-- 1. "Allow insert via trigger" - INSERT - pour tous
-- 2. "Users can view own profile" - SELECT - pour les utilisateurs (leur propre profil)
-- 3. "Users can update own profile" - UPDATE - pour les utilisateurs (leur propre profil)
-- 4. "Admins can view all profiles" - SELECT - pour les admins (tous les profils)
-- 5. "Admins can update all profiles" - UPDATE - pour les admins (tous les profils)






