// Frontend API Integration for R'MouV
// Replace localStorage with real API calls

class RMouVAPI {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.token = localStorage.getItem('rmouv_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur API');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication
    async register(userData) {
        const data = await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        this.token = data.token;
        localStorage.setItem('rmouv_token', this.token);
        return data;
    }

    async login(email, password) {
        const data = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        this.token = data.token;
        localStorage.setItem('rmouv_token', this.token);
        return data;
    }

    async logout() {
        this.token = null;
        localStorage.removeItem('rmouv_token');
        localStorage.removeItem('rmouv_user');
    }

    // User profile
    async getProfile() {
        return await this.request('/profile');
    }

    // Courses and bookings
    async getCourses() {
        return await this.request('/courses');
    }

    async getTimeSlots(date) {
        return await this.request(`/time-slots/${date}`);
    }

    async createBooking(timeSlotId, bookingDate) {
        return await this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify({ time_slot_id: timeSlotId, booking_date: bookingDate })
        });
    }

    async getUserBookings() {
        return await this.request('/bookings');
    }

    async cancelBooking(bookingId) {
        return await this.request(`/bookings/${bookingId}`, {
            method: 'DELETE'
        });
    }
}

// Initialize API
const api = new RMouVAPI();

// Update existing JavaScript functions to use API
function updateFrontendWithAPI() {
    // Replace localStorage-based functions with API calls
    
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const loginData = Object.fromEntries(formData);
            
            try {
                const data = await api.login(loginData.email, loginData.mot_de_passe);
                
                // Update user interface
                updateUserInterface(data.user);
                showBookingInterface();
                showNotification('Connexion réussie !', 'success');
                
            } catch (error) {
                showNotification(error.message || 'Erreur de connexion', 'error');
            }
        });
    }

    // Signup form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const signupData = Object.fromEntries(formData);
            
            // Validate required fields
            if (!signupData.prenom || !signupData.nom || !signupData.email || !signupData.mot_de_passe) {
                showNotification('Veuillez remplir tous les champs obligatoires', 'error');
                return;
            }
            
            // Validate consents
            if (!signupData.consent_cgu || !signupData.consent_privacy) {
                showNotification('Veuillez accepter les CGU et la politique de confidentialité', 'error');
                return;
            }
            
            try {
                const data = await api.register(signupData);
                
                // Update user interface
                updateUserInterface(data.user);
                showBookingInterface();
                showNotification('Inscription réussie ! Bienvenue chez R\'MouV !', 'success');
                
            } catch (error) {
                showNotification(error.message || 'Erreur lors de l\'inscription', 'error');
            }
        });
    }

    // Update booking functions
    window.bookSlot = async function(type, time) {
        try {
            // Get time slot ID from the booking data
            const timeSlots = await api.getTimeSlots(new Date().toISOString().split('T')[0]);
            const slot = timeSlots.find(s => s.course_name === type && s.start_time === time.split(' ')[1]);
            
            if (!slot) {
                showNotification('Créneau non trouvé', 'error');
                return;
            }

            await api.createBooking(slot.id, new Date().toISOString().split('T')[0]);
            showNotification('Créneau réservé avec succès !', 'success');
            
            // Refresh bookings
            updateBookingDisplay();
            updateUserBookings();
            
        } catch (error) {
            showNotification(error.message || 'Erreur lors de la réservation', 'error');
        }
    };

    window.cancelBooking = async function(bookingId) {
        try {
            await api.cancelBooking(bookingId);
            showNotification('Réservation annulée', 'info');
            
            // Refresh bookings
            updateBookingDisplay();
            updateUserBookings();
            
        } catch (error) {
            showNotification(error.message || 'Erreur lors de l\'annulation', 'error');
        }
    };

    // Update logout function
    window.logout = async function() {
        await api.logout();
        document.getElementById('booking-interface').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        
        // Hide user menu
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('auth-tabs').classList.remove('hidden');
        document.getElementById('user-info').classList.add('hidden');
        
        // Reset tab styles
        document.getElementById('login-tab').classList.add('bg-white', 'text-primary');
        document.getElementById('login-tab').classList.remove('bg-primary/20');
        document.getElementById('signup-tab').classList.remove('bg-white', 'text-primary');
        document.getElementById('signup-tab').classList.add('bg-primary/20');
        
        showNotification('Déconnexion réussie', 'info');
    };

    // Update booking display to use real data
    async function updateBookingDisplay() {
        try {
            const timeSlots = await api.getTimeSlots(new Date().toISOString().split('T')[0]);
            const bookingContainer = document.querySelector('#booking-interface .space-y-4');
            
            if (!bookingContainer) return;
            
            bookingContainer.innerHTML = timeSlots.map(slot => {
                const isFull = slot.available_spots <= 0;
                
                return `
                    <div class="flex justify-between items-center p-4 bg-white border rounded-lg">
                        <div>
                            <h5 class="font-bold">${slot.course_name}</h5>
                            <p class="text-sm text-neutral-600">${slot.start_time}-${slot.end_time} | ${isFull ? 'Complet (liste d\'attente)' : `${slot.available_spots} places disponibles`}</p>
                        </div>
                        <button class="${isFull ? 'bg-secondary hover:bg-secondary/90' : 'bg-primary hover:bg-primary/90'} text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors" 
                                onclick="${isFull ? `addToWaitlist('${slot.course_name}', '${slot.start_time}')` : `bookSlot('${slot.course_name}', '${slot.start_time}')`}">
                            ${isFull ? 'Liste d\'attente' : 'Réserver'}
                        </button>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error loading bookings:', error);
            showNotification('Erreur lors du chargement des créneaux', 'error');
        }
    }

    // Update user bookings display
    async function updateUserBookings() {
        try {
            const bookings = await api.getUserBookings();
            const bookingsContainer = document.getElementById('user-bookings');
            
            if (bookings.length === 0) {
                bookingsContainer.innerHTML = '<p class="text-center text-neutral-600">Vous n\'avez aucune réservation à venir</p>';
            } else {
                bookingsContainer.innerHTML = bookings.map(booking => `
                    <div class="flex justify-between items-center p-3 bg-white rounded-lg border mb-2">
                        <div>
                            <h5 class="font-semibold">${booking.course_name}</h5>
                            <p class="text-sm text-neutral-600">${booking.start_time}-${booking.end_time}</p>
                        </div>
                        <button onclick="cancelBooking(${booking.id})" class="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm transition-colors">
                            Annuler
                        </button>
                    </div>
                `).join('');
            }
            
        } catch (error) {
            console.error('Error loading user bookings:', error);
            showNotification('Erreur lors du chargement de vos réservations', 'error');
        }
    }

    // Check authentication status on page load
    async function checkAuthStatus() {
        try {
            const user = await api.getProfile();
            updateUserInterface(user);
            showBookingInterface();
        } catch (error) {
            // User not authenticated, show login form
            console.log('User not authenticated');
        }
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        checkAuthStatus();
    });
}

// Export for use in main script
window.RMouVAPI = RMouVAPI;
window.updateFrontendWithAPI = updateFrontendWithAPI;
