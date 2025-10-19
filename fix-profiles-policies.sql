-- Script pour corriger les politiques RLS de la table profiles
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer toutes les politiques existantes sur profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. Créer des politiques RLS simplifiées et sécurisées
-- Politique pour la lecture : les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Politique pour la mise à jour : les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Politique pour l'insertion : permettre l'insertion via le trigger
CREATE POLICY "Allow insert via trigger" ON profiles
    FOR INSERT WITH CHECK (true);

-- 3. Vérifier que RLS est activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Tester la lecture du profil
-- Cette requête devrait maintenant fonctionner
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- 5. Si vous voulez permettre aux admins de voir tous les profils (optionnel)
-- Décommentez les lignes suivantes :
/*
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'admin'
        )
    );
*/
