# Configuration des Emails de Confirmation Supabase

## 📧 Personnalisation des Emails de Confirmation

Pour personnaliser les emails de confirmation envoyés par Supabase et qu'ils mentionnent R'MouV, vous devez configurer les templates d'email dans le dashboard Supabase.

## 🔧 Étapes de Configuration

### 1. Accéder au Dashboard Supabase

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Sélectionnez votre projet R'MouV
3. Allez dans **Authentication** → **Email Templates**

### 2. Personnaliser le Template "Confirm signup"

1. Cliquez sur **"Confirm signup"** dans la liste des templates
2. Vous pouvez personnaliser :
   - **Subject** : Sujet de l'email
   - **Body** : Corps de l'email (HTML)

### 3. Template Recommandé pour R'MouV

**Sujet :**
```
Confirmez votre compte R'MouV
```

**Corps (HTML) :**
```html
<h2>Bienvenue chez R'MouV !</h2>
<p>Bonjour,</p>
<p>Merci de vous être inscrit sur R'MouV. Pour finaliser votre inscription, veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse email</a></p>
<p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
<p>{{ .ConfirmationURL }}</p>
<p>Ce lien est valide pendant 24 heures.</p>
<p>À bientôt,<br>L'équipe R'MouV</p>
<p style="color: #5A9FD4; font-size: 12px; margin-top: 20px;">
    R'MouV - Centre Sport-Santé<br>
    Reprends ton corps en main. Révèle-toi.
</p>
```

### 4. Variables Disponibles

Dans les templates Supabase, vous pouvez utiliser :
- `{{ .ConfirmationURL }}` : URL de confirmation avec token
- `{{ .Email }}` : Adresse email de l'utilisateur
- `{{ .Token }}` : Token de confirmation (généralement dans l'URL)
- `{{ .TokenHash }}` : Hash du token
- `{{ .SiteURL }}` : URL de votre site (configurée dans les paramètres)

### 5. Configurer l'URL du Site

1. Dans le dashboard Supabase, allez dans **Authentication** → **URL Configuration**
2. Dans **Site URL**, entrez : `https://rmouv.fr`
3. Dans **Redirect URLs**, ajoutez :
   - `https://rmouv.fr/auth/callback.html`
   - `https://rmouv-rehabtonmouv.netlify.app/auth/callback.html` (pour le développement)

### 6. Configurer SMTP avec OVH/Zimbra (Recommandé pour la Production)

Si vous avez une adresse email OVH/Zimbra (comme `contact1@rmouv.fr`), vous pouvez l'utiliser pour envoyer les emails de confirmation.

#### Paramètres SMTP OVH/Zimbra

1. Allez dans **Authentication** → **Email Templates** → **SMTP Settings**
2. Remplissez les champs suivants avec les paramètres OVH :

   **Host :** `ssl0.ovh.net`
   
   **Port number :** `587` (TLS) ou `465` (SSL)
   - Port 587 avec TLS est recommandé
   - Port 465 avec SSL fonctionne aussi
   
   **Username :** `contact1@rmouv.fr` (votre adresse email complète)
   
   **Password :** Le mot de passe de votre boîte email `contact1@rmouv.fr`
   
   **Minimum interval per user :** `60` secondes (par défaut, pour éviter le spam)

3. **Sender email** : `contact1@rmouv.fr`
4. **Sender name** : `R'MouV`

#### Où trouver ces informations ?

- **Host et Port** : Ces valeurs sont standard pour OVH (`ssl0.ovh.net` et port `587`)
- **Username** : Votre adresse email complète (`contact1@rmouv.fr`)
- **Password** : Le mot de passe de votre boîte email Zimbra/OVH

#### Important : Configuration DNS Anti-Spam

Pour éviter que les emails arrivent dans les spams, configurez les enregistrements DNS (SPF, DKIM, DMARC) chez OVH.

📖 **Guide détaillé** : Voir le fichier `CONFIGURATION_DNS_ANTI_SPAM.md` pour les instructions complètes.

**Résumé rapide :**
- **SPF** : Ajoutez un enregistrement TXT avec `v=spf1 include:mx.ovh.com ~all`
- **DKIM** : Récupérez les clés depuis OVH et ajoutez-les dans DNS
- **DMARC** : Ajoutez un enregistrement TXT `_dmarc` avec votre politique

Ces configurations se font dans l'interface de gestion DNS d'OVH (Zone DNS).

#### Alternative : Utiliser le service email intégré de Supabase

Si vous ne configurez pas SMTP, Supabase utilisera son service email intégré (avec des limites de taux). C'est suffisant pour les tests, mais pour la production, il est recommandé d'utiliser votre propre SMTP.

### 7. Tester la Configuration

1. Créez un compte de test via le formulaire d'inscription
2. Vérifiez que l'email reçu :
   - Mentionne bien "R'MouV"
   - Contient le bon design
   - Le lien de confirmation redirige vers `https://rmouv.fr/auth/callback.html`

## 🔗 URLs de Redirection Configurées

Les URLs suivantes doivent être autorisées dans Supabase :
- `https://rmouv.fr/auth/callback.html` (production)
- `https://rmouv-rehabtonmouv.netlify.app/auth/callback.html` (développement)

## 📝 Notes Importantes

- Les modifications des templates prennent effet immédiatement
- Les emails sont envoyés depuis Supabase, mais vous pouvez personnaliser l'apparence
- Pour un contrôle total, vous pouvez désactiver les emails Supabase et utiliser votre propre service SMTP
- Le lien de confirmation expire après 24 heures par défaut (configurable)

## 🆘 En Cas de Problème

Si les emails ne mentionnent pas R'MouV :
1. Vérifiez que vous avez bien modifié le template "Confirm signup"
2. Vérifiez que les modifications sont sauvegardées
3. Testez avec un nouveau compte
4. Vérifiez les logs dans **Authentication** → **Logs**

Si la redirection ne fonctionne pas :
1. Vérifiez que `https://rmouv.fr/auth/callback.html` est dans la liste des URLs autorisées
2. Vérifiez que le fichier `auth/callback.html` existe bien
3. Vérifiez la console du navigateur pour les erreurs

