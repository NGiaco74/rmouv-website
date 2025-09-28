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

// Fonctions utilitaires pour l'authentification
export const auth = {
  // Inscription
  async signUp(email, password, userData = {}) {
    return client.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        // Optionnel mais recommandé si email confirmation activée :
        // Redirige vers une page de votre site (doit être autorisée dans Supabase)
        emailRedirectTo: `${location.origin}/auth/callback`
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
