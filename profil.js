// Script pour la page Mon Profil
// Utilise le client Supabase de script.js au lieu d'en créer un nouveau

// Référence au client Supabase (sera initialisé depuis script.js)
let supabaseClient = null;

// Initialiser Supabase en récupérant le client de script.js
async function initializeSupabase() {
    try {
        // Attendre que Supabase soit chargé
        await waitForSupabase();
        
        // Essayer de récupérer le client Supabase de script.js
        // script.js crée le client dans une variable locale, on doit le recréer
        if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log('✅ Client Supabase créé dans profil.js');
            console.log('✅ URL:', window.SUPABASE_URL);
            return true;
        } else {
            console.error('❌ Variables Supabase manquantes:', {
                hasSupabaseLib: !!window.supabase,
                hasUrl: !!window.SUPABASE_URL,
                hasKey: !!window.SUPABASE_ANON_KEY
            });
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur initialisation Supabase:', error);
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
        
        let attempts = 0;
        const maxAttempts = 50; // 5 secondes max
        
        const checkSupabase = () => {
            attempts++;
            if (window.supabase) {
                resolve();
            } else if (attempts < maxAttempts) {
                setTimeout(checkSupabase, 100);
            } else {
                reject(new Error('Timeout: Supabase n\'a pas pu être chargé'));
            }
        };
        
        checkSupabase();
    });
}

// Charger les données du profil
async function loadProfile() {
    if (!supabaseClient) {
        console.error('❌ Supabase non initialisé dans loadProfile');
        showNotification('Erreur: Supabase non initialisé', 'error');
        return;
    }
    
    try {
        console.log('🔍 Vérification de la session...');
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Erreur session:', sessionError);
            showNotification('Erreur de session: ' + sessionError.message, 'error');
            return;
        }
        
        if (!session) {
            console.error('❌ Pas de session active');
            showNotification('Vous devez être connecté', 'error');
            setTimeout(() => {
                window.location.href = 'connexion.html';
            }, 2000);
            return;
        }
        
        const userId = session.user.id;
        console.log('✅ Session active - userId:', userId);
        console.log('✅ Email session:', session.user.email);
        console.log('✅ User metadata:', session.user.user_metadata);
        
        // Test de la requête avec logs détaillés
        console.log('📤 Envoi requête SELECT sur profiles...');
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        console.log('📥 Réponse reçue:', {
            hasData: !!profile,
            hasError: !!profileError,
            profile: profile,
            error: profileError
        });
        
        // Si le profil n'existe pas, le créer avec les données de base
        if (profileError) {
            console.error('❌ Erreur lors du chargement du profil');
            console.error('Code erreur:', profileError.code);
            console.error('Message:', profileError.message);
            console.error('Détails complets:', JSON.stringify(profileError, null, 2));
            
            if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows') || profileError.message?.includes('not found')) {
                console.log('⚠️ Profil inexistant, création...');
                
                // Créer un profil de base
                const { data: newProfile, error: createError } = await supabaseClient
                    .from('profiles')
                    .insert({
                        id: userId,
                        email: session.user.email,
                        first_name: session.user.user_metadata?.first_name || '',
                        last_name: session.user.user_metadata?.last_name || '',
                        role: 'user'
                    })
                    .select()
                    .single();
                
                if (createError) {
                    console.error('❌ Erreur création profil:', createError);
                    showNotification('Erreur lors de la création du profil: ' + createError.message, 'error');
                    return;
                }
                
                profile = newProfile;
                console.log('✅ Profil créé:', profile);
            } else if (profileError.code === '42501' || profileError.message?.includes('permission')) {
                console.error('🚫 Erreur de permissions RLS');
                showNotification('Erreur de permissions. Vérifiez les politiques RLS dans Supabase.', 'error');
                alert('Erreur de permissions RLS. Veuillez contacter l\'administrateur.');
                return;
            } else {
                showNotification('Erreur lors du chargement du profil: ' + profileError.message, 'error');
                return;
            }
        } else {
            console.log('✅ Profil chargé avec succès:', profile);
            console.log('📊 Détails profil:', {
                id: profile.id,
                email: profile.email,
                first_name: profile.first_name,
                last_name: profile.last_name,
                phone: profile.phone,
                date_of_birth: profile.date_of_birth
            });
        }
        
        // Remplir le formulaire - utiliser les données du profil ou celles de la session
        const firstNameInput = document.getElementById('first-name');
        const lastNameInput = document.getElementById('last-name');
        const emailInput = document.getElementById('email');
        
        console.log('📝 Remplissage formulaire:', {
            profileFirstName: profile.first_name,
            profileLastName: profile.last_name,
            metadataFirstName: session.user.user_metadata?.first_name,
            metadataLastName: session.user.user_metadata?.last_name,
            profileEmail: profile.email,
            sessionEmail: session.user.email
        });
        
        // Vérifier que profile existe
        if (!profile) {
            console.error('❌ Profile est null ou undefined');
            showNotification('Profil introuvable', 'error');
            return;
        }
        
        console.log('📝 Remplissage des champs du formulaire...');
        
        if (firstNameInput) {
            const firstNameValue = profile.first_name || session.user.user_metadata?.first_name || '';
            firstNameInput.value = firstNameValue;
            console.log('✅ Prénom rempli:', firstNameValue, 'depuis:', profile.first_name ? 'profil' : 'metadata');
        } else {
            console.error('❌ Champ first-name non trouvé dans le DOM');
        }
        
        if (lastNameInput) {
            const lastNameValue = profile.last_name || session.user.user_metadata?.last_name || '';
            lastNameInput.value = lastNameValue;
            console.log('✅ Nom rempli:', lastNameValue, 'depuis:', profile.last_name ? 'profil' : 'metadata');
        } else {
            console.error('❌ Champ last-name non trouvé dans le DOM');
        }
        
        if (emailInput) {
            const emailValue = profile.email || session.user.email || '';
            emailInput.value = emailValue;
            console.log('✅ Email rempli:', emailValue);
        } else {
            console.error('❌ Champ email non trouvé');
        }
        
        const phoneInput = document.getElementById('phone');
        const dateOfBirthInput = document.getElementById('date-of-birth');
        const genderInput = document.getElementById('gender');
        const pathologiesInput = document.getElementById('pathologies');
        const contraindicationsInput = document.getElementById('contraindications');
        const emergencyContactNameInput = document.getElementById('emergency-contact-name');
        const emergencyContactPhoneInput = document.getElementById('emergency-contact-phone');
        
        if (phoneInput) phoneInput.value = profile.phone || '';
        if (dateOfBirthInput) dateOfBirthInput.value = profile.date_of_birth || '';
        if (genderInput) genderInput.value = profile.gender || '';
        
        // Pathologies (tableau -> chaîne)
        if (pathologiesInput && profile.pathologies && Array.isArray(profile.pathologies)) {
            pathologiesInput.value = profile.pathologies.join(', ');
        } else if (pathologiesInput) {
            pathologiesInput.value = '';
        }
        
        if (contraindicationsInput) contraindicationsInput.value = profile.contraindications || '';
        if (emergencyContactNameInput) emergencyContactNameInput.value = profile.emergency_contact_name || '';
        if (emergencyContactPhoneInput) emergencyContactPhoneInput.value = profile.emergency_contact_phone || '';
        
    } catch (error) {
        console.error('❌ Erreur chargement profil:', error);
        showNotification('Erreur lors du chargement du profil', 'error');
    }
}

// Sauvegarder le profil
async function saveProfile(event) {
    event.preventDefault();
    
    if (!supabaseClient) {
        console.error('❌ Supabase non initialisé');
        return;
    }
    
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError || !session) {
            window.location.href = 'connexion.html';
            return;
        }
        
        const userId = session.user.id;
        
        // Récupérer les données du formulaire
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const phone = document.getElementById('phone').value;
        const dateOfBirth = document.getElementById('date-of-birth').value;
        const gender = document.getElementById('gender').value;
        const pathologiesText = document.getElementById('pathologies').value;
        const contraindications = document.getElementById('contraindications').value;
        const emergencyContactName = document.getElementById('emergency-contact-name').value;
        const emergencyContactPhone = document.getElementById('emergency-contact-phone').value;
        
        // Convertir les pathologies en tableau
        const pathologies = pathologiesText ? pathologiesText.split(',').map(p => p.trim()).filter(p => p) : null;
        
        // Préparer les données de mise à jour (ne pas inclure l'email car c'est géré par auth)
        const updateData = {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone ? phone.trim() : null,
            date_of_birth: dateOfBirth || null,
            gender: gender || null,
            pathologies: pathologies && pathologies.length > 0 ? pathologies : null,
            contraindications: contraindications ? contraindications.trim() : null,
            emergency_contact_name: emergencyContactName ? emergencyContactName.trim() : null,
            emergency_contact_phone: emergencyContactPhone ? emergencyContactPhone.trim() : null,
            updated_at: new Date().toISOString(),
            // Si des infos patient sont présentes, définir le statut
            patient_status: (phone || dateOfBirth || pathologies?.length > 0) ? 'active' : null
        };
        
        // Ne pas mettre à jour l'email ici car il est géré par auth.users
        // L'email dans profiles est synchronisé depuis auth.users
        
        // Désactiver le bouton et afficher le loading
        const saveBtn = document.getElementById('save-btn');
        const saveText = document.getElementById('save-text');
        const saveLoading = document.getElementById('save-loading');
        
        saveBtn.disabled = true;
        saveText.classList.add('hidden');
        saveLoading.classList.remove('hidden');
        
        // Mettre à jour le profil
        console.log('📤 Tentative de mise à jour profil:', updateData);
        const { data: updatedData, error: updateError } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select();
        
        if (updateError) {
            console.error('❌ Erreur mise à jour profil:', updateError);
            console.error('Détails erreur:', JSON.stringify(updateError, null, 2));
            showNotification('Erreur lors de la sauvegarde: ' + updateError.message, 'error');
        } else {
            console.log('✅ Profil mis à jour avec succès:', updatedData);
            showNotification('Profil mis à jour avec succès !', 'success');
            
            // Recharger le profil pour afficher les nouvelles données
            setTimeout(async () => {
                await loadProfile();
            }, 500);
        }
        
        // Réactiver le bouton
        saveBtn.disabled = false;
        saveText.classList.remove('hidden');
        saveLoading.classList.add('hidden');
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde profil:', error);
        showNotification('Erreur lors de la sauvegarde', 'error');
        
        // Réactiver le bouton
        const saveBtn = document.getElementById('save-btn');
        const saveText = document.getElementById('save-text');
        const saveLoading = document.getElementById('save-loading');
        saveBtn.disabled = false;
        saveText.classList.remove('hidden');
        saveLoading.classList.add('hidden');
    }
}

// Fonction de notification
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;
    
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            notification.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-500', 'text-white');
            break;
        default:
            notification.classList.add('bg-blue-500', 'text-white');
    }
    
    notification.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Initialiser la page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page profil chargée');
    
    // Attendre un peu pour que script.js se charge
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Initialiser Supabase
    const supabaseReady = await initializeSupabase();
    if (!supabaseReady) {
        console.error('❌ Impossible d\'initialiser Supabase');
        showNotification('Erreur d\'initialisation. Veuillez rafraîchir la page.', 'error');
        return;
    }
    
    // Vérifier la session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        console.error('❌ Pas de session:', sessionError);
        showNotification('Vous devez être connecté pour accéder à votre profil', 'error');
        setTimeout(() => {
            window.location.href = 'connexion.html';
        }, 2000);
        return;
    }
    
    // Charger le profil
    await loadProfile();
    
    // Configurer le formulaire
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
        console.log('✅ Formulaire configuré');
    } else {
        console.error('❌ Formulaire profile-form non trouvé');
    }
    
    // Attendre que script.js initialise le menu utilisateur
    setTimeout(() => {
        // Le menu devrait être initialisé par script.js
    }, 500);
});

