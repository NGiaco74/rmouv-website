// Client Supabase pour R'MouV
// Le global "supabase" est fourni par le CDN (script précédent)
/* global supabase */

if (typeof supabase === 'undefined') {
  throw new Error('Supabase CDN must be loaded before this script');
}

const { createClient } = supabase

// Utilisation de la Project URL + anon key (exposées côté client)
const supabaseUrl = window.SUPABASE_URL;          // ✅ Project URL
const supabaseAnonKey = window.SUPABASE_ANON_KEY; // ✅ anon/publishable key

export const client = createClient(supabaseUrl, supabaseAnonKey)

// URL du site de production (utilisée pour les redirections d'email)
// En développement, utilise location.origin, en production utilise rmouv.fr
const SITE_URL = window.SITE_URL || (location.hostname === 'localhost' || location.hostname.includes('netlify.app') 
  ? 'https://rmouv.fr' 
  : location.origin);

// Fonctions utilitaires pour l'authentification
export const auth = {
  // Inscription
  async signUp(email, password, userData = {}) {
    return client.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        // Redirige vers la page de callback de confirmation d'email
        // Utilise toujours l'URL de production pour éviter les redirections vers .netlify.app
        emailRedirectTo: `${SITE_URL}/auth/callback.html`
      }
    });
  },

  // Connexion
  async signIn(email, password) {
    return client.auth.signInWithPassword({ email, password });
  },

  // Déconnexion
  async signOut() {
    return client.auth.signOut();
  },

  // Obtenir la session actuelle
  async getSession() {
    return client.auth.getSession();
  },

  // Écouter les changements d'authentification
  onAuthStateChange(callback) {
    return client.auth.onAuthStateChange(callback);
  }
}

// Fonctions pour les réservations
export const bookings = {
  // Créer une réservation
  async create(bookingData) {
    return client
      .from('bookings')
      .insert([bookingData])
      .select()
  },

  // Récupérer les réservations de l'utilisateur
  async getUserBookings(userId) {
    return client
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true })
  },

  // Supprimer une réservation
  async delete(bookingId) {
    return client
      .from('bookings')
      .delete()
      .eq('id', bookingId)
  }
}
