-- Script pour corriger le trigger update_booking_slot_counter
-- Le trigger doit vérifier que current_bookings < max_capacity avant d'incrémenter
-- pour éviter de violer la contrainte CHECK booking_slots_check

-- Fonction pour vérifier la disponibilité AVANT l'insertion (BEFORE INSERT)
CREATE OR REPLACE FUNCTION check_booking_slot_availability()
RETURNS TRIGGER AS $$
DECLARE
    slot_record RECORD;
BEGIN
    IF NEW.status = 'confirmed' THEN
        -- Récupérer le créneau correspondant
        SELECT * INTO slot_record
        FROM booking_slots
        WHERE booking_date = NEW.booking_date
          AND booking_time::TIME = NEW.booking_time::TIME
          AND service_type = NEW.service_type;
        
        -- Si le créneau existe et est complet, empêcher l'insertion
        IF FOUND AND slot_record.current_bookings >= slot_record.max_capacity THEN
            RAISE EXCEPTION 'Ce créneau est complet. Capacité: %/%', 
                slot_record.current_bookings, slot_record.max_capacity;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le compteur APRÈS l'insertion (AFTER INSERT)
CREATE OR REPLACE FUNCTION update_booking_slot_counter()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        -- Incrémenter le compteur seulement si current_bookings < max_capacity
        -- (double vérification pour sécurité)
        UPDATE booking_slots
        SET current_bookings = current_bookings + 1
        WHERE booking_date = NEW.booking_date
          AND booking_time::TIME = NEW.booking_time::TIME
          AND service_type = NEW.service_type
          AND current_bookings < max_capacity; -- Vérification de la contrainte
        
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
              AND service_type = NEW.service_type
              AND current_bookings < max_capacity; -- Vérification de la contrainte
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger BEFORE INSERT pour vérifier la disponibilité
DROP TRIGGER IF EXISTS trigger_check_booking_slot_availability ON bookings;
CREATE TRIGGER trigger_check_booking_slot_availability
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_booking_slot_availability();

-- Le trigger AFTER INSERT existant sera mis à jour automatiquement avec la nouvelle fonction
