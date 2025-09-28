// Client Supabase pour R'MouV
// Vérification que Supabase est chargé
if (typeof supabase === 'undefined') {
  throw new Error('Supabase CDN must be loaded before this script');
}

const { createClient } = supabase

// Utilisation des variables d'environnement Netlify (côté client)
// Pour un site statique, Netlify expose les variables sans préfixe
const supabaseUrl = process.env.SUPABASE_DATABASE_URL || window.SUPABASE_DATABASE_URL || 'https://unhenqckskgfeytpkpia.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuaGVucWNrc2tnZmV5dHBrcGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNjI4MDEsImV4cCI6MjA3NDYzODgwMX0.JuNjKcw9QuwdiHZO8CYcb_3YrSAFEzAxodIIBZHdAhw'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Fonctions utilitaires pour l'authentification
export const auth = {
  // Inscription
  async signUp(email, password, userData = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  // Connexion
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Déconnexion
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Obtenir la session actuelle
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Écouter les changements d'authentification
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Fonctions pour les réservations
export const bookings = {
  // Créer une réservation
  async create(bookingData) {
    const { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select()
    return { data, error }
  },

  // Récupérer les réservations de l'utilisateur
  async getUserBookings(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true })
    return { data, error }
  },

  // Supprimer une réservation
  async delete(bookingId) {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
    return { error }
  }
}
