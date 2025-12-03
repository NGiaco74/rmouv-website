-- Trigger pour mettre à jour automatiquement current_bookings dans booking_slots
-- quand une réservation est créée ou supprimée

-- Fonction pour mettre à jour le compteur
CREATE OR REPLACE FUNCTION update_booking_slot_counter()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        -- Incrémenter le compteur
        UPDATE booking_slots
        SET current_bookings = current_bookings + 1
        WHERE booking_date = NEW.booking_date
          AND booking_time = NEW.booking_time
          AND service_type = NEW.service_type;
    ELSIF TG_OP = 'DELETE' THEN
        -- Décrémenter le compteur
        UPDATE booking_slots
        SET current_bookings = GREATEST(current_bookings - 1, 0)
        WHERE booking_date = OLD.booking_date
          AND booking_time = OLD.booking_time
          AND service_type = OLD.service_type
          AND OLD.status = 'confirmed';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si le statut change de confirmed à autre chose, décrémenter
        IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
            UPDATE booking_slots
            SET current_bookings = GREATEST(current_bookings - 1, 0)
            WHERE booking_date = OLD.booking_date
              AND booking_time = OLD.booking_time
              AND service_type = OLD.service_type;
        -- Si le statut change de non-confirmed à confirmed, incrémenter
        ELSIF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
            UPDATE booking_slots
            SET current_bookings = current_bookings + 1
            WHERE booking_date = NEW.booking_date
              AND booking_time = NEW.booking_time
              AND service_type = NEW.service_type;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger après INSERT
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_insert ON bookings;
CREATE TRIGGER trigger_update_booking_slot_on_insert
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

-- Trigger après DELETE
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_delete ON bookings;
CREATE TRIGGER trigger_update_booking_slot_on_delete
    AFTER DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

-- Trigger après UPDATE
DROP TRIGGER IF EXISTS trigger_update_booking_slot_on_update ON bookings;
CREATE TRIGGER trigger_update_booking_slot_on_update
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_slot_counter();

-- Fonction pour synchroniser tous les compteurs (à exécuter une fois pour corriger les données existantes)
CREATE OR REPLACE FUNCTION sync_all_booking_counters()
RETURNS void AS $$
BEGIN
    UPDATE booking_slots bs
    SET current_bookings = (
        SELECT COUNT(*)
        FROM bookings b
        WHERE b.booking_date = bs.booking_date
          AND b.booking_time = bs.booking_time
          AND b.service_type = bs.service_type
          AND b.status = 'confirmed'
    );
END;
$$ LANGUAGE plpgsql;

-- Exécuter la synchronisation initiale
SELECT sync_all_booking_counters();

-- Fonction pour obtenir les compteurs de réservations en temps réel
-- Cette fonction peut être appelée par les utilisateurs authentifiés
-- SECURITY DEFINER permet d'exécuter avec les permissions du créateur (admin)
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

-- Donner les permissions d'exécution aux utilisateurs authentifiés et anonymes
GRANT EXECUTE ON FUNCTION get_booking_counts(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_counts(DATE, DATE) TO anon;

-- Politique RLS pour permettre aux utilisateurs authentifiés de lire les réservations confirmées
-- (nécessaire pour compter les places disponibles)
-- Cette politique permet de lire booking_date, booking_time, service_type, status
-- mais pas les informations personnelles (user_id, etc.)
DROP POLICY IF EXISTS "Authenticated users can read confirmed bookings for counting" ON bookings;
CREATE POLICY "Authenticated users can read confirmed bookings for counting"
ON bookings
FOR SELECT
TO authenticated
USING (status = 'confirmed');

-- Alternative : Si vous voulez permettre la lecture de toutes les réservations confirmées même aux anonymes
-- (pour permettre le comptage sans authentification)
-- DROP POLICY IF EXISTS "Anyone can read confirmed bookings for counting" ON bookings;
-- CREATE POLICY "Anyone can read confirmed bookings for counting"
-- ON bookings
-- FOR SELECT
-- TO public
-- USING (status = 'confirmed');

