// Script de réservation pour R'MouV
// Gestion des créneaux et réservations côté client

// État global de l'application
let appState = {
    currentUser: null,
    isLoggedIn: false,
    selectedService: null,
    selectedSlot: null,
    selectedSlotService: null,
    currentSlots: [],
    currentWeek: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    supabase: null
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
        
        // Grouper les créneaux par date et heure
        const slotsByDateTime = {};
        if (dbSlots) {
            dbSlots.forEach(slot => {
                const key = `${slot.booking_date}_${slot.booking_time}`;
                if (!slotsByDateTime[key]) {
                    slotsByDateTime[key] = {
                        date: slot.booking_date,
                        time: slot.booking_time.substring(0, 5), // HH:MM
                        coaching_individuel: { max: 0, current: 0 },
                        coaching_groupe: { max: 0, current: 0 }
                    };
                }
                
                if (slot.service_type === 'coaching_individuel') {
                    slotsByDateTime[key].coaching_individuel.max = slot.max_capacity;
                    slotsByDateTime[key].coaching_individuel.current = slot.current_bookings;
                } else if (slot.service_type === 'coaching_groupe') {
                    slotsByDateTime[key].coaching_groupe.max = slot.max_capacity;
                    slotsByDateTime[key].coaching_groupe.current = slot.current_bookings;
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
            console.error('Erreur récupération créneau:', fetchError);
            return;
        }
        
        if (!slot) {
            console.error('Créneau non trouvé:', { date, time, serviceType });
            return;
        }
        
        // Mettre à jour le compteur
        const newCount = slot.current_bookings + increment;
        const { error: updateError } = await appState.supabase
            .from('booking_slots')
            .update({ current_bookings: newCount })
            .eq('id', slot.id);
        
        if (updateError) {
            console.error('Erreur mise à jour compteur:', updateError);
        } else {
            console.log('✅ Compteur mis à jour:', newCount);
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

// Charger les réservations existantes depuis Supabase
async function loadExistingBookings() {
    if (!appState.supabase) return {};
    
    try {
        console.log('🔍 Chargement des réservations depuis Supabase...');
        
        // Récupérer les réservations confirmées
        const { data: bookings, error } = await appState.supabase
            .from('bookings')
            .select('service_type, booking_date, booking_time, user_id')
            .eq('status', 'confirmed');
        
        if (error) {
            console.error('Erreur chargement réservations:', error);
            return {};
        }
        
        console.log('📋 Réservations trouvées:', bookings);
        
        // Compter les réservations par créneau et identifier les réservations de l'utilisateur actuel
        const bookingCounts = {};
        const userBookings = {};
        
        bookings.forEach(booking => {
            const key = `${booking.booking_date}_${booking.booking_time}`;
            if (!bookingCounts[key]) {
                bookingCounts[key] = { coaching_individuel: 0, coaching_groupe: 0 };
                userBookings[key] = { coaching_individuel: false, coaching_groupe: false };
            }
            bookingCounts[key][booking.service_type]++;
            
            // Vérifier si c'est une réservation de l'utilisateur actuel
            if (appState.currentUser && booking.user_id === appState.currentUser.id) {
                userBookings[key][booking.service_type] = true;
            }
        });
        
        console.log('📊 Compteurs calculés:', bookingCounts);
        console.log('👤 Réservations utilisateur:', userBookings);
        return { bookingCounts, userBookings };
    } catch (error) {
        console.error('Erreur chargement réservations:', error);
        return {};
    }
}

// Afficher les créneaux disponibles
async function displayAvailableSlots() {
    const slotsGrid = document.getElementById('slots-grid');
    if (!slotsGrid) return;
    
    console.log('🔄 Rechargement des créneaux...');
    
    // Générer les créneaux pour la semaine courante
    const weekStart = getWeekStart(appState.currentWeek);
    const slots = await generateWeekSlots(weekStart);
    
    // Charger les réservations existantes
    const bookingData = await loadExistingBookings();
    const bookingCounts = bookingData.bookingCounts || {};
    const userBookings = bookingData.userBookings || {};
    console.log('📊 Réservations chargées:', bookingCounts);
    console.log('👤 Réservations utilisateur:', userBookings);
    
    // Mettre à jour les compteurs et les informations utilisateur
    slots.forEach(slot => {
        const counts = bookingCounts[slot.id] || { coaching_individuel: 0, coaching_groupe: 0 };
        const userReservations = userBookings[slot.id] || { coaching_individuel: false, coaching_groupe: false };
        
        slot.coaching_individuel.current = counts.coaching_individuel;
        slot.coaching_groupe.current = counts.coaching_groupe;
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
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    // Logique : Si un type de cours est réservé, l'autre type n'est plus disponible
    let isIndividuelAvailable = false;
    let isGroupeAvailable = false;
    
    if (hasIndividuelBooking) {
        // Si cours individuel réservé, créneau fermé pour les cours collectifs
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else if (hasGroupeBooking) {
        // Si cours collectif réservé, créneau fermé pour les cours individuels
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else {
        // Aucune réservation, les deux types sont disponibles
        isIndividuelAvailable = slot.coaching_individuel.current < slot.coaching_individuel.max;
        isGroupeAvailable = slot.coaching_groupe.current < slot.coaching_groupe.max;
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
    const hasIndividuelBooking = slot.coaching_individuel.current > 0;
    const hasGroupeBooking = slot.coaching_groupe.current > 0;
    
    let isIndividuelAvailable = false;
    let isGroupeAvailable = false;
    
    if (hasIndividuelBooking) {
        // Si cours individuel réservé, créneau fermé pour tout le monde
        isIndividuelAvailable = false;
        isGroupeAvailable = false;
    } else if (hasGroupeBooking) {
        // Si cours groupe réservé, seul le groupe reste disponible
        isIndividuelAvailable = false;
        isGroupeAvailable = slot.coaching_groupe.current < slot.coaching_groupe.max;
    } else {
        // Aucune réservation, les deux types sont disponibles
        isIndividuelAvailable = slot.coaching_individuel.current < slot.coaching_individuel.max;
        isGroupeAvailable = slot.coaching_groupe.current < slot.coaching_groupe.max;
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
        // Créer la réservation
        const { data, error } = await appState.supabase
            .from('bookings')
            .insert([{
                user_id: appState.currentUser.id,
                service_type: serviceKey,
                booking_date: slot.date,
                booking_time: slot.time,
                duration: 60,
                status: 'confirmed'
            }])
            .select();
        
        if (error) {
            console.error('Erreur réservation:', error);
            alert('Erreur lors de la réservation. Veuillez réessayer.');
            return;
        }
        
        console.log('✅ Réservation créée:', data);
        
        // Mettre à jour le compteur dans booking_slots
        await updateSlotCounter(slot.date, slot.time, serviceKey, 1);
        
        // Succès
        alert('Réservation confirmée ! Vous recevrez un email de confirmation.');
        
        // Mise à jour immédiate de l'affichage local
        updateSlotDisplayImmediately(slot, serviceKey);
        
        // Réinitialiser la sélection
        appState.selectedSlot = null;
        document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('book-slot').disabled = true;
        
        // Recharger les créneaux depuis Supabase après un délai
        setTimeout(async () => {
            await displayAvailableSlots();
        }, 2000);
        
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
    
    console.log('📅 Variables calendrier initialisées:', {
        currentMonth: appState.currentMonth,
        currentYear: appState.currentYear
    });
    
    // Afficher le calendrier mensuel par défaut
    console.log('📅 Appel de displayMonthlyCalendar...');
    try {
        await displayMonthlyCalendar();
        console.log('✅ displayMonthlyCalendar terminé avec succès');
    } catch (error) {
        console.error('❌ Erreur dans displayMonthlyCalendar:', error);
    }
    
    console.log('✅ Page de réservation initialisée');
}

// Fonction pour changer de vue dans la réservation
function switchReservationView(viewType) {
    console.log('🔄 Changement de vue réservation vers:', viewType);
    console.log('🔄 Éléments trouvés:', {
        calendarView: !!document.getElementById('calendar-view'),
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
    
    // Désactiver tous les boutons
    document.querySelectorAll('.reservation-view-toggle').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-300');
    });
    
    // Activer le bouton sélectionné
    const activeButton = document.getElementById(`view-${viewType}`);
    if (activeButton) {
        activeButton.classList.add('active');
        activeButton.classList.remove('bg-white', 'text-gray-600', 'border-gray-300');
        activeButton.classList.add('bg-primary', 'text-white', 'border-primary');
    }
    
    // Afficher la vue sélectionnée
    switch(viewType) {
        case 'calendar':
            console.log('🔄 Affichage de la vue calendrier');
            const calendarView = document.getElementById('calendar-view');
            if (calendarView) {
                console.log('✅ Élément calendar-view trouvé');
                calendarView.classList.remove('hidden');
                console.log('✅ Classe hidden supprimée');
                displayMonthlyCalendar();
            } else {
                console.error('❌ Élément calendar-view non trouvé');
            }
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

// Afficher le calendrier mensuel
async function displayMonthlyCalendar() {
    console.log('📅 Début displayMonthlyCalendar');
    console.log('📅 Recherche de l\'élément monthly-calendar...');
    const calendarContainer = document.getElementById('monthly-calendar');
    console.log('📅 Élément trouvé:', calendarContainer);
    if (!calendarContainer) {
        console.error('❌ Élément monthly-calendar non trouvé');
        return;
    }
    
    console.log('📅 Affichage du calendrier mensuel');
    console.log('📅 Mois actuel:', appState.currentMonth, 'Année actuelle:', appState.currentYear);
    
    const today = new Date();
    const currentMonth = appState.currentMonth || today.getMonth();
    const currentYear = appState.currentYear || today.getFullYear();
    
    console.log('📅 Mois utilisé:', currentMonth, 'Année utilisée:', currentYear);
    
    // Mettre à jour le titre du mois
    const monthTitle = document.getElementById('current-month');
    if (monthTitle) {
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                           'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        monthTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
    
    // Générer le calendrier
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Commencer le dimanche
    
    // Récupérer les créneaux du mois
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    console.log('📅 Période:', monthStart, 'à', monthEnd);
    
    let slots = [];
    try {
        slots = await generateMonthSlots(monthStart, monthEnd);
        console.log('📅 Créneaux récupérés:', slots.length);
    } catch (error) {
        console.error('❌ Erreur récupération créneaux:', error);
        console.log('📅 Utilisation de créneaux vides pour test');
        slots = [];
    }
    
    // Créer la grille du calendrier
    let html = `
        <div class="grid grid-cols-7 gap-1 mb-4">
            <div class="text-center font-semibold text-gray-600 py-2">Dim</div>
            <div class="text-center font-semibold text-gray-600 py-2">Lun</div>
            <div class="text-center font-semibold text-gray-600 py-2">Mar</div>
            <div class="text-center font-semibold text-gray-600 py-2">Mer</div>
            <div class="text-center font-semibold text-gray-600 py-2">Jeu</div>
            <div class="text-center font-semibold text-gray-600 py-2">Ven</div>
            <div class="text-center font-semibold text-gray-600 py-2">Sam</div>
        </div>
        <div class="grid grid-cols-7 gap-1">
    `;
    
    console.log('📅 Génération des jours du calendrier...');
    
    // Générer les jours du calendrier
    for (let i = 0; i < 42; i++) { // 6 semaines x 7 jours
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const isCurrentMonth = currentDate.getMonth() === currentMonth;
        const isToday = currentDate.toDateString() === today.toDateString();
        const dateStr = currentDate.toISOString().split('T')[0];
        
        console.log(`📅 Jour ${i}: ${currentDate.getDate()}, mois actuel: ${isCurrentMonth}, aujourd'hui: ${isToday}`);
        
        // Vérifier s'il y a des créneaux pour ce jour
        const daySlots = slots.filter(slot => slot.date === dateStr);
        const hasSlots = daySlots.length > 0;
        
        // Déterminer les types de créneaux disponibles
        let hasIndividuel = false;
        let hasGroupe = false;
        let hasIndividuelAvailable = false;
        let hasGroupeAvailable = false;
        
        if (hasSlots) {
            hasIndividuel = daySlots.some(slot => slot.coaching_individuel.max > 0);
            hasGroupe = daySlots.some(slot => slot.coaching_groupe.max > 0);
            hasIndividuelAvailable = hasIndividuel && daySlots.some(slot => slot.coaching_individuel.current < slot.coaching_individuel.max);
            hasGroupeAvailable = hasGroupe && daySlots.some(slot => slot.coaching_groupe.current < slot.coaching_groupe.max);
        }
        
        let dayClasses = 'calendar-day';
        if (!isCurrentMonth) dayClasses += ' other-month';
        if (isToday) dayClasses += ' today';
        
        // Appliquer les codes couleur selon les types disponibles
        if (hasIndividuelAvailable && hasGroupeAvailable) {
            dayClasses += ' has-both';
        } else if (hasIndividuelAvailable) {
            dayClasses += ' has-individuel';
        } else if (hasGroupeAvailable) {
            dayClasses += ' has-groupe';
        } else if (hasSlots) {
            dayClasses += ' has-slots'; // Créneaux mais tous complets
        }
        
        html += `
            <div class="${dayClasses}" data-date="${dateStr}" onclick="selectCalendarDay('${dateStr}')">
                <div class="text-sm font-medium mb-1">${currentDate.getDate()}</div>
                ${hasSlots ? createDaySlotsDisplay(daySlots) : ''}
            </div>
        `;
    }
    
    html += '</div>';
    console.log('📅 HTML final généré:', html.length, 'caractères');
    console.log('📅 HTML à insérer:', html.substring(0, 200) + '...');
    
    calendarContainer.innerHTML = html;
    
    console.log('📅 HTML inséré dans le conteneur');
    console.log('📅 Contenu du conteneur après insertion:', calendarContainer.innerHTML.length, 'caractères');
    console.log('📅 Premiers caractères du conteneur:', calendarContainer.innerHTML.substring(0, 200) + '...');
    
    // Configurer les événements de navigation
    setupCalendarNavigation();
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
            console.error('Erreur chargement créneaux mensuels:', error);
            return [];
        }
        
        console.log('📅 Créneaux mensuels récupérés:', dbSlots);
        
        // Charger les réservations existantes
        const bookingData = await loadExistingBookings();
        const bookingCounts = bookingData.bookingCounts || {};
        const userBookings = bookingData.userBookings || {};
        
        // Formater les créneaux en regroupant par date/heure
        const slotsByDateTime = {};
        dbSlots.forEach(dbSlot => {
            const slotDate = new Date(dbSlot.booking_date);
            const slotId = `${dbSlot.booking_date}_${dbSlot.booking_time}`;
            const counts = bookingCounts[slotId] || { coaching_individuel: 0, coaching_groupe: 0 };
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
                        max: 1,
                        current: 0,
                        userReserved: false
                    },
                    coaching_groupe: {
                        max: 3,
                        current: 0,
                        userReserved: false
                    }
                };
            }
            
            // Mettre à jour les données selon le type de service
            if (dbSlot.service_type === 'coaching_individuel') {
                slotsByDateTime[slotId].coaching_individuel = {
                    max: dbSlot.max_capacity,
                    current: counts.coaching_individuel,
                    userReserved: userReservations.coaching_individuel
                };
            } else if (dbSlot.service_type === 'coaching_groupe') {
                slotsByDateTime[slotId].coaching_groupe = {
                    max: dbSlot.max_capacity,
                    current: counts.coaching_groupe,
                    userReserved: userReservations.coaching_groupe
                };
            }
        });
        
        // Convertir en tableau
        const formattedSlots = Object.values(slotsByDateTime);
        
        // Stocker les créneaux dans l'état global
        appState.currentSlots = formattedSlots;
        
        return formattedSlots;
    } catch (error) {
        console.error('Erreur generateMonthSlots:', error);
        return [];
    }
}

// Sélectionner un jour dans le calendrier
function selectCalendarDay(dateStr) {
    console.log('📅 Jour sélectionné:', dateStr);
    
    // Retirer la sélection précédente
    document.querySelectorAll('.calendar-day.selected').forEach(day => {
        day.classList.remove('selected');
    });
    
    // Ajouter la sélection au jour cliqué
    const selectedDay = document.querySelector(`[data-date="${dateStr}"]`);
    if (selectedDay) {
        selectedDay.classList.add('selected');
    }
    
    // Afficher les créneaux de ce jour dans une modal ou un panneau
    showDaySlots(dateStr);
}

// Afficher les créneaux d'un jour sélectionné
async function showDaySlots(dateStr) {
    console.log('📅 Affichage des créneaux pour:', dateStr);
    
    // Récupérer les créneaux de ce jour spécifique
    if (!appState.supabase) {
        alert('Erreur de connexion à la base de données.');
        return;
    }
    
    try {
        const { data: dbSlots, error } = await appState.supabase
            .from('booking_slots')
            .select('*')
            .eq('booking_date', dateStr)
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement créneaux du jour:', error);
            alert('Erreur lors du chargement des créneaux.');
            return;
        }
        
        console.log('📅 Créneaux du jour récupérés:', dbSlots);
        
        if (!dbSlots || dbSlots.length === 0) {
            alert('Aucun créneau disponible pour ce jour.');
            return;
        }
        
        // Charger les réservations existantes
        const bookingData = await loadExistingBookings();
        const bookingCounts = bookingData.bookingCounts || {};
        const userBookings = bookingData.userBookings || {};
        
        // Formater les créneaux
        const daySlots = [];
        dbSlots.forEach(dbSlot => {
            const slotDate = new Date(dbSlot.booking_date);
            const slotId = `${dbSlot.booking_date}_${dbSlot.booking_time}`;
            const counts = bookingCounts[slotId] || { coaching_individuel: 0, coaching_groupe: 0 };
            const userReservations = userBookings[slotId] || { coaching_individuel: false, coaching_groupe: false };
            
            daySlots.push({
                id: slotId,
                date: dbSlot.booking_date,
                time: dbSlot.booking_time,
                dayName: slotDate.toLocaleDateString('fr-FR', { weekday: 'long' }),
                dateFormatted: slotDate.toLocaleDateString('fr-FR'),
                coaching_individuel: {
                    max: dbSlot.service_type === 'coaching_individuel' ? dbSlot.max_capacity : 1,
                    current: dbSlot.service_type === 'coaching_individuel' ? counts.coaching_individuel : 0,
                    userReserved: userReservations.coaching_individuel
                },
                coaching_groupe: {
                    max: dbSlot.service_type === 'coaching_groupe' ? dbSlot.max_capacity : 3,
                    current: dbSlot.service_type === 'coaching_groupe' ? counts.coaching_groupe : 0,
                    userReserved: userReservations.coaching_groupe
                }
            });
        });
        
        // Créer une modal pour sélectionner le type de service
        showServiceSelectionModal(daySlots, dateStr);
        
    } catch (error) {
        console.error('Erreur showDaySlots:', error);
        alert('Erreur lors du chargement des créneaux.');
    }
}

// Afficher la modal de sélection de service
function showServiceSelectionModal(daySlots, dateStr) {
    // Grouper les créneaux par heure
    const slotsByTime = {};
    daySlots.forEach(slot => {
        if (!slotsByTime[slot.time]) {
            slotsByTime[slot.time] = [];
        }
        slotsByTime[slot.time].push(slot);
    });
    
    // Créer le contenu de la modal
    let slotsHtml = '';
    Object.keys(slotsByTime).forEach(time => {
        const timeSlots = slotsByTime[time];
        const hasIndividuel = timeSlots.some(s => s.coaching_individuel.max > 0);
        const hasGroupe = timeSlots.some(s => s.coaching_groupe.max > 0);
        
        const individuelAvailable = hasIndividuel && timeSlots.some(s => s.coaching_individuel.current < s.coaching_individuel.max);
        const groupeAvailable = hasGroupe && timeSlots.some(s => s.coaching_groupe.current < s.coaching_groupe.max);
        
        slotsHtml += `
            <div class="border border-gray-200 rounded-lg p-4 mb-3">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-semibold text-gray-800">${time}</h4>
                    <div class="flex gap-2">
                        ${individuelAvailable ? `
                            <button onclick="selectServiceForSlot('${timeSlots[0].id}', 'individuel')" 
                                    class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <span class="slot-type-indicator individuel mr-2"></span>
                                Individuel
                            </button>
                        ` : ''}
                        ${groupeAvailable ? `
                            <button onclick="selectServiceForSlot('${timeSlots[0].id}', 'groupe')" 
                                    class="bg-secondary hover:bg-secondary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <span class="slot-type-indicator groupe mr-2"></span>
                                Groupe
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="text-sm text-gray-600">
                    ${hasIndividuel ? `
                        <div class="flex items-center mb-1">
                            <span class="slot-type-indicator individuel mr-2"></span>
                            Individuel: ${timeSlots[0].coaching_individuel.current}/${timeSlots[0].coaching_individuel.max} places
                            ${individuelAvailable ? '<span class="text-green-600 ml-2">✓ Disponible</span>' : '<span class="text-red-600 ml-2">✗ Complet</span>'}
                        </div>
                    ` : ''}
                    ${hasGroupe ? `
                        <div class="flex items-center">
                            <span class="slot-type-indicator groupe mr-2"></span>
                            Groupe: ${timeSlots[0].coaching_groupe.current}/${timeSlots[0].coaching_groupe.max} places
                            ${groupeAvailable ? '<span class="text-green-600 ml-2">✓ Disponible</span>' : '<span class="text-red-600 ml-2">✗ Complet</span>'}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    const modalHtml = `
        <div id="service-selection-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Créneaux du ${new Date(dateStr).toLocaleDateString('fr-FR')}</h3>
                    <button onclick="closeServiceSelectionModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <p class="text-gray-600">Choisissez le type de coaching pour votre réservation :</p>
                </div>
                <div class="space-y-3">
                    ${slotsHtml}
                </div>
            </div>
        </div>
    `;
    
    // Ajouter la modal au DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Sélectionner un service pour un créneau
function selectServiceForSlot(slotId, serviceType) {
    console.log('🎯 Sélection service:', serviceType, 'pour créneau:', slotId);
    
    // Trouver le créneau dans les données
    const slot = appState.currentSlots?.find(s => s.id === slotId);
    if (!slot) {
        console.error('❌ Créneau non trouvé:', slotId);
        return;
    }
    
    // Stocker le service sélectionné
    appState.selectedService = serviceType;
    appState.selectedSlot = slot;
    appState.selectedSlotService = serviceType === 'individuel' ? 'coaching_individuel' : 'coaching_groupe';
    
    console.log('✅ Service sélectionné:', serviceType);
    console.log('✅ Créneau sélectionné:', slot);
    
    // Fermer la modal
    closeServiceSelectionModal();
    
    // Afficher un message de confirmation
    const serviceName = serviceType === 'individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
    const confirmMessage = `Confirmer la réservation pour le ${serviceName} le ${slot.dateFormatted} à ${slot.time} ?`;
    
    if (confirm(confirmMessage)) {
        makeReservation();
    }
}

// Fermer la modal de sélection de service
function closeServiceSelectionModal() {
    const modal = document.getElementById('service-selection-modal');
    if (modal) {
        modal.remove();
    }
}

// Fermer la modal des créneaux du jour
function closeDaySlotsModal() {
    const modal = document.getElementById('day-slots-modal');
    if (modal) {
        modal.remove();
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

// Créer l'affichage des créneaux pour un jour du calendrier
function createDaySlotsDisplay(daySlots) {
    let html = '';
    
    // Grouper les créneaux par heure
    const slotsByTime = {};
    daySlots.forEach(slot => {
        if (!slotsByTime[slot.time]) {
            slotsByTime[slot.time] = [];
        }
        slotsByTime[slot.time].push(slot);
    });
    
    // Afficher chaque heure avec les types disponibles selon la nouvelle logique
    Object.keys(slotsByTime).forEach(time => {
        const timeSlots = slotsByTime[time];
        const hasIndividuel = timeSlots.some(s => s.coaching_individuel.max > 0);
        const hasGroupe = timeSlots.some(s => s.coaching_groupe.max > 0);
        
        // Nouvelle logique : vérifier si un type est réservé
        const hasIndividuelBooking = timeSlots.some(s => s.coaching_individuel.current > 0);
        const hasGroupeBooking = timeSlots.some(s => s.coaching_groupe.current > 0);
        
        // Si un type est réservé, l'autre n'est plus disponible
        const individuelAvailable = hasIndividuel && !hasIndividuelBooking && !hasGroupeBooking;
        const groupeAvailable = hasGroupe && !hasIndividuelBooking && !hasGroupeBooking;
        
        html += `<div class="text-xs mb-1">`;
        html += `<div class="font-medium text-gray-700">${time}</div>`;
        
        if (hasIndividuel) {
            const status = individuelAvailable ? 'text-green-600' : 'text-red-600';
            const icon = individuelAvailable ? '✓' : '✗';
            html += `<div class="${status}">`;
            html += `<span class="slot-type-indicator individuel"></span>`;
            html += `${icon} Individuel</div>`;
        }
        
        if (hasGroupe) {
            const status = groupeAvailable ? 'text-green-600' : 'text-red-600';
            const icon = groupeAvailable ? '✓' : '✗';
            html += `<div class="${status}">`;
            html += `<span class="slot-type-indicator groupe"></span>`;
            html += `${icon} Groupe</div>`;
        }
        
        html += `</div>`;
    });
    
    return html;
}

// Configurer la navigation du calendrier
function setupCalendarNavigation() {
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    
    if (prevMonthBtn) {
        prevMonthBtn.onclick = () => {
            console.log('📅 Mois précédent cliqué');
            appState.currentMonth = (appState.currentMonth - 1 + 12) % 12;
            if (appState.currentMonth === 11) {
                appState.currentYear--;
            }
            console.log('📅 Nouveau mois:', appState.currentMonth, 'Nouvelle année:', appState.currentYear);
            displayMonthlyCalendar();
        };
    }
    
    if (nextMonthBtn) {
        nextMonthBtn.onclick = () => {
            console.log('📅 Mois suivant cliqué');
            appState.currentMonth = (appState.currentMonth + 1) % 12;
            if (appState.currentMonth === 0) {
                appState.currentYear++;
            }
            console.log('📅 Nouveau mois:', appState.currentMonth, 'Nouvelle année:', appState.currentYear);
            displayMonthlyCalendar();
        };
    }
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
        const hasIndividuelBooking = slot.coaching_individuel.current > 0;
        const hasGroupeBooking = slot.coaching_groupe.current > 0;
        
        // Nouvelle logique : un créneau est disponible seulement si aucun des deux types n'est réservé
        const isAvailable = !hasIndividuelBooking && !hasGroupeBooking;
        
        if (isAvailable) {
            availableSlots.push({
                ...slot,
                hasIndividuelAvailable: true, // Les deux types sont disponibles
                hasGroupeAvailable: true
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
    const hasIndividuelAvailable = slot.hasIndividuelAvailable;
    const hasGroupeAvailable = slot.hasGroupeAvailable;
    
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
        const { data: bookings, error } = await appState.supabase
            .from('bookings')
            .select('*')
            .eq('user_id', appState.currentUser.id)
            .eq('status', 'confirmed')
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement réservations:', error);
            bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des réservations</div>';
            return;
        }
        
        if (!bookings || bookings.length === 0) {
            bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucune réservation trouvée</div>';
            return;
        }
        
        let html = '';
        bookings.forEach(booking => {
            const date = new Date(booking.booking_date);
            const time = booking.booking_time;
            const serviceType = booking.service_type === 'coaching_individuel' ? 'Individuel' : 'Collectif';
            
            html += `
                <div class="slot-list-item">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="font-semibold text-gray-800">${serviceType}</div>
                            <div class="text-sm text-gray-600">${date.toLocaleDateString('fr-FR')} à ${time}</div>
                        </div>
                        <div class="text-right">
                            <span class="text-sm px-2 py-1 bg-green-100 text-green-800 rounded-full">Confirmé</span>
                        </div>
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
        switchReservationView: typeof window.switchReservationView,
        selectCalendarDay: typeof window.selectCalendarDay,
        closeDaySlotsModal: typeof window.closeDaySlotsModal
    });
    
    // Initialiser le reste immédiatement
    console.log('🔄 Initialisation complète...');
    await initializeReservationPage();
});

// Exposer les fonctions globalement à la fin du fichier
window.selectSlot = selectSlot;
window.makeReservation = makeReservation;
window.switchReservationView = switchReservationView;
window.selectCalendarDay = selectCalendarDay;
window.closeDaySlotsModal = closeDaySlotsModal;
window.selectServiceForSlot = selectServiceForSlot;
window.closeServiceSelectionModal = closeServiceSelectionModal;
