-- Script pour corriger le trigger update_booking_slot_counter
-- Le trigger doit vérifier la disponibilité en comptant les réservations réelles
-- pour éviter de violer la contrainte CHECK booking_slots_check

-- Fonction pour vérifier la disponibilité AVANT l'insertion (BEFORE INSERT)
-- Cette fonction compte les réservations réelles dans bookings, pas current_bookings
CREATE OR REPLACE FUNCTION check_booking_availability()
RETURNS TRIGGER AS $$
DECLARE
    slot_record RECORD;
    actual_count INTEGER;
BEGIN
    IF NEW.status = 'confirmed' THEN
        -- Récupérer le créneau correspondant
        SELECT * INTO slot_record
        FROM booking_slots
        WHERE booking_date = NEW.booking_date
          AND booking_time::TIME = NEW.booking_time::TIME
          AND service_type = NEW.service_type;
        
        IF FOUND THEN
            -- Compter les réservations réelles (y compris celle en cours d'insertion)
            SELECT COUNT(*) INTO actual_count
            FROM bookings
            WHERE booking_date = NEW.booking_date
              AND booking_time::TIME = NEW.booking_time::TIME
              AND service_type = NEW.service_type
              AND status = 'confirmed';
            
            -- Vérifier que le nombre de réservations (après insertion) ne dépasse pas la capacité
            IF actual_count >= slot_record.max_capacity THEN
                RAISE EXCEPTION 'Ce créneau est complet. Capacité: %/%', 
                    actual_count, slot_record.max_capacity;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le compteur APRÈS l'insertion (AFTER INSERT)
CREATE OR REPLACE FUNCTION update_booking_slot_counter()
RETURNS TRIGGER AS $$
DECLARE
    slot_record RECORD;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        -- Récupérer le créneau pour vérifier la contrainte
        SELECT * INTO slot_record
        FROM booking_slots
        WHERE booking_date = NEW.booking_date
          AND booking_time::TIME = NEW.booking_time::TIME
          AND service_type = NEW.service_type;
        
        -- Si le créneau existe, incrémenter seulement si on ne dépasse pas la capacité
        IF FOUND AND slot_record.current_bookings < slot_record.max_capacity THEN
            UPDATE booking_slots
            SET current_bookings = current_bookings + 1
            WHERE booking_date = NEW.booking_date
              AND booking_time::TIME = NEW.booking_time::TIME
              AND service_type = NEW.service_type;
        END IF;
        
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
            -- Récupérer le créneau pour vérifier la contrainte
            SELECT * INTO slot_record
            FROM booking_slots
            WHERE booking_date = NEW.booking_date
              AND booking_time::TIME = NEW.booking_time::TIME
              AND service_type = NEW.service_type;
            
            -- Si le créneau existe, vérifier qu'on peut incrémenter
            IF FOUND AND slot_record.current_bookings < slot_record.max_capacity THEN
                UPDATE booking_slots
                SET current_bookings = current_bookings + 1
                WHERE booking_date = NEW.booking_date
                  AND booking_time::TIME = NEW.booking_time::TIME
                  AND service_type = NEW.service_type;
            END IF;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger BEFORE INSERT pour vérifier la disponibilité
DROP TRIGGER IF EXISTS trigger_check_booking_availability ON bookings;
CREATE TRIGGER trigger_check_booking_availability
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_booking_availability();

-- Les triggers AFTER existants seront automatiquement mis à jour avec la nouvelle fonction

-- IMPORTANT: Synchroniser les compteurs pour s'assurer qu'ils sont à jour
-- Exécuter cette fonction pour corriger les compteurs existants
SELECT sync_all_booking_counters();
