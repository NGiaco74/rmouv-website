# 🔍 Debug : Email de Confirmation Non Reçu

## 📋 Checklist de Vérification

### 1. Vérifier les Logs Supabase (PRIORITAIRE)

1. Allez dans **Supabase Dashboard** → **Authentication** → **Logs**
2. Recherchez les entrées récentes pour votre compte de test
3. Vérifiez :
   - ✅ Y a-t-il une entrée "User signed up" ?
   - ✅ Y a-t-il une erreur liée à l'envoi d'email ?
   - ✅ Le statut de l'utilisateur : `email_confirmed_at` est-il `null` ?

**Ce que vous devez voir :**
- Si l'email a été envoyé : `email_confirmed_at: null` (normal, en attente de confirmation)
- Si erreur SMTP : message d'erreur dans les logs

### 2. Vérifier la Configuration SMTP dans Supabase

1. Allez dans **Authentication** → **Email Templates** → **SMTP Settings**
2. Vérifiez que :
   - ✅ **Host** : `ssl0.ovh.net`
   - ✅ **Port** : `587` (ou `465`)
   - ✅ **Username** : `contact1@rmouv.fr`
   - ✅ **Password** : Le mot de passe est bien enregistré (pas vide)
   - ✅ **Sender email** : `contact1@rmouv.fr`

3. **Test de connexion SMTP** :
   - Cliquez sur "Test connection" ou "Save" et vérifiez s'il y a une erreur
   - Si erreur : vérifiez le mot de passe et que le port n'est pas bloqué

### 3. Vérifier que l'Email Confirmation est Activé

1. Allez dans **Authentication** → **Settings** (ou **URL Configuration**)
2. Vérifiez que :
   - ✅ **Enable email confirmations** est activé (ON)
   - ✅ **Double confirm email** est désactivé (OFF) pour les tests

### 4. Vérifier les Spams et Filtres Email

1. ✅ Vérifiez votre dossier **SPAM/Indésirables**
2. ✅ Vérifiez les **filtres** de votre boîte email
3. ✅ Vérifiez si l'email est dans un dossier "Promotions" ou autre

### 5. Vérifier la Console du Navigateur

1. Ouvrez les **Outils de développement** (F12)
2. Onglet **Console**
3. Lors de l'inscription, vérifiez :
   - ✅ Y a-t-il des erreurs JavaScript ?
   - ✅ Le message "Résultat Supabase:" affiche-t-il `data.user` ?
   - ✅ Y a-t-il une erreur dans la réponse Supabase ?

**Ce que vous devez voir dans la console :**
```javascript
Résultat Supabase: {
  data: {
    user: { id: "...", email: "...", email_confirmed_at: null },
    session: null  // Normal si email confirmation activée
  },
  error: null
}
```

### 6. Vérifier les Paramètres d'Email dans Supabase

1. Allez dans **Authentication** → **Email Templates**
2. Vérifiez le template **"Confirm signup"** :
   - ✅ Le template est bien configuré
   - ✅ Le sujet contient "R'MouV" ou "Confirmez"
   - ✅ Le corps contient `{{ .ConfirmationURL }}`

### 7. Tester avec un Email Différent

Essayez de créer un compte avec :
- Un email Gmail
- Un email Outlook
- Un autre fournisseur

Pour voir si le problème est spécifique à votre boîte email.

## 🔧 Solutions Courantes

### Problème 1 : Erreur SMTP dans les Logs

**Symptôme** : Erreur "SMTP connection failed" ou "Authentication failed"

**Solutions :**
1. Vérifiez le mot de passe de `contact1@rmouv.fr`
2. Vérifiez que le port 587 n'est pas bloqué par votre firewall
3. Essayez le port 465 avec SSL au lieu de 587 avec TLS
4. Vérifiez que l'adresse `contact1@rmouv.fr` existe bien dans OVH

### Problème 2 : Email Confirmation Désactivée

**Symptôme** : L'utilisateur est créé mais aucun email n'est envoyé

**Solution :**
1. Allez dans **Authentication** → **Settings**
2. Activez **"Enable email confirmations"**
3. Sauvegardez

### Problème 3 : Email dans les Spams

**Symptôme** : L'email est envoyé (visible dans les logs) mais n'arrive pas

**Solutions :**
1. Vérifiez les spams
2. Ajoutez `contact1@rmouv.fr` à vos contacts
3. Configurez les enregistrements DNS (SPF, DKIM, DMARC) chez OVH

### Problème 4 : Template d'Email Incorrect

**Symptôme** : Erreur dans les logs liée au template

**Solution :**
1. Vérifiez que le template "Confirm signup" utilise bien `{{ .ConfirmationURL }}`
2. Vérifiez qu'il n'y a pas d'erreur de syntaxe dans le template HTML

## 📊 Comment Vérifier les Logs Supabase en Détail

1. **Dashboard Supabase** → **Authentication** → **Logs**
2. Filtrez par :
   - **Event type** : `user_signedup` ou `email_confirmation_sent`
   - **Time range** : Dernières 24 heures
3. Cliquez sur une entrée pour voir les détails :
   - ✅ **User ID** : L'ID de l'utilisateur créé
   - ✅ **Email** : L'adresse email utilisée
   - ✅ **Metadata** : Informations supplémentaires
   - ✅ **Error** : S'il y a une erreur, elle sera ici

## 🧪 Test Rapide

1. Créez un compte de test avec un email Gmail
2. Vérifiez les logs Supabase immédiatement après
3. Vérifiez la boîte Gmail (et les spams)
4. Si ça fonctionne avec Gmail mais pas avec votre email OVH :
   - Le problème vient probablement de la configuration SMTP ou des filtres OVH

## 📞 Si Rien Ne Fonctionne

1. **Vérifiez les logs Supabase** (le plus important)
2. **Testez avec un email Gmail** pour isoler le problème
3. **Vérifiez la console du navigateur** pour les erreurs JavaScript
4. **Contactez le support Supabase** si les logs montrent une erreur côté Supabase

---

**Date** : 6 décembre 2025

