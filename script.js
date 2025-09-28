// R'MouV Website JavaScript
import { auth, bookings } from './supabase-client.js';

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
function initializeAuth() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Listen for auth state changes
    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            appState.currentUser = session.user;
            appState.isAuthenticated = true;
            updateUI();
        } else if (event === 'SIGNED_OUT') {
            appState.currentUser = null;
            appState.isAuthenticated = false;
            updateUI();
        }
    });
}

async function checkAuthStatus() {
    const { session } = await auth.getSession();
    if (session) {
        appState.currentUser = session.user;
        appState.isAuthenticated = true;
        updateUI();
    }
}

function updateUI() {
    const createAccountBtn = document.querySelector('a[href="rejoindre.html"]');
    if (createAccountBtn) {
        if (appState.isAuthenticated) {
            // User is logged in - show user menu
            createAccountBtn.style.display = 'none';
            showUserMenu();
        } else {
            // User is not logged in - show create account button
            createAccountBtn.style.display = 'block';
            hideUserMenu();
        }
    }
}

function showUserMenu() {
    // Create user menu if it doesn't exist
    let userMenu = document.getElementById('user-menu');
    if (!userMenu) {
        userMenu = document.createElement('div');
        userMenu.id = 'user-menu';
        userMenu.className = 'flex items-center space-x-4';
        userMenu.innerHTML = `
            <div class="relative">
                <button id="user-dropdown-toggle" class="flex items-center space-x-2 bg-primary text-white px-3 py-2 rounded-full hover:bg-primary/90 transition-colors">
                    <span id="user-initials" class="font-bold"></span>
                    <i class="fas fa-chevron-down text-sm"></i>
                </button>
                <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                    <div class="py-3 px-2">
                        <div class="px-4 py-2 text-sm text-gray-600 border-b">
                            <span id="user-email"></span>
                        </div>
                        <a href="#" onclick="showBookingSystem()" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                            <i class="fas fa-calendar mr-2"></i>Mes réservations
                        </a>
                        <button onclick="logout()" class="w-full text-left block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                            <i class="fas fa-sign-out-alt mr-2"></i>Se déconnecter
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after the navigation links
        const nav = document.querySelector('.hidden.md\\:flex.items-center.space-x-8');
        if (nav) {
            nav.appendChild(userMenu);
        }
        
        // Add event listeners
        document.getElementById('user-dropdown-toggle').addEventListener('click', function() {
            const dropdown = document.getElementById('user-dropdown');
            dropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('user-dropdown');
            const toggle = document.getElementById('user-dropdown-toggle');
            if (toggle && dropdown && !toggle.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }
    
    // Update user info
    if (appState.currentUser) {
        const email = appState.currentUser.email;
        const initials = email.substring(0, 2).toUpperCase();
        
        document.getElementById('user-initials').textContent = initials;
        document.getElementById('user-email').textContent = email;
    }
    
    userMenu.style.display = 'flex';
}

function hideUserMenu() {
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
        userMenu.style.display = 'none';
    }
}

// Auth functions
async function signUp(email, password, userData = {}) {
    try {
        const { data, error } = await auth.signUp(email, password, userData);
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
        const { data, error } = await auth.signIn(email, password);
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
        const { error } = await auth.signOut();
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

