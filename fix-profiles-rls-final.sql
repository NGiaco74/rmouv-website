-- Script pour corriger définitivement les politiques RLS de la table profiles
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer TOUTES les politiques existantes pour repartir à zéro
DROP POLICY IF EXISTS "Allow insert via trigger" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. S'assurer que RLS est activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Politique pour l'insertion (nécessaire pour le trigger)
CREATE POLICY "Allow insert via trigger" ON profiles
    FOR INSERT 
    WITH CHECK (true);

-- 4. Politique SELECT : Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- 5. Politique UPDATE : Les utilisateurs peuvent modifier leur propre profil
-- IMPORTANT : Avec WITH CHECK pour valider les modifications
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6. Politique SELECT pour les admins : Voir tous les profils
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

-- 7. Politique UPDATE pour les admins : Modifier tous les profils
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

-- 8. Vérification : Afficher toutes les politiques créées
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;






