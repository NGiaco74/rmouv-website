-- Script ALTERNATIF pour corriger les politiques RLS
-- Si la version 1 ne fonctionne pas, essayez celle-ci
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. SUPPRIMER la fonction is_admin() si elle existe
DROP FUNCTION IF EXISTS public.is_admin();

-- 2. SUPPRIMER TOUTES les politiques existantes sur profiles
DROP POLICY IF EXISTS "Allow insert via trigger" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON profiles;

-- 3. S'assurer que RLS est activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. CRÉER la fonction is_admin() avec permissions explicites
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    user_role text;
BEGIN
    -- Utiliser pg_temp pour éviter tout conflit
    -- Lire directement depuis profiles en contournant RLS
    PERFORM 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
    
    RETURN FOUND;
END;
$$;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- 5. CRÉER les politiques de base

-- Politique INSERT (pour le trigger de création automatique)
CREATE POLICY "Allow insert via trigger" ON profiles
    FOR INSERT 
    WITH CHECK (true);

-- Politique SELECT pour les utilisateurs normaux (leur propre profil)
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Politique UPDATE pour les utilisateurs normaux (leur propre profil)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Politique SELECT pour les admins (tous les profils)
-- Utilise la fonction is_admin() pour éviter la récursion
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT 
    USING (public.is_admin() = true);

-- Politique UPDATE pour les admins (tous les profils)
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE 
    USING (public.is_admin() = true)
    WITH CHECK (public.is_admin() = true);

-- 6. VÉRIFICATION : Afficher toutes les politiques créées
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;






