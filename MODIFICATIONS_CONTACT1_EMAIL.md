# Modifications pour contact1@rmouv.fr

## ✅ Modifications effectuées dans le code

Toutes les occurrences de `contact@rmouv.fr` ont été remplacées par `contact1@rmouv.fr` dans les fichiers suivants :

- ✅ `CONFIGURATION_EMAILS_SUPABASE.md`
- ✅ `contact.html`
- ✅ `cgu.html`
- ✅ `LISTE_TESTS.md`
- ✅ `mentions-legales.html`
- ✅ `politique-confidentialite.html`

## 🔧 Modifications à faire dans Supabase

### 1. Configuration SMTP (si vous utilisez SMTP personnalisé)

1. Allez dans **Authentication** → **Email Templates** → **SMTP Settings**
2. Mettez à jour les champs suivants :
   - **Username** : `contact1@rmouv.fr` (au lieu de `contact@rmouv.fr`)
   - **Sender email** : `contact1@rmouv.fr` (au lieu de `contact@rmouv.fr`)
   - **Password** : Le mot de passe de la nouvelle boîte `contact1@rmouv.fr`

### 2. Vérification des templates d'email

Les templates d'email n'ont pas besoin d'être modifiés car ils utilisent la variable `{{ .SiteURL }}` et `{{ .ConfirmationURL }}` qui sont automatiquement générées.

## 🌐 Modifications à faire dans Netlify

**Aucune modification nécessaire dans Netlify** car :
- Netlify n'utilise pas directement l'adresse email `contact@rmouv.fr` ou `contact1@rmouv.fr`
- Les variables d'environnement Supabase (SUPABASE_URL, SUPABASE_ANON_KEY) restent les mêmes
- Le domaine `rmouv.fr` reste le même

## 📝 Résumé des actions

### Actions requises :
1. ✅ Code mis à jour (fait)
2. ⏳ **À faire** : Mettre à jour les paramètres SMTP dans Supabase avec `contact1@rmouv.fr`
3. ✅ Netlify : Aucune action nécessaire

### Paramètres SMTP à mettre à jour dans Supabase :

| Champ | Nouvelle valeur |
|-------|----------------|
| **Host** | `ssl0.ovh.net` (inchangé) |
| **Port** | `587` (inchangé) |
| **Username** | `contact1@rmouv.fr` ⚠️ **À CHANGER** |
| **Password** | [Mot de passe de contact1@rmouv.fr] ⚠️ **À CHANGER** |
| **Sender email** | `contact1@rmouv.fr` ⚠️ **À CHANGER** |

## 🧪 Test recommandé

Après avoir mis à jour les paramètres SMTP dans Supabase :

1. Créez un compte de test via le formulaire d'inscription
2. Vérifiez que l'email de confirmation est bien envoyé depuis `contact1@rmouv.fr`
3. Vérifiez que le lien de confirmation fonctionne correctement

---

**Date de modification** : 6 décembre 2025  
**Email mis à jour** : `contact@rmouv.fr` → `contact1@rmouv.fr`

