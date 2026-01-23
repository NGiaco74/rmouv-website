// Script de réservation pour R'MouV
// Gestion des créneaux et réservations côté client

// État global de l'application
let appState = {
    currentUser: null,
    isLoggedIn: false,
    selectedService: null,
    selectedSlot: null,
    selectedSlotService: null,
    selectedPatientId: null, // ID du patient pour qui réserver (null = pour soi-même, ou linked_patient_id)
    selectedPatientIsLinked: false, // true si c'est un patient lié
    linkedPatients: [], // Liste des patients liés de l'utilisateur
    currentSlots: [],
    currentWeek: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    supabase: null,
    showOnlyAvailable: true // Filtre par défaut activé
};

// Initialisation Supabase
async function initializeSupabase() {
    try {
        // Attendre que Supabase soit chargé
        await waitForSupabase();
        
        // Créer le client Supabase
        appState.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        
        console.log('Supabase initialisé');
        return true;
    } catch (error) {
        console.error('Erreur initialisation Supabase:', error);
        return false;
    }
}

// Attendre que Supabase soit disponible
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve();
            return;
        }
        
        const checkSupabase = () => {
            if (window.supabase) {
                resolve();
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        
        checkSupabase();
    });
}

// Générer les créneaux disponibles pour une semaine
async function generateWeekSlots(startDate) {
    if (!appState.supabase) {
        console.error('Supabase non initialisé');
        return [];
    }
    
    const slots = [];
    const currentDate = new Date(startDate);
    
    // Calculer la fin de la semaine
    const endDate = new Date(currentDate);
    endDate.setDate(currentDate.getDate() + 6);
    
    try {
        console.log('🔍 Récupération des créneaux pour la semaine:', startDate, 'à', endDate.toISOString().split('T')[0]);
        
        // Récupérer tous les créneaux de la semaine depuis la base de données
        const { data: dbSlots, error } = await appState.supabase
            .from('booking_slots')
            .select('*')
            .gte('booking_date', startDate.toISOString().split('T')[0])
            .lte('booking_date', endDate.toISOString().split('T')[0])
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur récupération créneaux:', error);
            return [];
        }
        
        console.log('📋 Créneaux récupérés:', dbSlots);
        
        // Charger les réservations réelles pour calculer le nombre exact de places occupées
        // Cela garantit que l'affichage est toujours à jour, même si current_bookings n'est pas synchronisé
        const { data: allBookings, error: bookingsError } = await appState.supabase
            .from('bookings')
            .select('booking_date, booking_time, service_type')
            .eq('status', 'confirmed')
            .gte('booking_date', startDate.toISOString().split('T')[0])
            .lte('booking_date', endDate.toISOString().split('T')[0]);
        
        if (bookingsError) {
            console.error('Erreur chargement réservations:', bookingsError);
        }
        
        // Compter les réservations réelles par créneau
        let bookingCounts = {};
        if (allBookings) {
            allBookings.forEach(booking => {
                const timeNormalized = booking.booking_time ? booking.booking_time.substring(0, 5) : booking.booking_time;
                const key = `${booking.booking_date}_${timeNormalized}_${booking.service_type}`;
                bookingCounts[key] = (bookingCounts[key] || 0) + 1;
            });
        }
        
        // Grouper les créneaux par date et heure
        const slotsByDateTime = {};
        if (dbSlots) {
            dbSlots.forEach(slot => {
                // Normaliser le format de booking_time (HH:MM:SS -> HH:MM)
                const timeNormalized = slot.booking_time ? slot.booking_time.substring(0, 5) : slot.booking_time;
                const key = `${slot.booking_date}_${timeNormalized}`;
                if (!slotsByDateTime[key]) {
                    slotsByDateTime[key] = {
                        date: slot.booking_date,
                        time: timeNormalized, // HH:MM
                        coaching_individuel: { max: 0, current: 0 },
                        coaching_groupe: { max: 0, current: 0 }
                    };
                }
                
                // Utiliser le nombre réel de réservations, ou current_bookings comme fallback
                const countKey = `${slot.booking_date}_${timeNormalized}_${slot.service_type}`;
                const realCount = bookingCounts[countKey] !== undefined ? bookingCounts[countKey] : (slot.current_bookings || 0);
                
                if (slot.service_type === 'coaching_individuel') {
                    slotsByDateTime[key].coaching_individuel.max = slot.max_capacity;
                    slotsByDateTime[key].coaching_individuel.current = realCount;
                } else if (slot.service_type === 'coaching_groupe') {
                    slotsByDateTime[key].coaching_groupe.max = slot.max_capacity;
                    slotsByDateTime[key].coaching_groupe.current = realCount;
                }
            });
        }
        
        // Créer les objets slots avec les informations de date
        Object.keys(slotsByDateTime).forEach(key => {
            const slotData = slotsByDateTime[key];
            const date = new Date(slotData.date);
            
            slots.push({
                id: key,
                date: slotData.date,
                time: slotData.time,
                dayName: getDayName(date.getDay()),
                dateFormatted: formatDate(date),
                coaching_individuel: slotData.coaching_individuel,
                coaching_groupe: slotData.coaching_groupe
            });
        });
        
        console.log('✅ Créneaux générés:', slots);
        
        // Stocker les créneaux dans l'état global
        appState.currentSlots = slots;
        
        return slots;
        
    } catch (error) {
        console.error('Erreur génération créneaux:', error);
        return [];
    }
}

// Mettre à jour le compteur de réservations dans booking_slots
async function updateSlotCounter(date, time, serviceType, increment) {
    try {
        console.log('🔄 Mise à jour compteur:', { date, time, serviceType, increment });
        
        // Récupérer le créneau actuel
        const { data: slot, error: fetchError } = await appState.supabase
            .from('booking_slots')
            .select('*')
            .eq('booking_date', date)
            .eq('booking_time', time)
            .eq('service_type', serviceType)
            .single();
        
        if (fetchError) {
            console.error('❌ Erreur récupération créneau:', fetchError);
            if (fetchError.code === 'PGRST301' || fetchError.message?.includes('permission denied')) {
                console.error('🚨 PROBLÈME DE PERMISSIONS RLS: Impossible de lire booking_slots pour mettre à jour le compteur');
            }
            return;
        }
        
        if (!slot) {
            console.error('❌ Créneau non trouvé:', { date, time, serviceType });
            return;
        }
        
        // Mettre à jour le compteur
        const newCount = (slot.current_bookings || 0) + increment;
        console.log(`🔄 Mise à jour compteur: ${slot.current_bookings} + ${increment} = ${newCount}`);
        
        const { error: updateError } = await appState.supabase
            .from('booking_slots')
            .update({ current_bookings: newCount })
            .eq('id', slot.id);
        
        if (updateError) {
            console.error('❌ Erreur mise à jour compteur:', updateError);
            if (updateError.code === 'PGRST301' || updateError.message?.includes('permission denied')) {
                console.error('🚨 PROBLÈME DE PERMISSIONS RLS: Impossible de mettre à jour booking_slots');
                console.error('🚨 Solution: Créer une politique RLS pour permettre la mise à jour de current_bookings aux utilisateurs authentifiés');
            }
        } else {
            console.log('✅ Compteur mis à jour avec succès:', newCount);
        }
        
    } catch (error) {
        console.error('Erreur updateSlotCounter:', error);
    }
}

// Obtenir le nom du jour
function getDayName(dayIndex) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayIndex];
}

// Formater la date
function formatDate(date) {
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long'
    });
}

// Synchroniser les compteurs current_bookings avec les réservations réelles
// Cette fonction compte les réservations dans bookings et met à jour booking_slots
async function syncBookingCounters() {
    if (!appState.supabase) return;
    
    try {
        console.log('🔄 Synchronisation des compteurs de réservations...');
        
        // Récupérer toutes les réservations confirmées
        const { data: bookings, error: bookingsError } = await appState.supabase
            .from('bookings')
            .select('service_type, booking_date, booking_time, status')
            .eq('status', 'confirmed');
        
        if (bookingsError) {
            console.error('❌ Erreur récupération réservations pour synchronisation:', bookingsError);
            return;
        }
        
        if (!bookings || bookings.length === 0) {
            console.log('📊 Aucune réservation à synchroniser');
            return;
        }
        
        // Compter les réservations par créneau
        const countsBySlot = {};
        bookings.forEach(booking => {
            const timeNormalized = booking.booking_time ? booking.booking_time.substring(0, 5) : booking.booking_time;
            const key = `${booking.booking_date}_${timeNormalized}_${booking.service_type}`;
            countsBySlot[key] = (countsBySlot[key] || 0) + 1;
        });
        
        console.log('📊 Compteurs calculés depuis bookings:', countsBySlot);
        
        // Récupérer tous les créneaux pour mettre à jour les compteurs
        const { data: slots, error: slotsError } = await appState.supabase
            .from('booking_slots')
            .select('id, booking_date, booking_time, service_type, current_bookings');
        
        if (slotsError) {
            console.error('❌ Erreur récupération créneaux pour synchronisation:', slotsError);
            return;
        }
        
        // Mettre à jour les compteurs
        let updatedCount = 0;
        for (const slot of slots) {
            const timeNormalized = slot.booking_time ? slot.booking_time.substring(0, 5) : slot.booking_time;
            const key = `${slot.booking_date}_${timeNormalized}_${slot.service_type}`;
            const realCount = countsBySlot[key] || 0;
            
            // Mettre à jour seulement si le compteur est différent
            if (slot.current_bookings !== realCount) {
                const { error: updateError } = await appState.supabase
                    .from('booking_slots')
                    .update({ current_bookings: realCount })
                    .eq('id', slot.id);
                
                if (updateError) {
                    console.error(`❌ Erreur mise à jour créneau ${slot.id}:`, updateError);
                } else {
                    console.log(`✅ Compteur mis à jour: ${slot.id} (${slot.current_bookings} → ${realCount})`);
                    updatedCount++;
                }
            }
        }
        
        console.log(`✅ Synchronisation terminée: ${updatedCount} créneaux mis à jour`);
        
    } catch (error) {
        console.error('❌ Erreur synchronisation compteurs:', error);
    }
}

// Charger les réservations de l'utilisateur actuel depuis Supabase
// Charger les patients liés de l'utilisateur connecté
async function loadLinkedPatients() {
    if (!appState.supabase || !appState.currentUser || !appState.isLoggedIn) {
        return [];
    }
    
    try {
        console.log('🔍 Chargement des patients liés de l\'utilisateur...');
        
        const { data: linkedPatients, error } = await appState.supabase
            .from('linked_patients')
            .select('id, first_name, last_name, email')
            .eq('linked_to_user_id', appState.currentUser.id)
            .eq('patient_status', 'active')
            .order('first_name', { ascending: true })
            .order('last_name', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement patients liés:', error);
            return [];
        }
        
        console.log('👥 Patients liés trouvés:', linkedPatients);
        appState.linkedPatients = linkedPatients || [];
        return appState.linkedPatients;
    } catch (error) {
        console.error('Erreur loadLinkedPatients:', error);
        return [];
    }
}

// Mettre à jour le sélecteur de patient dans l'interface
function updatePatientSelector() {
    const container = document.getElementById('patient-selector-container');
    const selector = document.getElementById('patient-selector');
    
    if (!container || !selector) return;
    
    // Si l'utilisateur a des patients liés, afficher le sélecteur
    if (appState.linkedPatients && Array.isArray(appState.linkedPatients) && appState.linkedPatients.length > 0) {
        container.classList.remove('hidden');
        
        // Vider le sélecteur (garder seulement "Moi-même")
        selector.innerHTML = '<option value="self">Moi-même</option>';
        
        // Ajouter les patients liés
        appState.linkedPatients.forEach(patient => {
            const option = document.createElement('option');
            const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email || 'Patient';
            option.value = patient.id;
            option.textContent = patientName;
            selector.appendChild(option);
        });
        
        // Ajouter l'écouteur d'événement
        selector.addEventListener('change', async function() {
            const selectedValue = this.value;
            if (selectedValue === 'self') {
                appState.selectedPatientId = null;
                appState.selectedPatientIsLinked = false;
            } else {
                appState.selectedPatientId = selectedValue;
                appState.selectedPatientIsLinked = true;
            }
            console.log('👤 Patient sélectionné pour réservation:', {
                patientId: appState.selectedPatientId,
                isLinked: appState.selectedPatientIsLinked
            });
            
            // Recharger les créneaux pour mettre à jour la disponibilité selon le patient sélectionné
            const currentView = getCurrentView();
            if (currentView === 'month') {
                console.log('🔄 Rechargement des créneaux avec le nouveau patient sélectionné...');
                await displayMonthCalendar();
            } else if (currentView === 'week') {
                await displayWeekSlots();
            } else if (currentView === 'list') {
                await displaySlotsList();
            }
        });
        
        // Réinitialiser la sélection
        appState.selectedPatientId = null;
        appState.selectedPatientIsLinked = false;
    } else {
        container.classList.add('hidden');
    }
}

// (pour savoir s'il a réservé un créneau, pas pour compter toutes les réservations)
// patientId: ID du patient pour qui vérifier les réservations (null = utilisateur connecté, ou linked_patient_id)
// isLinkedPatient: true si c'est un patient lié
async function loadExistingBookings(patientId = null, isLinkedPatient = false) {
    if (!appState.supabase) return { userBookings: {} };
    
    try {
        // Si l'utilisateur n'est pas connecté, retourner un objet vide
        if (!appState.currentUser || !appState.isLoggedIn) {
            return { userBookings: {} };
        }
        
        // Utiliser le patient sélectionné si fourni, sinon utiliser celui de l'état
        const selectedPatientId = patientId !== null ? patientId : appState.selectedPatientId;
        const selectedIsLinked = patientId !== null ? isLinkedPatient : appState.selectedPatientIsLinked;
        
        console.log('🔍 Chargement des réservations pour:', {
            patientId: selectedPatientId,
            isLinked: selectedIsLinked,
            forUser: selectedPatientId === null ? 'utilisateur connecté' : 'patient lié'
        });
        
        let bookings = [];
        
        if (selectedIsLinked && selectedPatientId) {
            // Récupérer les réservations du patient lié sélectionné
            const { data: linkedBookingsData, error: linkedError } = await appState.supabase
                .from('bookings')
                .select('service_type, booking_date, booking_time, user_id, linked_patient_id')
                .eq('status', 'confirmed')
                .eq('linked_patient_id', selectedPatientId);
            
            if (linkedError) {
                console.error('Erreur chargement réservations patient lié:', linkedError);
            } else if (linkedBookingsData) {
                bookings = linkedBookingsData;
            }
        } else {
            // Récupérer les réservations de l'utilisateur connecté
            const { data: userBookingsData, error: userError } = await appState.supabase
                .from('bookings')
                .select('service_type, booking_date, booking_time, user_id, linked_patient_id')
                .eq('status', 'confirmed')
                .eq('user_id', appState.currentUser.id);
            
            if (userError) {
                console.error('Erreur chargement réservations utilisateur:', userError);
            } else if (userBookingsData) {
                bookings = userBookingsData;
            }
        }
        
        console.log('📋 Réservations trouvées:', bookings.length);
        
        // Identifier les réservations du patient sélectionné
        const userBookings = {};
        
        if (bookings) {
            bookings.forEach(booking => {
                // Normaliser le format de booking_time (HH:MM:SS -> HH:MM)
                const timeNormalized = booking.booking_time ? booking.booking_time.substring(0, 5) : booking.booking_time;
                const key = `${booking.booking_date}_${timeNormalized}`;
                if (!userBookings[key]) {
                    userBookings[key] = { coaching_individuel: false, coaching_groupe: false };
                }
                userBookings[key][booking.service_type] = true;
            });
        }
        
        console.log('👤 Réservations pour le patient sélectionné:', userBookings);
        return { userBookings };
    } catch (error) {
        console.error('Erreur chargement réservations:', error);
        return { userBookings: {} };
    }
}

// Afficher les créneaux disponibles
async function displayAvailableSlots() {
    const slotsGrid = document.getElementById('slots-grid');
    if (!slotsGrid) return;
    
    console.log('🔄 Rechargement des créneaux...');
    
    // Générer les créneaux pour la semaine courante
    // (les compteurs viennent déjà de booking_slots.current_bookings via generateWeekSlots)
    const weekStart = getWeekStart(appState.currentWeek);
    const slots = await generateWeekSlots(weekStart);
    
    // Charger les réservations du patient sélectionné (pour savoir s'il a réservé)
    const bookingData = await loadExistingBookings(
        appState.selectedPatientId, 
        appState.selectedPatientIsLinked
    );
    const userBookings = bookingData.userBookings || {};
    console.log('👤 Réservations pour le patient sélectionné:', userBookings);
    
    // Mettre à jour uniquement les informations utilisateur (les compteurs sont déjà corrects depuis booking_slots)
    slots.forEach(slot => {
        const userReservations = userBookings[slot.id] || { coaching_individuel: false, coaching_groupe: false };
        
        slot.coaching_individuel.userReserved = userReservations.coaching_individuel;
        slot.coaching_groupe.userReserved = userReservations.coaching_groupe;
        
        console.log(`📅 Créneau ${slot.id}: Individuel ${slot.coaching_individuel.current}/${slot.coaching_individuel.max} (utilisateur: ${slot.coaching_individuel.userReserved}), Groupe ${slot.coaching_groupe.current}/${slot.coaching_groupe.max} (utilisateur: ${slot.coaching_groupe.userReserved})`);
    });
    
    // Afficher les créneaux
    slotsGrid.innerHTML = '';
    
    if (slots.length === 0) {
        slotsGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">Aucun créneau disponible cette semaine</div>';
        return;
    }
    
    slots.forEach(slot => {
        const slotCard = createSlotCard(slot);
        slotsGrid.appendChild(slotCard);
    });
    
    // Mettre à jour l'affichage de la semaine
    updateWeekDisplay();
}

// Créer une carte de créneau
function createSlotCard(slot) {
    const card = document.createElement('div');
    card.className = 'slot-card bg-white rounded-lg border border-gray-200 p-4 cursor-pointer';
    card.dataset.slotId = slot.id;
    
    // Nouvelle logique de disponibilité cohérente
    // Vérifier d'abord si le type de service existe pour ce créneau (max > 0)
    const hasIndividuelSlot = slot.coaching_individuel.max > 0;
    const hasGroupeSlot = slot.coaching_groupe.max > 0;
    
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    // Logique : Si un type de cours est réservé, l'autre type n'est plus disponible
    // MAIS on vérifie d'abord si le type de service existe pour ce créneau
    let isIndividuelAvailable = false;
    let isGroupeAvailable = false;
    
    if (hasIndividuelBooking) {
        // Si cours individuel réservé, créneau fermé pour les cours collectifs
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else if (hasGroupeBooking) {
        // Si cours collectif réservé, seul le groupe reste disponible (si le créneau groupe existe)
        isIndividuelAvailable = false;
        isGroupeAvailable = hasGroupeSlot && slot.coaching_groupe.current < slot.coaching_groupe.max;
    } else {
        // Aucune réservation, les types sont disponibles seulement s'ils existent pour ce créneau
        isIndividuelAvailable = hasIndividuelSlot && slot.coaching_individuel.current < slot.coaching_individuel.max;
        isGroupeAvailable = hasGroupeSlot && slot.coaching_groupe.current < slot.coaching_groupe.max;
    }
    
    const isAvailable = isIndividuelAvailable || isGroupeAvailable;
    
    // Vérifier si l'utilisateur a réservé ce créneau
    const userReservedIndividuel = slot.coaching_individuel.userReserved;
    const userReservedGroupe = slot.coaching_groupe.userReserved;
    
    if (!isAvailable) {
        card.classList.add('disabled');
    }
    
    // Style spécial si l'utilisateur a réservé
    if (userReservedIndividuel || userReservedGroupe) {
        card.classList.add('user-reserved');
    }
    
    card.innerHTML = `
        <div class="text-center">
            <div class="text-lg font-semibold text-gray-800 mb-2">${slot.dayName}</div>
            <div class="text-sm text-gray-600 mb-3">${slot.dateFormatted}</div>
            <div class="text-xl font-bold text-primary mb-3">${slot.time}</div>
            
            <div class="space-y-2">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Individuel:</span>
                    <span class="font-medium ${userReservedIndividuel ? 'text-blue-600' : (isIndividuelAvailable ? 'text-green-600' : 'text-red-600')}">
                        ${slot.coaching_individuel.current}/${slot.coaching_individuel.max}
                        ${userReservedIndividuel ? ' ✓' : ''}
                    </span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Groupe:</span>
                    <span class="font-medium ${userReservedGroupe ? 'text-blue-600' : (isGroupeAvailable ? 'text-green-600' : 'text-red-600')}">
                        ${slot.coaching_groupe.current}/${slot.coaching_groupe.max}
                        ${userReservedGroupe ? ' ✓' : ''}
                    </span>
                </div>
            </div>
            
            ${(userReservedIndividuel || userReservedGroupe) ? '<div class="mt-2 text-xs text-blue-600 font-medium">✓ Vous avez réservé</div>' : ''}
        </div>
    `;
    
    // Ajouter l'événement de clic
    card.addEventListener('click', () => {
        if (!isAvailable) return;
        
        // Désélectionner les autres cartes
        document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
        
        // Sélectionner cette carte
        card.classList.add('selected');
        appState.selectedSlot = slot;
        
        // Activer le bouton de réservation
        const bookButton = document.getElementById('book-slot');
        if (bookButton) {
            bookButton.disabled = false;
        }
    });
    
    return card;
}

// Obtenir le début de la semaine (lundi)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi
    return new Date(d.setDate(diff));
}

// Mettre à jour l'affichage de la semaine
function updateWeekDisplay() {
    const weekStart = getWeekStart(appState.currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekDisplay = document.getElementById('current-week');
    if (weekDisplay) {
        weekDisplay.textContent = `Semaine du ${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    }
}

// Gérer la sélection du type de service
function handleServiceSelection() {
    const serviceButtons = document.querySelectorAll('.service-btn');
    
    serviceButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Désélectionner les autres boutons
            serviceButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'bg-secondary', 'text-white');
                btn.classList.add('bg-white');
                
                // Remettre les bonnes couleurs de bordure et texte
                if (btn.id === 'service-individuel') {
                    btn.classList.add('border-primary', 'text-primary');
                } else if (btn.id === 'service-groupe') {
                    btn.classList.add('border-secondary', 'text-secondary');
                }
            });
            
            // Sélectionner ce bouton
            const serviceType = button.id.replace('service-', '');
            appState.selectedService = serviceType;
            
            if (serviceType === 'individuel') {
                button.classList.remove('bg-white', 'text-primary', 'border-primary');
                button.classList.add('bg-primary', 'text-white');
            } else {
                button.classList.remove('bg-white', 'text-secondary', 'border-secondary');
                button.classList.add('bg-secondary', 'text-white');
            }
            
            console.log('Service sélectionné:', serviceType);
            updateServiceInfo();
        });
    });
}

// Mettre à jour l'information du service sélectionné
function updateServiceInfo() {
    const serviceInfo = document.getElementById('selected-service-info');
    if (serviceInfo && appState.selectedService) {
        const serviceName = appState.selectedService === 'individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
        serviceInfo.textContent = `Service sélectionné : ${serviceName}`;
    }
}

// Gérer la navigation du calendrier
function handleCalendarNavigation() {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            appState.currentWeek.setDate(appState.currentWeek.getDate() - 7);
            displayAvailableSlots();
        });
    }
    
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            appState.currentWeek.setDate(appState.currentWeek.getDate() + 7);
            displayAvailableSlots();
        });
    }
}

// Mise à jour immédiate de l'affichage d'un créneau après réservation
function updateSlotDisplayImmediately(slot, serviceKey) {
    console.log('🔄 Mise à jour immédiate du créneau:', slot.id, serviceKey);
    
    // Trouver la carte du créneau
    const slotCard = document.querySelector(`[data-slot-id="${slot.id}"]`);
    if (!slotCard) {
        console.log('❌ Carte du créneau non trouvée');
        return;
    }
    
    // Mettre à jour les données locales
    slot[serviceKey].current += 1;
    slot[serviceKey].userReserved = true;
    
    console.log('📊 Nouvelles données:', {
        service: serviceKey,
        current: slot[serviceKey].current,
        max: slot[serviceKey].max,
        userReserved: slot[serviceKey].userReserved
    });
    
    // Reconstruire le contenu de la carte avec la nouvelle logique
    // Vérifier d'abord si le type de service existe pour ce créneau (max > 0)
    const hasIndividuelSlot = slot.coaching_individuel.max > 0;
    const hasGroupeSlot = slot.coaching_groupe.max > 0;
    
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    let isIndividuelAvailable = false;
    let isGroupeAvailable = false;
    
    if (hasIndividuelBooking) {
        // Si cours individuel réservé, créneau fermé pour tout le monde
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else if (hasGroupeBooking) {
        // Si cours groupe réservé, seul le groupe reste disponible (si le créneau groupe existe)
        isIndividuelAvailable = false;
        isGroupeAvailable = hasGroupeSlot && slot.coaching_groupe.current < slot.coaching_groupe.max;
    } else {
        // Aucune réservation, les types sont disponibles seulement s'ils existent pour ce créneau
        isIndividuelAvailable = hasIndividuelSlot && slot.coaching_individuel.current < slot.coaching_individuel.max;
        isGroupeAvailable = hasGroupeSlot && slot.coaching_groupe.current < slot.coaching_groupe.max;
    }
    
    const isAvailable = isIndividuelAvailable || isGroupeAvailable;
    
    // Vérifier si l'utilisateur a réservé ce créneau
    const userReservedIndividuel = slot.coaching_individuel.userReserved;
    const userReservedGroupe = slot.coaching_groupe.userReserved;
    
    // Mettre à jour les classes CSS
    slotCard.className = 'slot-card bg-white rounded-lg border border-gray-200 p-4 cursor-pointer';
    
    if (!isAvailable) {
        slotCard.classList.add('disabled');
    }
    
    // Style spécial si l'utilisateur a réservé
    if (userReservedIndividuel || userReservedGroupe) {
        slotCard.classList.add('user-reserved');
    }
    
    // Mettre à jour le contenu HTML
    slotCard.innerHTML = `
        <div class="text-center">
            <div class="text-lg font-semibold text-gray-800 mb-2">${slot.dayName}</div>
            <div class="text-sm text-gray-600 mb-3">${slot.dateFormatted}</div>
            <div class="text-xl font-bold text-primary mb-3">${slot.time}</div>
            
            <div class="space-y-2">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Individuel:</span>
                    <span class="font-medium ${userReservedIndividuel ? 'text-blue-600' : (isIndividuelAvailable ? 'text-green-600' : 'text-red-600')}">
                        ${slot.coaching_individuel.current}/${slot.coaching_individuel.max}
                        ${userReservedIndividuel ? ' ✓' : ''}
                    </span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Groupe:</span>
                    <span class="font-medium ${userReservedGroupe ? 'text-blue-600' : (isGroupeAvailable ? 'text-green-600' : 'text-red-600')}">
                        ${slot.coaching_groupe.current}/${slot.coaching_groupe.max}
                        ${userReservedGroupe ? ' ✓' : ''}
                    </span>
                </div>
            </div>
            
            ${(userReservedIndividuel || userReservedGroupe) ? '<div class="mt-2 text-xs text-blue-600 font-medium">✓ Vous avez réservé</div>' : ''}
        </div>
    `;
    
    console.log('✅ Affichage mis à jour immédiatement');
}

// Sélectionner un créneau
function selectSlot(slotId) {
    console.log('🎯 Sélection du créneau:', slotId);
    
    // Trouver le créneau dans les données
    const slot = appState.currentSlots?.find(s => s.id === slotId);
    if (!slot) {
        console.error('❌ Créneau non trouvé:', slotId);
        return;
    }
    
    // Vérifier la disponibilité selon le service sélectionné
    if (!appState.selectedService) {
        alert('Veuillez d\'abord sélectionner un type de service (Individuel ou Groupe).');
        return;
    }
    
    const serviceKey = appState.selectedService === 'individuel' ? 'coaching_individuel' : 'coaching_groupe';
    const slotService = slot[serviceKey];
    
    if (!slotService) {
        console.error('❌ Service non disponible pour ce créneau:', serviceKey);
        return;
    }
    
    if (slotService.current >= slotService.max) {
        alert('Ce créneau n\'est plus disponible pour le service sélectionné.');
        return;
    }
    
    if (slotService.userReserved) {
        alert('Vous avez déjà réservé ce créneau.');
        return;
    }
    
    // Stocker le créneau sélectionné
    appState.selectedSlot = slot;
    appState.selectedSlotService = serviceKey;
    
    console.log('✅ Créneau sélectionné:', slot);
    console.log('✅ Service:', serviceKey);
    
    // Afficher un message de confirmation
    const serviceName = appState.selectedService === 'individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
    const confirmMessage = `Confirmer la réservation pour le ${serviceName} le ${slot.dateFormatted} à ${slot.time} ?`;
    
    if (confirm(confirmMessage)) {
        makeReservation();
    }
}

// Effectuer une réservation
async function makeReservation() {
    if (!appState.isLoggedIn) {
        alert('Vous devez être connecté pour effectuer une réservation.');
        window.location.href = 'connexion.html';
        return;
    }
    
    if (!appState.selectedService || !appState.selectedSlot) {
        alert('Veuillez sélectionner un service et un créneau.');
        return;
    }
    
    // Vérifier la disponibilité selon la nouvelle logique
    const serviceKey = `coaching_${appState.selectedService}`;
    const slot = appState.selectedSlot;
    
    // Vérifier si l'utilisateur a déjà réservé ce créneau
    if (slot[serviceKey].userReserved) {
        alert('Vous avez déjà réservé ce créneau.');
        return;
    }
    
    // Vérifier d'abord si le type de service existe pour ce créneau
    if (serviceKey === 'coaching_individuel' && slot.coaching_individuel.max === 0) {
        alert('Ce créneau n\'est pas disponible pour les cours individuels.');
        return;
    }
    if (serviceKey === 'coaching_groupe' && slot.coaching_groupe.max === 0) {
        alert('Ce créneau n\'est pas disponible pour les cours collectifs.');
        return;
    }
    
    // Appliquer la logique de disponibilité cohérente
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    // Logique : Si un type de cours est réservé, l'autre type n'est plus disponible
    if (hasIndividuelBooking && serviceKey === 'coaching_groupe') {
        // Si cours individuel réservé, créneau fermé pour les cours collectifs
        alert('Ce créneau n\'est plus disponible pour les cours collectifs (cours individuel réservé).');
        return;
    } else if (hasGroupeBooking && serviceKey === 'coaching_individuel') {
        // Si cours collectif réservé, créneau fermé pour les cours individuels
        alert('Ce créneau n\'est plus disponible pour les cours individuels (cours collectif réservé).');
        return;
    } else if (serviceKey === 'coaching_groupe' && slot[serviceKey].current >= slot[serviceKey].max) {
        // Vérifier la capacité pour les cours collectifs
        alert('Ce créneau n\'est plus disponible pour les cours collectifs (capacité atteinte).');
        return;
    } else if (serviceKey === 'coaching_individuel' && slot[serviceKey].current >= slot[serviceKey].max) {
        // Vérifier la capacité pour les cours individuels
        alert('Ce créneau n\'est plus disponible pour les cours individuels (capacité atteinte).');
        return;
    }
    
    try {
        // Préparer les données de réservation
        const bookingData = {
            service_type: serviceKey,
            booking_date: slot.date,
            booking_time: slot.time,
            duration: 60,
            status: 'confirmed'
        };
        
        // Si un patient lié est sélectionné, utiliser linked_patient_id
        if (appState.selectedPatientId && appState.selectedPatientIsLinked) {
            bookingData.linked_patient_id = appState.selectedPatientId;
            // S'assurer que user_id est explicitement null
            bookingData.user_id = null;
        } else {
            // Sinon, réserver pour l'utilisateur connecté
            bookingData.user_id = appState.currentUser.id;
            // S'assurer que linked_patient_id est explicitement null
            bookingData.linked_patient_id = null;
        }
        
        console.log('📝 Données de réservation à insérer:', bookingData);
        
        // Créer la réservation
        const { data, error } = await appState.supabase
            .from('bookings')
            .insert([bookingData])
            .select();
        
        if (error) {
            console.error('Erreur réservation:', error);
            alert('Erreur lors de la réservation. Veuillez réessayer.');
            return;
        }
        
        console.log('✅ Réservation créée:', data);
        
        // Note: Le compteur dans booking_slots est mis à jour automatiquement par le trigger
        // Pas besoin d'appeler updateSlotCounter manuellement
        
        // Succès
        alert('Réservation confirmée !');
        
        // Mise à jour immédiate de l'affichage local
        updateSlotDisplayImmediately(slot, serviceKey);
        
        // Réinitialiser la sélection
        appState.selectedSlot = null;
        appState.selectedService = null;
        document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
        const bookButton = document.getElementById('book-slot');
        if (bookButton) {
            bookButton.disabled = true;
        }
        
        // Rafraîchir toutes les vues automatiquement
        const currentView = getCurrentView();
        setTimeout(async () => {
            console.log('🔄 Rafraîchissement automatique après réservation...');
            try {
                // Rafraîchir la vue actuelle
                if (currentView === 'month') {
                    await displayMonthCalendar();
                } else if (currentView === 'week') {
                    await displayWeekSlots();
                } else if (currentView === 'list') {
                    await displaySlotsList();
                } else if (currentView === 'my-bookings') {
                    await displayMyBookings();
                }
                
                // Toujours rafraîchir "Mes réservations" si on est sur une autre vue
                if (currentView !== 'my-bookings') {
                    // Ne pas attendre, juste mettre à jour en arrière-plan
                    displayMyBookings().catch(err => console.error('Erreur rafraîchissement mes réservations:', err));
                }
            } catch (error) {
                console.error('Erreur lors du rafraîchissement:', error);
            }
        }, 500);
        
    } catch (error) {
        console.error('Erreur réservation:', error);
        alert('Erreur lors de la réservation. Veuillez réessayer.');
    }
}

// Initialisation de la page
async function initializeReservationPage() {
    console.log('🚀 Début initializeReservationPage');
    
    // Initialiser Supabase
    const supabaseReady = await initializeSupabase();
    if (!supabaseReady) {
        console.error('❌ Impossible d\'initialiser Supabase');
        return;
    }
    
    console.log('✅ Supabase initialisé');
    
    // Initialiser l'authentification
    await initializeAuth();
    
    console.log('✅ Authentification initialisée');
    
    // Charger les patients liés si l'utilisateur est connecté
    if (appState.isLoggedIn && appState.currentUser) {
        await loadLinkedPatients();
        updatePatientSelector();
    }
    
    // Configurer les événements
    handleCalendarNavigation();
    
    // Bouton de réservation
    const bookButton = document.getElementById('book-slot');
    if (bookButton) {
        bookButton.addEventListener('click', makeReservation);
    }
    
    // Initialiser les variables du calendrier
    const today = new Date();
    appState.currentMonth = today.getMonth();
    appState.currentYear = today.getFullYear();
    appState.showOnlyAvailable = true; // Filtre par défaut activé
    
    // Vérifier si on doit ouvrir directement "Mes réservations" (via hash ou paramètre)
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const hash = window.location.hash;
    
    let defaultView = 'month';
    if (hash === '#my-bookings' || viewParam === 'my-bookings') {
        defaultView = 'my-bookings';
    }
    
    // Afficher la vue appropriée
    if (defaultView === 'my-bookings') {
        console.log('📅 Ouverture directe de la vue "Mes réservations"...');
        switchReservationView('my-bookings');
    } else {
        console.log('📅 Affichage de la vue calendrier mensuel par défaut...');
        try {
            await displayMonthCalendar();
            console.log('✅ Vue calendrier mensuel affichée avec succès');
        } catch (error) {
            console.error('❌ Erreur dans displayMonthCalendar:', error);
        }
    }
    
    console.log('✅ Page de réservation initialisée');
}

// Fonction pour obtenir la vue actuelle
function getCurrentView() {
    const monthView = document.getElementById('month-view');
    const weekView = document.getElementById('week-view');
    const listView = document.getElementById('list-view');
    const myBookingsView = document.getElementById('my-bookings-view');
    
    if (monthView && !monthView.classList.contains('hidden')) return 'month';
    if (weekView && !weekView.classList.contains('hidden')) return 'week';
    if (listView && !listView.classList.contains('hidden')) return 'list';
    if (myBookingsView && !myBookingsView.classList.contains('hidden')) return 'my-bookings';
    return 'month'; // Par défaut
}

// Fonction pour changer de vue dans la réservation
function switchReservationView(viewType) {
    console.log('🔄 Changement de vue réservation vers:', viewType);
    console.log('🔄 Éléments trouvés:', {
        weekView: !!document.getElementById('week-view'),
        listView: !!document.getElementById('list-view'),
        myBookingsView: !!document.getElementById('my-bookings-view')
    });
    
    // Masquer toutes les vues
    document.querySelectorAll('.reservation-view').forEach(view => {
        console.log('🔄 Masquage de la vue:', view.id);
        view.classList.add('hidden');
    });
    
    console.log('🔄 Nombre de vues trouvées:', document.querySelectorAll('.reservation-view').length);
    
    // Désactiver tous les boutons - retirer toutes les classes de style d'abord
    document.querySelectorAll('.reservation-view-toggle').forEach(btn => {
        btn.classList.remove('active');
        // Retirer toutes les classes de style possibles
        btn.classList.remove('bg-white', 'text-gray-600', 'border-gray-300', 'bg-primary', 'text-white', 'border-primary');
        // Réappliquer les classes par défaut (non actif)
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-300');
    });
    
    // Activer le bouton sélectionné
    const activeButton = document.getElementById(`view-${viewType}`);
    if (activeButton) {
        // Retirer toutes les classes de style
        activeButton.classList.remove('bg-white', 'text-gray-600', 'border-gray-300', 'bg-primary', 'text-white', 'border-primary');
        // Ajouter les classes actives
        activeButton.classList.add('active', 'bg-primary', 'text-white', 'border-primary');
    }
    
    // Gérer l'affichage du filtre
    const filterSection = document.getElementById('filter-section');
    if (filterSection) {
        if (viewType === 'month') {
            filterSection.classList.remove('hidden');
        } else {
            filterSection.classList.add('hidden');
        }
    }
    
    // Afficher la vue sélectionnée
    switch(viewType) {
        case 'month':
            document.getElementById('month-view').classList.remove('hidden');
            displayMonthCalendar();
            break;
        case 'week':
            document.getElementById('week-view').classList.remove('hidden');
            displayWeekSlots();
            break;
        case 'list':
            document.getElementById('list-view').classList.remove('hidden');
            displaySlotsList();
            break;
        case 'my-bookings':
            document.getElementById('my-bookings-view').classList.remove('hidden');
            displayMyBookings();
            break;
    }
}

// Générer les créneaux pour un mois
async function generateMonthSlots(startDate, endDate) {
    console.log('📅 Début generateMonthSlots:', startDate, endDate);
    if (!appState.supabase) {
        console.error('❌ Supabase non initialisé');
        return [];
    }
    
    try {
        const { data: dbSlots, error } = await appState.supabase
            .from('booking_slots')
            .select('*')
            .gte('booking_date', startDate.toISOString().split('T')[0])
            .lte('booking_date', endDate.toISOString().split('T')[0])
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('❌ Erreur chargement créneaux mensuels:', error);
            console.error('❌ Détails de l\'erreur:', JSON.stringify(error, null, 2));
            
            // Vérifier si c'est une erreur de permissions RLS
            if (error.code === 'PGRST301' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
                console.error('🚨 PROBLÈME DE PERMISSIONS RLS DÉTECTÉ');
                console.error('🚨 Les utilisateurs non-admin ne peuvent pas lire la table booking_slots');
                console.error('🚨 Solution: Créer une politique RLS dans Supabase pour permettre la lecture de booking_slots aux utilisateurs authentifiés');
                alert('Erreur de permissions: Les utilisateurs non-admin ne peuvent pas accéder aux créneaux. Vérifiez les politiques RLS dans Supabase.');
            } else {
                alert('Erreur lors du chargement des créneaux. Vérifiez la console pour plus de détails.');
            }
            return [];
        }
        
        console.log('📅 Créneaux mensuels récupérés:', dbSlots);
        console.log('📊 Nombre de créneaux:', dbSlots?.length || 0);
        if (dbSlots && dbSlots.length > 0) {
            console.log('📊 Exemple de créneau:', {
                id: dbSlots[0].id,
                date: dbSlots[0].booking_date,
                time: dbSlots[0].booking_time,
                service_type: dbSlots[0].service_type,
                max_capacity: dbSlots[0].max_capacity,
                current_bookings: dbSlots[0].current_bookings
            });
        }
        
        // Charger les réservations du patient sélectionné (pour savoir s'il a réservé)
        // Utiliser le patient sélectionné dans appState
        const bookingData = await loadExistingBookings(
            appState.selectedPatientId, 
            appState.selectedPatientIsLinked
        );
        const userBookings = bookingData.userBookings || {};
        
        // Charger les réservations réelles pour calculer le nombre exact de places occupées
        // Cela garantit que l'affichage est toujours à jour, même si current_bookings n'est pas synchronisé
        const { data: allBookings, error: bookingsError } = await appState.supabase
            .from('bookings')
            .select('booking_date, booking_time, service_type')
            .eq('status', 'confirmed')
            .gte('booking_date', startDate.toISOString().split('T')[0])
            .lte('booking_date', endDate.toISOString().split('T')[0]);
        
        if (bookingsError) {
            console.error('Erreur chargement réservations:', bookingsError);
        }
        
        // Compter les réservations réelles par créneau
        let bookingCounts = {};
        if (allBookings) {
            allBookings.forEach(booking => {
                const timeNormalized = booking.booking_time ? booking.booking_time.substring(0, 5) : booking.booking_time;
                const key = `${booking.booking_date}_${timeNormalized}_${booking.service_type}`;
                bookingCounts[key] = (bookingCounts[key] || 0) + 1;
            });
        }
        
        // Utiliser les compteurs réels calculés depuis les réservations
        // Si pas de réservation trouvée pour un créneau, utiliser current_bookings comme fallback
        dbSlots.forEach(dbSlot => {
            const timeNormalized = dbSlot.booking_time ? dbSlot.booking_time.substring(0, 5) : dbSlot.booking_time;
            const key = `${dbSlot.booking_date}_${timeNormalized}_${dbSlot.service_type}`;
            // Utiliser le nombre réel de réservations, ou current_bookings comme fallback
            if (bookingCounts[key] === undefined) {
                bookingCounts[key] = dbSlot.current_bookings ?? 0;
            }
        });
        
        // Filtrer les créneaux passés avant de les formater
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().substring(0, 5); // Format HH:MM
        
        // Formater les créneaux en regroupant par date/heure
        const slotsByDateTime = {};
        dbSlots.forEach(dbSlot => {
            // Filtrer les créneaux passés
            const slotDateStr = dbSlot.booking_date;
            const slotTime = dbSlot.booking_time ? dbSlot.booking_time.substring(0, 5) : dbSlot.booking_time;
            
            // Si la date est passée, ignorer
            if (slotDateStr < todayStr) {
                return;
            }
            
            // Si c'est aujourd'hui et que l'heure est passée, ignorer
            if (slotDateStr === todayStr && slotTime < currentTime) {
                return;
            }
            
            const slotDate = new Date(dbSlot.booking_date);
            // Normaliser le format de booking_time (HH:MM:SS -> HH:MM)
            const timeNormalized = slotTime;
            const slotId = `${dbSlot.booking_date}_${timeNormalized}`;
            const userReservations = userBookings[slotId] || { coaching_individuel: false, coaching_groupe: false };
            
            // Si c'est le premier créneau pour cette date/heure, créer l'objet
            if (!slotsByDateTime[slotId]) {
                slotsByDateTime[slotId] = {
                    id: slotId,
                    date: dbSlot.booking_date,
                    time: dbSlot.booking_time,
                    dayName: slotDate.toLocaleDateString('fr-FR', { weekday: 'long' }),
                    dateFormatted: slotDate.toLocaleDateString('fr-FR'),
                    coaching_individuel: {
                        max: 0,  // Initialiser à 0, sera mis à jour seulement si le type existe
                        current: 0,
                        userReserved: false
                    },
                    coaching_groupe: {
                        max: 0,  // Initialiser à 0, sera mis à jour seulement si le type existe
                        current: 0,
                        userReserved: false
                    }
                };
            }
            
            // Mettre à jour les données selon le type de service
            // Utiliser les compteurs calculés en temps réel depuis bookings
            const countKey = `${dbSlot.booking_date}_${timeNormalized}_${dbSlot.service_type}`;
            const realCount = bookingCounts[countKey] ?? 0;
            
            if (dbSlot.service_type === 'coaching_individuel') {
                slotsByDateTime[slotId].coaching_individuel = {
                    max: dbSlot.max_capacity,
                    current: realCount,
                    userReserved: userReservations.coaching_individuel
                };
            } else if (dbSlot.service_type === 'coaching_groupe') {
                slotsByDateTime[slotId].coaching_groupe = {
                    max: dbSlot.max_capacity,
                    current: realCount,
                    userReserved: userReservations.coaching_groupe
                };
            }
        });
        
        // Convertir en tableau
        const formattedSlots = Object.values(slotsByDateTime);
        
        console.log('📊 Créneaux formatés générés:', formattedSlots.length);
        if (formattedSlots.length > 0) {
            console.log('📊 Exemple de créneau formaté:', {
                id: formattedSlots[0].id,
                date: formattedSlots[0].date,
                time: formattedSlots[0].time,
                individuel: formattedSlots[0].coaching_individuel,
                groupe: formattedSlots[0].coaching_groupe
            });
        }
        
        // Stocker les créneaux dans l'état global
        appState.currentSlots = formattedSlots;
        
        return formattedSlots;
    } catch (error) {
        console.error('Erreur generateMonthSlots:', error);
        return [];
    }
}

// Créer le HTML d'une carte de créneau
function createSlotCardHTML(slot) {
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    let isIndividuelAvailable = false;
    let isGroupeAvailable = false;
    
    if (hasIndividuelBooking) {
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else if (hasGroupeBooking) {
        isIndividuelAvailable = false;
        isGroupeAvailable = slot.coaching_groupe.current < slot.coaching_groupe.max;
    } else {
        isIndividuelAvailable = slot.coaching_individuel.current < slot.coaching_individuel.max;
        isGroupeAvailable = slot.coaching_groupe.current < slot.coaching_groupe.max;
    }
    
    const isAvailable = isIndividuelAvailable || isGroupeAvailable;
    const userReservedIndividuel = slot.coaching_individuel.userReserved;
    const userReservedGroupe = slot.coaching_groupe.userReserved;
    
    return `
        <div class="slot-list-item ${!isAvailable ? 'disabled' : ''} ${(userReservedIndividuel || userReservedGroupe) ? 'user-reserved' : ''}" 
             data-slot-id="${slot.id}" onclick="selectSlot('${slot.id}')">
            <div class="flex justify-between items-center">
                <div>
                    <div class="font-semibold text-gray-800">${slot.time}</div>
                    <div class="text-sm text-gray-600">${slot.dayName}</div>
                </div>
                <div class="text-right">
                    <div class="text-sm">
                        <span class="text-gray-600">Individuel:</span>
                        <span class="font-medium ${userReservedIndividuel ? 'text-blue-600' : (isIndividuelAvailable ? 'text-green-600' : 'text-red-600')}">
                            ${slot.coaching_individuel.current}/${slot.coaching_individuel.max}
                            ${userReservedIndividuel ? ' ✓' : ''}
                        </span>
                    </div>
                    <div class="text-sm">
                        <span class="text-gray-600">Groupe:</span>
                        <span class="font-medium ${userReservedGroupe ? 'text-blue-600' : (isGroupeAvailable ? 'text-green-600' : 'text-red-600')}">
                            ${slot.coaching_groupe.current}/${slot.coaching_groupe.max}
                            ${userReservedGroupe ? ' ✓' : ''}
                        </span>
                    </div>
                </div>
            </div>
            ${(userReservedIndividuel || userReservedGroupe) ? '<div class="mt-2 text-xs text-blue-600 font-medium">✓ Vous avez réservé</div>' : ''}
        </div>
    `;
}

// Afficher les créneaux de la semaine (vue existante)
async function displayWeekSlots() {
    console.log('📅 Affichage de la vue semaine');
    await displayAvailableSlots();
}

// Afficher la liste des créneaux style Doctolib
async function displaySlotsList() {
    const slotsList = document.getElementById('slots-list');
    if (!slotsList) return;
    
    console.log('📋 Affichage de la liste des créneaux style Doctolib');
    
    // Récupérer tous les créneaux disponibles
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const slots = await generateMonthSlots(today, nextMonth);
    
    if (slots.length === 0) {
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun créneau disponible</div>';
        return;
    }
    
    // Filtrer seulement les créneaux disponibles selon la nouvelle logique
    const availableSlots = [];
    slots.forEach(slot => {
        // Vérifier quels types de service existent pour ce créneau (max > 0)
        const hasIndividuelSlot = slot.coaching_individuel.max > 0;
        const hasGroupeSlot = slot.coaching_groupe.max > 0;
        
        const hasIndividuelBooking = slot.coaching_individuel.current > 0;
        const hasGroupeBooking = slot.coaching_groupe.current > 0;
        
        // Vérifier la disponibilité : un créneau est disponible si au moins un type a des places disponibles
        // Pour les créneaux individuels : disponible seulement si pas encore réservé
        // Pour les créneaux de groupe : disponible tant qu'il reste des places (current < max)
        const isIndividuelAvailable = hasIndividuelSlot && !hasIndividuelBooking && !hasGroupeBooking;
        const isGroupeAvailable = hasGroupeSlot && !hasIndividuelBooking && slot.coaching_groupe.current < slot.coaching_groupe.max;
        
        const isAvailable = isIndividuelAvailable || isGroupeAvailable;
        
        if (isAvailable) {
            availableSlots.push({
                ...slot,
                hasIndividuelAvailable: isIndividuelAvailable,
                hasGroupeAvailable: isGroupeAvailable
            });
        }
    });
    
    if (availableSlots.length === 0) {
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun créneau disponible</div>';
        return;
    }
    
    // Grouper par date et heure pour éviter les doublons
    const slotsByDateTime = {};
    availableSlots.forEach(slot => {
        const key = `${slot.date}_${slot.time}`;
        if (!slotsByDateTime[key]) {
            slotsByDateTime[key] = {
                ...slot,
                hasIndividuelAvailable: false,
                hasGroupeAvailable: false
            };
        }
        
        // Mettre à jour les disponibilités
        if (slot.hasIndividuelAvailable) {
            slotsByDateTime[key].hasIndividuelAvailable = true;
        }
        if (slot.hasGroupeAvailable) {
            slotsByDateTime[key].hasGroupeAvailable = true;
        }
    });
    
    // Convertir en objet groupé par date
    const slotsByDate = {};
    Object.values(slotsByDateTime).forEach(slot => {
        if (!slotsByDate[slot.date]) {
            slotsByDate[slot.date] = [];
        }
        slotsByDate[slot.date].push(slot);
    });
    
    // Générer le HTML style Doctolib
    let html = '';
    Object.keys(slotsByDate).sort().forEach(date => {
        const daySlots = slotsByDate[date];
        const dateObj = new Date(date);
        
        html += `
            <div class="mb-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-800">
                        ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h4>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${daySlots.map(slot => createDoctolibSlotCard(slot)).join('')}
                    </div>
                </div>
            </div>
        `;
    });
    
    slotsList.innerHTML = html;
}

// Créer une carte de créneau style Doctolib
function createDoctolibSlotCard(slot) {
    // Vérifier quels types de service existent pour ce créneau (max > 0)
    const hasIndividuelSlot = slot.coaching_individuel.max > 0;
    const hasGroupeSlot = slot.coaching_groupe.max > 0;
    
    // Vérifier la disponibilité : le type doit exister ET avoir des places disponibles
    const hasIndividuelAvailable = hasIndividuelSlot && slot.coaching_individuel.current < slot.coaching_individuel.max;
    const hasGroupeAvailable = hasGroupeSlot && slot.coaching_groupe.current < slot.coaching_groupe.max;
    
    return `
        <div class="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors">
            <div class="text-center">
                <div class="text-lg font-semibold text-gray-800 mb-2">${slot.time}</div>
                <div class="text-sm text-gray-600 mb-3">${slot.dayName}</div>
                
                <div class="space-y-2">
                    ${hasIndividuelAvailable ? `
                        <button onclick="selectServiceForSlot('${slot.id}', 'individuel')" 
                                class="w-full bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                            <span class="slot-type-indicator individuel mr-2"></span>
                            Coaching Individuel
                        </button>
                    ` : ''}
                    ${hasGroupeAvailable ? `
                        <button onclick="selectServiceForSlot('${slot.id}', 'groupe')" 
                                class="w-full bg-secondary hover:bg-secondary/90 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                            <span class="slot-type-indicator groupe mr-2"></span>
                            Coaching Groupe
                        </button>
                    ` : ''}
                </div>
                
                <div class="mt-3 text-xs text-gray-500">
                    ${slot.coaching_individuel.max > 0 ? `
                        <div class="flex items-center justify-center mb-1">
                            <span class="slot-type-indicator individuel mr-2"></span>
                            Individuel: ${slot.coaching_individuel.current}/${slot.coaching_individuel.max}
                        </div>
                    ` : ''}
                    ${slot.coaching_groupe.max > 0 ? `
                        <div class="flex items-center justify-center">
                            <span class="slot-type-indicator groupe mr-2"></span>
                            Groupe: ${slot.coaching_groupe.current}/${slot.coaching_groupe.max}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Formater l'heure pour l'affichage
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours}h${minutes}`;
}

// Afficher mes réservations
async function displayMyBookings() {
    const bookingsList = document.getElementById('my-bookings-list');
    if (!bookingsList) return;
    
    console.log('📋 Affichage de mes réservations');
    
    if (!appState.isLoggedIn) {
        bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Veuillez vous connecter pour voir vos réservations</div>';
        return;
    }
    
    try {
        // Récupérer les réservations de l'utilisateur ET de ses patients liés
        const linkedPatientIds = (appState.linkedPatients && Array.isArray(appState.linkedPatients)) 
            ? appState.linkedPatients.map(p => p && p.id ? p.id : null).filter(id => id !== null) 
            : [];
        
        let bookings = [];
        
        // Récupérer les réservations de l'utilisateur
        const { data: userBookings, error: userError } = await appState.supabase
            .from('bookings')
            .select('*')
            .eq('status', 'confirmed')
            .eq('user_id', appState.currentUser.id)
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (userError) {
            console.error('Erreur chargement réservations utilisateur:', userError);
        } else if (userBookings) {
            bookings = [...bookings, ...userBookings];
        }
        
        // Récupérer les réservations des patients liés
        if (linkedPatientIds.length > 0) {
            const { data: linkedBookings, error: linkedError } = await appState.supabase
                .from('bookings')
                .select('*')
                .eq('status', 'confirmed')
                .in('linked_patient_id', linkedPatientIds)
                .order('booking_date', { ascending: true })
                .order('booking_time', { ascending: true });
            
            if (linkedError) {
                console.error('Erreur chargement réservations patients liés:', linkedError);
            } else if (linkedBookings) {
                bookings = [...bookings, ...linkedBookings];
            }
        }
        
        // Trier toutes les réservations par date et heure
        bookings.sort((a, b) => {
            const dateCompare = a.booking_date.localeCompare(b.booking_date);
            if (dateCompare !== 0) return dateCompare;
            return a.booking_time.localeCompare(b.booking_time);
        });
        
        const error = userError || (linkedPatientIds.length > 0 ? null : null);
        
        if (error) {
            console.error('Erreur chargement réservations:', error);
            bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des réservations</div>';
            return;
        }
        
        if (!bookings || bookings.length === 0) {
            bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucune réservation trouvée</div>';
            return;
        }
        
        // Créer un map pour trouver rapidement les noms des patients liés
        const linkedPatientsMap = {};
        if (appState.linkedPatients && Array.isArray(appState.linkedPatients)) {
            appState.linkedPatients.forEach(p => {
                if (p && p.id) {
                    linkedPatientsMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Patient lié';
                }
            });
        }
        
        let html = '';
        bookings.forEach(booking => {
            const date = new Date(booking.booking_date);
            const time = booking.booking_time;
            const serviceType = booking.service_type === 'coaching_individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
            const dateStr = booking.booking_date;
            const isPast = date < new Date();
            const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const formattedTime = formatTime(time);
            const reservationDate = booking.created_at ? new Date(booking.created_at).toLocaleDateString('fr-FR') : '';
            const duration = booking.duration || 60;
            
            // Déterminer pour qui est la réservation
            const isForLinkedPatient = booking.linked_patient_id !== null;
            const patientName = isForLinkedPatient ? linkedPatientsMap[booking.linked_patient_id] : null;
            
            html += `
                <div class="bg-white rounded-lg border border-gray-200 p-6 mb-4">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">${serviceType}</h3>
                                ${isForLinkedPatient ? `<span class="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">Pour ${patientName}</span>` : ''}
                            </div>
                            
                            <div class="space-y-2 text-sm text-gray-600">
                                <div class="flex items-center">
                                    <i class="fas fa-calendar-day mr-2 text-primary"></i>
                                    <span>${formattedDate}</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-clock mr-2 text-primary"></i>
                                    <span>${formattedTime}</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-stopwatch mr-2 text-primary"></i>
                                    <span>${duration} minutes</span>
                                </div>
                                ${reservationDate ? `
                                <div class="flex items-center">
                                    <i class="fas fa-calendar-plus mr-2 text-primary"></i>
                                    <span>Réservé le ${reservationDate}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="mt-4 md:mt-0 md:ml-4">
                            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                Confirmé
                            </span>
                        </div>
                    </div>
                    <div class="flex gap-2 ${isPast ? 'opacity-50' : ''}">
                        ${!isPast ? `
                            <button onclick="cancelBooking('${booking.id}', '${dateStr}', '${time}', '${booking.service_type}')" 
                                    class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <i class="fas fa-times mr-2"></i>Annuler
                            </button>
                            <button onclick="modifyBooking('${booking.id}', '${dateStr}', '${time}', '${booking.service_type}')" 
                                    class="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <i class="fas fa-edit mr-2"></i>Modifier
                            </button>
                        ` : `
                            <div class="text-sm text-gray-500 italic">Cette réservation est passée</div>
                        `}
                    </div>
                </div>
            `;
        });
        
        bookingsList.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayMyBookings:', error);
        bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des réservations</div>';
    }
}

// Initialiser l'authentification (utilise les fonctions de script.js)
async function initializeAuth() {
    if (!appState.supabase) return;
    
    try {
        // Obtenir la session actuelle
        const { data: { session }, error } = await appState.supabase.auth.getSession();
        
        if (error) {
            console.error('Erreur session:', error);
            return;
        }
        
        if (session) {
            appState.currentUser = session.user;
            appState.isLoggedIn = true;
            updateUI(true, session.user);
        } else {
            appState.isLoggedIn = false;
            updateUI(false, null);
        }
        
        // Écouter les changements d'authentification
        appState.supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                appState.currentUser = session.user;
                appState.isLoggedIn = true;
                updateUI(true, session.user);
            } else {
                appState.currentUser = null;
                appState.isLoggedIn = false;
                updateUI(false, null);
            }
        });
        
    } catch (error) {
        console.error('Erreur initialisation auth:', error);
    }
}

// Mettre à jour l'interface utilisateur
function updateUI(isLoggedIn, user) {
    const authButtons = document.getElementById('auth-buttons');
    const authButtonsMobile = document.getElementById('auth-buttons-mobile');
    const userMenu = document.getElementById('user-menu');
    const userMenuMobile = document.getElementById('user-menu-mobile');
    
    if (isLoggedIn && user) {
        // Masquer les boutons de connexion
        if (authButtons) authButtons.classList.add('hidden');
        if (authButtonsMobile) authButtonsMobile.classList.add('hidden');
        
        // Afficher le menu utilisateur
        if (userMenu) userMenu.classList.remove('hidden');
        if (userMenuMobile) userMenuMobile.classList.remove('hidden');
        
        // Mettre à jour les initiales
        const initials = getUserInitials(user);
        const initialsElement = document.getElementById('user-initials');
        const initialsMobileElement = document.getElementById('user-initials-mobile');
        
        if (initialsElement) initialsElement.textContent = initials;
        if (initialsMobileElement) initialsMobileElement.textContent = initials;
        
        // Initialiser le dropdown
        setTimeout(() => initializeUserDropdown(), 100);
    } else {
        // Afficher les boutons de connexion
        if (authButtons) authButtons.classList.remove('hidden');
        if (authButtonsMobile) authButtonsMobile.classList.remove('hidden');
        
        // Masquer le menu utilisateur
        if (userMenu) userMenu.classList.add('hidden');
        if (userMenuMobile) userMenuMobile.classList.add('hidden');
    }
}

// Obtenir les initiales de l'utilisateur
function getUserInitials(user) {
    if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
        return (user.user_metadata.first_name[0] + user.user_metadata.last_name[0]).toUpperCase();
    }
    
    if (user.email) {
        return user.email.substring(0, 2).toUpperCase();
    }
    
    return 'U';
}

// Initialiser le dropdown utilisateur
let dropdownInitialized = false;
function initializeUserDropdown() {
    if (dropdownInitialized) return;
    
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdown = document.getElementById('user-dropdown');
    
    if (!dropdownToggle || !dropdown) return;
    
    // Cloner l'élément pour supprimer les anciens event listeners
    const newToggle = dropdownToggle.cloneNode(true);
    dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
    
    newToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    
    // Fermer le dropdown en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !newToggle.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
    
    dropdownInitialized = true;
}

// Fonction de déconnexion globale
window.logout = async function() {
    if (!appState.supabase) return;
    
    try {
        const { error } = await appState.supabase.auth.signOut();
        if (error) {
            console.error('Erreur déconnexion:', error);
            return;
        }
        
        appState.currentUser = null;
        appState.isLoggedIn = false;
        updateUI(false, null);
        
        // Rediriger vers la page d'accueil
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Erreur déconnexion:', error);
    }
};

// Initialiser la page quand le DOM est chargé
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation de la page de réservation');
    
    console.log('🔍 Fonctions exposées:', {
        selectSlot: typeof window.selectSlot,
        makeReservation: typeof window.makeReservation,
        switchReservationView: typeof window.switchReservationView
    });
    
    // Initialiser le reste immédiatement
    console.log('🔄 Initialisation complète...');
    await initializeReservationPage();
});

// Sélectionner un service pour un créneau (utilisé par la vue liste)
function selectServiceForSlot(slotId, serviceType) {
    console.log('🎯 Sélection service:', serviceType, 'pour créneau:', slotId);
    
    // Trouver le créneau dans les données
    const slot = appState.currentSlots?.find(s => s.id === slotId);
    if (!slot) {
        console.error('❌ Créneau non trouvé:', slotId);
        alert('Erreur : créneau non trouvé');
        return;
    }
    
    // Vérifier que le type de service existe pour ce créneau
    const serviceKey = serviceType === 'individuel' ? 'coaching_individuel' : 'coaching_groupe';
    if (slot[serviceKey].max === 0) {
        alert(`Ce créneau n'est pas disponible pour le ${serviceType === 'individuel' ? 'coaching individuel' : 'coaching groupe'}.`);
        return;
    }
    
    // Vérifier la disponibilité
    if (slot[serviceKey].current >= slot[serviceKey].max) {
        alert('Ce créneau est complet.');
        return;
    }
    
    // Vérifier si l'utilisateur a déjà réservé ce créneau
    if (slot[serviceKey].userReserved) {
        alert('Vous avez déjà réservé ce créneau.');
        return;
    }
    
    // Stocker le service sélectionné
    appState.selectedService = serviceType;
    appState.selectedSlot = slot;
    appState.selectedSlotService = serviceKey;
    
    console.log('✅ Service sélectionné:', serviceType);
    console.log('✅ Créneau sélectionné:', slot);
    
    // Afficher un message de confirmation
    const serviceName = serviceType === 'individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
    const confirmMessage = `Confirmer la réservation pour le ${serviceName} le ${slot.dateFormatted} à ${slot.time} ?`;
    
    if (confirm(confirmMessage)) {
        makeReservation();
    }
}

// ============================================
// NOUVELLE VUE CALENDRIER MENSUEL
// ============================================

// Afficher la liste des jours disponibles
async function displayMonthCalendar() {
    const daysListContainer = document.getElementById('available-days-list');
    if (!daysListContainer) return;
    
    // S'assurer que currentMonth et currentYear sont initialisés
    if (appState.currentMonth === undefined || appState.currentMonth === null) {
        const today = new Date();
        appState.currentMonth = today.getMonth();
        appState.currentYear = today.getFullYear();
    }
    
    const currentMonth = appState.currentMonth;
    const currentYear = appState.currentYear;
    
    // Mettre à jour le titre
    const monthTitle = document.getElementById('current-month-title');
    if (monthTitle) {
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                           'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        monthTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
    
    // S'assurer que les patients liés sont chargés avant de générer les créneaux
    if (appState.isLoggedIn && appState.currentUser && (!appState.linkedPatients || appState.linkedPatients.length === 0)) {
        console.log('🔄 Chargement des patients liés avant génération des créneaux...');
        await loadLinkedPatients();
    }
    
    // Récupérer les créneaux du mois
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    console.log('📅 Génération des créneaux pour:', monthStart.toISOString().split('T')[0], 'à', monthEnd.toISOString().split('T')[0]);
    const slots = await generateMonthSlots(monthStart, monthEnd);
    console.log('📅 Créneaux générés:', slots.length);
    
    // Grouper les créneaux par date
    const slotsByDate = {};
    slots.forEach(slot => {
        if (!slotsByDate[slot.date]) {
            slotsByDate[slot.date] = [];
        }
        slotsByDate[slot.date].push(slot);
    });
    
    // Identifier les jours disponibles et les trier
    const availableDates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('📅 Date d\'aujourd\'hui (pour filtrage):', today.toISOString().split('T')[0]);
    console.log('📅 Nombre de dates avec créneaux:', Object.keys(slotsByDate).length);
    
    Object.keys(slotsByDate).sort().forEach(date => {
        const dateObj = new Date(date + 'T00:00:00'); // S'assurer que la date est à minuit
        dateObj.setHours(0, 0, 0, 0);
        
        // Vérifier si la date est passée
        if (dateObj < today) {
            console.log('⏭️ Date passée ignorée:', date);
            return; // Ignorer les dates passées
        }
        
        // Si c'est aujourd'hui, filtrer les créneaux avec des heures passées
        const isToday = dateObj.getTime() === today.getTime();
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 5); // Format HH:MM
        
        // Filtrer les créneaux passés pour aujourd'hui
        let daySlots = slotsByDate[date];
        if (isToday) {
            daySlots = daySlots.filter(slot => {
                const slotTime = slot.time ? slot.time.substring(0, 5) : slot.time;
                const isPast = slotTime < currentTime;
                if (isPast) {
                    console.log(`⏭️ Créneau passé ignoré pour aujourd'hui: ${date} ${slotTime}`);
                }
                return !isPast;
            });
            
            // Si tous les créneaux du jour sont passés, ignorer ce jour
            if (daySlots.length === 0) {
                console.log('⏭️ Tous les créneaux de ce jour sont passés:', date);
                return;
            }
        }
        
        // Vérifier si l'utilisateur a déjà réservé un créneau ce jour
        const hasUserReservation = daySlots.some(slot => 
            slot.coaching_individuel.userReserved || slot.coaching_groupe.userReserved
        );
        
        // Vérifier s'il y a des créneaux disponibles (non réservés par l'utilisateur)
        const hasAvailable = daySlots.some(slot => {
            // Pour individuel : disponible si max > 0, pas encore réservé par l'utilisateur, et pas de réservation groupe
            const hasIndividuel = slot.coaching_individuel.max > 0 && 
                                 slot.coaching_individuel.current < slot.coaching_individuel.max &&
                                 !slot.coaching_individuel.userReserved &&
                                 slot.coaching_groupe.current === 0; // Pas de réservation groupe
            // Pour groupe : disponible si max > 0, pas encore réservé par l'utilisateur, et pas de réservation individuel
            const hasGroupe = slot.coaching_groupe.max > 0 && 
                             slot.coaching_groupe.current < slot.coaching_groupe.max &&
                             !slot.coaching_groupe.userReserved &&
                             slot.coaching_individuel.current === 0; // Pas de réservation individuel
            
            // Log pour débogage
            if (slot.coaching_individuel.max > 0 || slot.coaching_groupe.max > 0) {
                console.log(`  Slot ${slot.time}: hasIndividuel=${hasIndividuel}, hasGroupe=${hasGroupe}`, {
                    individuel: { max: slot.coaching_individuel.max, current: slot.coaching_individuel.current, userReserved: slot.coaching_individuel.userReserved },
                    groupe: { max: slot.coaching_groupe.max, current: slot.coaching_groupe.current, userReserved: slot.coaching_groupe.userReserved }
                });
            }
            
            return hasIndividuel || hasGroupe;
        });
        
        console.log(`📅 Date ${date}: hasAvailable=${hasAvailable}, hasUserReservation=${hasUserReservation}, slots=${daySlots.length}`);
        if (daySlots.length > 0) {
            console.log(`📅 Exemple slot pour ${date}:`, {
                time: daySlots[0].time,
                individuel: daySlots[0].coaching_individuel,
                groupe: daySlots[0].coaching_groupe
            });
        }
        
        // Si le filtre est activé, n'afficher que les jours avec créneaux disponibles
        // (exclure les jours où l'utilisateur a déjà réservé, car il ne peut réserver qu'1 par jour)
        if (appState.showOnlyAvailable) {
            if (hasAvailable && !hasUserReservation) {
                availableDates.push({
                    date: date,
                    dateObj: dateObj,
                    slots: daySlots,
                    hasUserReservation: hasUserReservation
                });
            }
        } else {
            // Afficher tous les jours qui ont des créneaux (disponibles ou réservés par l'utilisateur)
            // Même si l'utilisateur a réservé, on affiche le jour pour qu'il puisse voir/modifier
            const hasAnySlots = daySlots.some(slot => 
                slot.coaching_individuel.max > 0 || slot.coaching_groupe.max > 0
            );
            if (hasAnySlots) {
                availableDates.push({
                    date: date,
                    dateObj: dateObj,
                    slots: daySlots,
                    hasUserReservation: hasUserReservation
                });
            }
        }
    });
    
    console.log('📊 Créneaux générés:', slots.length);
    console.log('📊 Créneaux groupés par date:', Object.keys(slotsByDate).length);
    console.log('📊 Dates disponibles après filtrage:', availableDates.length);
    console.log('📊 Filtre "showOnlyAvailable" activé:', appState.showOnlyAvailable);
    
    if (availableDates.length === 0) {
        let message = 'Aucun créneau disponible ce mois';
        if (slots.length === 0) {
            message = 'Aucun créneau trouvé dans la base de données pour ce mois';
        } else if (Object.keys(slotsByDate).length === 0) {
            message = 'Aucun créneau trouvé pour ce mois';
        } else if (appState.showOnlyAvailable) {
            message = 'Aucun créneau disponible ce mois (tous les créneaux sont complets ou déjà réservés)';
        }
        daysListContainer.innerHTML = `<div class="text-center text-gray-500 py-8">${message}</div>`;
        appState.monthSlots = slots;
        appState.slotsByDate = slotsByDate;
        return;
    }
    
    // Générer la liste des jours
    let html = '';
    availableDates.forEach(({ date, dateObj, slots: daySlots, hasUserReservation }) => {
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
        const dayNumber = dateObj.getDate();
        const isExpanded = appState.expandedDays?.includes(date);
        
        // Filtrer les créneaux selon le filtre
        let slotsToShow = daySlots;
        if (appState.showOnlyAvailable) {
            // Afficher uniquement les créneaux disponibles
            // Un créneau est disponible si :
            // 1. Il a des places libres (current < max)
            // 2. L'utilisateur ne l'a pas déjà réservé
            // 3. L'utilisateur n'a pas réservé un autre créneau ce jour (limite 1 par jour)
            slotsToShow = daySlots.filter(slot => {
                // Si l'utilisateur a déjà réservé un créneau ce jour, aucun autre créneau n'est disponible
                if (hasUserReservation) {
                    return false;
                }
                
                const hasIndividuel = slot.coaching_individuel.max > 0 && 
                                     slot.coaching_individuel.current < slot.coaching_individuel.max &&
                                     !slot.coaching_individuel.userReserved;
                const hasGroupe = slot.coaching_groupe.max > 0 && 
                                 slot.coaching_groupe.current < slot.coaching_groupe.max &&
                                 !slot.coaching_groupe.userReserved;
                return hasIndividuel || hasGroupe;
            });
        } else {
            // Quand le filtre est désactivé, afficher tous les créneaux du jour
            // (même ceux réservés par l'utilisateur, pour qu'il puisse les voir/modifier)
            slotsToShow = daySlots;
        }
        
        html += `
            <div class="bg-white rounded-lg shadow-sm border overflow-hidden ${hasUserReservation ? 'border-blue-300' : ''}">
                <button onclick="toggleDaySlots('${date}')" 
                        class="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition-colors text-left">
                    <div class="flex items-center gap-3">
                        <h4 class="text-lg font-semibold text-gray-800">
                            ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNumber}
                        </h4>
                        ${hasUserReservation ? `
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <i class="fas fa-check-circle mr-1"></i>Réservé
                            </span>
                        ` : ''}
                    </div>
                    <i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400"></i>
                </button>
                
                <div id="day-slots-${date}" class="${isExpanded ? '' : 'hidden'} border-t">
                    <div class="p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        `;
        
        slotsToShow.forEach(slot => {
            const hasIndividuel = slot.coaching_individuel.max > 0 && 
                                 slot.coaching_individuel.current < slot.coaching_individuel.max;
            const hasGroupe = slot.coaching_groupe.max > 0 && 
                             slot.coaching_groupe.current < slot.coaching_groupe.max;
            
            // Vérifier si l'utilisateur a réservé ce créneau spécifique
            const userReservedIndividuel = slot.coaching_individuel.userReserved;
            const userReservedGroupe = slot.coaching_groupe.userReserved;
            const slotUserReserved = userReservedIndividuel || userReservedGroupe;
            
            // Si l'utilisateur a réservé un créneau ce jour (n'importe quel créneau), 
            // tous les autres créneaux sont non disponibles (limite 1 créneau par jour)
            // SAUF le créneau qu'il a réservé (qui reste visible mais non cliquable)
            const individuelNotAvailable = userReservedIndividuel || (hasUserReservation && !userReservedIndividuel) || !hasIndividuel;
            const groupeNotAvailable = userReservedGroupe || (hasUserReservation && !userReservedGroupe) || !hasGroupe;
            
            html += `
                <div class="border rounded-lg p-4 hover:border-primary transition-all ${slotUserReserved ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}">
                    <div class="text-center mb-3">
                        <div class="flex items-center justify-center gap-2">
                            <div class="text-lg font-semibold text-gray-800">${slot.time}</div>
                            ${slotUserReserved ? `
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <i class="fas fa-check-circle mr-1"></i>Réservé
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="space-y-2 mb-3">
                        ${slot.coaching_individuel.max > 0 ? `
                            <button onclick="selectSlotForDay('${slot.id}', 'individuel', '${date}')" 
                                    class="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${individuelNotAvailable ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' : 'bg-primary hover:bg-primary/90 text-white'}"
                                    ${individuelNotAvailable ? 'disabled' : ''}>
                                <span class="slot-type-indicator individuel mr-2"></span>
                                Coaching Individuel
                                ${userReservedIndividuel ? '<i class="fas fa-check ml-2"></i>' : ''}
                            </button>
                        ` : ''}
                        ${slot.coaching_groupe.max > 0 ? `
                            <button onclick="selectSlotForDay('${slot.id}', 'groupe', '${date}')" 
                                    class="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${groupeNotAvailable ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' : 'bg-secondary hover:bg-secondary/90 text-white'}"
                                    ${groupeNotAvailable ? 'disabled' : ''}>
                                <span class="slot-type-indicator groupe mr-2"></span>
                                Coaching Groupe
                                ${userReservedGroupe ? '<i class="fas fa-check ml-2"></i>' : ''}
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="text-xs text-gray-500 text-center">
                        ${slot.coaching_individuel.max > 0 ? `
                            <div class="${userReservedIndividuel ? 'text-blue-600 font-medium' : ''}">
                                Individuel: ${slot.coaching_individuel.current}/${slot.coaching_individuel.max}
                                ${userReservedIndividuel ? ' ✓' : ''}
                            </div>
                        ` : ''}
                        ${slot.coaching_groupe.max > 0 ? `
                            <div class="${userReservedGroupe ? 'text-blue-600 font-medium' : ''}">
                                Groupe: ${slot.coaching_groupe.current}/${slot.coaching_groupe.max}
                                ${userReservedGroupe ? ' ✓' : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    daysListContainer.innerHTML = html;
    
    // Stocker les créneaux pour utilisation ultérieure
    appState.monthSlots = slots;
    appState.slotsByDate = slotsByDate;
}

// Toggle l'affichage des créneaux d'un jour
function toggleDaySlots(dateStr) {
    if (!appState.expandedDays) {
        appState.expandedDays = [];
    }
    
    const index = appState.expandedDays.indexOf(dateStr);
    if (index > -1) {
        appState.expandedDays.splice(index, 1);
    } else {
        appState.expandedDays.push(dateStr);
    }
    
    // Rafraîchir l'affichage
    displayMonthCalendar();
}

// Toggle le filtre "voir uniquement les créneaux disponibles"
function toggleAvailableFilter() {
    const checkbox = document.getElementById('show-only-available');
    if (checkbox) {
        appState.showOnlyAvailable = checkbox.checked;
        // Réinitialiser les jours expandés pour éviter les problèmes d'affichage
        appState.expandedDays = [];
        displayMonthCalendar();
    }
}

// Changer de mois
function changeMonth(direction) {
    // S'assurer que currentMonth et currentYear sont initialisés
    if (appState.currentMonth === undefined || appState.currentMonth === null) {
        const today = new Date();
        appState.currentMonth = today.getMonth();
        appState.currentYear = today.getFullYear();
    }
    
    appState.currentMonth += direction;
    
    if (appState.currentMonth < 0) {
        appState.currentMonth = 11;
        appState.currentYear--;
    } else if (appState.currentMonth > 11) {
        appState.currentMonth = 0;
        appState.currentYear++;
    }
    
    console.log('📅 Changement de mois:', {
        direction,
        newMonth: appState.currentMonth,
        newYear: appState.currentYear
    });
    
    displayMonthCalendar();
}


// Sélectionner un créneau pour un jour et réserver directement
async function selectSlotForDay(slotId, serviceType, dateStr) {
    if (!appState.isLoggedIn) {
        alert('Vous devez être connecté pour effectuer une réservation.');
        window.location.href = 'connexion.html';
        return;
    }
    
    // Trouver le créneau
    const slot = appState.monthSlots?.find(s => s.id === slotId);
    if (!slot) {
        alert('Créneau non trouvé.');
        return;
    }
    
    // Vérifier la disponibilité
    const serviceKey = serviceType === 'individuel' ? 'coaching_individuel' : 'coaching_groupe';
    
    // Vérifier si l'utilisateur a déjà réservé ce créneau
    if (slot[serviceKey].userReserved) {
        alert('Vous avez déjà réservé ce créneau.');
        return;
    }
    
    if (slot[serviceKey].max === 0) {
        alert(`Ce créneau n'est pas disponible pour le ${serviceType === 'individuel' ? 'coaching individuel' : 'coaching groupe'}.`);
        return;
    }
    
    // Vérifier la disponibilité : s'assurer qu'il reste au moins une place
    if (slot[serviceKey].current >= slot[serviceKey].max) {
        alert('Ce créneau est complet. Veuillez rafraîchir la page pour voir les disponibilités à jour.');
        return;
    }
    
    // Vérification supplémentaire : s'assurer qu'on ne dépasse pas la capacité
    if (slot[serviceKey].current + 1 > slot[serviceKey].max) {
        alert('Ce créneau est complet. Veuillez rafraîchir la page pour voir les disponibilités à jour.');
        return;
    }
    
    // Afficher un message de confirmation
    const serviceName = serviceType === 'individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
    const dateObj = new Date(dateStr);
    const dateFormatted = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const confirmMessage = `Confirmer la réservation pour le ${serviceName} le ${dateFormatted} à ${slot.time} ?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
        // Effectuer la réservation
        try {
            // Préparer les données de réservation
            const bookingData = {
                service_type: serviceKey,
                booking_date: dateStr,
                booking_time: slot.time,
                duration: 60,
                status: 'confirmed'
            };
            
            // Si un patient lié est sélectionné, utiliser linked_patient_id
            if (appState.selectedPatientId && appState.selectedPatientIsLinked) {
                bookingData.linked_patient_id = appState.selectedPatientId;
                // S'assurer que user_id est explicitement null
                bookingData.user_id = null;
            } else {
                // Sinon, réserver pour l'utilisateur connecté
                bookingData.user_id = appState.currentUser.id;
                // S'assurer que linked_patient_id est explicitement null
                bookingData.linked_patient_id = null;
            }
            
            console.log('📝 Données de réservation à insérer:', bookingData);
            
            const { data, error } = await appState.supabase
                .from('bookings')
                .insert([bookingData])
                .select();
        
        if (error) {
            console.error('Erreur réservation:', error);
            alert('Erreur lors de la réservation. Veuillez réessayer.');
            return;
        }
        
        console.log('✅ Réservation créée:', data);
        
        // Note: Le compteur dans booking_slots est mis à jour automatiquement par le trigger
        // Pas besoin d'appeler updateSlotCounter manuellement
        
        // Succès
        alert('Réservation confirmée !');
        
        // Rafraîchir l'affichage
        setTimeout(async () => {
            await displayMonthCalendar();
            if (typeof displayMyBookings === 'function') {
                await displayMyBookings();
            }
        }, 500);
        
    } catch (error) {
        console.error('Erreur réservation:', error);
        alert('Erreur lors de la réservation. Veuillez réessayer.');
    }
}

// Annuler une réservation
async function cancelBooking(bookingId, dateStr, time, serviceType) {
    const confirmMessage = `Êtes-vous sûr de vouloir annuler cette réservation ?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const { error } = await appState.supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur annulation:', error);
            alert('Erreur lors de l\'annulation. Veuillez réessayer.');
            return;
        }
        
        // Note: Le compteur dans booking_slots est mis à jour automatiquement par le trigger
        // Pas besoin d'appeler updateSlotCounter manuellement
        
        alert('Réservation annulée avec succès.');
        
        // Rafraîchir l'affichage
        setTimeout(async () => {
            await displayMyBookings();
            await displayMonthCalendar();
        }, 500);
        
    } catch (error) {
        console.error('Erreur annulation:', error);
        alert('Erreur lors de l\'annulation. Veuillez réessayer.');
    }
}

// Modifier une réservation (ouvrir la vue liste mensuelle avec le jour sélectionné)
async function modifyBooking(bookingId, dateStr, time, serviceType) {
    // D'abord annuler la réservation actuelle
    const confirmMessage = `Pour modifier cette réservation, nous allons d'abord annuler la réservation actuelle, puis vous pourrez en sélectionner une nouvelle. Continuer ?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Annuler la réservation
        const { error } = await appState.supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur annulation:', error);
            alert('Erreur lors de la modification. Veuillez réessayer.');
            return;
        }
        
        // Note: Le compteur dans booking_slots est mis à jour automatiquement par le trigger
        // Pas besoin d'appeler updateSlotCounter manuellement
        
        // Basculer vers la vue liste mensuelle
        switchReservationView('month');
        
        // Attendre un peu pour que la vue se charge
        setTimeout(async () => {
            // Trouver le mois de la réservation
            const dateObj = new Date(dateStr);
            appState.currentMonth = dateObj.getMonth();
            appState.currentYear = dateObj.getFullYear();
            
            // Afficher le calendrier
            await displayMonthCalendar();
            
            // Expand le jour concerné
            if (!appState.expandedDays) {
                appState.expandedDays = [];
            }
            if (!appState.expandedDays.includes(dateStr)) {
                appState.expandedDays.push(dateStr);
            }
            
            // Rafraîchir pour afficher le jour expandé
            await displayMonthCalendar();
            
            // Scroll vers le jour
            const dayElement = document.querySelector(`[onclick="toggleDaySlots('${dateStr}')"]`);
            if (dayElement) {
                dayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            alert('Réservation annulée. Veuillez sélectionner un nouveau créneau.');
        }, 500);
        
    } catch (error) {
        console.error('Erreur modification:', error);
        alert('Erreur lors de la modification. Veuillez réessayer.');
    }
}



// Exposer les fonctions globalement à la fin du fichier
window.selectSlot = selectSlot;
window.makeReservation = makeReservation;
window.switchReservationView = switchReservationView;
window.selectServiceForSlot = selectServiceForSlot;
window.getCurrentView = getCurrentView;
window.displayWeekSlots = displayWeekSlots;
window.displaySlotsList = displaySlotsList;
window.displayMyBookings = displayMyBookings;
window.displayMonthCalendar = displayMonthCalendar;
window.changeMonth = changeMonth;
window.toggleDaySlots = toggleDaySlots;
window.toggleAvailableFilter = toggleAvailableFilter;
window.selectSlotForDay = selectSlotForDay;
window.cancelBooking = cancelBooking;
window.modifyBooking = modifyBooking;
