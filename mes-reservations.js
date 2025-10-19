// Script pour la page "Mes réservations"
// Gestion de l'affichage et de la gestion des réservations utilisateur

// État global de l'application
let appState = {
    currentUser: null,
    isLoggedIn: false,
    supabase: null,
    bookings: [],
    currentFilter: 'all'
};

// Initialisation Supabase
async function initializeSupabase() {
    try {
        // Attendre que Supabase soit chargé
        await waitForSupabase();
        
        // Créer le client Supabase
        appState.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        
        console.log('Supabase initialisé pour mes réservations');
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

// Charger les réservations de l'utilisateur
async function loadUserBookings() {
    if (!appState.supabase || !appState.currentUser) {
        console.log('Supabase ou utilisateur non disponible');
        return [];
    }
    
    try {
        console.log('🔍 Chargement des réservations utilisateur...');
        
        const { data: bookings, error } = await appState.supabase
            .from('bookings')
            .select('*')
            .eq('user_id', appState.currentUser.id)
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

// Formater la date pour l'affichage
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Formater l'heure pour l'affichage
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    return `${hours}h${minutes}`;
}

// Obtenir le nom du service
function getServiceName(serviceType) {
    const services = {
        'coaching_individuel': 'Coaching Individuel',
        'coaching_groupe': 'Coaching Groupe'
    };
    return services[serviceType] || serviceType;
}

// Obtenir la couleur du statut
function getStatusColor(status) {
    const colors = {
        'confirmed': 'status-confirmed',
        'cancelled': 'status-cancelled',
        'completed': 'status-completed'
    };
    return colors[status] || 'status-confirmed';
}

// Obtenir le texte du statut
function getStatusText(status) {
    const texts = {
        'confirmed': 'Confirmée',
        'cancelled': 'Annulée',
        'completed': 'Terminée'
    };
    return texts[status] || status;
}

// Créer une carte de réservation
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card bg-white rounded-lg border border-gray-200 p-6 ${booking.status}`;
    card.dataset.bookingId = booking.id;
    card.dataset.status = booking.status;
    
    const serviceName = getServiceName(booking.service_type);
    const statusClass = getStatusColor(booking.status);
    const statusText = getStatusText(booking.status);
    const formattedDate = formatDate(booking.booking_date);
    const formattedTime = formatTime(booking.booking_time);
    
    card.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between">
            <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-lg font-semibold text-gray-800">${serviceName}</h3>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
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
                        <span>${booking.duration} minutes</span>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-calendar-plus mr-2 text-primary"></i>
                        <span>Réservé le ${new Date(booking.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                </div>
                
                ${booking.notes ? `
                    <div class="mt-3 p-3 bg-gray-50 rounded-md">
                        <p class="text-sm text-gray-600">
                            <i class="fas fa-sticky-note mr-2"></i>
                            <strong>Notes:</strong> ${booking.notes}
                        </p>
                    </div>
                ` : ''}
            </div>
            
            <div class="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0 md:ml-4">
                ${booking.status === 'confirmed' ? `
                    <button onclick="cancelBooking('${booking.id}')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                        <i class="fas fa-times mr-2"></i>Annuler
                    </button>
                ` : ''}
                
                ${booking.status === 'cancelled' ? `
                    <button onclick="reactivateBooking('${booking.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                        <i class="fas fa-redo mr-2"></i>Réactiver
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Afficher les réservations
async function displayBookings() {
    const bookingsList = document.getElementById('bookings-list');
    const noBookings = document.getElementById('no-bookings');
    
    if (!bookingsList) return;
    
    // Charger les réservations
    appState.bookings = await loadUserBookings();
    
    // Filtrer les réservations selon le filtre actuel
    const filteredBookings = appState.currentFilter === 'all' 
        ? appState.bookings 
        : appState.bookings.filter(booking => booking.status === appState.currentFilter);
    
    // Vider la liste
    bookingsList.innerHTML = '';
    
    if (filteredBookings.length === 0) {
        if (appState.bookings.length === 0) {
            // Aucune réservation
            noBookings.classList.remove('hidden');
            bookingsList.classList.add('hidden');
        } else {
            // Pas de réservations pour ce filtre
            bookingsList.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-filter text-4xl text-gray-300 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-600 mb-2">Aucune réservation ${getStatusText(appState.currentFilter).toLowerCase()}</h3>
                    <p class="text-gray-500">Essayez un autre filtre ou réservez un nouveau créneau.</p>
                </div>
            `;
        }
        return;
    }
    
    // Masquer le message "aucune réservation"
    noBookings.classList.add('hidden');
    bookingsList.classList.remove('hidden');
    
    // Afficher les réservations
    filteredBookings.forEach(booking => {
        const card = createBookingCard(booking);
        bookingsList.appendChild(card);
    });
    
    console.log(`📅 ${filteredBookings.length} réservations affichées (filtre: ${appState.currentFilter})`);
}

// Annuler une réservation
async function cancelBooking(bookingId) {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) {
        return;
    }
    
    try {
        const { error } = await appState.supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur annulation:', error);
            alert('Erreur lors de l\'annulation de la réservation.');
            return;
        }
        
        console.log('✅ Réservation annulée');
        alert('Réservation annulée avec succès.');
        
        // Recharger les réservations
        await displayBookings();
        
    } catch (error) {
        console.error('Erreur annulation:', error);
        alert('Erreur lors de l\'annulation de la réservation.');
    }
}

// Réactiver une réservation
async function reactivateBooking(bookingId) {
    if (!confirm('Êtes-vous sûr de vouloir réactiver cette réservation ?')) {
        return;
    }
    
    try {
        const { error } = await appState.supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', bookingId);
        
        if (error) {
            console.error('Erreur réactivation:', error);
            alert('Erreur lors de la réactivation de la réservation.');
            return;
        }
        
        console.log('✅ Réservation réactivée');
        alert('Réservation réactivée avec succès.');
        
        // Recharger les réservations
        await displayBookings();
        
    } catch (error) {
        console.error('Erreur réactivation:', error);
        alert('Erreur lors de la réactivation de la réservation.');
    }
}

// Gérer les filtres
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Retirer la classe active de tous les boutons
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            });
            
            // Ajouter la classe active au bouton cliqué
            button.classList.remove('bg-gray-200', 'text-gray-700');
            button.classList.add('bg-primary', 'text-white');
            
            // Mettre à jour le filtre
            appState.currentFilter = button.id.replace('filter-', '');
            
            // Recharger l'affichage
            displayBookings();
        });
    });
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
            
            // Charger les réservations
            await displayBookings();
        } else {
            appState.isLoggedIn = false;
            updateUI(false, null);
            
            // Rediriger vers la page de connexion
            window.location.href = 'connexion.html';
        }
        
        // Écouter les changements d'authentification
        appState.supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                appState.currentUser = session.user;
                appState.isLoggedIn = true;
                updateUI(true, session.user);
                displayBookings();
            } else {
                appState.currentUser = null;
                appState.isLoggedIn = false;
                updateUI(false, null);
                window.location.href = 'connexion.html';
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

// Exposer les fonctions globalement
window.cancelBooking = cancelBooking;
window.reactivateBooking = reactivateBooking;

// Initialisation de la page
async function initializeMyBookingsPage() {
    // Initialiser Supabase
    const supabaseReady = await initializeSupabase();
    if (!supabaseReady) {
        console.error('Impossible d\'initialiser Supabase');
        return;
    }
    
    // Initialiser l'authentification
    await initializeAuth();
    
    // Configurer les filtres
    setupFilters();
}

// Initialiser la page quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initializeMyBookingsPage);
