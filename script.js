// R'MouV Website JavaScript

// Global state
const appState = {
    currentUser: null,
    bookings: [],
    currentWeek: new Date(),
    classTypes: {
        mobilite: { name: 'Cours Collectif – Mobilité', capacity: 10 },
        renforcement: { name: 'Cours Collectif – Renforcement', capacity: 12 },
        cardio: { name: 'Cours Collectif – Cardio doux', capacity: 12 }
    }
};

// DOM Elements
const elements = {
    header: document.getElementById('header'),
    navbarToggle: document.getElementById('navbar-toggle'),
    navbarMenu: document.getElementById('navbar-menu'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    bookingSystem: document.getElementById('booking-system'),
    userDashboard: document.getElementById('user-dashboard'),
    calendarGrid: document.getElementById('calendar-grid'),
    currentWeek: document.getElementById('current-week'),
    bookingsList: document.getElementById('bookings-list'),
    contactForm: document.getElementById('contactForm')
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeAuth();
    initializeBookingSystem();
    initializeContactForm();
    initializeScrollEffects();
    initializeAnimations();
    
    // Check if user is already logged in
    checkAuthStatus();
});

// Navigation
function initializeNavigation() {
    // Mobile menu toggle
    if (elements.navbarToggle) {
        elements.navbarToggle.addEventListener('click', toggleMobileMenu);
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Close mobile menu if open
                if (elements.navbarMenu.classList.contains('active')) {
                    toggleMobileMenu();
                }
            }
        });
    });

    // Header scroll effect
    window.addEventListener('scroll', handleHeaderScroll);
}

function toggleMobileMenu() {
    elements.navbarMenu.classList.toggle('active');
    elements.navbarToggle.classList.toggle('active');
}

function handleHeaderScroll() {
    if (window.scrollY > 100) {
        elements.header.classList.add('scrolled');
    } else {
        elements.header.classList.remove('scrolled');
    }
}

// Authentication
function initializeAuth() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchAuthTab(tab);
        });
    });

    // Form submissions
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }

    if (elements.signupForm) {
        elements.signupForm.addEventListener('submit', handleSignup);
    }
}

function switchAuthTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Show/hide forms
    elements.loginForm.classList.toggle('hidden', tab !== 'login');
    elements.signupForm.classList.toggle('hidden', tab !== 'signup');
}

function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loginData = Object.fromEntries(formData);

    // Simulate login (replace with real API call)
    if (loginData.email && loginData.mot_de_passe) {
        appState.currentUser = {
            email: loginData.email,
            name: 'Utilisateur Test' // In real app, get from server
        };
        
        localStorage.setItem('rmouv_user', JSON.stringify(appState.currentUser));
        showBookingSystem();
        showNotification('Connexion réussie !', 'success');
    } else {
        showNotification('Veuillez remplir tous les champs', 'error');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
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

    // Simulate signup (replace with real API call)
    appState.currentUser = {
        email: signupData.email,
        name: `${signupData.prenom} ${signupData.nom}`,
        phone: signupData.telephone,
        objective: signupData.objectif
    };
    
    localStorage.setItem('rmouv_user', JSON.stringify(appState.currentUser));
    showBookingSystem();
    showNotification('Inscription réussie ! Bienvenue chez R\'MouV !', 'success');
}

function checkAuthStatus() {
    const savedUser = localStorage.getItem('rmouv_user');
    if (savedUser) {
        appState.currentUser = JSON.parse(savedUser);
        showBookingSystem();
    }
}

function logout() {
    appState.currentUser = null;
    localStorage.removeItem('rmouv_user');
    elements.bookingSystem.classList.add('hidden');
    elements.userDashboard.classList.add('hidden');
    switchAuthTab('login');
    showNotification('Déconnexion réussie', 'info');
}

// Booking System
function initializeBookingSystem() {
    // Calendar navigation
    document.getElementById('prev-week')?.addEventListener('click', () => {
        appState.currentWeek.setDate(appState.currentWeek.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('next-week')?.addEventListener('click', () => {
        appState.currentWeek.setDate(appState.currentWeek.getDate() + 7);
        renderCalendar();
    });

    // Filters
    document.getElementById('class-type-filter')?.addEventListener('change', renderCalendar);
    document.getElementById('level-filter')?.addEventListener('change', renderCalendar);
}

function showBookingSystem() {
    elements.bookingSystem.classList.remove('hidden');
    elements.userDashboard.classList.remove('hidden');
    renderCalendar();
    renderUserBookings();
}

function renderCalendar() {
    if (!elements.calendarGrid) return;

    const startOfWeek = getStartOfWeek(appState.currentWeek);
    const endOfWeek = getEndOfWeek(appState.currentWeek);
    
    // Update week display
    elements.currentWeek.textContent = 
        `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;

    // Generate calendar slots
    elements.calendarGrid.innerHTML = '';
    
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    
    // Add day headers
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        elements.calendarGrid.appendChild(dayHeader);
    });

    // Generate time slots for each day
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + dayOffset);
        
        times.forEach(time => {
            const slot = createCalendarSlot(currentDay, time);
            elements.calendarGrid.appendChild(slot);
        });
    }
}

function createCalendarSlot(date, time) {
    const slot = document.createElement('div');
    slot.className = 'calendar-slot';
    
    const dateStr = formatDate(date);
    const isPast = date < new Date();
    const isBooked = isSlotBooked(dateStr, time);
    const isFull = Math.random() > 0.7; // Simulate random availability
    
    if (isPast) {
        slot.classList.add('past');
        slot.textContent = `${time}\nPassé`;
    } else if (isBooked) {
        slot.classList.add('booked');
        slot.textContent = `${time}\nRéservé`;
    } else if (isFull) {
        slot.classList.add('full');
        slot.textContent = `${time}\nComplet`;
        slot.addEventListener('click', () => {
            showNotification('Ce créneau est complet. Ajout à la liste d\'attente ?', 'info');
        });
    } else {
        slot.classList.add('available');
        slot.textContent = `${time}\nDisponible`;
        slot.addEventListener('click', () => {
            bookSlot(dateStr, time);
        });
    }
    
    return slot;
}

function bookSlot(date, time) {
    if (!appState.currentUser) {
        showNotification('Veuillez vous connecter pour réserver', 'error');
        return;
    }

    const booking = {
        id: Date.now(),
        date: date,
        time: time,
        type: 'Cours Collectif – Mobilité', // Default, should be selected
        user: appState.currentUser.email
    };

    appState.bookings.push(booking);
    localStorage.setItem('rmouv_bookings', JSON.stringify(appState.bookings));
    
    renderCalendar();
    renderUserBookings();
    showNotification('Créneau réservé avec succès !', 'success');
}

function isSlotBooked(date, time) {
    return appState.bookings.some(booking => 
        booking.date === date && booking.time === time
    );
}

function renderUserBookings() {
    if (!elements.bookingsList) return;

    const userBookings = appState.bookings.filter(booking => 
        booking.user === appState.currentUser?.email
    );

    if (userBookings.length === 0) {
        elements.bookingsList.innerHTML = '<p>Aucune réservation pour le moment.</p>';
        return;
    }

    elements.bookingsList.innerHTML = userBookings.map(booking => `
        <div class="booking-item">
            <div class="booking-info">
                <h4>${booking.type}</h4>
                <p>${booking.date} à ${booking.time}</p>
            </div>
            <div class="booking-actions">
                <button class="btn btn-secondary btn-small" onclick="cancelBooking(${booking.id})">
                    Annuler
                </button>
            </div>
        </div>
    `).join('');
}

function cancelBooking(bookingId) {
    appState.bookings = appState.bookings.filter(booking => booking.id !== bookingId);
    localStorage.setItem('rmouv_bookings', JSON.stringify(appState.bookings));
    renderCalendar();
    renderUserBookings();
    showNotification('Réservation annulée', 'info');
}

// Contact Form
function initializeContactForm() {
    if (elements.contactForm) {
        elements.contactForm.addEventListener('submit', handleContactSubmit);
    }
}

function handleContactSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const contactData = Object.fromEntries(formData);

    // Simulate form submission (replace with real API call)
    console.log('Contact form submitted:', contactData);
    showNotification('Message envoyé ! Nous vous répondrons rapidement.', 'success');
    e.target.reset();
}

// Scroll Effects
function initializeScrollEffects() {
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.content-block, .equipment-card, .team-card').forEach(el => {
        observer.observe(el);
    });
}

// Animations
function initializeAnimations() {
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .content-block, .equipment-card, .team-card {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.6s ease-out;
        }
        
        .content-block.animate-in, 
        .equipment-card.animate-in, 
        .team-card.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .navbar-toggle.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        
        .navbar-toggle.active span:nth-child(2) {
            opacity: 0;
        }
        
        .navbar-toggle.active span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -6px);
        }
    `;
    document.head.appendChild(style);
}

// Utility Functions
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

function getEndOfWeek(date) {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
}

function formatDate(date) {
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
    });
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease-out;
        max-width: 400px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    `;

    // Set background color based on type
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        info: '#3B82F6',
        warning: '#F59E0B'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Load saved bookings
function loadBookings() {
    const savedBookings = localStorage.getItem('rmouv_bookings');
    if (savedBookings) {
        appState.bookings = JSON.parse(savedBookings);
    }
}

// Initialize saved data
loadBookings();

// Export functions for global access
window.logout = logout;
window.cancelBooking = cancelBooking;
