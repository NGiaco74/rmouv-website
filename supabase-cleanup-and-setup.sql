-- ============================================
-- NETTOYAGE COMPLET : Suppression de tout
-- ============================================

-- Supprimer tous les triggers sur bookings
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_insert ON bookings;
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_delete ON bookings;
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_update ON bookings;

-- Supprimer toutes les fonctions
DROP FUNCTION IF EXISTS update_booking_slot_counter() CASCADE;
DROP FUNCTION IF EXISTS sync_all_booking_counters() CASCADE;
DROP FUNCTION IF EXISTS get_booking_counts(DATE, DATE) CASCADE;

-- Supprimer toutes les politiques RLS pour bookings
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can create all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can read confirmed bookings for counting" ON bookings;
DROP POLICY IF EXISTS "Anyone can read confirmed bookings for counting" ON bookings;

-- Supprimer toutes les politiques RLS pour booking_slots
DROP POLICY IF EXISTS "Admins can manage all slots" ON booking_slots;
DROP POLICY IF EXISTS "Admins can manage booking slots" ON booking_slots;
DROP POLICY IF EXISTS "Anyone can view booking slots" ON booking_slots;
DROP POLICY IF EXISTS "Authenticated users can update current_bookings only" ON booking_slots;
DROP POLICY IF EXISTS "Authenticated users can update current_bookings" ON booking_slots;

-- ============================================
-- RECRÉATION PROPRE : Politiques RLS
-- ============================================

-- ============================================
-- POLITIQUES POUR booking_slots
-- ============================================

-- 1. Tout le monde peut lire booking_slots (pour voir les créneaux disponibles)
CREATE POLICY "Anyone can view booking slots"
ON booking_slots
FOR SELECT
TO public
USING (true);

-- 2. Seuls les admins peuvent créer/modifier/supprimer des créneaux
CREATE POLICY "Admins can manage booking slots"
ON booking_slots
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- 3. Les utilisateurs authentifiés peuvent mettre à jour uniquement current_bookings
-- (via les triggers, mais on laisse la possibilité pour la synchronisation)
CREATE POLICY "Authenticated users can update current_bookings"
ON booking_slots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- POLITIQUES POUR bookings
-- ============================================

-- 1. Les admins peuvent tout faire sur bookings
CREATE POLICY "Admins can manage all bookings"
ON bookings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- 2. Les utilisateurs authentifiés peuvent voir leurs propres réservations
CREATE POLICY "Users can view own bookings"
ON bookings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Les utilisateurs authentifiés peuvent créer leurs propres réservations
CREATE POLICY "Users can create own bookings"
ON bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Les utilisateurs authentifiés peuvent modifier leurs propres réservations
CREATE POLICY "Users can update own bookings"
ON bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Les utilisateurs authentifiés peuvent supprimer leurs propres réservations
CREATE POLICY "Users can delete own bookings"
ON bookings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Les utilisateurs authentifiés peuvent lire les réservations confirmées pour compter les places
-- (nécessaire pour afficher les compteurs 2/3, 1/3, etc.)
CREATE POLICY "Authenticated users can read confirmed bookings for counting"
ON bookings
FOR SELECT
TO authenticated
USING (status = 'confirmed');

-- ============================================
-- FONCTIONS ET TRIGGERS
-- ============================================

-- Fonction pour mettre à jour automatiquement current_bookings dans booking_slots
CREATE OR REPLACE FUNCTION update_booking_slot_counter()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        -- Incrémenter le compteur
        UPDATE booking_slots
        SET current_bookings = current_bookings + 1
        WHERE booking_date = NEW.booking_date
          AND booking_time::TIME = NEW.booking_time::TIME
          AND service_type = NEW.service_type;
    ELSIF TG_OP = 'DELETE' THEN
        -- Décrémenter le compteur
        UPDATE booking_slots
        SET current_bookings = GREATEST(current_bookings - 1, 0)
        WHERE booking_date = OLD.booking_date
          AND booking_time::TIME = OLD.booking_time::TIME
          AND service_type = OLD.service_type
          AND OLD.status = 'confirmed';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si le statut change de confirmed à autre chose, décrémenter
        IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
            UPDATE booking_slots
            SET current_bookings = GREATEST(current_bookings - 1, 0)
            WHERE booking_date = OLD.booking_date
              AND booking_time::TIME = OLD.booking_time::TIME
              AND service_type = OLD.service_type;
        -- Si le statut change de non-confirmed à confirmed, incrémenter
        ELSIF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
            UPDATE booking_slots
            SET current_bookings = current_bookings + 1
            WHERE booking_date = NEW.booking_date
              AND booking_time::TIME = NEW.booking_time::TIME
              AND service_type = NEW.service_type;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers pour mettre à jour automatiquement current_bookings
CREATE TRIGGER trigger_update_booking_slot_on_insert
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

CREATE TRIGGER trigger_update_booking_slot_on_delete
    AFTER DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

CREATE TRIGGER trigger_update_booking_slot_on_update
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

-- Fonction pour synchroniser tous les compteurs (à exécuter une fois après le nettoyage)
CREATE OR REPLACE FUNCTION sync_all_booking_counters()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE booking_slots bs
    SET current_bookings = (
        SELECT COUNT(*)
        FROM bookings b
        WHERE b.booking_date = bs.booking_date
          AND b.booking_time::TIME = bs.booking_time::TIME
          AND b.service_type = bs.service_type
          AND b.status = 'confirmed'
    );
END;
$$;

-- Fonction pour obtenir les compteurs en temps réel (fallback si current_bookings n'est pas à jour)
CREATE OR REPLACE FUNCTION get_booking_counts(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    booking_date DATE,
    booking_time TEXT,
    service_type TEXT,
    current_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bs.booking_date,
        bs.booking_time::TEXT,
        bs.service_type,
        COALESCE(
            (SELECT COUNT(*)::BIGINT
             FROM bookings b
             WHERE b.booking_date = bs.booking_date
               AND b.booking_time::TIME = bs.booking_time::TIME
               AND b.service_type = bs.service_type
               AND b.status = 'confirmed'),
            0
        ) AS current_count
    FROM booking_slots bs
    WHERE bs.booking_date >= start_date
      AND bs.booking_date <= end_date
    GROUP BY bs.booking_date, bs.booking_time, bs.service_type;
END;
$$;

-- Permissions pour les fonctions
GRANT EXECUTE ON FUNCTION get_booking_counts(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_counts(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION sync_all_booking_counters() TO authenticated;

-- ============================================
-- SYNCHRONISATION INITIALE
-- ============================================

-- Synchroniser tous les compteurs avec les réservations existantes
SELECT sync_all_booking_counters();

-- ============================================
-- VÉRIFICATION
-- ============================================

-- Afficher le nombre de créneaux mis à jour
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM booking_slots
    WHERE current_bookings > 0;
    
    RAISE NOTICE '✅ Synchronisation terminée : % créneaux avec des réservations', updated_count;
END $$;




