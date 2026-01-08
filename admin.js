// Script pour la page d'administration
// Gestion du calendrier et des créneaux

// État global de l'application
let adminState = {
    currentUser: null,
    isLoggedIn: false,
    supabase: null,
    currentDate: new Date(),
    slots: [],
    bookings: [],
    selectedDate: null,
    selectedSlots: [], // IDs des créneaux sélectionnés pour suppression multiple
    slotsCache: {
        data: [],
        timestamp: null,
        maxAge: 30000, // 30 secondes de cache
        loadedMonths: 1 // Nombre de mois chargés (pagination)
    }
};

// Initialisation Supabase
async function initializeSupabase() {
    try {
        // Si déjà initialisé, retourner true
        if (adminState.supabase) {
            return true;
        }
        
        // Attendre que window.supabase soit disponible
        await waitForSupabase();
        
        // Vérifier que les clés sont disponibles
        if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
            console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY non définis');
            return false;
        }
        
        // Créer le client seulement s'il n'existe pas déjà
        if (!adminState.supabase) {
            adminState.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialisé pour l\'administration');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erreur initialisation Supabase:', error);
        return false;
    }
}

// Attendre que Supabase soit disponible (améliorée avec timeout)
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 secondes max (50 * 100ms)
        
        const checkSupabase = () => {
            attempts++;
            if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('Timeout: Supabase CDN n\'a pas été chargé dans les 5 secondes'));
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        
        checkSupabase();
    });
}

// Charger tous les créneaux (avec cache)
async function loadAllSlots(forceRefresh = false) {
    if (!adminState.supabase) return [];
    
    // Vérifier le cache
    const now = Date.now();
    if (!forceRefresh && 
        adminState.slotsCache.data.length > 0 && 
        adminState.slotsCache.timestamp && 
        (now - adminState.slotsCache.timestamp) < adminState.slotsCache.maxAge) {
        console.log('📦 Utilisation du cache pour les créneaux');
        return adminState.slotsCache.data;
    }
    
    try {
        console.log('🔍 Chargement de tous les créneaux...');
        
        const { data: slots, error } = await adminState.supabase
            .from('booking_slots')
            .select('*')
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement créneaux:', error);
            return [];
        }
        
        // Mettre à jour le cache
        adminState.slotsCache.data = slots || [];
        adminState.slotsCache.timestamp = now;
        
        console.log('📅 Créneaux trouvés:', slots);
        return slots || [];
    } catch (error) {
        console.error('Erreur chargement créneaux:', error);
        return [];
    }
}

// Charger uniquement les créneaux futurs avec pagination (standard industrie)
async function loadFutureSlots(monthsAhead = 1, append = false) {
    if (!adminState.supabase) return [];
    
    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setMonth(today.getMonth() + monthsAhead);
        
        const todayStr = formatDateForInput(today);
        const futureStr = formatDateForInput(futureDate);
        
        console.log(`🔍 Chargement des créneaux futurs (${todayStr} à ${futureStr})...`);
        
        const { data: slots, error } = await adminState.supabase
            .from('booking_slots')
            .select('*')
            .gte('booking_date', todayStr)
            .lte('booking_date', futureStr)
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement créneaux futurs:', error);
            return append ? adminState.slotsCache.data : [];
        }
        
        if (append) {
            // Ajouter aux créneaux existants (éviter les doublons)
            const existingKeys = new Set(adminState.slotsCache.data.map(s => `${s.booking_date}_${s.booking_time}_${s.service_type}`));
            const newSlots = (slots || []).filter(s => !existingKeys.has(`${s.booking_date}_${s.booking_time}_${s.service_type}`));
            adminState.slotsCache.data = [...adminState.slotsCache.data, ...newSlots];
            adminState.slotsCache.loadedMonths = monthsAhead;
            adminState.slotsCache.timestamp = Date.now();
        } else {
            adminState.slotsCache.data = slots || [];
            adminState.slotsCache.loadedMonths = monthsAhead;
            adminState.slotsCache.timestamp = Date.now();
        }
        
        console.log(`📅 ${adminState.slotsCache.data.length} créneaux chargés (${monthsAhead} mois)`);
        return adminState.slotsCache.data;
    } catch (error) {
        console.error('Erreur chargement créneaux futurs:', error);
        return append ? adminState.slotsCache.data : [];
    }
}

// Charger le rôle de l'utilisateur
async function loadUserRole(userId) {
    try {
        const { data, error } = await adminState.supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Erreur chargement rôle:', error);
            return 'user'; // Rôle par défaut
        }
        
        return data?.role || 'user';
    } catch (error) {
        console.error('Erreur chargement rôle:', error);
        return 'user';
    }
}

// Charger toutes les réservations
async function loadAllBookings() {
    if (!adminState.supabase) return [];
    
    try {
        console.log('🔍 Chargement de toutes les réservations...');
        
        const { data: bookings, error } = await adminState.supabase
            .from('bookings')
            .select('*')
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement réservations:', error);
            return [];
        }
        
        console.log('📋 Réservations trouvées:', bookings);
        return bookings || [];
    } catch (error) {
        console.error('Erreur chargement réservations:', error);
        return [];
    }
}

// Générer le calendrier pour le mois courant
function generateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    const year = adminState.currentDate.getFullYear();
    const month = adminState.currentDate.getMonth();
    
    // Mettre à jour le titre du mois
    const monthTitle = document.getElementById('current-month');
    if (monthTitle) {
        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        monthTitle.textContent = `${monthNames[month]} ${year}`;
    }
    
    // Premier jour du mois et dernier jour
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Convertir dimanche=0 vers lundi=0
    
    // Vider la grille
    calendarGrid.innerHTML = '';
    
    // Ajouter les jours du mois précédent
    const prevMonth = new Date(year, month, 0);
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonth.getDate() - i;
        const dayElement = createDayElement(prevMonth.getFullYear(), month - 1, day, true);
        calendarGrid.appendChild(dayElement);
    }
    
    // Ajouter les jours du mois courant
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayElement = createDayElement(year, month, day, false);
        calendarGrid.appendChild(dayElement);
    }
    
    // Ajouter les jours du mois suivant pour compléter la grille
    const remainingDays = 42 - calendarGrid.children.length;
    for (let day = 1; day <= remainingDays; day++) {
        const dayElement = createDayElement(year, month + 1, day, true);
        calendarGrid.appendChild(dayElement);
    }
}

// Créer un élément de jour
function createDayElement(year, month, day, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day p-2 border border-gray-200 ${isOtherMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}`;
    
    const date = new Date(year, month, day);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
        dayElement.classList.add('today');
    }
    
    // Vérifier s'il y a des créneaux pour ce jour
    const daySlots = adminState.slots.filter(slot => {
        const slotDate = new Date(slot.booking_date);
        return slotDate.toDateString() === date.toDateString();
    });
    
    if (daySlots.length > 0) {
        dayElement.classList.add('has-slots');
    }
    
    // Contenu du jour
    dayElement.innerHTML = `
        <div class="text-sm font-medium mb-1">${day}</div>
        <div class="space-y-1">
            ${daySlots.map(slot => {
                const bookings = adminState.bookings.filter(booking => 
                    booking.booking_date === slot.booking_date && 
                    booking.booking_time === slot.booking_time &&
                    booking.service_type === slot.service_type
                );
                
                const isBooked = bookings.length > 0;
                const indicatorClass = isBooked ? 'slot-booked' : 
                    (slot.service_type === 'coaching_individuel' ? 'slot-individuel' : 'slot-groupe');
                
                return `
                    <div class="flex items-center text-xs">
                        <div class="slot-indicator ${indicatorClass}"></div>
                        <span>${slot.booking_time}</span>
                        <span class="ml-1">(${bookings.length}/${slot.max_capacity})</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Ajouter l'événement de clic
    if (!isOtherMonth) {
        dayElement.addEventListener('click', () => showDayDetails(date));
    }
    
    return dayElement;
}

// Afficher les détails d'un jour
function showDayDetails(date) {
    adminState.selectedDate = date;
    
    const modal = document.getElementById('day-details-modal');
    const title = document.getElementById('day-details-title');
    const content = document.getElementById('day-details-content');
    
    if (!modal || !title || !content) return;
    
    const dateStr = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    title.textContent = `Détails - ${dateStr}`;
    
    // Filtrer les créneaux et réservations pour ce jour
    const daySlots = adminState.slots.filter(slot => {
        const slotDate = new Date(slot.booking_date);
        return slotDate.toDateString() === date.toDateString();
    });
    
    const dayBookings = adminState.bookings.filter(booking => {
        const bookingDate = new Date(booking.booking_date);
        return bookingDate.toDateString() === date.toDateString();
    });
    
    if (daySlots.length === 0) {
        content.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-calendar-times text-4xl text-gray-300 mb-4"></i>
                <h4 class="text-lg font-semibold text-gray-600 mb-2">Aucun créneau</h4>
                <p class="text-gray-500 mb-4">Aucun créneau n'est défini pour ce jour.</p>
                <button onclick="addSlotForDate('${formatDateForInput(date)}')" class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium transition-colors">
                    <i class="fas fa-plus mr-2"></i>Ajouter un créneau
                </button>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center justify-between mb-4 pb-3 border-b">
                    <label class="flex items-center cursor-pointer">
                        <input type="checkbox" class="slot-checkbox select-all-slots mr-2" onchange="selectAllVisibleSlots()">
                        <span class="text-sm font-medium text-gray-700">Tout sélectionner</span>
                    </label>
                    <button id="bulk-delete-modal-btn" onclick="deleteMultipleSlots()" class="hidden bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-sm">
                        <i class="fas fa-trash mr-2"></i>Supprimer sélection
                    </button>
                </div>
                ${daySlots.map(slot => {
                    const slotBookings = dayBookings.filter(booking => 
                        booking.booking_time === slot.booking_time &&
                        booking.service_type === slot.service_type
                    );
                    
                    const serviceName = slot.service_type === 'coaching_individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
                    const maxCapacity = slot.max_capacity;
                    const currentBookings = slotBookings.length;
                    const isSelected = adminState.selectedSlots.includes(slot.id);
                    
                    return `
                        <div class="time-slot ${currentBookings >= maxCapacity ? 'booked' : ''} ${isSelected ? 'border-2 border-blue-500 bg-blue-50' : ''}">
                            <div class="flex items-start gap-3 mb-2">
                                <input type="checkbox" 
                                       class="slot-checkbox mt-1" 
                                       value="${slot.id}" 
                                       ${isSelected ? 'checked' : ''}
                                       onchange="toggleSlotSelection('${slot.id}'); this.closest('.time-slot').classList.toggle('border-2', this.checked); this.closest('.time-slot').classList.toggle('border-blue-500', this.checked); this.closest('.time-slot').classList.toggle('bg-blue-50', this.checked);">
                                <div class="flex-1">
                                    <div class="flex justify-between items-center mb-2">
                                        <h4 class="font-semibold">${slot.booking_time} - ${serviceName}</h4>
                                        <div class="flex gap-2">
                                            <button onclick="editSlot('${slot.id}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="deleteSlot('${slot.id}')" class="text-red-600 hover:text-red-800 text-sm">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="text-sm text-gray-600 mb-2">
                                        Capacité: ${currentBookings}/${maxCapacity}
                                    </div>
                                    
                                    ${slotBookings.length > 0 ? `
                                        <div class="space-y-2">
                                            <h5 class="font-medium text-sm">Réservations:</h5>
                                            ${slotBookings.map(booking => `
                                                <div class="booking-item ${booking.service_type === 'coaching_individuel' ? 'booking-individuel' : 'booking-groupe'}">
                                                    <div class="flex justify-between items-center">
                                                        <div>
                                                            <div class="font-medium">Utilisateur ${booking.user_id ? booking.user_id.substring(0, 8) : 'Inconnu'}</div>
                                                            <div class="text-xs text-gray-500">ID: ${booking.user_id || 'Non disponible'}</div>
                                                        </div>
                                                        <div class="text-xs text-gray-500">
                                                            ${booking.status === 'confirmed' ? 'Confirmée' : 
                                                              booking.status === 'cancelled' ? 'Annulée' : 'Terminée'}
                                                        </div>
                                                    </div>
                                                    ${booking.notes ? `<div class="text-xs text-gray-600 mt-1">${booking.notes}</div>` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : `
                                        <div class="text-sm text-gray-500">Aucune réservation</div>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
                
                <div class="mt-6 pt-4 border-t flex justify-between items-center">
                    <button onclick="addSlotForDate('${formatDateForInput(date)}')" class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium transition-colors">
                        <i class="fas fa-plus mr-2"></i>Ajouter un autre créneau
                    </button>
                </div>
            </div>
        `;
        
        // Mettre à jour le bouton de suppression en masse après le rendu
        setTimeout(() => updateBulkDeleteButtons(), 100);
    }
    
    modal.classList.add('show');
}

// Fermer le modal des détails du jour
function closeDayDetailsModal() {
    const modal = document.getElementById('day-details-modal');
    if (modal) {
        modal.classList.remove('show');
        // Vider la sélection des créneaux du jour fermé
        if (adminState.selectedDate) {
            const daySlots = adminState.slots.filter(slot => {
                const slotDate = new Date(slot.booking_date);
                return slotDate.toDateString() === adminState.selectedDate.toDateString();
            });
            daySlots.forEach(slot => {
                const index = adminState.selectedSlots.indexOf(slot.id);
                if (index > -1) {
                    adminState.selectedSlots.splice(index, 1);
                }
            });
            updateBulkDeleteButtons();
        }
    }
}

// Afficher le modal d'ajout de créneau
function showAddSlotModal() {
    const modal = document.getElementById('add-slot-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// Fermer le modal d'ajout de créneau
// Fonction pour gérer le toggle "indéfiniment" pour les créneaux récurrents
window.toggleRecurringIndefinite = function() {
    const indefiniteCheckbox = document.getElementById('recurring-indefinite');
    const weeksInput = document.getElementById('recurring-weeks');
    
    if (indefiniteCheckbox && weeksInput) {
        if (indefiniteCheckbox.checked) {
            // Désactiver le champ nombre de semaines
            weeksInput.disabled = true;
            weeksInput.value = '';
        } else {
            // Réactiver le champ et remettre la valeur par défaut
            weeksInput.disabled = false;
            weeksInput.value = '4';
        }
    }
};

function closeAddSlotModal() {
    const modal = document.getElementById('add-slot-modal');
    if (modal) {
        modal.classList.remove('show');
        
        // Réinitialiser le formulaire
        const form = document.getElementById('add-slot-form');
        if (form) {
            form.reset();
        }
        
        // Décocher explicitement les checkboxes
        const checkboxes = document.querySelectorAll('input[name="slot-types"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Effacer les erreurs de validation
        clearValidationErrors();
    }
}

// Gérer la fermeture des modales avec la touche Échap
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Fermer toutes les modales ouvertes
        closeDayDetailsModal();
        closeAddSlotModal();
    }
});

// Fermer les modales en cliquant à l'extérieur
document.addEventListener('click', function(event) {
    // Modale des détails du jour
    const dayDetailsModal = document.getElementById('day-details-modal');
    if (dayDetailsModal && event.target === dayDetailsModal) {
        closeDayDetailsModal();
    }
    
    // Modale d'ajout de créneau
    const addSlotModal = document.getElementById('add-slot-modal');
    if (addSlotModal && event.target === addSlotModal) {
        closeAddSlotModal();
    }
});

// Ajouter un créneau pour une date spécifique
// Fonction utilitaire pour formater une date en YYYY-MM-DD (fuseau horaire local)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addSlotForDate(dateStr) {
    const modal = document.getElementById('add-slot-modal');
    const dateInput = document.getElementById('slot-date');
    const recurringCheckbox = document.getElementById('recurring-slot');
    const recurringOptions = document.getElementById('recurring-options');
    
    if (modal && dateInput) {
        // Fermer d'abord la modale des détails du jour
        closeDayDetailsModal();
        
        // Réinitialiser le formulaire
        const form = document.getElementById('add-slot-form');
        if (form) {
            form.reset();
        }
        
        // Réinitialiser l'option "indéfiniment"
        const indefiniteCheckbox = document.getElementById('recurring-indefinite');
        const weeksInput = document.getElementById('recurring-weeks');
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = false;
        }
        if (weeksInput) {
            weeksInput.disabled = false;
            weeksInput.value = '4';
        }
        
        // Masquer les options de récurrence
        if (recurringOptions) {
            recurringOptions.classList.add('hidden');
        }
        if (recurringCheckbox) {
            recurringCheckbox.checked = false;
        }
        
        // Puis ouvrir la modale d'ajout de créneau
        dateInput.value = dateStr;
        modal.classList.add('show');
    }
}

// Gérer la soumission du formulaire d'ajout de créneau
async function handleAddSlotSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const date = formData.get('slot-date');
    const timeType = formData.get('time-type');
    const time = formData.get('slot-time');
    const startTime = formData.get('start-time');
    const endTime = formData.get('end-time');
    const notes = formData.get('slot-notes');
    const groupCapacity = parseInt(formData.get('group-capacity')) || 3;
    
    // Récupérer les types de cours sélectionnés (checkboxes)
    const selectedTypes = formData.getAll('slot-types');
    
    // Vérifier si la récurrence est activée
    const isRecurring = formData.get('recurring-slot') === 'on';
    const recurringDays = formData.getAll('recurring-days');
    const isIndefinite = document.getElementById('recurring-indefinite')?.checked || false;
    const recurringWeeks = isIndefinite ? null : (parseInt(formData.get('recurring-weeks')) || 4);
    
    console.log('📋 Données du formulaire:', {
        date,
        timeType,
        time,
        startTime,
        endTime,
        selectedTypes,
        notes,
        isRecurring,
        recurringDays,
        recurringWeeks
    });
    
    // Validation selon le type de création
    if (!date || selectedTypes.length === 0) {
        // Validation visuelle
        clearValidationErrors();
        
        if (!date) {
            showFieldError('slot-date', 'La date est obligatoire');
        }
        if (selectedTypes.length === 0) {
            showFieldError('slot-types', 'Veuillez sélectionner au moins un type de cours');
        }
        
        alert('Veuillez remplir tous les champs obligatoires (Date et au moins un type de cours).');
        return;
    }
    
    // Validation spécifique selon le type
    if (timeType === 'single') {
        if (!time) {
            showFieldError('slot-time', 'L\'heure est obligatoire');
            alert('Veuillez sélectionner une heure pour le créneau unique.');
            return;
        }
    } else if (timeType === 'range') {
        if (!startTime || !endTime) {
            showFieldError('start-time', 'L\'heure de début est obligatoire');
            showFieldError('end-time', 'L\'heure de fin est obligatoire');
            alert('Veuillez saisir l\'heure de début et de fin pour la plage d\'horaires.');
            return;
        }
        
        // Vérifier que l'heure de fin est après l'heure de début
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        
        if (endHour <= startHour) {
            showFieldError('end-time', 'L\'heure de fin doit être après l\'heure de début');
            alert('L\'heure de fin doit être après l\'heure de début.');
            return;
        }
    }
    
    // Validation pour la récurrence
    if (isRecurring && recurringDays.length === 0) {
        alert('Veuillez sélectionner au moins un jour de la semaine pour la récurrence.');
        return;
    }
    
    try {
        // Utiliser la nouvelle fonction pour gérer la création
        await handleSlotCreation(date, timeType, time, startTime, endTime, selectedTypes, groupCapacity, notes, isRecurring, recurringDays, recurringWeeks);
        
        // Fermer le modal et actualiser
        closeAddSlotModal();
        
        // Rafraîchir automatiquement toutes les vues après création
        setTimeout(async () => {
            console.log('🔄 Rafraîchissement automatique après création de créneau...');
            try {
                // Invalider le cache et rafraîchir le calendrier
                adminState.slotsCache.timestamp = null;
                await refreshCalendar(true);
                
                // Rafraîchir aussi la liste si elle est visible
                const slotsListContainer = document.getElementById('slots-list');
                if (slotsListContainer && !slotsListContainer.closest('.hidden')) {
                    await displaySlotsList();
                }
            } catch (error) {
                console.error('Erreur lors du rafraîchissement:', error);
            }
        }, 500);
        
    } catch (error) {
        console.error('Erreur création créneaux:', error);
        
        if (error.code === '23505') {
            alert('Certains créneaux existent déjà. Veuillez actualiser la page et réessayer.');
        } else if (error.code === '42501') {
            alert('Erreur de permissions. Vérifiez que vous êtes bien connecté en tant qu\'administrateur.');
        } else {
            alert('Erreur lors de la création des créneaux. Veuillez réessayer.');
        }
    }
}

// Gérer la sélection d'un créneau pour suppression multiple
function toggleSlotSelection(slotId) {
    const index = adminState.selectedSlots.indexOf(slotId);
    const isSelected = index > -1;
    
    if (isSelected) {
        adminState.selectedSlots.splice(index, 1);
    } else {
        adminState.selectedSlots.push(slotId);
    }
    
    // Mettre à jour l'affichage des boutons de suppression en masse
    updateBulkDeleteButtons();
    
    // Retourner le nouvel état de sélection
    return adminState.selectedSlots.includes(slotId);
}

// Mettre à jour l'affichage des boutons de suppression en masse
function updateBulkDeleteButtons() {
    const selectedCount = adminState.selectedSlots.length;
    
    // Bouton dans le modal de détails
    const modalBulkDeleteBtn = document.getElementById('bulk-delete-modal-btn');
    if (modalBulkDeleteBtn) {
        if (selectedCount > 0) {
            modalBulkDeleteBtn.classList.remove('hidden');
            modalBulkDeleteBtn.innerHTML = `<i class="fas fa-trash mr-2"></i>Supprimer ${selectedCount} créneau(x) sélectionné(s)`;
        } else {
            modalBulkDeleteBtn.classList.add('hidden');
        }
    }
    
    // Bouton dans la vue liste
    const listBulkDeleteBtn = document.getElementById('bulk-delete-list-btn');
    if (listBulkDeleteBtn) {
        if (selectedCount > 0) {
            listBulkDeleteBtn.classList.remove('hidden');
            listBulkDeleteBtn.innerHTML = `<i class="fas fa-trash mr-2"></i>Supprimer ${selectedCount} créneau(x) sélectionné(s)`;
        } else {
            listBulkDeleteBtn.classList.add('hidden');
        }
    }
    
    // Checkbox "Tout sélectionner"
    const selectAllCheckboxes = document.querySelectorAll('.select-all-slots');
    selectAllCheckboxes.forEach(checkbox => {
        if (adminState.selectedSlots.length > 0) {
            checkbox.indeterminate = adminState.selectedSlots.length < adminState.slots.length;
            checkbox.checked = adminState.selectedSlots.length === adminState.slots.length;
        } else {
            checkbox.indeterminate = false;
            checkbox.checked = false;
        }
    });
}

// Sélectionner tous les créneaux visibles
function selectAllVisibleSlots() {
    const checkbox = event ? event.target : window.event.target;
    const isChecked = checkbox.checked;
    
    // Récupérer tous les IDs de créneaux visibles selon le contexte
    let visibleSlotIds = [];
    
    // Si on est dans le modal de détails
    const dayDetailsModal = document.getElementById('day-details-modal');
    if (dayDetailsModal && dayDetailsModal.classList.contains('show') && adminState.selectedDate) {
        const daySlots = adminState.slots.filter(slot => {
            const slotDate = new Date(slot.booking_date);
            return slotDate.toDateString() === adminState.selectedDate.toDateString();
        });
        visibleSlotIds = daySlots.map(slot => slot.id);
    } else {
        // Sinon, dans la vue liste - récupérer tous les créneaux visibles depuis le DOM
        const slotCheckboxes = document.querySelectorAll('.slot-checkbox:not(.select-all-slots)');
        visibleSlotIds = Array.from(slotCheckboxes)
            .map(cb => cb.value)
            .filter(id => id); // Filtrer les valeurs vides
    }
    
    if (isChecked) {
        // Ajouter tous les créneaux visibles
        visibleSlotIds.forEach(id => {
            if (!adminState.selectedSlots.includes(id)) {
                adminState.selectedSlots.push(id);
            }
        });
    } else {
        // Retirer tous les créneaux visibles
        visibleSlotIds.forEach(id => {
            const index = adminState.selectedSlots.indexOf(id);
            if (index > -1) {
                adminState.selectedSlots.splice(index, 1);
            }
        });
    }
    
    // Mettre à jour toutes les checkboxes visibles
    visibleSlotIds.forEach(id => {
        const slotCheckbox = document.querySelector(`.slot-checkbox[value="${id}"]:not(.select-all-slots)`);
        if (slotCheckbox) {
            slotCheckbox.checked = isChecked;
            
            // Mettre à jour visuellement les éléments sélectionnés
            const slotElement = slotCheckbox.closest('.time-slot') || slotCheckbox.closest('.bg-gray-50');
            if (slotElement) {
                if (isChecked) {
                    slotElement.classList.add('border-2', 'border-blue-500', 'bg-blue-50');
                } else {
                    slotElement.classList.remove('border-2', 'border-blue-500', 'bg-blue-50');
                }
            }
        }
    });
    
    updateBulkDeleteButtons();
}

// Supprimer plusieurs créneaux en une fois
async function deleteMultipleSlots() {
    if (adminState.selectedSlots.length === 0) {
        alert('Aucun créneau sélectionné.');
        return;
    }
    
    const count = adminState.selectedSlots.length;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} créneau(x) ? Toutes les réservations associées seront également supprimées.`)) {
        return;
    }
    
    try {
        // Supprimer d'abord toutes les réservations associées
        // Les réservations sont liées par booking_date, booking_time et service_type
        const slotsToDelete = adminState.slots.filter(s => adminState.selectedSlots.includes(s.id));
        let bookingsError = null;
        
        for (const slot of slotsToDelete) {
            const { error } = await adminState.supabase
                .from('bookings')
                .delete()
                .eq('booking_date', slot.booking_date)
                .eq('booking_time', slot.booking_time)
                .eq('service_type', slot.service_type);
            
            if (error && !bookingsError) {
                bookingsError = error;
            }
        }
        
        if (bookingsError) {
            console.error('Erreur suppression réservations:', bookingsError);
        }
        
        // Supprimer tous les créneaux sélectionnés
        const { error } = await adminState.supabase
            .from('booking_slots')
            .delete()
            .in('id', adminState.selectedSlots);
        
        if (error) {
            console.error('Erreur suppression créneaux:', error);
            alert('Erreur lors de la suppression des créneaux.');
            return;
        }
        
        console.log(`✅ ${count} créneau(x) supprimé(s)`);
        
        // Vider la sélection
        adminState.selectedSlots = [];
        updateBulkDeleteButtons();
        
        // Invalider le cache et actualiser toutes les données
        adminState.slotsCache.timestamp = null;
        await refreshCalendar(true);
        
        // Vérifier quelle vue est active et la mettre à jour
        const calendarView = document.getElementById('calendar-view');
        const listView = document.getElementById('list-view');
        
        if (calendarView && !calendarView.classList.contains('hidden')) {
            // Vue calendrier active - rafraîchir le modal si ouvert
            const dayDetailsModal = document.getElementById('day-details-modal');
            if (dayDetailsModal && dayDetailsModal.classList.contains('show') && adminState.selectedDate) {
                showDayDetails(adminState.selectedDate);
            }
        } else if (listView && !listView.classList.contains('hidden')) {
            // Vue liste active - rafraîchir la liste
            await displaySlotsList();
        }
        
        alert(`${count} créneau(x) supprimé(s) avec succès !`);
        
    } catch (error) {
        console.error('Erreur suppression créneaux:', error);
        alert('Erreur lors de la suppression des créneaux.');
    }
}

// Supprimer un créneau
async function deleteSlot(slotId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ? Toutes les réservations associées seront également supprimées.')) {
        return;
    }
    
    try {
        // Récupérer les informations du créneau avant suppression (pour savoir quelle date rafraîchir)
        const slotToDelete = adminState.slots.find(s => s.id === slotId);
        const slotDate = slotToDelete ? new Date(slotToDelete.booking_date) : null;
        
        // Supprimer d'abord les réservations associées
        // Les réservations sont liées par booking_date, booking_time et service_type
        const { error: bookingsError } = await adminState.supabase
            .from('bookings')
            .delete()
            .eq('booking_date', slotToDelete.booking_date)
            .eq('booking_time', slotToDelete.booking_time)
            .eq('service_type', slotToDelete.service_type);
        
        if (bookingsError) {
            console.error('Erreur suppression réservations:', bookingsError);
        }
        
        // Supprimer le créneau
        const { error } = await adminState.supabase
            .from('booking_slots')
            .delete()
            .eq('id', slotId);
        
        if (error) {
            console.error('Erreur suppression créneau:', error);
            alert('Erreur lors de la suppression du créneau.');
            return;
        }
        
        console.log('✅ Créneau supprimé');
        
        // Invalider le cache et actualiser toutes les données
        adminState.slotsCache.timestamp = null;
        await refreshCalendar(true);
        
        // Vérifier quelle vue est active et la mettre à jour
        const calendarView = document.getElementById('calendar-view');
        const listView = document.getElementById('list-view');
        
        if (calendarView && !calendarView.classList.contains('hidden')) {
            // Vue calendrier active - rafraîchir le modal si ouvert
            const dayDetailsModal = document.getElementById('day-details-modal');
            if (dayDetailsModal && dayDetailsModal.classList.contains('show') && slotDate && adminState.selectedDate) {
                // Vérifier si la date du modal correspond à celle du créneau supprimé
                if (slotDate.toDateString() === adminState.selectedDate.toDateString()) {
                    // Rafraîchir le modal avec les nouvelles données
                    showDayDetails(adminState.selectedDate);
                }
            }
        } else if (listView && !listView.classList.contains('hidden')) {
            // Vue liste active - rafraîchir la liste
            await displaySlotsList();
        }
        
        alert('Créneau supprimé avec succès !');
        
    } catch (error) {
        console.error('Erreur suppression créneau:', error);
        alert('Erreur lors de la suppression du créneau.');
    }
}

// Modifier un créneau
async function editSlot(slotId) {
    const slot = adminState.slots.find(s => s.id === slotId);
    if (!slot) return;
    
    // Pour l'instant, on peut juste afficher les informations
    // Dans une version plus avancée, on pourrait avoir un modal d'édition
    alert(`Modification du créneau:\nDate: ${slot.booking_date}\nHeure: ${slot.booking_time}\nType: ${slot.service_type}\nCapacité: ${slot.max_capacity}`);
}

// Actualiser le calendrier (sans recharger tous les créneaux)
async function refreshCalendar(forceRefresh = false) {
    console.log('🔄 Actualisation du calendrier...');
    
    // Ne recharger que si nécessaire (forceRefresh) ou si le cache est vide ou invalide
    const cacheValid = adminState.slotsCache.data.length > 0 && 
                       adminState.slotsCache.timestamp && 
                       (Date.now() - adminState.slotsCache.timestamp) < adminState.slotsCache.maxAge;
    
    if (forceRefresh || !cacheValid) {
        adminState.slots = await loadAllSlots(forceRefresh);
    } else {
        adminState.slots = adminState.slotsCache.data;
    }
    
    // S'assurer que slots est toujours un tableau
    if (!Array.isArray(adminState.slots)) {
        adminState.slots = [];
    }
    
    adminState.bookings = await loadAllBookings();
    
    // Régénérer le calendrier (même si vide)
    generateCalendar();
    
    console.log('✅ Calendrier actualisé');
}

// Navigation du calendrier
function previousMonth() {
    adminState.currentDate.setMonth(adminState.currentDate.getMonth() - 1);
    generateCalendar();
}

function nextMonth() {
    adminState.currentDate.setMonth(adminState.currentDate.getMonth() + 1);
    generateCalendar();
}

// Initialiser l'authentification
async function initializeAuth() {
    if (!adminState.supabase) return;
    
    try {
        const { data: { session }, error } = await adminState.supabase.auth.getSession();
        
        if (error) {
            console.error('Erreur session:', error);
            return;
        }
        
        if (session) {
            adminState.currentUser = session.user;
            adminState.isLoggedIn = true;
            
            // Vérifier si l'utilisateur est admin
            const userRole = await loadUserRole(session.user.id);
            if (userRole !== 'admin') {
                alert('Accès refusé. Cette page est réservée aux administrateurs.');
                window.location.href = 'index.html';
                return;
            }
            
            // Charger les données et générer le calendrier (forcer le refresh au démarrage)
            await refreshCalendar(true);
        } else {
            adminState.isLoggedIn = false;
            window.location.href = 'connexion.html';
        }
        
        // Écouter les changements d'authentification
        adminState.supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                adminState.currentUser = session.user;
                adminState.isLoggedIn = true;
                refreshCalendar(false);
            } else {
                adminState.currentUser = null;
                adminState.isLoggedIn = false;
                window.location.href = 'connexion.html';
            }
        });
        
    } catch (error) {
        console.error('Erreur initialisation auth:', error);
    }
}

// Fonction de déconnexion globale
window.logout = async function() {
    if (!adminState.supabase) return;
    
    try {
        const { error } = await adminState.supabase.auth.signOut();
        if (error) {
            console.error('Erreur déconnexion:', error);
            return;
        }
        
        adminState.currentUser = null;
        adminState.isLoggedIn = false;
        
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Erreur déconnexion:', error);
    }
};

// Fonctions de validation visuelle
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        const formField = field.closest('.form-field');
        if (formField) {
            formField.classList.add('error');
            
            // Supprimer l'ancien message d'erreur s'il existe
            const existingError = formField.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
            
            // Ajouter le nouveau message d'erreur
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            formField.appendChild(errorDiv);
        }
    }
}

function clearValidationErrors() {
    const formFields = document.querySelectorAll('.form-field');
    formFields.forEach(field => {
        field.classList.remove('error');
        const errorMessage = field.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    });
}

// Fonction pour changer de vue
function switchView(viewType) {
    console.log('🔄 Changement de vue vers:', viewType);
    
    // Vider la sélection des créneaux lors du changement de vue
    adminState.selectedSlots = [];
    updateBulkDeleteButtons();
    
    // Masquer toutes les vues
    const todayView = document.getElementById('today-view');
    const listView = document.getElementById('list-view');
    const bookingsView = document.getElementById('bookings-view');
    const statsView = document.getElementById('stats-view');
    const patientsView = document.getElementById('patients-view');
    
    if (todayView) todayView.classList.add('hidden');
    if (listView) listView.classList.add('hidden');
    if (bookingsView) bookingsView.classList.add('hidden');
    if (statsView) statsView.classList.add('hidden');
    if (patientsView) patientsView.classList.add('hidden');
    
    // Désactiver tous les boutons
    document.querySelectorAll('.view-toggle').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-300');
        btn.classList.remove('bg-primary', 'text-white', 'border-primary');
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
        case 'today':
            if (todayView) todayView.classList.remove('hidden');
            displayToday();
            break;
        case 'list':
            if (listView) listView.classList.remove('hidden');
            displaySlotsList();
            break;
        case 'bookings':
            if (bookingsView) bookingsView.classList.remove('hidden');
            displayBookingsList();
            break;
        case 'stats':
            if (statsView) statsView.classList.remove('hidden');
            displayStats();
            break;
        case 'patients':
            if (patientsView) patientsView.classList.remove('hidden');
            displayPatients();
            break;
    }
}

// Afficher la vue "Aujourd'hui" avec le prochain créneau
async function displayToday(forceReload = false) {
    const todayContent = document.getElementById('today-content');
    if (!todayContent) return;
    
    console.log('📅 Affichage de la vue Aujourd\'hui');
    
    const now = new Date();
    const todayStr = formatDateForInput(now);
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM
    
    // Utiliser le cache si disponible et pas de force reload
    let slots;
    if (!forceReload && adminState.slotsCache.data.length > 0 && adminState.slotsCache.timestamp && 
        (Date.now() - adminState.slotsCache.timestamp) < adminState.slotsCache.maxAge) {
        // Filtrer les créneaux du cache pour les 30 prochains jours
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + 30);
        const futureStr = formatDateForInput(futureDate);
        slots = adminState.slotsCache.data.filter(s => s.booking_date >= todayStr && s.booking_date <= futureStr);
        console.log('📦 Utilisation du cache pour la vue Aujourd\'hui');
    } else {
        // Charger uniquement 1 mois de créneaux (standard industrie)
        const futureDate = new Date(now);
        futureDate.setMonth(now.getMonth() + 1);
        const futureStr = formatDateForInput(futureDate);
        
        const { data: slotsData, error } = await adminState.supabase
            .from('booking_slots')
            .select('*')
            .gte('booking_date', todayStr)
            .lte('booking_date', futureStr)
            .order('booking_date', { ascending: true })
            .order('booking_time', { ascending: true })
            .limit(100);
        
        if (error) {
            console.error('Erreur chargement créneaux:', error);
            todayContent.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des créneaux</div>';
            return;
        }
        
        slots = slotsData;
    }
    
    if (!slots || slots.length === 0) {
        todayContent.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">Aucun créneau à venir</h3>
                <p class="text-gray-600 mb-6">Il n'y a pas de créneaux programmés pour le moment.</p>
                <button onclick="showAddSlotModal()" class="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-full transition-all shadow-lg">
                    <i class="fas fa-plus mr-2"></i>Ajouter un créneau
                </button>
            </div>
        `;
        return;
    }
    
    // Trouver le prochain créneau (le premier qui n'est pas encore passé)
    let nextSlot = null;
    for (const slot of slots) {
        const slotDate = slot.booking_date;
        const slotTime = slot.booking_time.substring(0, 5);
        
        if (slotDate > todayStr || (slotDate === todayStr && slotTime >= currentTime)) {
            nextSlot = slot;
            break;
        }
    }
    
    if (!nextSlot) {
        todayContent.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-calendar-check text-6xl text-green-300 mb-4"></i>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">Tous les créneaux d'aujourd'hui sont passés</h3>
                <p class="text-gray-600 mb-6">Le prochain créneau est prévu pour demain ou plus tard.</p>
            </div>
        `;
        return;
    }
    
    // Charger les réservations pour ce créneau
    // Les réservations sont liées par booking_date, booking_time et service_type (pas booking_slot_id)
    const { data: bookingsData, error: bookingsError } = await adminState.supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', nextSlot.booking_date)
        .eq('booking_time', nextSlot.booking_time)
        .eq('service_type', nextSlot.service_type)
        .eq('status', 'confirmed');
    
    if (bookingsError) {
        console.error('Erreur chargement réservations:', bookingsError);
    }
    
    console.log('📋 Réservations brutes chargées:', bookingsData);
    
    let bookings = [];
    
    // Si on a des réservations, charger les profils séparément
    if (bookingsData && bookingsData.length > 0) {
        const userIds = [...new Set(bookingsData.map(b => b.user_id))];
        console.log('👥 IDs utilisateurs à charger:', userIds);
        
        const { data: profilesData, error: profilesError } = await adminState.supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', userIds);
        
        if (profilesError) {
            console.error('Erreur chargement profils:', profilesError);
        }
        
        console.log('👤 Profils chargés:', profilesData);
        
        // Fusionner les données
        bookings = bookingsData.map(booking => {
            const profile = profilesData?.find(p => p.id === booking.user_id) || null;
            return {
                ...booking,
                profiles: profile
            };
        });
    }
    
    console.log('📋 Réservations finales avec profils:', bookings);
    
    const bookingsList = bookings || [];
    // Utiliser le nombre réel de réservations au lieu de current_bookings
    const actualBookings = bookingsList.length;
    const slotDate = new Date(nextSlot.booking_date);
    const dayName = slotDate.toLocaleDateString('fr-FR', { weekday: 'long' });
    const formattedDate = slotDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const slotTime = nextSlot.booking_time.substring(0, 5);
    const typeName = nextSlot.service_type === 'coaching_individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
    const isFull = actualBookings >= nextSlot.max_capacity;
    const availableSpots = nextSlot.max_capacity - actualBookings;
    
    let html = `
        <div class="mb-6">
            <h2 class="text-3xl font-bold text-gray-800 mb-2">Prochain créneau</h2>
            <p class="text-gray-600">Informations détaillées sur le prochain créneau à venir</p>
        </div>
        
        <div class="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-8 mb-6 border-2 border-primary/20">
            <div class="flex items-start justify-between mb-6">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <i class="fas fa-calendar-alt text-3xl text-primary"></i>
                        <div>
                            <h3 class="text-2xl font-bold text-gray-800">${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${formattedDate}</h3>
                            <p class="text-gray-600">${slotDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 mt-4">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-clock text-xl text-primary"></i>
                            <span class="text-xl font-semibold text-gray-800">${slotTime}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i class="fas fa-users text-xl text-secondary"></i>
                            <span class="text-lg font-medium text-gray-700">${typeName}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="inline-block px-4 py-2 rounded-full ${isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} font-semibold mb-2">
                        ${isFull ? 'Complet' : `${availableSpots} place${availableSpots > 1 ? 's' : ''} disponible${availableSpots > 1 ? 's' : ''}`}
                    </div>
                    <div class="text-sm text-gray-600">
                        ${actualBookings}/${nextSlot.max_capacity} réservé${actualBookings > 1 ? 's' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (bookingsList.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Participants (${bookingsList.length})</h3>
                <div class="space-y-3">
        `;
        
        for (const booking of bookingsList) {
            console.log('📋 Réservation:', booking);
            // profiles peut être un objet ou null
            const profile = booking.profiles || null;
            console.log('👤 Profil:', profile);
            
            let userName = 'Utilisateur inconnu';
            if (profile) {
                if (profile.first_name && profile.last_name) {
                    userName = `${profile.first_name} ${profile.last_name}`;
                } else if (profile.email) {
                    userName = profile.email;
                }
            } else if (booking.user_id) {
                // Si pas de profil, essayer de charger depuis l'email de l'utilisateur
                userName = booking.user_id;
            }
            
            const userId = booking.user_id;
            const userEmail = profile?.email || booking.user_id;
            
            html += `
                <div class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-transparent hover:border-primary/30 transition-all group">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 cursor-pointer hover:bg-primary/10 active:bg-primary/20 rounded-lg p-1.5 sm:p-2 -m-1.5 sm:-m-2" onclick="showPatientDetails('${userId}'); event.stopPropagation();">
                            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 group-hover:scale-110 transition-transform">
                                ${userName.charAt(0).toUpperCase()}
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="font-medium text-gray-800 text-sm sm:text-base truncate group-hover:text-primary transition-colors">${userName}</p>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400 text-xs group-hover:text-primary group-hover:translate-x-1 transition-all"></i>
                        </div>
                        <button onclick="cancelParticipantBooking('${booking.id}', '${nextSlot.id}'); event.stopPropagation();" 
                                class="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors flex-shrink-0" 
                                title="Annuler la réservation">
                            <i class="fas fa-times mr-1"></i><span class="hidden sm:inline">Annuler</span>
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Ajouter le menu déroulant pour ajouter un participant (vue Aujourd'hui)
        html += `
            <div class="mt-6 pt-6 border-t border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3">Ajouter un participant</h4>
                <div class="flex gap-3">
                    <select id="add-participant-today-${nextSlot.id}" class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">Sélectionner un utilisateur...</option>
                    </select>
                    <button onclick="addParticipantToSlot('${nextSlot.id}', '${nextSlot.booking_date}', '${nextSlot.booking_time}', '${nextSlot.service_type}', ${nextSlot.max_capacity}, ${actualBookings})" 
                            class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md transition-colors font-medium">
                        <i class="fas fa-plus mr-2"></i>Ajouter
                    </button>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="bg-gray-50 rounded-lg p-6 text-center">
                <i class="fas fa-user-slash text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-600">Aucune réservation pour ce créneau</p>
                <p class="text-xs text-gray-500 mt-2">Créneau ID: ${nextSlot.id}</p>
            </div>
        `;
        
        // Ajouter le menu déroulant même s'il n'y a pas de réservations
        html += `
            <div class="mt-6 pt-6 border-t border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3">Ajouter un participant</h4>
                <div class="flex gap-3">
                    <select id="add-participant-today-${nextSlot.id}" class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">Sélectionner un utilisateur...</option>
                    </select>
                    <button onclick="addParticipantToSlot('${nextSlot.id}', '${nextSlot.booking_date}', '${nextSlot.booking_time}', '${nextSlot.service_type}', ${nextSlot.max_capacity}, ${actualBookings})" 
                            class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md transition-colors font-medium">
                        <i class="fas fa-plus mr-2"></i>Ajouter
                    </button>
                </div>
            </div>
        `;
    }
    
    // Afficher les autres créneaux du jour si c'est aujourd'hui
    if (nextSlot.booking_date === todayStr) {
        const todaySlots = slots.filter(s => s.booking_date === todayStr && s.id !== nextSlot.id);
        if (todaySlots.length > 0) {
            // Charger les réservations pour tous les créneaux d'aujourd'hui
            // Construire les conditions pour chaque créneau (date, time, service_type)
            const todaySlotKeys = todaySlots.map(s => ({
                date: s.booking_date,
                time: s.booking_time,
                service_type: s.service_type,
                slot_id: s.id
            }));
            
            // Charger toutes les réservations d'aujourd'hui
            const { data: bookingsDataToday, error: bookingsErrorToday } = await adminState.supabase
                .from('bookings')
                .select('*')
                .eq('booking_date', todayStr)
                .eq('status', 'confirmed');
            
            let allBookingsToday = [];
            if (bookingsDataToday && bookingsDataToday.length > 0) {
                const userIds = [...new Set(bookingsDataToday.map(b => b.user_id))];
                const { data: profilesDataToday } = await adminState.supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .in('id', userIds);
                
                allBookingsToday = bookingsDataToday.map(booking => {
                    const profile = profilesDataToday?.find(p => p.id === booking.user_id) || null;
                    return {
                        ...booking,
                        profiles: profile
                    };
                });
            }
            
            // Grouper les réservations par créneau (en utilisant date, time, service_type)
            const bookingsBySlot = {};
            if (allBookingsToday && allBookingsToday.length > 0) {
                todaySlotKeys.forEach(slotKey => {
                    const slotBookings = allBookingsToday.filter(booking => 
                        booking.booking_date === slotKey.date &&
                        booking.booking_time === slotKey.time &&
                        booking.service_type === slotKey.service_type
                    );
                    if (slotBookings.length > 0) {
                        bookingsBySlot[slotKey.slot_id] = slotBookings;
                    }
                });
            }
            
            html += `
                <div class="mt-8 pt-8 border-t">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Autres créneaux aujourd'hui</h3>
                    <div class="space-y-4">
            `;
            
            for (const slot of todaySlots) {
                const time = slot.booking_time.substring(0, 5);
                const type = slot.service_type === 'coaching_individuel' ? 'Individuel' : 'Groupe';
                const slotBookings = bookingsBySlot[slot.id] || [];
                // Utiliser le nombre réel de réservations au lieu de current_bookings
                const actualBookings = slotBookings.length;
                const full = actualBookings >= slot.max_capacity;
                
                html += `
                    <div class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span class="font-semibold text-base sm:text-lg text-gray-800">${time}</span>
                                <span class="text-xs sm:text-sm text-gray-600">${type}</span>
                            </div>
                            <span class="text-xs px-2 py-1 rounded-full ${full ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} self-start sm:self-auto">${full ? 'Complet' : 'Disponible'}</span>
                        </div>
                        <div class="text-xs sm:text-sm text-gray-500 mb-3">${actualBookings}/${slot.max_capacity} places</div>
                `;
                
                if (slotBookings.length > 0) {
                    html += `
                        <div class="mt-3 pt-3 border-t border-gray-300">
                            <p class="text-xs sm:text-sm font-medium text-gray-700 mb-2">Participants (${slotBookings.length})</p>
                            <div class="space-y-1.5 sm:space-y-2">
                    `;
                    
                    for (const booking of slotBookings) {
                        const profile = booking.profiles || {};
                        const userName = profile.first_name && profile.last_name 
                            ? `${profile.first_name} ${profile.last_name}`
                            : profile.email || booking.user_id || 'Utilisateur inconnu';
                        const userId = booking.user_id;
                        
                        html += `
                            <div class="flex items-center gap-2 sm:gap-3 text-sm">
                                <div class="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:bg-primary/10 active:bg-primary/20 p-2 sm:p-2.5 rounded-lg transition-all border border-transparent hover:border-primary/30 group" onclick="showPatientDetails('${userId}'); event.stopPropagation();">
                                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                                        ${userName.charAt(0).toUpperCase()}
                                    </div>
                                    <span class="text-gray-700 flex-1 font-medium group-hover:text-primary transition-colors">${userName}</span>
                                    <i class="fas fa-chevron-right text-gray-400 text-xs group-hover:text-primary group-hover:translate-x-1 transition-all"></i>
                                </div>
                                <button onclick="cancelParticipantBooking('${booking.id}', '${slot.id}'); event.stopPropagation();" 
                                        class="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors flex-shrink-0" 
                                        title="Annuler la réservation">
                                    <i class="fas fa-times mr-1"></i><span class="hidden sm:inline">Annuler</span>
                                </button>
                            </div>
                        `;
                    }
                    
                    html += `
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="mt-3 pt-3 border-t border-gray-300">
                            <p class="text-sm text-gray-500">Aucune réservation</p>
                        </div>
                    `;
                }
                
                html += `
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
    }
    
    todayContent.innerHTML = html;
    
    // Remplir le menu déroulant pour la vue Aujourd'hui
    if (nextSlot) {
        const selectElement = document.getElementById(`add-participant-today-${nextSlot.id}`);
        if (selectElement) {
            console.log('✅ Select trouvé pour remplissage:', selectElement.id);
            // Charger tous les utilisateurs
            const allUsers = await loadAllUsersForDropdown();
            console.log('👥 Utilisateurs chargés pour menu déroulant:', allUsers.length);
            
            // Vider le select
            selectElement.innerHTML = '<option value="">Sélectionner un utilisateur...</option>';
            
            // Ajouter les utilisateurs
            allUsers.forEach(user => {
                const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Utilisateur inconnu';
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = userName;
                selectElement.appendChild(option);
            });
            
            console.log('✅ Menu déroulant rempli avec', selectElement.options.length, 'options');
        } else {
            console.error('❌ Select non trouvé pour nextSlot.id:', nextSlot.id);
        }
    } else {
        console.warn('⚠️ nextSlot est null ou undefined');
    }
}

// Afficher la liste des créneaux
async function displaySlotsList(forceReload = false) {
    const slotsList = document.getElementById('slots-list');
    if (!slotsList) return;
    
    console.log('📋 Affichage de la liste des créneaux');
    
    // Charger uniquement 1 mois initialement (standard industrie)
    // Utiliser le cache si disponible et pas de force reload
    let slots = forceReload ? await loadFutureSlots(1, false) : 
                  (adminState.slotsCache.data.length > 0 && adminState.slotsCache.timestamp && 
                   (Date.now() - adminState.slotsCache.timestamp) < adminState.slotsCache.maxAge) ?
                  adminState.slotsCache.data : await loadFutureSlots(1, false);
    
    if (!slots || slots.length === 0) {
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun créneau créé</div>';
        return;
    }
    
    // Filtrer les créneaux passés (date passée OU date d'aujourd'hui mais heure passée)
    const now = new Date();
    const todayStr = formatDateForInput(now);
    const currentTime = now.toTimeString().substring(0, 5); // Format HH:MM
    
    slots = slots.filter(slot => {
        const slotDate = slot.booking_date;
        const slotTime = slot.booking_time.substring(0, 5); // Format HH:MM
        
        // Si la date est dans le futur, garder le créneau
        if (slotDate > todayStr) {
            return true;
        }
        
        // Si la date est aujourd'hui, vérifier que l'heure n'est pas passée
        if (slotDate === todayStr) {
            return slotTime >= currentTime;
        }
        
        // Sinon, c'est une date passée, exclure
        return false;
    });
    
    if (slots.length === 0) {
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun créneau futur disponible</div>';
        return;
    }
    
    // Grouper les créneaux par date
    const slotsByDate = {};
    slots.forEach(slot => {
        const date = slot.booking_date;
        if (!slotsByDate[date]) {
            slotsByDate[date] = [];
        }
        slotsByDate[date].push(slot);
    });
    
    // Charger toutes les réservations pour tous les créneaux
    // Les réservations sont liées par booking_date, booking_time et service_type (pas booking_slot_id)
    // On charge toutes les réservations confirmées et on les groupe ensuite
    const { data: bookingsData, error: bookingsError } = await adminState.supabase
        .from('bookings')
        .select('*')
        .eq('status', 'confirmed');
    
    if (bookingsError) {
        console.error('Erreur chargement réservations liste:', bookingsError);
    }
    
    console.log('📋 Réservations brutes chargées pour liste:', bookingsData);
    
    let allBookings = [];
    
    // Si on a des réservations, charger les profils séparément
    if (bookingsData && bookingsData.length > 0) {
        const userIds = [...new Set(bookingsData.map(b => b.user_id))];
        console.log('👥 IDs utilisateurs à charger pour liste:', userIds);
        
        const { data: profilesData, error: profilesError } = await adminState.supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', userIds);
        
        if (profilesError) {
            console.error('Erreur chargement profils pour liste:', profilesError);
        }
        
        console.log('👤 Profils chargés pour liste:', profilesData);
        
        // Fusionner les données
        allBookings = bookingsData.map(booking => {
            const profile = profilesData?.find(p => p.id === booking.user_id) || null;
            return {
                ...booking,
                profiles: profile
            };
        });
    }
    
    console.log('📋 Toutes les réservations finales avec profils:', allBookings);
    
    // Grouper les réservations par créneau (en utilisant date, time, service_type)
    const bookingsBySlot = {};
    if (allBookings && allBookings.length > 0) {
        slots.forEach(slot => {
            const slotBookings = allBookings.filter(booking => 
                booking.booking_date === slot.booking_date &&
                booking.booking_time === slot.booking_time &&
                booking.service_type === slot.service_type
            );
            if (slotBookings.length > 0) {
                bookingsBySlot[slot.id] = slotBookings;
            }
        });
    }
    
    console.log('📋 Réservations groupées par créneau:', bookingsBySlot);
    console.log('📋 Nombre de créneaux avec réservations:', Object.keys(bookingsBySlot).length);
    
    // Vérifier pour chaque créneau s'il a des réservations
    slots.forEach(slot => {
        const slotBookings = bookingsBySlot[slot.id] || [];
        if (slot.current_bookings > 0 && slotBookings.length === 0) {
            console.warn(`⚠️ Créneau ${slot.id} a ${slot.current_bookings} réservations mais aucune trouvée dans bookingsBySlot`);
        }
    });
    
    // Initialiser expandedDays si nécessaire
    if (!adminState.expandedDays) {
        adminState.expandedDays = [];
    }
    
    // Charger tous les utilisateurs pour les menus déroulants
    const allUsers = await loadAllUsersForDropdown();
    
    // Générer le HTML avec en-tête de sélection
    let html = `
        <div class="mb-4 pb-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" class="slot-checkbox select-all-slots mr-2" onchange="selectAllVisibleSlots()">
                <span class="text-xs sm:text-sm font-medium text-gray-700">Tout sélectionner</span>
            </label>
            <button id="bulk-delete-list-btn" onclick="deleteMultipleSlots()" class="hidden bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-medium transition-colors text-xs sm:text-sm">
                <i class="fas fa-trash mr-1 sm:mr-2"></i><span class="hidden sm:inline">Supprimer sélection</span><span class="sm:hidden">Supprimer</span>
            </button>
        </div>
        <div class="space-y-2">
    `;
    
    Object.keys(slotsByDate).sort().forEach(date => {
        const dateSlots = slotsByDate[date];
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
        const dayNumber = dateObj.getDate();
        const isExpanded = adminState.expandedDays.includes(date);
        
        html += `
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div class="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                    <input type="checkbox" 
                           class="day-checkbox flex-shrink-0 mr-2" 
                           data-date="${date}"
                           onchange="toggleDaySelection('${date}')">
                    <button onclick="toggleAdminDaySlots('${date}')" 
                            class="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 hover:bg-gray-50 transition-colors text-left">
                        <div class="flex items-center gap-2 sm:gap-3">
                            <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-primary transition-transform text-sm sm:text-base"></i>
                            <h4 class="text-base sm:text-lg font-semibold text-gray-800">
                                ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNumber}
                            </h4>
                            <span class="text-xs sm:text-sm text-gray-500">${dateSlots.length} créneau${dateSlots.length > 1 ? 'x' : ''}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${(() => {
                                const slotsWithBookings = dateSlots.map(s => {
                                    const bookings = bookingsBySlot[s.id] || [];
                                    return { ...s, actualBookings: bookings.length };
                                });
                                const hasFull = slotsWithBookings.some(s => s.actualBookings >= s.max_capacity);
                                const hasAvailable = slotsWithBookings.some(s => s.actualBookings < s.max_capacity);
                                return (hasFull ? '<span class="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">Complet</span>' : '') +
                                       (hasAvailable ? '<span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Disponible</span>' : '');
                            })()}
                        </div>
                    </button>
                </div>
                <div id="day-slots-${date}" class="${isExpanded ? '' : 'hidden'} border-t border-gray-200">
                    <div class="p-3 sm:p-4 space-y-2 sm:space-y-3">
        `;
        
        dateSlots.sort((a, b) => a.booking_time.localeCompare(b.booking_time)).forEach(slot => {
            const time = slot.booking_time.substring(0, 5);
            const typeName = slot.service_type === 'coaching_individuel' ? 'Individuel' : 'Groupe';
            const slotBookings = bookingsBySlot[slot.id] || [];
            // Utiliser le nombre réel de réservations au lieu de current_bookings
            const actualBookings = slotBookings.length;
            const isFull = actualBookings >= slot.max_capacity;
            const statusClass = isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusText = isFull ? 'Complet' : 'Disponible';
            const isSelected = adminState.selectedSlots.includes(slot.id);
            
            html += `
                <div class="bg-gray-50 rounded-lg p-3 sm:p-4 border ${isSelected ? 'border-2 border-blue-500 bg-blue-50' : 'border-gray-200'}">
                    <div class="flex items-start gap-2 sm:gap-3">
                        <input type="checkbox" 
                               class="slot-checkbox mt-1 flex-shrink-0" 
                               value="${slot.id}" 
                               ${isSelected ? 'checked' : ''}
                               onchange="toggleSlotSelection('${slot.id}'); this.closest('.bg-gray-50').classList.toggle('border-2', this.checked); this.closest('.bg-gray-50').classList.toggle('border-blue-500', this.checked); this.closest('.bg-gray-50').classList.toggle('bg-blue-50', this.checked);">
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                                <span class="font-semibold text-base sm:text-lg text-gray-800">${time}</span>
                                <span class="text-xs px-2 py-1 rounded-full ${statusClass} self-start sm:self-auto">${statusText}</span>
                            </div>
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                                <span class="text-xs sm:text-sm text-gray-600">
                                    <i class="fas fa-users mr-1"></i>${typeName}
                                </span>
                                <span class="text-xs sm:text-sm text-gray-500">
                                    ${actualBookings}/${slot.max_capacity} places
                                </span>
                            </div>
            `;
            
            // Afficher les participants
            console.log(`📋 Créneau ${slot.id} - Réservations réelles: ${actualBookings}, Réservations trouvées:`, slotBookings);
            if (slotBookings.length > 0) {
                html += `
                            <div class="mt-3 pt-3 border-t border-gray-300">
                                <p class="text-xs sm:text-sm font-medium text-gray-700 mb-2">Participants (${slotBookings.length})</p>
                                <div class="space-y-1.5 sm:space-y-2">
                `;
                
                for (const booking of slotBookings) {
                    console.log('📋 Réservation dans liste:', booking);
                    const profile = booking.profiles || null;
                    console.log('👤 Profil dans liste:', profile);
                    
                    let userName = 'Utilisateur inconnu';
                    if (profile) {
                        if (profile.first_name && profile.last_name) {
                            userName = `${profile.first_name} ${profile.last_name}`;
                        } else if (profile.email) {
                            userName = profile.email;
                        }
                    } else if (booking.user_id) {
                        userName = booking.user_id;
                    }
                    
                    const userId = booking.user_id;
                    
                    html += `
                        <div class="flex items-center gap-2 sm:gap-3 text-sm p-2 sm:p-2.5 rounded-lg transition-all border border-transparent hover:border-primary/30 group">
                            <div class="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:bg-primary/10 active:bg-primary/20 rounded-lg p-1.5 sm:p-2 -m-1.5 sm:-m-2" onclick="showPatientDetails('${userId}'); event.stopPropagation();">
                                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                                    ${userName.charAt(0).toUpperCase()}
                                </div>
                                <span class="text-gray-700 flex-1 font-medium group-hover:text-primary transition-colors">${userName}</span>
                                <i class="fas fa-chevron-right text-gray-400 text-xs group-hover:text-primary group-hover:translate-x-1 transition-all"></i>
                            </div>
                            <button onclick="cancelParticipantBooking('${booking.id}', '${slot.id}'); event.stopPropagation();" 
                                    class="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors flex-shrink-0" 
                                    title="Annuler la réservation">
                                <i class="fas fa-times mr-1"></i><span class="hidden sm:inline">Annuler</span>
                            </button>
                        </div>
                    `;
                }
                
                html += `
                                </div>
                            </div>
                `;
            } else {
                html += `
                            <div class="mt-3 pt-3 border-t border-gray-300">
                                <p class="text-xs sm:text-sm text-gray-500 mb-2">Aucune réservation</p>
                            </div>
                `;
            }
            
            // Ajouter le menu déroulant pour ajouter un participant
            html += `
                            <div class="mt-3 pt-3 border-t border-gray-300">
                                <p class="text-xs sm:text-sm font-medium text-gray-700 mb-2">Ajouter un participant</p>
                                <div class="flex gap-2">
                                    <select id="add-participant-${slot.id}" class="flex-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option value="">Sélectionner un utilisateur...</option>
                                    </select>
                                    <button onclick="addParticipantToSlot('${slot.id}', '${slot.booking_date}', '${slot.booking_time}', '${slot.service_type}', ${slot.max_capacity}, ${actualBookings})" 
                                            class="text-xs sm:text-sm bg-primary hover:bg-primary/90 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors">
                                        <i class="fas fa-plus mr-1"></i><span class="hidden sm:inline">Ajouter</span>
                                    </button>
                                </div>
                            </div>
            `;
            
            html += `
                            <div class="flex gap-2 mt-3">
                                <button onclick="deleteSlot('${slot.id}')" class="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors">
                                    <i class="fas fa-trash mr-1"></i><span class="hidden sm:inline">Supprimer</span><span class="sm:hidden">Suppr.</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Ajouter le bouton "Voir plus" (standard industrie - pagination)
    const currentMonths = adminState.slotsCache.loadedMonths || 1;
    html += `
        <div class="text-center mt-6 pt-6 border-t border-gray-200">
            <button onclick="loadMoreSlots()" class="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg">
                <i class="fas fa-chevron-down mr-2"></i>Voir plus (${currentMonths + 1} mois)
            </button>
        </div>
    `;
    
    slotsList.innerHTML = html;
    
    // Remplir les menus déroulants avec les utilisateurs
    slots.forEach(slot => {
        const selectElement = document.getElementById(`add-participant-${slot.id}`);
        if (selectElement) {
            // Vider le select
            selectElement.innerHTML = '<option value="">Sélectionner un utilisateur...</option>';
            
            // Ajouter les utilisateurs
            allUsers.forEach(user => {
                const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Utilisateur inconnu';
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = userName;
                selectElement.appendChild(option);
            });
        }
    });
    
    // Mettre à jour le bouton de suppression en masse après le rendu
    setTimeout(() => updateBulkDeleteButtons(), 100);
}

// Toggle l'affichage des créneaux d'un jour (vue liste)
function toggleAdminDaySlots(dateStr) {
    if (!adminState.expandedDays) {
        adminState.expandedDays = [];
    }
    
    const index = adminState.expandedDays.indexOf(dateStr);
    if (index > -1) {
        adminState.expandedDays.splice(index, 1);
    } else {
        adminState.expandedDays.push(dateStr);
    }
    
    // Recharger la liste pour mettre à jour l'affichage
    displaySlotsList();
}

// Sélectionner/désélectionner tous les créneaux d'un jour
function toggleDaySelection(dateStr) {
    const checkbox = document.querySelector(`input.day-checkbox[data-date="${dateStr}"]`);
    if (!checkbox) return;
    
    const isChecked = checkbox.checked;
    const dayContainer = checkbox.closest('.bg-white');
    const slotCheckboxes = dayContainer.querySelectorAll('.slot-checkbox:not(.select-all-slots)');
    
    slotCheckboxes.forEach(slotCheckbox => {
        slotCheckbox.checked = isChecked;
        const slotId = slotCheckbox.value;
        if (isChecked) {
            if (!adminState.selectedSlots.includes(slotId)) {
                adminState.selectedSlots.push(slotId);
            }
        } else {
            const index = adminState.selectedSlots.indexOf(slotId);
            if (index > -1) {
                adminState.selectedSlots.splice(index, 1);
            }
        }
        // Mettre à jour visuellement
        const slotCard = slotCheckbox.closest('.bg-gray-50');
        if (slotCard) {
            slotCard.classList.toggle('border-2', isChecked);
            slotCard.classList.toggle('border-blue-500', isChecked);
            slotCard.classList.toggle('bg-blue-50', isChecked);
        }
    });
    
    updateBulkDeleteButtons();
}

// Charger tous les utilisateurs pour le menu déroulant
async function loadAllUsersForDropdown() {
    if (!adminState.supabase) return [];
    
    try {
        const { data: profiles, error } = await adminState.supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });
        
        if (error) {
            console.error('Erreur chargement utilisateurs:', error);
            return [];
        }
        
        return profiles || [];
    } catch (error) {
        console.error('Erreur chargement utilisateurs:', error);
        return [];
    }
}

// Ajouter un participant à un créneau
async function addParticipantToSlot(slotId, bookingDate, bookingTime, serviceType, maxCapacity, currentBookings) {
    const selectElement = document.getElementById(`add-participant-${slotId}`) || document.getElementById(`add-participant-today-${slotId}`);
    if (!selectElement) {
        console.error('❌ Select non trouvé pour slotId:', slotId);
        console.error('Tentative IDs:', `add-participant-${slotId}`, `add-participant-today-${slotId}`);
        alert('Erreur: élément de sélection non trouvé');
        return;
    }
    
    console.log('🔍 Select trouvé:', selectElement.id);
    console.log('📋 Valeur du select:', selectElement.value);
    console.log('📋 Options disponibles:', selectElement.options.length);
    console.log('📋 Index sélectionné:', selectElement.selectedIndex);
    
    // Afficher toutes les options pour debug
    console.log('📋 Détails des options:');
    for (let i = 0; i < selectElement.options.length; i++) {
        const opt = selectElement.options[i];
        console.log(`  Option ${i}: value="${opt.value}", text="${opt.text}", selected=${opt.selected}`);
    }
    
    const userId = selectElement.value;
    if (!userId || userId === '' || userId === null || userId === undefined) {
        console.error('❌ Aucun utilisateur sélectionné');
        console.error('❌ Valeur du select:', userId);
        console.error('❌ Index sélectionné:', selectElement.selectedIndex);
        alert('Veuillez sélectionner un utilisateur');
        return;
    }
    
    console.log('✅ Utilisateur sélectionné:', userId);
    
    // Vérifier si l'utilisateur a déjà une réservation pour ce créneau
    // Utiliser .maybeSingle() au lieu de .single() pour éviter l'erreur 406 quand il n'y a pas de résultat
    const { data: existingBooking, error: checkError } = await adminState.supabase
        .from('bookings')
        .select('id')
        .eq('user_id', userId)
        .eq('booking_date', bookingDate)
        .eq('booking_time', bookingTime)
        .eq('service_type', serviceType)
        .eq('status', 'confirmed')
        .maybeSingle();
    
    if (checkError) {
        console.error('Erreur vérification réservation existante:', checkError);
        // Ne pas bloquer si c'est juste une erreur de requête, continuer quand même
    }
    
    if (existingBooking) {
        alert('Cet utilisateur a déjà une réservation pour ce créneau');
        return;
    }
    
    // Afficher un warning si ça dépasse la limite
    const willExceed = currentBookings >= maxCapacity;
    if (willExceed) {
        const confirmMessage = `⚠️ Attention: Ce créneau a déjà ${currentBookings}/${maxCapacity} places occupées.\n\nVoulez-vous quand même ajouter ce participant ?`;
        if (!confirm(confirmMessage)) {
            return;
        }
    }
    
    try {
        // Créer la réservation
        const { data: booking, error: bookingError } = await adminState.supabase
            .from('bookings')
            .insert({
                user_id: userId,
                booking_date: bookingDate,
                booking_time: bookingTime,
                service_type: serviceType,
                status: 'confirmed'
            })
            .select()
            .single();
        
        if (bookingError) {
            console.error('Erreur création réservation:', bookingError);
            alert('Erreur lors de l\'ajout du participant: ' + bookingError.message);
            return;
        }
        
        // Mettre à jour le compteur du créneau
        const newCount = currentBookings + 1;
        const { error: updateError } = await adminState.supabase
            .from('booking_slots')
            .update({ current_bookings: newCount })
            .eq('id', slotId);
        
        if (updateError) {
            console.error('Erreur mise à jour compteur:', updateError);
            // Ne pas bloquer si le compteur ne peut pas être mis à jour
        }
        
        console.log('✅ Participant ajouté avec succès');
        
        // Réinitialiser le select
        selectElement.value = '';
        
        // Invalider le cache des créneaux pour forcer le rechargement
        adminState.slotsCache.timestamp = null;
        
        // Recharger uniquement la vue active (pas toutes les vues) avec force reload
        const listView = document.getElementById('list-view');
        const todayView = document.getElementById('today-view');
        const bookingsView = document.getElementById('bookings-view');
        
        if (listView && !listView.classList.contains('hidden')) {
            await displaySlotsList(true);
        }
        if (todayView && !todayView.classList.contains('hidden')) {
            await displayToday(true);
        }
        if (bookingsView && !bookingsView.classList.contains('hidden')) {
            await displayBookingsList();
        }
        
        alert(willExceed ? 
            '⚠️ Participant ajouté avec succès (créneau au-delà de la capacité normale)' : 
            '✅ Participant ajouté avec succès');
        
    } catch (error) {
        console.error('Erreur addParticipantToSlot:', error);
        alert('Erreur lors de l\'ajout du participant.');
    }
}

// Annuler la réservation d'un participant
async function cancelParticipantBooking(bookingId, slotId) {
    if (!confirm('Êtes-vous sûr de vouloir annuler la réservation de ce participant ?')) {
        return;
    }
    
    try {
        // Récupérer les informations de la réservation avant de la supprimer
        const { data: booking, error: fetchError } = await adminState.supabase
            .from('bookings')
            .select('booking_date, booking_time, service_type, status')
            .eq('id', bookingId)
            .single();
        
        if (fetchError) {
            console.error('Erreur récupération réservation:', fetchError);
            alert('Erreur lors de la récupération de la réservation.');
            return;
        }
        
        // Supprimer la réservation
        const { error } = await adminState.supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur annulation réservation:', error);
            alert('Erreur lors de l\'annulation de la réservation.');
            return;
        }
        
        console.log('✅ Réservation annulée:', bookingId);
        
        // Mettre à jour le compteur current_bookings dans booking_slots
        // Seulement si la réservation était confirmée
        if (booking && booking.status === 'confirmed') {
            // Si slotId est fourni, l'utiliser directement, sinon chercher le créneau
            if (slotId) {
                // Récupérer le créneau actuel
                const { data: slot, error: slotError } = await adminState.supabase
                    .from('booking_slots')
                    .select('current_bookings')
                    .eq('id', slotId)
                    .single();
                
                if (!slotError && slot) {
                    const newCount = Math.max((slot.current_bookings || 0) - 1, 0);
                    await adminState.supabase
                        .from('booking_slots')
                        .update({ current_bookings: newCount })
                        .eq('id', slotId);
                    console.log(`✅ Compteur mis à jour pour slot ${slotId}: ${slot.current_bookings} -> ${newCount}`);
                }
            } else if (booking) {
                // Chercher le créneau par date, heure et type de service
                const { data: slot, error: slotError } = await adminState.supabase
                    .from('booking_slots')
                    .select('id, current_bookings')
                    .eq('booking_date', booking.booking_date)
                    .eq('booking_time', booking.booking_time)
                    .eq('service_type', booking.service_type)
                    .maybeSingle();
                
                if (!slotError && slot) {
                    const newCount = Math.max((slot.current_bookings || 0) - 1, 0);
                    await adminState.supabase
                        .from('booking_slots')
                        .update({ current_bookings: newCount })
                        .eq('id', slot.id);
                    console.log(`✅ Compteur mis à jour pour slot ${slot.id}: ${slot.current_bookings} -> ${newCount}`);
                }
            }
        }
        
        // Invalider le cache des créneaux pour forcer le rechargement
        adminState.slotsCache.timestamp = null;
        
        // Recharger uniquement la vue active (pas toutes les vues) avec force reload
        const listView = document.getElementById('list-view');
        const todayView = document.getElementById('today-view');
        const bookingsView = document.getElementById('bookings-view');
        
        if (listView && !listView.classList.contains('hidden')) {
            await displaySlotsList(true);
        }
        if (todayView && !todayView.classList.contains('hidden')) {
            await displayToday(true);
        }
        if (bookingsView && !bookingsView.classList.contains('hidden')) {
            await displayBookingsList();
        }
        
        alert('Réservation annulée avec succès.');
        
    } catch (error) {
        console.error('Erreur cancelParticipantBooking:', error);
        alert('Erreur lors de l\'annulation de la réservation.');
    }
}

// Sélectionner/désélectionner tous les créneaux d'un jour
function toggleDaySelection(dateStr) {
    const checkbox = document.querySelector(`input.day-checkbox[data-date="${dateStr}"]`);
    if (!checkbox) return;
    
    const isChecked = checkbox.checked;
    const dayContainer = checkbox.closest('.bg-white');
    const slotCheckboxes = dayContainer.querySelectorAll('.slot-checkbox:not(.select-all-slots)');
    
    slotCheckboxes.forEach(slotCheckbox => {
        slotCheckbox.checked = isChecked;
        const slotId = slotCheckbox.value;
        if (isChecked) {
            if (!adminState.selectedSlots.includes(slotId)) {
                adminState.selectedSlots.push(slotId);
            }
        } else {
            const index = adminState.selectedSlots.indexOf(slotId);
            if (index > -1) {
                adminState.selectedSlots.splice(index, 1);
            }
        }
        // Mettre à jour visuellement
        const slotCard = slotCheckbox.closest('.bg-gray-50');
        if (slotCard) {
            slotCard.classList.toggle('border-2', isChecked);
            slotCard.classList.toggle('border-blue-500', isChecked);
            slotCard.classList.toggle('bg-blue-50', isChecked);
        }
    });
    
    updateBulkDeleteButtons();
}

// Annuler la réservation d'un participant
async function cancelParticipantBooking(bookingId, slotId) {
    if (!confirm('Êtes-vous sûr de vouloir annuler la réservation de ce participant ?')) {
        return;
    }
    
    try {
        // Récupérer les informations de la réservation avant de la supprimer
        const { data: booking, error: fetchError } = await adminState.supabase
            .from('bookings')
            .select('booking_date, booking_time, service_type, status')
            .eq('id', bookingId)
            .single();
        
        if (fetchError) {
            console.error('Erreur récupération réservation:', fetchError);
            alert('Erreur lors de la récupération de la réservation.');
            return;
        }
        
        // Supprimer la réservation
        const { error } = await adminState.supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur annulation réservation:', error);
            alert('Erreur lors de l\'annulation de la réservation.');
            return;
        }
        
        console.log('✅ Réservation annulée:', bookingId);
        
        // Mettre à jour le compteur current_bookings dans booking_slots
        // Seulement si la réservation était confirmée
        if (booking && booking.status === 'confirmed') {
            // Si slotId est fourni, l'utiliser directement, sinon chercher le créneau
            if (slotId) {
                // Récupérer le créneau actuel
                const { data: slot, error: slotError } = await adminState.supabase
                    .from('booking_slots')
                    .select('current_bookings')
                    .eq('id', slotId)
                    .single();
                
                if (!slotError && slot) {
                    const newCount = Math.max((slot.current_bookings || 0) - 1, 0);
                    await adminState.supabase
                        .from('booking_slots')
                        .update({ current_bookings: newCount })
                        .eq('id', slotId);
                    console.log(`✅ Compteur mis à jour pour slot ${slotId}: ${slot.current_bookings} -> ${newCount}`);
                }
            } else if (booking) {
                // Chercher le créneau par date, heure et type de service
                const { data: slot, error: slotError } = await adminState.supabase
                    .from('booking_slots')
                    .select('id, current_bookings')
                    .eq('booking_date', booking.booking_date)
                    .eq('booking_time', booking.booking_time)
                    .eq('service_type', booking.service_type)
                    .maybeSingle();
                
                if (!slotError && slot) {
                    const newCount = Math.max((slot.current_bookings || 0) - 1, 0);
                    await adminState.supabase
                        .from('booking_slots')
                        .update({ current_bookings: newCount })
                        .eq('id', slot.id);
                    console.log(`✅ Compteur mis à jour pour slot ${slot.id}: ${slot.current_bookings} -> ${newCount}`);
                }
            }
        }
        
        // Invalider le cache des créneaux pour forcer le rechargement
        adminState.slotsCache.timestamp = null;
        
        // Recharger uniquement la vue active (pas toutes les vues) avec force reload
        const listView = document.getElementById('list-view');
        const todayView = document.getElementById('today-view');
        const bookingsView = document.getElementById('bookings-view');
        
        if (listView && !listView.classList.contains('hidden')) {
            await displaySlotsList(true);
        }
        if (todayView && !todayView.classList.contains('hidden')) {
            await displayToday(true);
        }
        if (bookingsView && !bookingsView.classList.contains('hidden')) {
            await displayBookingsList();
        }
        
        alert('Réservation annulée avec succès.');
        
    } catch (error) {
        console.error('Erreur cancelParticipantBooking:', error);
        alert('Erreur lors de l\'annulation de la réservation.');
    }
}

// Récupérer les informations utilisateur
async function getUserInfo(userId) {
    try {
        // Essayer d'abord la table profiles si elle existe
        const { data: profile, error: profileError } = await adminState.supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', userId)
            .single();
        
        if (!profileError && profile) {
            console.log('✅ Profil trouvé:', profile);
            return profile;
        }
        
        console.log('⚠️ Pas de profil trouvé, erreur:', profileError);
        
        // Fallback: utiliser les métadonnées de l'utilisateur actuel si c'est le même
        const { data: { user } } = await adminState.supabase.auth.getUser();
        if (user && user.id === userId) {
            const metadata = user.user_metadata || {};
            if (metadata.first_name || metadata.last_name || metadata.email) {
                console.log('✅ Métadonnées utilisateur trouvées:', metadata);
                return {
                    first_name: metadata.first_name || '',
                    last_name: metadata.last_name || '',
                    email: metadata.email || user.email || ''
                };
            }
        }
        
        // Dernier fallback: retourner null
        console.log('⚠️ Aucune info utilisateur trouvée pour:', userId);
        return null;
    } catch (error) {
        console.error('Erreur récupération info utilisateur:', error);
        return null;
    }
}

// Afficher la liste des réservations
async function displayBookingsList() {
    const bookingsList = document.getElementById('bookings-list');
    if (!bookingsList) return;
    
    // Vérifier que Supabase est initialisé
    if (!adminState.supabase) {
        console.error('❌ Supabase non initialisé, tentative d\'initialisation...');
        const initialized = await initializeSupabase();
        if (!initialized) {
            bookingsList.innerHTML = '<div class="text-center text-red-500 py-8">Erreur: Impossible de se connecter à la base de données</div>';
            return;
        }
    }
    
    console.log('📋 Affichage de la liste des réservations');
    
    // Charger les réservations depuis la base de données
    const { data: bookings, error } = await adminState.supabase
        .from('bookings')
        .select('*')
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });
    
    if (error) {
        console.error('Erreur chargement réservations:', error);
        bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des réservations</div>';
        return;
    }
    
    console.log('📋 Réservations récupérées:', bookings);
    
    if (!bookings || bookings.length === 0) {
        console.log('📋 Aucune réservation trouvée');
        bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucune réservation</div>';
        return;
    }
    
    // Filtrer les réservations passées (date passée OU date d'aujourd'hui mais heure passée)
    const now = new Date();
    const todayStr = formatDateForInput(now);
    const currentTime = now.toTimeString().substring(0, 5); // Format HH:MM
    
    const futureBookings = bookings.filter(booking => {
        const bookingDate = booking.booking_date;
        const bookingTime = booking.booking_time.substring(0, 5); // Format HH:MM
        
        // Si la date est dans le futur, garder la réservation
        if (bookingDate > todayStr) {
            return true;
        }
        
        // Si la date est aujourd'hui, vérifier que l'heure n'est pas passée
        if (bookingDate === todayStr) {
            return bookingTime >= currentTime;
        }
        
        // Sinon, c'est une date passée, exclure
        return false;
    });
    
    if (futureBookings.length === 0) {
        bookingsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucune réservation future</div>';
        return;
    }
    
    // Générer le HTML
    let html = '<div class="space-y-3 sm:space-y-4">';
    
    // Récupérer les informations utilisateur pour chaque réservation
    for (const booking of futureBookings) {
        const userInfo = await getUserInfo(booking.user_id);
        
        const date = new Date(booking.booking_date);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const time = booking.booking_time.substring(0, 5);
        const typeName = booking.service_type === 'coaching_individuel' ? 'Individuel' : 'Groupe';
        
        let userName;
        if (userInfo && userInfo.first_name && userInfo.last_name) {
            userName = `${userInfo.first_name} ${userInfo.last_name}`;
        } else if (userInfo && userInfo.email) {
            userName = userInfo.email;
        } else if (userInfo && (userInfo.first_name || userInfo.last_name)) {
            userName = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim();
        } else {
            userName = `Utilisateur ${booking.user_id.substring(0, 8)}...`;
        }
        
        console.log('👤 Nom utilisateur généré:', userName, 'pour user_id:', booking.user_id);
        
        const statusClass = {
            'confirmed': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800',
            'completed': 'bg-blue-100 text-blue-800'
        }[booking.status] || 'bg-gray-100 text-gray-800';
        
        const statusText = {
            'confirmed': 'Confirmée',
            'cancelled': 'Annulée',
            'completed': 'Terminée'
        }[booking.status] || booking.status;
        
        // Ne pas afficher le bouton annuler si la réservation est déjà annulée
        const canCancel = booking.status === 'confirmed';
        
        html += `
            <div class="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
                <div class="flex items-start gap-3 sm:gap-4">
                    <div class="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:bg-primary/10 active:bg-primary/20 rounded-lg p-1.5 sm:p-2 -m-1.5 sm:-m-2 transition-all" onclick="showPatientDetails('${booking.user_id}'); event.stopPropagation();">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 hover:scale-110 transition-transform">
                            ${userName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-semibold text-gray-800 text-base sm:text-lg group-hover:text-primary transition-colors">${userName}</h3>
                            <p class="text-sm text-gray-600 mt-1">
                                <i class="fas fa-calendar mr-1"></i>${formattedDate}
                            </p>
                            <p class="text-sm text-gray-600">
                                <i class="fas fa-clock mr-1"></i>${time}
                            </p>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-xs sm:text-sm text-gray-600">
                                    <i class="fas fa-users mr-1"></i>${typeName}
                                </span>
                                <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                            </div>
                            ${booking.notes ? `<p class="text-xs sm:text-sm text-gray-500 mt-2"><i class="fas fa-sticky-note mr-1"></i>${booking.notes}</p>` : ''}
                        </div>
                        <i class="fas fa-chevron-right text-gray-400 text-xs hover:text-primary hover:translate-x-1 transition-all flex-shrink-0 mt-2"></i>
                    </div>
                    ${canCancel ? `
                        <button onclick="cancelParticipantBooking('${booking.id}', null); event.stopPropagation();" 
                                class="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors flex-shrink-0 self-start" 
                                title="Annuler la réservation">
                            <i class="fas fa-times mr-1"></i><span class="hidden sm:inline">Annuler</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    bookingsList.innerHTML = html;
}

// Afficher les statistiques
async function displayStats() {
    // Vérifier que Supabase est initialisé
    if (!adminState.supabase) {
        console.error('❌ Supabase non initialisé, tentative d\'initialisation...');
        const initialized = await initializeSupabase();
        if (!initialized) {
            console.error('❌ Impossible d\'initialiser Supabase pour les statistiques');
            return;
        }
    }
    
    console.log('📊 Affichage des statistiques');
    
    // Charger les données
    const { data: slots, error: slotsError } = await adminState.supabase
        .from('booking_slots')
        .select('*');
    
    const { data: bookings, error: bookingsError } = await adminState.supabase
        .from('bookings')
        .select('*');
    
    if (slotsError || bookingsError) {
        console.error('Erreur chargement données:', slotsError || bookingsError);
        return;
    }
    
    // Calculer les statistiques
    const totalSlots = slots ? slots.length : 0;
    const totalBookings = bookings ? bookings.length : 0;
    const totalCapacity = slots ? slots.reduce((sum, slot) => sum + slot.max_capacity, 0) : 0;
    const occupancyRate = totalCapacity > 0 ? Math.round((totalBookings / totalCapacity) * 100) : 0;
    
    // Mettre à jour les cartes de statistiques
    document.getElementById('total-slots').textContent = totalSlots;
    document.getElementById('total-bookings').textContent = totalBookings;
    document.getElementById('occupancy-rate').textContent = `${occupancyRate}%`;
    
    // Graphique des réservations par jour de la semaine
    const bookingsByDay = {};
    if (bookings) {
        bookings.forEach(booking => {
            const date = new Date(booking.booking_date);
            const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
            bookingsByDay[dayName] = (bookingsByDay[dayName] || 0) + 1;
        });
    }
    
    // Graphique des types de cours
    const courseTypes = {};
    if (bookings) {
        bookings.forEach(booking => {
            const typeName = booking.service_type === 'coaching_individuel' ? 'Individuel' : 'Groupe';
            courseTypes[typeName] = (courseTypes[typeName] || 0) + 1;
        });
    }
    
    // Créer des graphiques simples avec des barres CSS
    createSimpleChart('bookings-by-day-chart', bookingsByDay, 'Réservations');
    createSimpleChart('course-types-chart', courseTypes, 'Réservations');
}

// Créer un graphique simple avec des barres CSS
function createSimpleChart(containerId, data, label) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const maxValue = Math.max(...Object.values(data));
    let html = '<div class="space-y-3">';
    
    Object.entries(data).forEach(([key, value]) => {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        html += `
            <div class="flex items-center">
                <div class="w-20 text-sm text-gray-600">${key}</div>
                <div class="flex-1 mx-3">
                    <div class="bg-gray-200 rounded-full h-4">
                        <div class="bg-primary h-4 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="w-12 text-sm font-medium text-gray-800">${value}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Afficher la liste des utilisateurs
async function displayUsers() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    console.log('👥 Affichage de la liste des utilisateurs');
    
    // Récupérer les valeurs des filtres
    const roleFilter = document.getElementById('users-filter-role');
    const statusFilter = document.getElementById('users-filter-status');
    const selectedRole = roleFilter ? roleFilter.value : '';
    const selectedStatus = statusFilter ? statusFilter.value : '';
    
    console.log('🔍 Filtres appliqués:', { role: selectedRole, status: selectedStatus });
    
    try {
        // Récupérer tous les utilisateurs depuis la table profiles
        const { data: profiles, error: profilesError } = await adminState.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (profilesError) {
            console.error('Erreur chargement profils:', profilesError);
            usersList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des utilisateurs</div>';
            return;
        }
        
        console.log('👥 Profils récupérés:', profiles);
        console.log('👥 Rôles des utilisateurs:', profiles.map(p => ({ email: p.email, role: p.role })));
        
        if (!profiles || profiles.length === 0) {
            console.log('👥 Aucun utilisateur trouvé');
            usersList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun utilisateur</div>';
            return;
        }
        
        // Appliquer les filtres
        let filteredProfiles = profiles;
        
        if (selectedRole) {
            filteredProfiles = filteredProfiles.filter(p => p.role === selectedRole);
        }
        
        if (selectedStatus) {
            // Pour le statut "actif", on considère les utilisateurs avec une date de création récente
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            if (selectedStatus === 'active') {
                filteredProfiles = filteredProfiles.filter(p => new Date(p.created_at) > thirtyDaysAgo);
            } else if (selectedStatus === 'inactive') {
                filteredProfiles = filteredProfiles.filter(p => new Date(p.created_at) <= thirtyDaysAgo);
            }
        }
        
        console.log('👥 Profils filtrés:', filteredProfiles.length);
        
        // Récupérer les réservations pour calculer les statistiques
        const { data: bookings, error: bookingsError } = await adminState.supabase
            .from('bookings')
            .select('user_id')
            .eq('status', 'confirmed');
        
        if (bookingsError) {
            console.error('Erreur chargement réservations:', bookingsError);
        }
        
        // Calculer les statistiques (sur tous les profils, pas seulement les filtrés)
        const totalUsers = profiles.length;
        const activeUsers = profiles.filter(p => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(p.created_at) > thirtyDaysAgo;
        }).length;
        const adminUsers = profiles.filter(p => p.role === 'admin').length;
        const usersWithBookings = bookings ? new Set(bookings.map(b => b.user_id)).size : 0;
        
        // Mettre à jour les cartes de statistiques
        document.getElementById('total-users').textContent = totalUsers;
        document.getElementById('active-users').textContent = activeUsers;
        document.getElementById('admin-users').textContent = adminUsers;
        document.getElementById('users-with-bookings').textContent = usersWithBookings;
        
        // Générer le HTML pour chaque utilisateur filtré
        let html = '';
        for (const profile of filteredProfiles) {
            const userBookings = bookings ? bookings.filter(b => b.user_id === profile.id).length : 0;
            const createdAt = new Date(profile.created_at).toLocaleDateString('fr-FR');
            const roleClass = profile.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
            const roleText = profile.role === 'admin' ? 'Administrateur' : 'Utilisateur';
            
            const userName = profile.first_name && profile.last_name ? 
                `${profile.first_name} ${profile.last_name}` : 
                profile.email || `Utilisateur ${profile.id.substring(0, 8)}...`;
            
            html += `
                <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                                ${profile.first_name ? profile.first_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <h3 class="font-semibold text-gray-800">${userName}</h3>
                                <p class="text-sm text-gray-600">${profile.email || 'Email non disponible'}</p>
                            </div>
                        </div>
                        <span class="text-xs px-2 py-1 rounded-full ${roleClass}">${roleText}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">Inscrit le:</span>
                            <div class="font-medium">${createdAt}</div>
                        </div>
                        <div>
                            <span class="text-gray-500">Réservations:</span>
                            <div class="font-medium">${userBookings}</div>
                        </div>
                        <div>
                            <span class="text-gray-500">Dernière MAJ:</span>
                            <div class="font-medium">${new Date(profile.updated_at).toLocaleDateString('fr-FR')}</div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="editPatient('${profile.id}')" class="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded">
                                <i class="fas fa-edit mr-1"></i>Modifier
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            html = '<div class="text-center text-gray-500 py-8">Aucun utilisateur ne correspond aux filtres sélectionnés</div>';
        }
        
        usersList.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayUsers:', error);
        usersList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des utilisateurs</div>';
    }
}

// Changer le rôle d'un utilisateur
async function toggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    if (!confirm(`Êtes-vous sûr de vouloir changer le rôle de cet utilisateur en "${newRole}" ?`)) {
        return;
    }
    
    try {
        console.log('🔄 Tentative de changement de rôle:', { userId, currentRole, newRole });
        
        const { error } = await adminState.supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
        
        if (error) {
            console.error('❌ Erreur Supabase:', error);
            alert(`Erreur lors du changement de rôle: ${error.message}`);
            return;
        }
        
        console.log('✅ Rôle changé:', userId, 'vers', newRole);
        
        // Vérifier que la mise à jour a bien été effectuée
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde
        
        const { data: updatedProfile, error: checkError } = await adminState.supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
            
        if (checkError) {
            console.error('❌ Erreur vérification:', checkError);
        } else {
            console.log('🔍 Rôle vérifié en base:', updatedProfile.role);
        }
        
        alert(`Rôle changé en "${newRole}" avec succès !`);
        
        // Recharger la liste des patients et utilisateurs
        await displayPatients();
        
    } catch (error) {
        console.error('Erreur toggleUserRole:', error);
        alert('Erreur lors du changement de rôle.');
    }
}

// Exposer les fonctions globalement
window.showAddSlotModal = showAddSlotModal;
window.closeAddSlotModal = closeAddSlotModal;
window.showDayDetails = showDayDetails;
window.closeDayDetailsModal = closeDayDetailsModal;
window.addSlotForDate = addSlotForDate;
window.toggleUserRole = toggleUserRole;
window.deleteSlot = deleteSlot;
window.editSlot = editSlot;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.switchView = switchView;
window.toggleSlotSelection = toggleSlotSelection;
window.deleteMultipleSlots = deleteMultipleSlots;
window.selectAllVisibleSlots = selectAllVisibleSlots;

// Initialisation de la page
async function initializeAdminPage() {
    // Initialiser Supabase
    const supabaseReady = await initializeSupabase();
    if (!supabaseReady) {
        console.error('Impossible d\'initialiser Supabase');
        return;
    }
    
    // Configurer le formulaire
    const addSlotForm = document.getElementById('add-slot-form');
    if (addSlotForm) {
        addSlotForm.addEventListener('submit', handleAddSlotSubmit);
    }
    
    // Configurer le formulaire patient
    const patientForm = document.getElementById('patient-form');
    if (patientForm) {
        patientForm.addEventListener('submit', handlePatientFormSubmit);
    }
    
    // Configurer la recherche et les filtres de patients
    const patientsSearch = document.getElementById('patients-search');
    if (patientsSearch) {
        patientsSearch.addEventListener('input', async () => {
            await displayPatients();
        });
    }
    
    const patientsRoleFilter = document.getElementById('patients-filter-role');
    if (patientsRoleFilter) {
        patientsRoleFilter.addEventListener('change', async () => {
            console.log('🔄 Filtre rôle changé:', patientsRoleFilter.value);
            await displayPatients();
        });
    }
    
    const patientsStatusFilter = document.getElementById('patients-filter-status');
    if (patientsStatusFilter) {
        patientsStatusFilter.addEventListener('change', async () => {
            console.log('🔄 Filtre statut changé:', patientsStatusFilter.value);
            await displayPatients();
        });
    }
    
    // Initialiser l'authentification
    await initializeAuth();
    
    // Initialiser la vue par défaut (calendrier)
    switchView('today');
}

// Fonction pour gérer la création de créneaux (simple ou récurrent)
async function handleSlotCreation(date, timeType, time, startTime, endTime, selectedTypes, groupCapacity, notes, isRecurring, recurringDays, recurringWeeks) {
    if (isRecurring) {
        await createRecurringSlots(date, timeType, time, startTime, endTime, selectedTypes, recurringDays, recurringWeeks, groupCapacity, notes);
    } else {
        await createSingleSlot(date, timeType, time, startTime, endTime, selectedTypes, groupCapacity, notes);
    }
}

// Fonction pour créer un seul créneau (logique existante)
async function createSingleSlot(date, timeType, time, startTime, endTime, selectedTypes, groupCapacity, notes) {
    const slotsToCreate = [];
    const existingSlots = [];
    
    // Déterminer les heures à créer selon le type
    let hoursToCreate = [];
    
    if (timeType === 'single') {
        // Créneau unique : utiliser l'heure sélectionnée
        hoursToCreate = [time];
    } else if (timeType === 'range') {
        // Plage d'horaires : générer toutes les heures entre startTime et endTime
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
            hoursToCreate.push(`${hour.toString().padStart(2, '0')}:00`);
        }
    }
    
    console.log('🕐 Heures à créer:', hoursToCreate);
    
    // Pour chaque heure et chaque type de cours
    for (const hour of hoursToCreate) {
        for (const serviceType of selectedTypes) {
            const maxCapacity = serviceType === 'coaching_groupe' ? groupCapacity : 1;
            
            // Vérifier si le créneau existe déjà
            const { data: existingSlot, error: fetchError } = await adminState.supabase
                .from('booking_slots')
                .select('id, service_type')
                .eq('booking_date', date)
                .eq('booking_time', hour)
                .eq('service_type', serviceType)
                .single();
            
            if (existingSlot) {
                existingSlots.push(`${date} ${hour} (${serviceType})`);
                console.log(`⚠️ Créneau existant: ${date} ${hour} ${serviceType}`);
            } else {
                slotsToCreate.push({
                    service_type: serviceType,
                    booking_date: date,
                    booking_time: hour,
                    max_capacity: maxCapacity,
                    current_bookings: 0
                });
                console.log(`✅ Nouveau créneau: ${date} ${hour} ${serviceType} (${maxCapacity} places)`);
            }
        }
    }
    
    // Créer les nouveaux créneaux
    if (slotsToCreate.length > 0) {
        const { data, error } = await adminState.supabase
            .from('booking_slots')
            .insert(slotsToCreate)
            .select();
        
        if (error) {
            console.error('Erreur création créneaux:', error);
            throw error;
        }
        
        console.log(`✅ ${slotsToCreate.length} créneau(x) créé(s) avec succès`);
    }
    
    // Afficher un résumé
    let message = `✅ Création terminée !\n`;
    if (slotsToCreate.length > 0) {
        message += `📅 ${slotsToCreate.length} nouveau(x) créneau(x) créé(s)\n`;
    }
    if (existingSlots.length > 0) {
        message += `⚠️ ${existingSlots.length} créneau(x) existant(s) ignoré(s)`;
    }
    
    alert(message);
}

// Fonction pour créer des créneaux récurrents (optimisée avec batch creation)
async function createRecurringSlots(startDate, timeType, time, startTime, endTime, selectedTypes, recurringDays, weeks, groupCapacity, notes) {
    // Limiter à 4 mois maximum (16 semaines) - standard industrie
    const isIndefinite = weeks === null || weeks === undefined;
    const maxWeeks = isIndefinite ? 16 : Math.min(weeks, 16); // 4 mois = 16 semaines maximum
    
    console.log('🔄 Création de créneaux récurrents (mode batch):', {
        startDate,
        timeType,
        time,
        startTime,
        endTime,
        selectedTypes,
        recurringDays,
        weeks: isIndefinite ? 'indéfiniment (4 mois max)' : `${weeks} semaines (max 4 mois)`,
        groupCapacity
    });
    
    const dayMap = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 0
    };
    
    const targetDays = recurringDays.map(day => dayMap[day]);
    const startDateObj = new Date(startDate);
    
    // Déterminer les heures à créer selon le type
    let hoursToCreate = [];
    
    if (timeType === 'single') {
        // Créneau unique : utiliser l'heure sélectionnée
        hoursToCreate = [time];
    } else if (timeType === 'range') {
        // Plage d'horaires : générer toutes les heures entre startTime et endTime
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
            hoursToCreate.push(`${hour.toString().padStart(2, '0')}:00`);
        }
    }
    
    console.log('📅 Jours cibles:', targetDays);
    console.log('📅 Date de départ:', startDateObj);
    console.log('🕐 Heures à créer:', hoursToCreate);
    console.log('📅 Mode:', isIndefinite ? 'indéfiniment (4 mois max)' : `${weeks} semaines (max 4 mois)`);
    
    // ÉTAPE 1 : Calculer TOUTES les dates/heures à créer en une seule fois
    const slotsToCreate = [];
    const endDate = new Date(startDateObj);
    endDate.setDate(endDate.getDate() + (maxWeeks * 7));
    
    for (let week = 0; week < maxWeeks; week++) {
        for (const dayOfWeek of targetDays) {
            // Calculer la date pour ce jour de la semaine
            const daysUntilTarget = (dayOfWeek - startDateObj.getDay() + 7) % 7;
            const targetDate = new Date(startDateObj);
            targetDate.setDate(startDateObj.getDate() + daysUntilTarget + (week * 7));
            
            // Ne pas créer de créneaux dans le passé
            if (targetDate < new Date()) {
                continue;
            }
            
            const dateStr = targetDate.toISOString().split('T')[0];
            
            // Pour chaque heure et chaque type de service
            for (const hour of hoursToCreate) {
                for (const serviceType of selectedTypes) {
                    const maxCapacity = serviceType === 'coaching_groupe' ? groupCapacity : 1;
                    slotsToCreate.push({
                        service_type: serviceType,
                        booking_date: dateStr,
                        booking_time: hour,
                        max_capacity: maxCapacity,
                        current_bookings: 0
                    });
                }
            }
        }
    }
    
    console.log(`📦 ${slotsToCreate.length} créneaux à créer au total`);
    
    if (slotsToCreate.length === 0) {
        alert('⚠️ Aucun créneau à créer (toutes les dates sont dans le passé)');
        return;
    }
    
    // STANDARD INDUSTRIE : Insérer directement sans vérification préalable
    // La base de données gère les doublons via contrainte d'unicité (2x plus rapide)
    // ÉTAPE 2 : Créer TOUS les créneaux en une seule requête batch (instantané)
    console.log('🚀 Création batch instantanée de tous les créneaux (une seule requête)...');
    
    let createdCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    try {
        // Essayer d'insérer tous les créneaux en une seule requête (instantané)
        const { data, error } = await adminState.supabase
            .from('booking_slots')
            .insert(slotsToCreate)
            .select();
        
        if (error) {
            console.error('Erreur création batch:', error);
            
            // Si erreur de contrainte d'unicité, certains créneaux existent déjà
            if (error.code === '23505') {
                // Insérer par chunks pour identifier ceux qui existent déjà
                console.log('⚠️ Certains créneaux existent déjà, insertion par chunks...');
                const chunkSize = 2000;
                const chunks = [];
                
                for (let i = 0; i < slotsToCreate.length; i += chunkSize) {
                    chunks.push(slotsToCreate.slice(i, i + chunkSize));
                }
                
                // Exécuter tous les chunks EN PARALLÈLE
                const promises = chunks.map((chunk, index) => 
                    adminState.supabase
                        .from('booking_slots')
                        .insert(chunk)
                        .select()
                        .then(({ data, error }) => {
                            if (error) {
                                // Si erreur d'unicité, certains existent déjà - on ignore
                                if (error.code === '23505') {
                                    skippedCount += chunk.length;
                                    return { success: false, count: 0, skipped: chunk.length };
                                }
                                console.error(`Erreur chunk ${index + 1}:`, error);
                                errorCount += chunk.length;
                                return { success: false, count: 0, skipped: 0 };
                            }
                            console.log(`✅ Chunk ${index + 1}: ${data.length} créneaux créés`);
                            return { success: true, count: data.length, skipped: 0 };
                        })
                        .catch(err => {
                            if (err.code === '23505') {
                                skippedCount += chunk.length;
                                return { success: false, count: 0, skipped: chunk.length };
                            }
                            console.error(`Erreur fatale chunk ${index + 1}:`, err);
                            errorCount += chunk.length;
                            return { success: false, count: 0, skipped: 0 };
                        })
                );
                
                const results = await Promise.all(promises);
                createdCount = results.reduce((sum, r) => sum + r.count, 0);
                skippedCount = results.reduce((sum, r) => sum + r.skipped, 0);
            } else if ((error.message && (error.message.includes('too large') || error.message.includes('exceeds') || error.message.includes('size'))) || slotsToCreate.length > 5000) {
                // Si erreur de taille, diviser en chunks et faire en parallèle
                console.log('⚠️ Trop de créneaux, division en chunks parallèles...');
                const chunkSize = 2000;
                const chunks = [];
                
                for (let i = 0; i < slotsToCreate.length; i += chunkSize) {
                    chunks.push(slotsToCreate.slice(i, i + chunkSize));
                }
                
                // Exécuter tous les chunks EN PARALLÈLE
                const promises = chunks.map((chunk, index) => 
                    adminState.supabase
                        .from('booking_slots')
                        .insert(chunk)
                        .select()
                        .then(({ data, error }) => {
                            if (error) {
                                if (error.code === '23505') {
                                    skippedCount += chunk.length;
                                    return { success: false, count: 0, skipped: chunk.length };
                                }
                                console.error(`Erreur chunk ${index + 1}:`, error);
                                errorCount += chunk.length;
                                return { success: false, count: 0, skipped: 0 };
                            }
                            console.log(`✅ Chunk ${index + 1}: ${data.length} créneaux créés`);
                            return { success: true, count: data.length, skipped: 0 };
                        })
                        .catch(err => {
                            if (err.code === '23505') {
                                skippedCount += chunk.length;
                                return { success: false, count: 0, skipped: chunk.length };
                            }
                            console.error(`Erreur fatale chunk ${index + 1}:`, err);
                            errorCount += chunk.length;
                            return { success: false, count: 0, skipped: 0 };
                        })
                );
                
                const results = await Promise.all(promises);
                createdCount = results.reduce((sum, r) => sum + r.count, 0);
                skippedCount = results.reduce((sum, r) => sum + r.skipped, 0);
            } else {
                throw error;
            }
        } else {
            // Succès : tous les créneaux créés en une seule requête (instantané !)
            createdCount = data.length;
            console.log(`✅ ${createdCount} créneaux créés instantanément en une seule requête !`);
        }
    } catch (error) {
        console.error('Erreur fatale lors de la création batch:', error);
        errorCount = slotsToCreate.length;
    }
    
    // Afficher le résumé
    let message = `✅ Création récurrente terminée !\n`;
    message += `📅 ${createdCount} créneau(x) créé(s)\n`;
    if (skippedCount > 0) {
        message += `⚠️ ${skippedCount} créneau(x) existant(s) ignoré(s)\n`;
    }
    if (errorCount > 0) {
        message += `❌ ${errorCount} créneau(x) en erreur`;
    }
    
    alert(message);
    console.log('✅ Création récurrente terminée');
}

// ============================================
// GESTION DES PATIENTS
// ============================================

// Afficher la liste des patients et utilisateurs (fusionnée)
async function displayPatients() {
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;
    
    console.log('🏥👥 Affichage de la liste des patients et utilisateurs');
    
    // Récupérer les valeurs des filtres
    const roleFilter = document.getElementById('patients-filter-role');
    const statusFilter = document.getElementById('patients-filter-status');
    const searchInput = document.getElementById('patients-search');
    const selectedRole = roleFilter ? roleFilter.value : '';
    const selectedStatus = statusFilter ? statusFilter.value : '';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    console.log('🔍 Filtres appliqués:', { role: selectedRole, status: selectedStatus, search: searchTerm });
    
    // Vérifier que Supabase est initialisé
    if (!adminState.supabase) {
        console.error('❌ Supabase non initialisé, tentative d\'initialisation...');
        const initialized = await initializeSupabase();
        if (!initialized) {
            patientsList.innerHTML = '<div class="text-center text-red-500 py-8">Erreur: Impossible de se connecter à la base de données</div>';
            return;
        }
    }
    
    try {
        // Récupérer tous les profils (tous les utilisateurs)
        const { data: profiles, error } = await adminState.supabase
            .from('profiles')
            .select('*')
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });
        
        if (error) {
            console.error('❌ Erreur chargement profils:', error);
            console.error('Détails erreur:', JSON.stringify(error, null, 2));
            patientsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement: ' + error.message + '</div>';
            return;
        }
        
        console.log('✅ Profils récupérés:', profiles?.length || 0);
        
        if (!profiles || profiles.length === 0) {
            patientsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun utilisateur enregistré</div>';
            // Mettre à jour les statistiques à 0
            document.getElementById('total-users').textContent = '0';
            document.getElementById('active-users').textContent = '0';
            document.getElementById('admin-users').textContent = '0';
            document.getElementById('users-with-bookings').textContent = '0';
            return;
        }
        
        // Récupérer les réservations pour calculer les statistiques
        const { data: bookings, error: bookingsError } = await adminState.supabase
            .from('bookings')
            .select('user_id')
            .eq('status', 'confirmed');
        
        if (bookingsError) {
            console.error('Erreur chargement réservations:', bookingsError);
        }
        
        // Calculer les statistiques (sur tous les profils)
        const totalUsers = profiles.length;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeUsers = profiles.filter(p => new Date(p.created_at) > thirtyDaysAgo).length;
        const adminUsers = profiles.filter(p => p.role === 'admin').length;
        const usersWithBookings = bookings ? new Set(bookings.map(b => b.user_id)).size : 0;
        
        // Mettre à jour les cartes de statistiques
        document.getElementById('total-users').textContent = totalUsers;
        document.getElementById('active-users').textContent = activeUsers;
        document.getElementById('admin-users').textContent = adminUsers;
        document.getElementById('users-with-bookings').textContent = usersWithBookings;
        
        // Appliquer les filtres
        let filteredProfiles = profiles;
        
        // Filtre par recherche
        if (searchTerm) {
            filteredProfiles = filteredProfiles.filter(p => 
                `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(searchTerm) ||
                p.email?.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtre par rôle
        if (selectedRole) {
            filteredProfiles = filteredProfiles.filter(p => p.role === selectedRole);
        }
        
        // Filtre par statut
        if (selectedStatus) {
            if (selectedStatus === 'active') {
                filteredProfiles = filteredProfiles.filter(p => new Date(p.created_at) > thirtyDaysAgo);
            } else if (selectedStatus === 'inactive') {
                filteredProfiles = filteredProfiles.filter(p => new Date(p.created_at) <= thirtyDaysAgo);
            }
        }
        
        console.log('👥 Profils filtrés:', filteredProfiles.length);
        
        // Vérifier s'il y a des résultats après filtrage
        if (filteredProfiles.length === 0) {
            patientsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun résultat ne correspond aux filtres sélectionnés</div>';
            return;
        }
        
        // Générer le HTML
        let html = '';
        filteredProfiles.forEach(profile => {
            const pathologies = profile.pathologies && Array.isArray(profile.pathologies) 
                ? profile.pathologies.join(', ') 
                : '';
            
            const userName = profile.first_name && profile.last_name ? 
                `${profile.first_name} ${profile.last_name}` : 
                profile.email || `Utilisateur ${profile.id.substring(0, 8)}...`;
            
            const roleClass = profile.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
            const roleText = profile.role === 'admin' ? 'Admin' : 'User';
            
            const userBookings = bookings ? bookings.filter(b => b.user_id === profile.id).length : 0;
            
            html += `
                <div class="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200 hover:shadow-md transition-shadow">
                    <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-2 mb-2">
                                <h3 class="text-base md:text-lg font-semibold text-gray-800 break-words">
                                    ${userName}
                                </h3>
                                <span class="text-xs px-2 py-1 rounded-full ${roleClass} whitespace-nowrap">${roleText}</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                                <div class="break-words"><i class="fas fa-envelope mr-1 md:mr-2"></i><span class="break-all">${profile.email || 'N/A'}</span></div>
                                ${profile.phone ? `<div class="break-words"><i class="fas fa-phone mr-1 md:mr-2"></i>${profile.phone}</div>` : ''}
                                ${profile.date_of_birth ? `<div><i class="fas fa-birthday-cake mr-1 md:mr-2"></i>${new Date(profile.date_of_birth).toLocaleDateString('fr-FR')}</div>` : ''}
                                ${profile.gender ? `<div><i class="fas fa-venus-mars mr-1 md:mr-2"></i>${profile.gender}</div>` : ''}
                                <div><i class="fas fa-calendar-check mr-1 md:mr-2"></i>${userBookings} réservation(s)</div>
                            </div>
                            ${pathologies ? `<div class="mt-2 text-xs md:text-sm break-words"><strong>Pathologies:</strong> ${pathologies}</div>` : ''}
                            ${profile.contraindications ? `<div class="mt-2 text-xs md:text-sm text-red-600 break-words"><strong>Contre-indications:</strong> ${profile.contraindications}</div>` : ''}
                        </div>
                        <div class="flex flex-row md:flex-col gap-2 md:ml-4 flex-shrink-0">
                            <button onclick="showPatientDetails('${profile.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 md:px-4 py-2 rounded-md text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none">
                                <i class="fas fa-eye mr-1"></i><span class="hidden sm:inline">Voir détails</span><span class="sm:hidden">Détails</span>
                            </button>
                            <button onclick="editPatient('${profile.id}')" class="bg-gray-500 hover:bg-gray-600 text-white px-3 md:px-4 py-2 rounded-md text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none">
                                <i class="fas fa-edit mr-1"></i>Modifier
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        patientsList.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayPatients:', error);
        patientsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement: ' + error.message + '</div>';
    }
}


// Fermer le modal de patient
function closePatientModal() {
    const modal = document.getElementById('patient-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Modifier un patient existant
async function editPatient(patientId) {
    try {
        const { data: patient, error } = await adminState.supabase
            .from('profiles')
            .select('*')
            .eq('id', patientId)
            .single();
        
        if (error || !patient) {
            alert('Erreur lors du chargement du patient');
            return;
        }
        
        const modal = document.getElementById('patient-modal');
        const title = document.getElementById('patient-modal-title');
        const form = document.getElementById('patient-form');
        
        if (!modal || !title || !form) return;
        
        title.textContent = `Modifier le patient: ${patient.first_name} ${patient.last_name}`;
        
        // Remplir le formulaire
        document.getElementById('patient-first-name').value = patient.first_name || '';
        document.getElementById('patient-last-name').value = patient.last_name || '';
        document.getElementById('patient-email').value = patient.email || '';
        document.getElementById('patient-phone').value = patient.phone || '';
        document.getElementById('patient-date-of-birth').value = patient.date_of_birth || '';
        document.getElementById('patient-gender').value = patient.gender || '';
        document.getElementById('patient-role').value = patient.role || 'user';
        
        // Pathologies
        if (patient.pathologies && Array.isArray(patient.pathologies)) {
            document.getElementById('patient-pathologies').value = patient.pathologies.join(', ');
        }
        
        document.getElementById('patient-contraindications').value = patient.contraindications || '';
        document.getElementById('patient-emergency-name').value = patient.emergency_contact_name || '';
        document.getElementById('patient-emergency-phone').value = patient.emergency_contact_phone || '';
        
        // Stocker l'ID du patient
        form.dataset.patientId = patientId;
        
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Erreur editPatient:', error);
        alert('Erreur lors du chargement du patient');
    }
}

// Gérer la soumission du formulaire patient (édition uniquement)
async function handlePatientFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const patientId = form.dataset.patientId;
    
    if (!patientId) {
        alert('Erreur: ID patient manquant');
        return;
    }
    
    // Récupérer les données
    const firstName = document.getElementById('patient-first-name').value;
    const lastName = document.getElementById('patient-last-name').value;
    const email = document.getElementById('patient-email').value;
    const phone = document.getElementById('patient-phone').value;
    const dateOfBirth = document.getElementById('patient-date-of-birth').value;
    const gender = document.getElementById('patient-gender').value;
    const role = document.getElementById('patient-role').value;
    const pathologiesText = document.getElementById('patient-pathologies').value;
    const contraindications = document.getElementById('patient-contraindications').value;
    const emergencyName = document.getElementById('patient-emergency-name').value;
    const emergencyPhone = document.getElementById('patient-emergency-phone').value;
    
    // Convertir pathologies en tableau
    const pathologies = pathologiesText ? pathologiesText.split(',').map(p => p.trim()).filter(p => p) : null;
    
    try {
        // Mise à jour du profil patient
        const updateData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone || null,
            date_of_birth: dateOfBirth || null,
            gender: gender || null,
            role: role || 'user',
            pathologies: pathologies && pathologies.length > 0 ? pathologies : null,
            contraindications: contraindications || null,
            emergency_contact_name: emergencyName || null,
            emergency_contact_phone: emergencyPhone || null,
            patient_status: 'active',
            updated_at: new Date().toISOString()
        };
        
        const { error } = await adminState.supabase
            .from('profiles')
            .update(updateData)
            .eq('id', patientId);
        
        if (error) throw error;
        
        alert('Fiche patient mise à jour avec succès !');
        closePatientModal();
        await displayPatients();
        
    } catch (error) {
        console.error('Erreur handlePatientFormSubmit:', error);
        alert('Erreur: ' + error.message);
    }
}

// Afficher les détails d'un patient avec commentaires
async function showPatientDetails(patientId) {
    const modal = document.getElementById('patient-details-modal');
    const title = document.getElementById('patient-details-title');
    const content = document.getElementById('patient-details-content');
    
    if (!modal || !title || !content) return;
    
    try {
        // Charger le patient
        const { data: patient, error: patientError } = await adminState.supabase
            .from('profiles')
            .select('*')
            .eq('id', patientId)
            .single();
        
        if (patientError || !patient) {
            alert('Erreur lors du chargement du patient');
            return;
        }
        
        // Charger les commentaires
        const { data: comments, error: commentsError } = await adminState.supabase
            .from('patient_comments')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
        
        if (commentsError) {
            console.error('Erreur chargement commentaires:', commentsError);
        }
        
        // Récupérer l'utilisateur actuel pour vérifier les permissions
        const { data: { user: currentUser } } = await adminState.supabase.auth.getUser();
        
        title.textContent = `Détails: ${patient.first_name} ${patient.last_name}`;
        
        const pathologies = patient.pathologies && Array.isArray(patient.pathologies) 
            ? patient.pathologies.join(', ') 
            : 'Aucune';
        
        // Générer le contenu
        content.innerHTML = `
            <div class="space-y-6">
                <!-- Informations patient -->
                <div class="bg-gray-50 rounded-lg p-6">
                    <h4 class="text-lg font-semibold mb-4">Informations du patient</h4>
                    <div class="grid md:grid-cols-2 gap-4 text-sm">
                        <div><strong>Email:</strong> ${patient.email || 'N/A'}</div>
                        <div><strong>Téléphone:</strong> ${patient.phone || 'N/A'}</div>
                        <div><strong>Date de naissance:</strong> ${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('fr-FR') : 'N/A'}</div>
                        <div><strong>Genre:</strong> ${patient.gender || 'N/A'}</div>
                        <div class="md:col-span-2"><strong>Pathologies:</strong> ${pathologies}</div>
                        ${patient.contraindications ? `<div class="md:col-span-2 text-red-600"><strong>Contre-indications:</strong> ${patient.contraindications}</div>` : ''}
                        ${patient.emergency_contact_name ? `<div><strong>Contact d'urgence:</strong> ${patient.emergency_contact_name}</div>` : ''}
                        ${patient.emergency_contact_phone ? `<div><strong>Tél. urgence:</strong> ${patient.emergency_contact_phone}</div>` : ''}
                    </div>
                </div>
                
                <!-- Section commentaires -->
                <div class="border-t pt-6">
                    <h4 class="text-lg font-semibold mb-4">Commentaires</h4>
                    
                    <!-- Formulaire d'ajout de commentaire -->
                    <div class="bg-blue-50 rounded-lg p-4 mb-4">
                        <form id="add-comment-form" onsubmit="event.preventDefault(); addPatientComment('${patientId}');">
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Type de commentaire</label>
                                <select id="comment-type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="general">Général</option>
                                    <option value="medical">Médical</option>
                                    <option value="administrative">Administratif</option>
                                    <option value="follow_up">Suivi</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Commentaire</label>
                                <textarea id="comment-text" rows="3" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
                            </div>
                            <button type="submit" class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md">
                                <i class="fas fa-plus mr-2"></i>Ajouter un commentaire
                            </button>
                        </form>
                    </div>
                    
                    <!-- Liste des commentaires -->
                    <div id="comments-list" class="space-y-3">
                        ${comments && comments.length > 0 
                            ? comments.map(comment => {
                                // Vérifier si l'utilisateur actuel est l'auteur du commentaire
                                const isAuthor = currentUser && comment.created_by === currentUser.id;
                                const wasUpdated = comment.updated_at && comment.updated_at !== comment.created_at;
                                
                                return `
                                <div class="bg-white border border-gray-200 rounded-lg p-4" id="comment-${comment.id}">
                                    <div class="flex justify-between items-start mb-2">
                                        <div>
                                            <div class="font-semibold">${comment.created_by_name}</div>
                                            <div class="text-xs text-gray-500">
                                                ${new Date(comment.created_at).toLocaleDateString('fr-FR')} à ${new Date(comment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                ${wasUpdated ? '<span class="ml-2 text-gray-400">(modifié)</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">${getCommentTypeLabel(comment.comment_type)}</span>
                                            ${isAuthor ? `
                                                <button onclick="editPatientComment('${comment.id}', '${patientId}')" class="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50" title="Modifier">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button onclick="deletePatientComment('${comment.id}', '${patientId}')" class="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50" title="Supprimer">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-700 mt-2" id="comment-text-${comment.id}">${comment.comment}</div>
                                </div>
                            `;
                            }).join('')
                            : '<p class="text-gray-500 text-center py-4">Aucun commentaire pour le moment</p>'
                        }
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Erreur showPatientDetails:', error);
        alert('Erreur lors du chargement des détails du patient');
    }
}

// Fonction utilitaire pour les labels des types de commentaires
function getCommentTypeLabel(type) {
    const labels = {
        'general': 'Général',
        'medical': 'Médical',
        'administrative': 'Administratif',
        'follow_up': 'Suivi'
    };
    return labels[type] || type;
}

// Fermer le modal de détails patient
function closePatientDetailsModal() {
    const modal = document.getElementById('patient-details-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Ajouter un commentaire pour un patient
async function addPatientComment(patientId) {
    const commentText = document.getElementById('comment-text').value;
    const commentType = document.getElementById('comment-type').value;
    
    if (!commentText.trim()) {
        alert('Veuillez saisir un commentaire');
        return;
    }
    
    try {
        const { data: { user } } = await adminState.supabase.auth.getUser();
        
        // Récupérer le nom de l'utilisateur actuel
        const { data: currentProfile } = await adminState.supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();
        
        const userName = currentProfile 
            ? `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || user.email
            : user.email;
        
        // Créer le commentaire
        const { error } = await adminState.supabase
            .from('patient_comments')
            .insert({
                patient_id: patientId,
                comment: commentText.trim(),
                comment_type: commentType,
                created_by: user.id,
                created_by_name: userName
            });
        
        if (error) throw error;
        
        // Réafficher les détails du patient (pour mettre à jour les commentaires)
        await showPatientDetails(patientId);
        
        // Réinitialiser le formulaire
        document.getElementById('comment-text').value = '';
        
    } catch (error) {
        console.error('Erreur addPatientComment:', error);
        alert('Erreur lors de l\'ajout du commentaire: ' + error.message);
    }
}

// Modifier un commentaire patient
async function editPatientComment(commentId, patientId) {
    try {
        // Récupérer le commentaire
        const { data: comment, error: commentError } = await adminState.supabase
            .from('patient_comments')
            .select('*')
            .eq('id', commentId)
            .single();
        
        if (commentError || !comment) {
            alert('Erreur lors du chargement du commentaire');
            return;
        }
        
        // Vérifier que l'utilisateur est l'auteur
        const { data: { user } } = await adminState.supabase.auth.getUser();
        if (!user || comment.created_by !== user.id) {
            alert('Vous n\'êtes pas autorisé à modifier ce commentaire');
            return;
        }
        
        // Remplacer l'affichage du commentaire par un formulaire d'édition
        const commentDiv = document.getElementById(`comment-${commentId}`);
        if (!commentDiv) return;
        
        const commentText = commentDiv.querySelector(`#comment-text-${commentId}`);
        const editForm = `
            <div class="edit-comment-form mt-2 border-t pt-3">
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Type de commentaire</label>
                    <select id="edit-comment-type-${commentId}" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="general" ${comment.comment_type === 'general' ? 'selected' : ''}>Général</option>
                        <option value="medical" ${comment.comment_type === 'medical' ? 'selected' : ''}>Médical</option>
                        <option value="administrative" ${comment.comment_type === 'administrative' ? 'selected' : ''}>Administratif</option>
                        <option value="follow_up" ${comment.comment_type === 'follow_up' ? 'selected' : ''}>Suivi</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Commentaire</label>
                    <textarea id="edit-comment-text-${commentId}" rows="3" required class="w-full px-3 py-2 border border-gray-300 rounded-md">${comment.comment}</textarea>
                </div>
                <div class="flex gap-2">
                    <button onclick="savePatientComment('${commentId}', '${patientId}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm">
                        <i class="fas fa-check mr-1"></i>Enregistrer
                    </button>
                    <button onclick="cancelEditComment('${commentId}', '${patientId}')" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm">
                        <i class="fas fa-times mr-1"></i>Annuler
                    </button>
                </div>
            </div>
        `;
        
        commentText.style.display = 'none';
        commentText.insertAdjacentHTML('afterend', editForm);
        
    } catch (error) {
        console.error('Erreur editPatientComment:', error);
        alert('Erreur lors de la modification du commentaire: ' + error.message);
    }
}

// Annuler l'édition d'un commentaire
function cancelEditComment(commentId, patientId) {
    const commentDiv = document.getElementById(`comment-${commentId}`);
    if (!commentDiv) return;
    
    const editForm = commentDiv.querySelector('.edit-comment-form');
    const commentText = commentDiv.querySelector(`#comment-text-${commentId}`);
    
    if (editForm) {
        editForm.remove();
    }
    
    if (commentText) {
        commentText.style.display = 'block';
    }
}

// Enregistrer un commentaire modifié
async function savePatientComment(commentId, patientId) {
    try {
        const commentText = document.getElementById(`edit-comment-text-${commentId}`).value;
        const commentType = document.getElementById(`edit-comment-type-${commentId}`).value;
        
        if (!commentText.trim()) {
            alert('Veuillez saisir un commentaire');
            return;
        }
        
        // Vérifier que l'utilisateur est l'auteur
        const { data: comment, error: commentError } = await adminState.supabase
            .from('patient_comments')
            .select('created_by')
            .eq('id', commentId)
            .single();
        
        if (commentError || !comment) {
            alert('Erreur lors de la vérification du commentaire');
            return;
        }
        
        const { data: { user } } = await adminState.supabase.auth.getUser();
        if (!user || comment.created_by !== user.id) {
            alert('Vous n\'êtes pas autorisé à modifier ce commentaire');
            return;
        }
        
        // Mettre à jour le commentaire
        const { error: updateError } = await adminState.supabase
            .from('patient_comments')
            .update({
                comment: commentText.trim(),
                comment_type: commentType,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId);
        
        if (updateError) throw updateError;
        
        // Réafficher les détails du patient (pour mettre à jour les commentaires)
        await showPatientDetails(patientId);
        
    } catch (error) {
        console.error('Erreur savePatientComment:', error);
        alert('Erreur lors de l\'enregistrement du commentaire: ' + error.message);
    }
}

// Supprimer un commentaire patient
async function deletePatientComment(commentId, patientId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
        return;
    }
    
    try {
        // Vérifier que l'utilisateur est l'auteur
        const { data: comment, error: commentError } = await adminState.supabase
            .from('patient_comments')
            .select('created_by')
            .eq('id', commentId)
            .single();
        
        if (commentError || !comment) {
            alert('Erreur lors de la vérification du commentaire');
            return;
        }
        
        const { data: { user } } = await adminState.supabase.auth.getUser();
        if (!user || comment.created_by !== user.id) {
            alert('Vous n\'êtes pas autorisé à supprimer ce commentaire');
            return;
        }
        
        // Supprimer le commentaire
        const { error: deleteError } = await adminState.supabase
            .from('patient_comments')
            .delete()
            .eq('id', commentId);
        
        if (deleteError) throw deleteError;
        
        // Réafficher les détails du patient (pour mettre à jour les commentaires)
        await showPatientDetails(patientId);
        
    } catch (error) {
        console.error('Erreur deletePatientComment:', error);
        alert('Erreur lors de la suppression du commentaire: ' + error.message);
    }
}

// Exposer les fonctions globalement
window.closePatientModal = closePatientModal;
window.editPatient = editPatient;
window.showPatientDetails = showPatientDetails;
window.closePatientDetailsModal = closePatientDetailsModal;
window.addPatientComment = addPatientComment;
window.editPatientComment = editPatientComment;
window.cancelEditComment = cancelEditComment;
window.savePatientComment = savePatientComment;
window.deletePatientComment = deletePatientComment;
window.refreshCalendar = refreshCalendar;
window.displaySlotsList = displaySlotsList;
window.displayToday = displayToday;

// Fonction pour charger plus de créneaux (pagination - standard industrie)
async function loadMoreSlots() {
    const currentMonths = adminState.slotsCache.loadedMonths || 1;
    const newMonths = currentMonths + 1;
    
    console.log(`📅 Chargement de ${newMonths} mois de créneaux...`);
    
    // Charger le mois supplémentaire (append = true pour ajouter aux existants)
    await loadFutureSlots(newMonths, true);
    
    // Recharger l'affichage
    await displaySlotsList();
}

window.loadMoreSlots = loadMoreSlots;
window.toggleAdminDaySlots = toggleAdminDaySlots;
window.cancelParticipantBooking = cancelParticipantBooking;
window.addParticipantToSlot = addParticipantToSlot;
window.toggleDaySelection = toggleDaySelection;

// Initialiser la page quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initializeAdminPage);
