# 🔍 Débogage : Email de Réinitialisation de Mot de Passe

## 📋 Checklist de Vérification

### 1. Vérifier les Logs Supabase

**Étape 1 : Accéder aux logs**
1. Allez dans **Supabase Dashboard** → **Authentication** → **Logs**
2. Filtrez par type : **"Password Recovery"** ou **"Password Reset"**
3. Vérifiez les entrées récentes après votre demande de réinitialisation

**Ce qu'il faut chercher :**
- ✅ **Succès** : Une entrée avec le statut "Success" indique que l'email a été envoyé
- ❌ **Erreur** : Une entrée avec le statut "Error" indique un problème (SMTP, configuration, etc.)

**Exemple de log réussi :**
```
Type: Password Recovery
Status: Success
Email: votre@email.com
Timestamp: [date/heure]
```

**Exemple de log d'erreur :**
```
Type: Password Recovery
Status: Error
Error: SMTP connection failed / Invalid email / etc.
```

### 2. Vérifier la Configuration SMTP

**Étape 1 : Vérifier les paramètres SMTP**
1. Allez dans **Supabase Dashboard** → **Authentication** → **Email Templates** → **SMTP Settings**
2. Vérifiez que les paramètres suivants sont corrects :

   **Host :** `ssl0.ovh.net`
   **Port :** `587` (TLS) ou `465` (SSL)
   **Username :** `contact1@rmouv.fr`
   **Password :** [Le mot de passe de votre boîte email]
   **Sender email :** `contact1@rmouv.fr`
   **Sender name :** `R'MouV`

**Étape 2 : Tester la connexion SMTP**
- Cliquez sur **"Test SMTP Connection"** ou **"Send Test Email"** si disponible
- Si le test échoue, vérifiez :
  - Le mot de passe est correct
  - Le port n'est pas bloqué par un firewall
  - L'adresse email `contact1@rmouv.fr` existe et fonctionne

### 3. Vérifier les Spams et Dossiers Indésirables

**Étape 1 : Vérifier les spams**
- Ouvrez votre boîte email
- Vérifiez le dossier **Spam / Indésirables**
- Cherchez un email de `contact1@rmouv.fr` ou `noreply@supabase.co`

**Étape 2 : Vérifier tous les dossiers**
- Vérifiez aussi :
  - Dossier "Promotions" (Gmail)
  - Dossier "Autres" (Outlook)
  - Dossier "Archive"
  - Dossier "Corbeille"

### 4. Vérifier la Console du Navigateur

**Étape 1 : Ouvrir la console**
1. Sur la page `connexion.html`, appuyez sur **F12** ou **Ctrl+Shift+I**
2. Allez dans l'onglet **Console**

**Étape 2 : Tester la réinitialisation**
1. Cliquez sur "Mot de passe oublié ?"
2. Entrez votre email
3. Cliquez sur "Envoyer"
4. Regardez la console pour voir s'il y a des erreurs

**Erreurs possibles :**
- `Error: Email not found` → L'email n'existe pas dans Supabase
- `Error: SMTP connection failed` → Problème de configuration SMTP
- `Error: Rate limit exceeded` → Trop de tentatives, attendez quelques minutes
- `Error: Invalid email` → Format d'email invalide

### 5. Vérifier les URLs de Redirection

**Étape 1 : Vérifier les URLs autorisées**
1. Allez dans **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Vérifiez que ces URLs sont dans **Redirect URLs** :
   - `https://rmouv.fr/auth/reset-password.html`
   - `https://rmouv-rehabtonmouv.netlify.app/auth/reset-password.html` (développement)

**Étape 2 : Vérifier le Site URL**
- **Site URL** doit être : `https://rmouv.fr`

### 6. Vérifier que l'Email Existe dans Supabase

**Étape 1 : Vérifier dans Supabase**
1. Allez dans **Supabase Dashboard** → **Authentication** → **Users**
2. Cherchez votre email dans la liste
3. Vérifiez que l'utilisateur existe et est actif

**Note :** Si l'email n'existe pas, Supabase peut ne pas envoyer d'email (pour des raisons de sécurité, certains systèmes n'indiquent pas si un email existe ou non).

### 7. Vérifier le Template d'Email

**Étape 1 : Vérifier le template**
1. Allez dans **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Cliquez sur **"Reset Password"**
3. Vérifiez que :
   - Le template contient `{{ .ConfirmationURL }}`
   - Le template est bien sauvegardé
   - Le sujet est défini

### 8. Tester avec un Email Différent

**Si rien ne fonctionne :**
1. Testez avec une autre adresse email (Gmail, Outlook, etc.)
2. Si ça fonctionne avec un autre email, le problème vient peut-être de votre serveur email ou de vos filtres anti-spam

### 9. Vérifier les Limites de Taux (Rate Limiting)

**Étape 1 : Vérifier les limites**
- Supabase limite le nombre d'emails envoyés par utilisateur
- Si vous avez fait plusieurs tentatives, attendez **15-30 minutes** avant de réessayer

**Étape 2 : Vérifier les paramètres**
1. Allez dans **Authentication** → **Email Templates** → **SMTP Settings**
2. Vérifiez **"Minimum interval per user"** (généralement 60 secondes)

### 10. Vérifier les DNS et la Configuration Anti-Spam

**Si les emails arrivent en spam :**
- Vérifiez que les enregistrements DNS (SPF, DKIM, DMARC) sont correctement configurés
- Voir le fichier `CONFIGURATION_DNS_ANTI_SPAM.md` pour les détails

## 🔧 Solutions Courantes

### Problème : Email non reçu

**Solution 1 : Vérifier les logs Supabase**
- Si le log montre "Success" mais vous ne recevez rien, vérifiez les spams
- Si le log montre "Error", corrigez la configuration SMTP

**Solution 2 : Réessayer après quelques minutes**
- Parfois il y a un délai d'envoi
- Attendez 5-10 minutes avant de réessayer

**Solution 3 : Vérifier le format de l'email**
- Assurez-vous que l'email est correct (ex: `test@example.com`)
- Pas d'espaces avant/après l'email

### Problème : Erreur SMTP

**Solution 1 : Vérifier le mot de passe**
- Le mot de passe de `contact1@rmouv.fr` doit être correct
- Essayez de vous connecter à Zimbra avec ce mot de passe pour vérifier

**Solution 2 : Vérifier le port**
- Essayez le port **587** (TLS) au lieu de **465** (SSL) ou vice versa
- Certains réseaux bloquent certains ports

**Solution 3 : Désactiver temporairement SMTP**
- Si SMTP ne fonctionne pas, désactivez-le temporairement
- Supabase utilisera son service email intégré (mais avec des limites)

### Problème : Email arrive en spam

**Solution :**
- Vérifiez la configuration DNS (SPF, DKIM, DMARC)
- Ajoutez `contact1@rmouv.fr` à vos contacts
- Marquez l'email comme "Non spam" si vous le recevez

## 📞 Support

Si rien ne fonctionne après avoir vérifié tous ces points :
1. Vérifiez les logs Supabase pour l'erreur exacte
2. Vérifiez la console du navigateur pour les erreurs JavaScript
3. Contactez le support Supabase si le problème persiste

## ✅ Checklist Rapide

- [ ] Logs Supabase montrent "Success" ?
- [ ] Configuration SMTP correcte ?
- [ ] Email vérifié dans Spam/Indésirables ?
- [ ] Console navigateur sans erreurs ?
- [ ] URLs de redirection configurées ?
- [ ] Email existe dans Supabase ?
- [ ] Template "Reset Password" configuré ?
- [ ] Attendu 5-10 minutes après l'envoi ?
- [ ] Testé avec un autre email ?

