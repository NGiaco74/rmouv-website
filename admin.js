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
    selectedDate: null
};

// Initialisation Supabase
async function initializeSupabase() {
    try {
        await waitForSupabase();
        adminState.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.log('Supabase initialisé pour l\'administration');
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

// Charger tous les créneaux
async function loadAllSlots() {
    if (!adminState.supabase) return [];
    
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
        
        console.log('📅 Créneaux trouvés:', slots);
        return slots || [];
    } catch (error) {
        console.error('Erreur chargement créneaux:', error);
        return [];
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
                ${daySlots.map(slot => {
                    const slotBookings = dayBookings.filter(booking => 
                        booking.booking_time === slot.booking_time &&
                        booking.service_type === slot.service_type
                    );
                    
                    const serviceName = slot.service_type === 'coaching_individuel' ? 'Coaching Individuel' : 'Coaching Groupe';
                    const maxCapacity = slot.max_capacity;
                    const currentBookings = slotBookings.length;
                    
                    return `
                        <div class="time-slot ${currentBookings >= maxCapacity ? 'booked' : ''}">
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
                    `;
                }).join('')}
                
                <div class="mt-6 pt-4 border-t">
                    <button onclick="addSlotForDate('${formatDateForInput(date)}')" class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium transition-colors">
                        <i class="fas fa-plus mr-2"></i>Ajouter un autre créneau
                    </button>
                </div>
            </div>
        `;
    }
    
    modal.classList.add('show');
}

// Fermer le modal des détails du jour
function closeDayDetailsModal() {
    const modal = document.getElementById('day-details-modal');
    if (modal) {
        modal.classList.remove('show');
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
    const recurringWeeks = parseInt(formData.get('recurring-weeks')) || 4;
    
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
        
        // Petit délai pour s'assurer que la DB est synchronisée
        setTimeout(async () => {
            await refreshCalendar();
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

// Supprimer un créneau
async function deleteSlot(slotId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ? Toutes les réservations associées seront également supprimées.')) {
        return;
    }
    
    try {
        // Supprimer d'abord les réservations associées
        const { error: bookingsError } = await adminState.supabase
            .from('bookings')
            .delete()
            .eq('booking_slot_id', slotId);
        
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
        alert('Créneau supprimé avec succès !');
        
        // Actualiser le calendrier
        await refreshCalendar();
        
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

// Actualiser le calendrier
async function refreshCalendar() {
    console.log('🔄 Actualisation du calendrier...');
    
    // Recharger les données
    adminState.slots = await loadAllSlots();
    adminState.bookings = await loadAllBookings();
    
    // Régénérer le calendrier
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
            
            // Charger les données et générer le calendrier
            await refreshCalendar();
        } else {
            adminState.isLoggedIn = false;
            window.location.href = 'connexion.html';
        }
        
        // Écouter les changements d'authentification
        adminState.supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                adminState.currentUser = session.user;
                adminState.isLoggedIn = true;
                refreshCalendar();
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
    
    // Masquer toutes les vues
    document.getElementById('calendar-view').classList.add('hidden');
    document.getElementById('calendar-grid-section').classList.add('hidden');
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('bookings-view').classList.add('hidden');
    document.getElementById('stats-view').classList.add('hidden');
    document.getElementById('users-view').classList.add('hidden');
    
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
        case 'calendar':
            document.getElementById('calendar-view').classList.remove('hidden');
            document.getElementById('calendar-grid-section').classList.remove('hidden');
            break;
        case 'list':
            document.getElementById('list-view').classList.remove('hidden');
            displaySlotsList();
            break;
        case 'bookings':
            document.getElementById('bookings-view').classList.remove('hidden');
            displayBookingsList();
            break;
        case 'stats':
            document.getElementById('stats-view').classList.remove('hidden');
            displayStats();
            break;
        case 'users':
            document.getElementById('users-view').classList.remove('hidden');
            displayUsers();
            break;
    }
}

// Afficher la liste des créneaux
async function displaySlotsList() {
    const slotsList = document.getElementById('slots-list');
    if (!slotsList) return;
    
    console.log('📋 Affichage de la liste des créneaux');
    
    // Charger les créneaux depuis la base de données
    const { data: slots, error } = await adminState.supabase
        .from('booking_slots')
        .select('*')
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });
    
    if (error) {
        console.error('Erreur chargement créneaux:', error);
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Erreur lors du chargement des créneaux</div>';
        return;
    }
    
    if (!slots || slots.length === 0) {
        slotsList.innerHTML = '<div class="text-center text-gray-500 py-8">Aucun créneau créé</div>';
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
    
    // Générer le HTML
    let html = '';
    Object.keys(slotsByDate).sort().forEach(date => {
        const dateSlots = slotsByDate[date];
        const dateObj = new Date(date);
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });
        const formattedDate = dateObj.toLocaleDateString('fr-FR');
        
        html += `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-semibold text-gray-800">${dayName} ${formattedDate}</h3>
                    <span class="text-sm text-gray-500">${dateSlots.length} créneau(x)</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        `;
        
        dateSlots.forEach(slot => {
            const time = slot.booking_time.substring(0, 5);
            const typeName = slot.service_type === 'coaching_individuel' ? 'Individuel' : 'Groupe';
            const isFull = slot.current_bookings >= slot.max_capacity;
            const statusClass = isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusText = isFull ? 'Complet' : 'Disponible';
            
            html += `
                <div class="bg-gray-50 rounded-lg p-3 border">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-medium text-gray-800">${time}</span>
                        <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                    </div>
                    <div class="text-sm text-gray-600 mb-2">${typeName}</div>
                    <div class="text-xs text-gray-500">${slot.current_bookings}/${slot.max_capacity} places</div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="deleteSlot('${slot.id}')" class="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">
                            <i class="fas fa-trash mr-1"></i>Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    slotsList.innerHTML = html;
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
    
    // Générer le HTML
    let html = '';
    
    // Récupérer les informations utilisateur pour chaque réservation
    for (const booking of bookings) {
        const userInfo = await getUserInfo(booking.user_id);
        
        const date = new Date(booking.booking_date);
        const formattedDate = date.toLocaleDateString('fr-FR');
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
        
        html += `
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-semibold text-gray-800">${userName}</h3>
                        <p class="text-sm text-gray-600">${formattedDate} à ${time}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-600">
                        <span class="font-medium">Type:</span> ${typeName}
                        ${booking.notes ? `<br><span class="font-medium">Notes:</span> ${booking.notes}` : ''}
                    </div>
                    <div class="text-xs text-gray-500">
                        Créée le ${new Date(booking.created_at).toLocaleDateString('fr-FR')}
                    </div>
                </div>
            </div>
        `;
    }
    
    bookingsList.innerHTML = html;
}

// Afficher les statistiques
async function displayStats() {
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
                            <button onclick="toggleUserRole('${profile.id}', '${profile.role}')" class="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded">
                                <i class="fas fa-user-edit mr-1"></i>Changer rôle
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
        
        // Recharger la liste des utilisateurs
        await displayUsers();
        
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
    
    // Initialiser l'authentification
    await initializeAuth();
    
    // Initialiser les filtres pour la vue utilisateurs
    const roleFilter = document.getElementById('users-filter-role');
    const statusFilter = document.getElementById('users-filter-status');
    
    if (roleFilter) {
        roleFilter.addEventListener('change', () => {
            console.log('🔄 Filtre rôle changé:', roleFilter.value);
            displayUsers();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            console.log('🔄 Filtre statut changé:', statusFilter.value);
            displayUsers();
        });
    }
    
    // Initialiser la vue par défaut (calendrier)
    switchView('calendar');
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

// Fonction pour créer des créneaux récurrents
async function createRecurringSlots(startDate, timeType, time, startTime, endTime, selectedTypes, recurringDays, weeks, groupCapacity, notes) {
    console.log('🔄 Création de créneaux récurrents:', {
        startDate,
        timeType,
        time,
        startTime,
        endTime,
        selectedTypes,
        recurringDays,
        weeks,
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
    const createdSlots = [];
    const skippedSlots = [];
    
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
    
    // Créer des créneaux pour chaque semaine
    for (let week = 0; week < weeks; week++) {
        console.log(`📅 Semaine ${week + 1}/${weeks}`);
        
        for (const dayOfWeek of targetDays) {
            // Calculer la date pour ce jour de la semaine
            const daysUntilTarget = (dayOfWeek - startDateObj.getDay() + 7) % 7;
            const targetDate = new Date(startDateObj);
            targetDate.setDate(startDateObj.getDate() + daysUntilTarget + (week * 7));
            
            const dateStr = targetDate.toISOString().split('T')[0];
            
            console.log(`📅 Calcul date: jour ${dayOfWeek}, semaine ${week}, date calculée: ${dateStr}`);
            
            // Créer les créneaux pour cette date et chaque heure
            for (const hour of hoursToCreate) {
                for (const serviceType of selectedTypes) {
                    try {
                        // Vérifier si le créneau existe déjà
                        const { data: existingSlotData, error: checkError } = await adminState.supabase
                            .from('booking_slots')
                            .select('id, service_type')
                            .eq('booking_date', dateStr)
                            .eq('booking_time', hour)
                            .eq('service_type', serviceType)
                            .single();
                        
                        if (existingSlotData) {
                            console.log(`⚠️ Créneau ${serviceType} existe déjà pour ${dateStr} ${hour}`);
                            skippedSlots.push(`${dateStr} ${hour} (${serviceType})`);
                            continue;
                        }
                        
                        // Créer le créneau
                        const maxCapacity = serviceType === 'coaching_groupe' ? groupCapacity : 1;
                        const { data, error } = await adminState.supabase
                            .from('booking_slots')
                            .insert([{
                                service_type: serviceType,
                                booking_date: dateStr,
                                booking_time: hour,
                                max_capacity: maxCapacity,
                                current_bookings: 0
                            }])
                            .select();
                        
                        if (error) {
                            console.error(`Erreur création créneau ${serviceType} ${dateStr} ${hour}:`, error);
                            if (error.code === '23505') { // Contrainte d'unicité violée
                                console.log(`⚠️ Créneau ${serviceType} créé entre temps`);
                                skippedSlots.push(`${dateStr} ${hour} (${serviceType})`);
                                continue;
                            }
                            throw error;
                        }
                        
                        createdSlots.push(data[0]);
                        console.log(`✅ Créneau récurrent ${serviceType} créé pour ${dateStr} ${hour}`);
                        
                    } catch (error) {
                        console.error(`Erreur création créneau ${serviceType} ${dateStr} ${hour}:`, error);
                        skippedSlots.push(`${dateStr} ${hour} (${serviceType})`);
                    }
                }
            }
        }
    }
    
    // Afficher le résumé
    let message = `✅ Création récurrente terminée !\n`;
    message += `📅 ${createdSlots.length} créneau(x) créé(s)\n`;
    if (skippedSlots.length > 0) {
        message += `⚠️ ${skippedSlots.length} créneau(x) existant(s) ignoré(s)`;
    }
    
    alert(message);
}

// Initialiser la page quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initializeAdminPage);
