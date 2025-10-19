// R'MouV Website JavaScript
// Crée le client Supabase directement
let supabase = null;

// Initialiser Supabase quand il est disponible
function initializeSupabase() {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialisé dans script.js');
        return true;
    }
    return false;
}

// Essayer d'initialiser immédiatement
if (!initializeSupabase()) {
    // Si pas encore disponible, attendre que le DOM soit chargé
    document.addEventListener('DOMContentLoaded', () => {
        if (!initializeSupabase()) {
            console.error('❌ Impossible d\'initialiser Supabase');
        }
    });
}

// Global state
const appState = {
    currentUser: null,
    isAuthenticated: false,
    userRole: null,
    isAdmin: false
};

// DOM Elements
const elements = {
    header: document.getElementById('header'),
    navbarToggle: document.getElementById('mobile-menu-toggle'),
    navbarMenu: document.getElementById('mobile-menu'),
    contactForm: document.getElementById('contactForm')
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // 1) Afficher immédiatement l'état caché (évite le flash)
    displayCachedAuthState();
    
    // 2) Initialiser les autres composants
    initializeNavigation();
    initializeContactForm();
    initializeScrollEffects();
    initializeAnimations();
    
    // 3) Vérifier l'authentification en arrière-plan
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
                if (elements.navbarMenu && !elements.navbarMenu.classList.contains('hidden')) {
                    toggleMobileMenu();
                }
            }
        });
    });

    // Header scroll effect
    window.addEventListener('scroll', handleHeaderScroll);
}

function toggleMobileMenu() {
    if (!elements.navbarMenu || !elements.navbarToggle) return; // Vérifier que les éléments existent
    
    elements.navbarMenu.classList.toggle('hidden');
    elements.navbarToggle.classList.toggle('active');
}

function handleHeaderScroll() {
    if (!elements.header) return; // Vérifier que l'élément existe
    
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
// Charger le rôle de l'utilisateur
async function loadUserRole(userId) {
    if (!supabase) {
        console.error('❌ Supabase non initialisé');
        return 'user';
    }
    
    try {
        console.log('🔍 Chargement du rôle pour l\'utilisateur:', userId);
        
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('❌ Erreur chargement rôle:', error);
            console.log('📝 Table profiles probablement inexistante, rôle par défaut: user');
            return 'user'; // Rôle par défaut
        }
        
        const role = data?.role || 'user';
        console.log('✅ Rôle chargé:', role);
        return role;
    } catch (error) {
        console.error('❌ Erreur chargement rôle:', error);
        console.log('📝 Erreur de connexion, rôle par défaut: user');
        return 'user';
    }
}

// Afficher immédiatement l'état d'authentification caché
function displayCachedAuthState() {
    console.log('⚡ Affichage immédiat de l\'état caché...');
    
    try {
        // Récupérer l'état caché
        const cachedAuth = localStorage.getItem('rmouv_auth_cache');
        const cachedUser = localStorage.getItem('rmouv_user_cache');
        const cachedRole = localStorage.getItem('rmouv_role_cache');
        
        if (cachedAuth === 'true' && cachedUser && cachedRole) {
            console.log('📦 État caché trouvé - Utilisateur connecté');
            
            // Afficher immédiatement l'interface connectée
            const authButtons = document.getElementById('auth-buttons');
            const authButtonsMobile = document.getElementById('auth-buttons-mobile');
            const userMenu = document.getElementById('user-menu');
            const userMenuMobile = document.getElementById('user-menu-mobile');
            
            // Masquer les boutons d'authentification
            if (authButtons) authButtons.style.display = 'none';
            if (authButtonsMobile) authButtonsMobile.style.display = 'none';
            
            // Afficher le menu utilisateur
            if (userMenu) {
                userMenu.classList.remove('hidden');
                userMenu.style.display = 'flex';
            }
            if (userMenuMobile) {
                userMenuMobile.classList.remove('hidden');
                userMenuMobile.style.display = 'block';
            }
            
            // Afficher les initiales
            const userData = JSON.parse(cachedUser);
            const initials = userData.initials || 'U';
            const initialsElement = document.getElementById('user-initials');
            const initialsMobileElement = document.getElementById('user-initials-mobile');
            
            if (initialsElement) initialsElement.textContent = initials;
            if (initialsMobileElement) initialsMobileElement.textContent = initials;
            
            // Gérer le bouton admin
            if (cachedRole === 'admin') {
                const adminButtonDesktop = document.getElementById('admin-button-desktop');
                const adminButtonMobile = document.getElementById('admin-button-mobile');
                
                if (adminButtonDesktop) {
                    adminButtonDesktop.classList.remove('hidden');
                    adminButtonDesktop.style.display = 'block';
                }
                if (adminButtonMobile) {
                    adminButtonMobile.classList.remove('hidden');
                    adminButtonMobile.style.display = 'block';
                }
            }
            
            console.log('✅ Interface connectée affichée immédiatement');
        } else {
            console.log('📦 Aucun état caché - Utilisateur non connecté');
            
            // Afficher immédiatement l'interface non connectée
            const authButtons = document.getElementById('auth-buttons');
            const authButtonsMobile = document.getElementById('auth-buttons-mobile');
            const userMenu = document.getElementById('user-menu');
            const userMenuMobile = document.getElementById('user-menu-mobile');
            
            // Afficher les boutons d'authentification
            if (authButtons) authButtons.style.display = 'flex';
            if (authButtonsMobile) authButtonsMobile.style.display = 'block';
            
            // Masquer le menu utilisateur
            if (userMenu) {
                userMenu.classList.add('hidden');
                userMenu.style.display = 'none';
            }
            if (userMenuMobile) {
                userMenuMobile.classList.add('hidden');
                userMenuMobile.style.display = 'none';
            }
            
            console.log('✅ Interface non connectée affichée immédiatement');
        }
        
        // Marquer que l'authentification est chargée (pour le CSS)
        document.body.classList.add('auth-loaded');
    } catch (error) {
        console.error('❌ Erreur affichage état caché:', error);
    }
}

async function initializeAuth() {
    console.log('🔐 Initialisation de l\'authentification...');
    
    if (!supabase) {
        console.error('❌ Supabase non initialisé');
        return;
    }
    
    try {
        // 1) Lire la session au chargement
        const { data: { session } } = await supabase.auth.getSession();
        console.log('📋 Session actuelle:', session);
        
        if (session) {
            // Charger le rôle de l'utilisateur
            appState.userRole = await loadUserRole(session.user.id);
            appState.isAdmin = appState.userRole === 'admin';
            console.log('👤 Rôle utilisateur:', appState.userRole, 'Admin:', appState.isAdmin);
        }
        
        updateUI(!!session, session?.user);
        
        // 2) Écouter les changements (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Changement d\'état auth:', event, session);
            
            if (session) {
                // Charger le rôle de l'utilisateur
                appState.userRole = await loadUserRole(session.user.id);
                appState.isAdmin = appState.userRole === 'admin';
                console.log('👤 Rôle utilisateur:', appState.userRole, 'Admin:', appState.isAdmin);
            } else {
                appState.userRole = null;
                appState.isAdmin = false;
            }
            
            updateUI(!!session, session?.user);
        });
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation auth:', error);
    }
}

// Mettre à jour le cache d'authentification
function updateAuthCache(isLoggedIn, user) {
    try {
        if (isLoggedIn && user) {
            // Calculer les initiales
            let initials = 'U';
            if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
                initials = (user.user_metadata.first_name.charAt(0) + user.user_metadata.last_name.charAt(0)).toUpperCase();
            } else if (user.email) {
                initials = user.email.charAt(0).toUpperCase();
            }
            
            // Créer l'objet utilisateur pour le cache
            const userData = {
                id: user.id,
                email: user.email,
                initials: initials,
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || ''
            };
            
            // Sauvegarder dans le cache
            localStorage.setItem('rmouv_auth_cache', 'true');
            localStorage.setItem('rmouv_user_cache', JSON.stringify(userData));
            localStorage.setItem('rmouv_role_cache', appState.userRole || 'user');
            
            console.log('💾 Cache mis à jour - Utilisateur connecté:', userData);
        } else {
            // Nettoyer le cache
            localStorage.removeItem('rmouv_auth_cache');
            localStorage.removeItem('rmouv_user_cache');
            localStorage.removeItem('rmouv_role_cache');
            
            console.log('🗑️ Cache nettoyé - Utilisateur déconnecté');
        }
    } catch (error) {
        console.error('❌ Erreur mise à jour cache:', error);
    }
}

function updateUI(isLoggedIn, user) {
    console.log('🎨 Mise à jour de l\'UI - Connecté:', isLoggedIn, 'Utilisateur:', user);
    
    // Update app state
    appState.isAuthenticated = isLoggedIn;
    appState.currentUser = user;
    
    // Mettre à jour le cache localStorage
    updateAuthCache(isLoggedIn, user);
    
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
        
        // Gérer l'affichage du bouton d'administration
        updateAdminButtonVisibility();
        
        // Initialize dropdown functionality after a short delay to ensure DOM is ready
        setTimeout(() => {
            initializeUserDropdown();
        }, 100);
    } else {
        console.log('❌ Affichage des boutons d\'authentification');
        // User is not logged in - show auth buttons
        if (authButtons) authButtons.classList.remove('hidden');
        if (authButtonsMobile) authButtonsMobile.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (userMenuMobile) userMenuMobile.classList.add('hidden');
        
        // S'assurer que les boutons admin sont masqués quand déconnecté
        updateAdminButtonVisibility();
    }
}

// Gérer la visibilité du bouton d'administration
function updateAdminButtonVisibility() {
    const adminButtonDesktop = document.getElementById('admin-button-desktop');
    const adminButtonMobile = document.getElementById('admin-button-mobile');
    
    console.log('🔧 Mise à jour visibilité bouton admin:', {
        isAdmin: appState.isAdmin,
        userRole: appState.userRole,
        adminButtonDesktop: !!adminButtonDesktop,
        adminButtonMobile: !!adminButtonMobile
    });
    
    // Par défaut, masquer les boutons (sécurité) avec CSS inline
    if (adminButtonDesktop) {
        adminButtonDesktop.classList.add('hidden');
        adminButtonDesktop.style.display = 'none';
    }
    if (adminButtonMobile) {
        adminButtonMobile.classList.add('hidden');
        adminButtonMobile.style.display = 'none';
    }
    
    // Seulement afficher si l'utilisateur est vraiment admin
    if (appState.isAdmin === true && appState.userRole === 'admin') {
        if (adminButtonDesktop) {
            adminButtonDesktop.classList.remove('hidden');
            adminButtonDesktop.style.display = 'block';
        }
        if (adminButtonMobile) {
            adminButtonMobile.classList.remove('hidden');
            adminButtonMobile.style.display = 'block';
        }
        console.log('✅ Boutons d\'administration affichés');
    } else {
        console.log('❌ Boutons d\'administration masqués - Rôle:', appState.userRole, 'IsAdmin:', appState.isAdmin);
    }
}

// Variable pour éviter les doublons d'écouteurs
let dropdownInitialized = false;

function initializeUserDropdown() {
    if (dropdownInitialized) return; // Éviter les doublons
    
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdown = document.getElementById('user-dropdown');
    
    console.log('🔧 Tentative d\'initialisation du dropdown:', {
        dropdownToggle: !!dropdownToggle,
        dropdown: !!dropdown,
        dropdownInitialized
    });
    
    if (dropdownToggle && dropdown) {
        console.log('🔧 Initialisation du dropdown utilisateur');
        
        // Remove any existing event listeners by cloning the element
        const newToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
        
        newToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🖱️ Clic sur le dropdown toggle');
            dropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!newToggle.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        dropdownInitialized = true;
        console.log('✅ Dropdown initialisé avec succès');
    } else {
        console.log('❌ Éléments dropdown non trouvés');
    }
}

// Auth functions
async function signUp(email, password, userData = {}) {
    if (!supabase) {
        console.error('❌ Supabase non initialisé');
        return { error: { message: 'Supabase non initialisé' } };
    }
    
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
    if (!supabase) {
        console.error('❌ Supabase non initialisé');
        return { error: { message: 'Supabase non initialisé' } };
    }
    
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
    if (!supabase) {
        console.error('❌ Supabase non initialisé');
        return;
    }
    
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

