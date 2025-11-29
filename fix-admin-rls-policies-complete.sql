-- Script COMPLET pour corriger les politiques RLS pour que les admins voient tous les profils
-- À exécuter dans l'éditeur SQL de Supabase
-- IMPORTANT: Ce script supprime TOUTES les politiques et les recrée proprement

-- 1. SUPPRIMER toutes les versions possibles de la fonction is_admin()
-- Il peut y avoir plusieurs signatures, donc on les liste et supprime toutes
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Lister et supprimer toutes les fonctions is_admin dans le schéma public
    FOR func_record IN 
        SELECT 
            proname, 
            oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'is_admin' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || '(' || func_record.argtypes || ') CASCADE';
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Si erreur, essayer quand même de supprimer sans signature
        BEGIN
            DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
END $$;

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

-- 4. CRÉER les politiques dans le bon ordre (les plus restrictives d'abord, puis les plus permissives)

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

-- CRÉER une fonction pour vérifier si l'utilisateur est admin (contourne RLS)
-- Cette fonction utilise SECURITY DEFINER pour lire directement dans profiles sans RLS
-- SET search_path = '' force l'utilisation du schéma public explicite
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    user_role text;
BEGIN
    -- Lire directement dans profiles sans passer par RLS grâce à SECURITY DEFINER
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$;

-- Politique SELECT pour les admins (tous les profils)
-- Utilise la fonction is_admin() pour éviter la récursion
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT 
    USING (public.is_admin());

-- Politique UPDATE pour les admins (tous les profils)
-- Utilise la fonction is_admin() pour éviter la récursion
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. VÉRIFICATION : Afficher toutes les politiques créées
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 5. TEST : Vérifier que l'utilisateur actuel peut voir tous les profils s'il est admin
-- (Remplacez 'YOUR_USER_ID' par votre ID utilisateur admin)
-- SELECT id, email, role FROM profiles WHERE id = auth.uid();
-- SELECT COUNT(*) as total_profiles FROM profiles;

-- NOTE IMPORTANTE : 
-- Les politiques RLS fonctionnent avec une logique OR :
-- - Si l'utilisateur correspond à "Users can view own profile" (auth.uid() = id) → peut voir son profil
-- - Si l'utilisateur est admin ET correspond à "Admins can view all profiles" → peut voir TOUS les profils
-- Les deux politiques peuvent être vraies en même temps, ce qui permet aux admins de voir tous les profils

