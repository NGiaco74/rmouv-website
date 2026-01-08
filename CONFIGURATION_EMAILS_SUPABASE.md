# Configuration des Emails de Confirmation Supabase

## 📧 Personnalisation des Emails de Confirmation

Pour personnaliser les emails de confirmation envoyés par Supabase et qu'ils mentionnent R'MouV, vous devez configurer les templates d'email dans le dashboard Supabase.

## 🔧 Étapes de Configuration

### 1. Accéder au Dashboard Supabase

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Sélectionnez votre projet R'MouV
3. Allez dans **Authentication** → **Email Templates**

### 2. Personnaliser les Templates d'Email

Supabase propose plusieurs templates d'email. Les principaux sont :
- **"Confirm signup"** : Email de confirmation lors de l'inscription
- **"Reset Password"** : Email de réinitialisation de mot de passe
- **"Magic Link"** : Email de connexion sans mot de passe (si activé)

#### Template "Confirm signup"

1. Cliquez sur **"Confirm signup"** dans la liste des templates
2. Vous pouvez personnaliser :
   - **Subject** : Sujet de l'email
   - **Body** : Corps de l'email (HTML)

### 3. Template Recommandé pour R'MouV (avec Logo HTML)

**Sujet :**
```
Confirmez votre compte R'MouV
```

**Corps (HTML) - Template Professionnel avec Logo (Couleurs R'MouV) :**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header avec Logo et accent orange -->
                    <tr>
                        <td align="center" style="padding: 40px 20px 20px 20px; background-color: #ffffff; border-radius: 8px 8px 0 0; border-top: 4px solid #FF8A3E;">
                            <img src="https://rmouv.fr/Images/Logo.png" alt="R'MouV Logo" style="max-width: 200px; height: auto; display: block;">
                        </td>
                    </tr>
                    
                    <!-- Contenu principal -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <h2 style="color: #37474F; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                                Bienvenue chez <span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span> !
                            </h2>
                            
                            <p style="color: #37474F; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Bonjour,
                            </p>
                            
                            <p style="color: #37474F; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Merci de vous être inscrit sur <strong><span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span></strong>. Pour finaliser votre inscription et accéder à tous nos services, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :
                            </p>
                            
                            <!-- Bouton de confirmation (couleur primaire bleue) -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #5A9FD4; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 600; font-size: 16px; text-align: center; box-shadow: 0 2px 4px rgba(90, 159, 212, 0.3);">
                                            Confirmer mon adresse email
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #37474F; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0; opacity: 0.8;">
                                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                            </p>
                            
                            <p style="color: #5A9FD4; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; word-break: break-all;">
                                {{ .ConfirmationURL }}
                            </p>
                            
                            <p style="color: #37474F; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; opacity: 0.7;">
                                ⏰ Ce lien est valide pendant 24 heures.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer avec couleurs R'MouV -->
                    <tr>
                        <td style="padding: 30px 40px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 0 0 8px 8px; border-top: 2px solid #5A9FD4;">
                            <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">
                                <span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span> - Centre Sport-Santé
                            </p>
                            <p style="color: #FF8A3E; font-size: 13px; margin: 0 0 12px 0; text-align: center; font-style: italic; font-weight: 500;">
                                Reprends ton corps en main. Révèle-toi.
                            </p>
                            <p style="color: #37474F; font-size: 11px; margin: 0; text-align: center; opacity: 0.6;">
                                © <span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span> - Tous droits réservés
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Note importante :** Le logo utilise l'URL absolue `https://rmouv.fr/Images/Logo.png`. Assurez-vous que cette URL est accessible publiquement pour que le logo s'affiche correctement dans les emails.

#### Template "Reset Password" (Réinitialisation de mot de passe)

**Sujet :**
```
Réinitialisez votre mot de passe R'MouV
```

**Corps (HTML) - Template Professionnel avec Logo (Couleurs R'MouV) :**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header avec Logo et accent orange -->
                    <tr>
                        <td align="center" style="padding: 40px 20px 20px 20px; background-color: #ffffff; border-radius: 8px 8px 0 0; border-top: 4px solid #FF8A3E;">
                            <img src="https://rmouv.fr/Images/Logo.png" alt="R'MouV Logo" style="max-width: 200px; height: auto; display: block;">
                        </td>
                    </tr>
                    
                    <!-- Contenu principal -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <h2 style="color: #37474F; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                                Réinitialisation de votre mot de passe
                            </h2>
                            
                            <p style="color: #37474F; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Bonjour,
                            </p>
                            
                            <p style="color: #37474F; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Vous avez demandé à réinitialiser votre mot de passe pour votre compte <strong><span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span></strong>. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
                            </p>
                            
                            <!-- Bouton de réinitialisation (couleur primaire bleue) -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #5A9FD4; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 600; font-size: 16px; text-align: center; box-shadow: 0 2px 4px rgba(90, 159, 212, 0.3);">
                                            Réinitialiser mon mot de passe
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #37474F; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0; opacity: 0.8;">
                                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                            </p>
                            
                            <p style="color: #5A9FD4; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; word-break: break-all;">
                                {{ .ConfirmationURL }}
                            </p>
                            
                            <p style="color: #37474F; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; opacity: 0.7;">
                                ⏰ Ce lien est valide pendant 1 heure.
                            </p>
                            
                            <p style="color: #EF4444; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; font-weight: 500;">
                                ⚠️ Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer avec couleurs R'MouV -->
                    <tr>
                        <td style="padding: 30px 40px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 0 0 8px 8px; border-top: 2px solid #5A9FD4;">
                            <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">
                                <span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span> - Centre Sport-Santé
                            </p>
                            <p style="color: #FF8A3E; font-size: 13px; margin: 0 0 12px 0; text-align: center; font-style: italic; font-weight: 500;">
                                Reprends ton corps en main. Révèle-toi.
                            </p>
                            <p style="color: #37474F; font-size: 11px; margin: 0; text-align: center; opacity: 0.6;">
                                © <span style="color: #5A9FD4;">R'</span><span style="color: #FF8A3E;">MouV</span> - Tous droits réservés
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Note :** Pour le template "Reset Password", utilisez `{{ .ConfirmationURL }}` qui contient le lien vers `https://rmouv.fr/auth/reset-password.html` avec les paramètres nécessaires.

### 3. Variables Disponibles

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
- `https://rmouv.fr/auth/callback.html` (confirmation d'inscription - production)
- `https://rmouv.fr/auth/reset-password.html` (réinitialisation de mot de passe - production)
- `https://rmouv-rehabtonmouv.netlify.app/auth/callback.html` (développement)
- `https://rmouv-rehabtonmouv.netlify.app/auth/reset-password.html` (développement)

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

