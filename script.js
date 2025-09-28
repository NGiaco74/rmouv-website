// R'MouV Website JavaScript
// Crée le client Supabase directement
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Global state
const appState = {
    currentUser: null,
    isAuthenticated: false
};

// DOM Elements
const elements = {
    header: document.getElementById('header'),
    navbarToggle: document.getElementById('navbar-toggle'),
    navbarMenu: document.getElementById('navbar-menu'),
    contactForm: document.getElementById('contactForm')
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeContactForm();
    initializeScrollEffects();
    initializeAnimations();
    initializeAuth();
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

// Authentication
async function initializeAuth() {
    console.log('🔐 Initialisation de l\'authentification...');
    
    try {
        // 1) Lire la session au chargement
        const { data: { session } } = await supabase.auth.getSession();
        console.log('📋 Session actuelle:', session);
        updateUI(!!session, session?.user);
        
        // 2) Écouter les changements (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Changement d\'état auth:', event, session);
            updateUI(!!session, session?.user);
        });
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation auth:', error);
    }
}

function updateUI(isLoggedIn, user) {
    console.log('🎨 Mise à jour de l\'UI - Connecté:', isLoggedIn, 'Utilisateur:', user);
    
    // Update app state
    appState.isAuthenticated = isLoggedIn;
    appState.currentUser = user;
    
    const authButtons = document.getElementById('auth-buttons');
    const authButtonsMobile = document.getElementById('auth-buttons-mobile');
    const userMenu = document.getElementById('user-menu');
    const userMenuMobile = document.getElementById('user-menu-mobile');
    const userInitials = document.getElementById('user-initials');
    const userInitialsMobile = document.getElementById('user-initials-mobile');
    
    console.log('🔍 Éléments trouvés:', {
        authButtons: !!authButtons,
        authButtonsMobile: !!authButtonsMobile,
        userMenu: !!userMenu,
        userMenuMobile: !!userMenuMobile,
        userInitials: !!userInitials,
        userInitialsMobile: !!userInitialsMobile
    });
    
    if (isLoggedIn && user) {
        console.log('✅ Affichage du menu utilisateur');
        // User is logged in - show user menu
        if (authButtons) authButtons.classList.add('hidden');
        if (authButtonsMobile) authButtonsMobile.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userMenuMobile) userMenuMobile.classList.remove('hidden');
        
        // Set user initials
        const email = user.email;
        let initials = '';
        
        // Try to get initials from user metadata first
        if (user.user_metadata && user.user_metadata.first_name && user.user_metadata.last_name) {
            initials = user.user_metadata.first_name.charAt(0).toUpperCase() + user.user_metadata.last_name.charAt(0).toUpperCase();
        } else {
            // Fallback to email-based initials
            const emailParts = email.split('@')[0].split('.');
            if (emailParts.length >= 2) {
                initials = emailParts[0].charAt(0).toUpperCase() + emailParts[1].charAt(0).toUpperCase();
            } else {
                initials = email.charAt(0).toUpperCase() + (email.split('@')[0].charAt(1) || '').toUpperCase();
            }
        }
        
        console.log('👤 Initiales calculées:', initials, 'pour email:', email, 'métadonnées:', user.user_metadata);
        if (userInitials) userInitials.textContent = initials;
        if (userInitialsMobile) userInitialsMobile.textContent = initials;
        
        // Initialize dropdown functionality
        initializeUserDropdown();
    } else {
        console.log('❌ Affichage des boutons d\'authentification');
        // User is not logged in - show auth buttons
        if (authButtons) authButtons.classList.remove('hidden');
        if (authButtonsMobile) authButtonsMobile.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (userMenuMobile) userMenuMobile.classList.add('hidden');
    }
}

// Variable pour éviter les doublons d'écouteurs
let dropdownInitialized = false;

function initializeUserDropdown() {
    if (dropdownInitialized) return; // Éviter les doublons
    
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdown = document.getElementById('user-dropdown');
    
    if (dropdownToggle && dropdown) {
        console.log('🔧 Initialisation du dropdown utilisateur');
        
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🖱️ Clic sur le dropdown toggle');
            dropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownToggle.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        dropdownInitialized = true;
    }
}

// Auth functions
async function signUp(email, password, userData = {}) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: userData
            }
        });
        if (error) {
            showNotification('Erreur lors de l\'inscription: ' + error.message, 'error');
            return { success: false, error };
        }
        
        showNotification('Inscription réussie ! Vérifiez votre email pour confirmer votre compte.', 'success');
        return { success: true, data };
    } catch (error) {
        showNotification('Erreur lors de l\'inscription: ' + error.message, 'error');
        return { success: false, error };
    }
}

async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            showNotification('Erreur de connexion: ' + error.message, 'error');
            return { success: false, error };
        }
        
        showNotification('Connexion réussie !', 'success');
        return { success: true, data };
    } catch (error) {
        showNotification('Erreur de connexion: ' + error.message, 'error');
        return { success: false, error };
    }
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showNotification('Erreur lors de la déconnexion: ' + error.message, 'error');
            return;
        }
        
        showNotification('Déconnexion réussie', 'info');
    } catch (error) {
        showNotification('Erreur lors de la déconnexion: ' + error.message, 'error');
    }
}

function showBookingSystem() {
    showNotification('Système de réservation en cours de développement...', 'info');
}

// Make logout function globally available
window.logout = logout;


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

