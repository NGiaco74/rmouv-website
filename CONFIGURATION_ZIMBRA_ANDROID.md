# Configuration Zimbra OVH sur Android

## 📱 Paramètres de Serveur Mail pour Android

### Configuration IMAP (Recommandé)

**Avantages IMAP** : Synchronisation bidirectionnelle, emails accessibles sur tous les appareils

#### Serveur de réception (IMAP)
- **Type de compte** : IMAP
- **Serveur** : `ssl0.ovh.net`
- **Port** : `993`
- **Sécurité** : SSL/TLS (ou SSL)
- **Nom d'utilisateur** : `contact1@rmouv.fr` (votre adresse email complète)
- **Mot de passe** : Le mot de passe de votre boîte email

#### Serveur d'envoi (SMTP)
- **Serveur** : `ssl0.ovh.net`
- **Port** : `587` (TLS) ou `465` (SSL)
- **Sécurité** : STARTTLS (pour port 587) ou SSL (pour port 465)
- **Authentification** : Oui (cocher)
- **Nom d'utilisateur** : `contact1@rmouv.fr`
- **Mot de passe** : Le même mot de passe que pour la réception

### Configuration POP3 (Alternative)

**Note** : POP3 télécharge les emails localement, moins pratique pour la synchronisation multi-appareils

#### Serveur de réception (POP3)
- **Type de compte** : POP3
- **Serveur** : `ssl0.ovh.net`
- **Port** : `995`
- **Sécurité** : SSL/TLS
- **Nom d'utilisateur** : `contact1@rmouv.fr`
- **Mot de passe** : Le mot de passe de votre boîte email

#### Serveur d'envoi (SMTP)
- **Serveur** : `ssl0.ovh.net`
- **Port** : `587` (TLS) ou `465` (SSL)
- **Sécurité** : STARTTLS (pour port 587) ou SSL (pour port 465)
- **Authentification** : Oui
- **Nom d'utilisateur** : `contact1@rmouv.fr`
- **Mot de passe** : Le même mot de passe

## 📋 Résumé des Paramètres

| Paramètre | IMAP | POP3 | SMTP |
|-----------|------|------|------|
| **Serveur** | `ssl0.ovh.net` | `ssl0.ovh.net` | `ssl0.ovh.net` |
| **Port** | `993` | `995` | `587` (TLS) ou `465` (SSL) |
| **Sécurité** | SSL/TLS | SSL/TLS | STARTTLS (587) ou SSL (465) |
| **Authentification** | Oui | Oui | Oui |
| **Username** | `contact1@rmouv.fr` | `contact1@rmouv.fr` | `contact1@rmouv.fr` |

## 🔧 Configuration Pas à Pas sur Android

### Méthode 1 : Configuration Manuelle (Gmail, Email par défaut, etc.)

1. Ouvrez l'application **Email** ou **Gmail** sur votre Android
2. Allez dans **Paramètres** → **Ajouter un compte** → **Autre**
3. Entrez votre adresse email : `contact1@rmouv.fr`
4. Sélectionnez **Configuration manuelle**
5. Choisissez **IMAP** (recommandé) ou **POP3**
6. Remplissez les paramètres :
   - **Serveur IMAP** : `ssl0.ovh.net`
   - **Port** : `993`
   - **Sécurité** : SSL/TLS
   - **Nom d'utilisateur** : `contact1@rmouv.fr`
   - **Mot de passe** : [votre mot de passe]
7. Pour SMTP :
   - **Serveur SMTP** : `ssl0.ovh.net`
   - **Port** : `587`
   - **Sécurité** : STARTTLS
   - **Authentification** : Activée
   - **Nom d'utilisateur** : `contact1@rmouv.fr`
   - **Mot de passe** : [votre mot de passe]
8. Cliquez sur **Suivant** et attendez la vérification
9. Configurez les options (synchronisation, notifications, etc.)
10. Terminez la configuration

### Méthode 2 : Configuration Automatique (si disponible)

Certaines applications Android peuvent détecter automatiquement les paramètres OVH :

1. Ouvrez l'application Email
2. Ajoutez un compte
3. Entrez `contact1@rmouv.fr` et votre mot de passe
4. L'application peut détecter automatiquement les paramètres OVH
5. Si la détection automatique échoue, utilisez la méthode manuelle ci-dessus

## ⚙️ Options Recommandées

Après la configuration, configurez :

- **Fréquence de synchronisation** : Toutes les 15 minutes ou "En temps réel" si disponible
- **Synchroniser les 30 derniers jours** : Pour ne pas surcharger l'appareil
- **Notifications** : Activez pour recevoir les alertes
- **Signature email** : Ajoutez une signature professionnelle si souhaité

## 🔍 Vérification

Une fois configuré, testez :

1. ✅ **Réception** : Envoyez-vous un email depuis un autre compte
2. ✅ **Envoi** : Envoyez un email de test depuis votre Android
3. ✅ **Synchronisation** : Vérifiez que les emails apparaissent bien

## 🆘 Problèmes Courants

### Erreur "Connexion impossible" ou "Authentification échouée"

**Solutions :**
1. Vérifiez le mot de passe (sensible à la casse)
2. Vérifiez que vous utilisez bien `contact1@rmouv.fr` comme nom d'utilisateur (pas juste `contact1`)
3. Vérifiez que le port et la sécurité correspondent (993 + SSL pour IMAP, 587 + STARTTLS pour SMTP)
4. Vérifiez votre connexion internet

### Erreur "Serveur non trouvé"

**Solutions :**
1. Vérifiez que le serveur est bien `ssl0.ovh.net` (pas `ssl.ovh.net` ou autre)
2. Vérifiez votre connexion internet/WiFi
3. Essayez avec les données mobiles si vous êtes sur WiFi (ou vice versa)

### Les emails ne se synchronisent pas

**Solutions :**
1. Vérifiez les paramètres de synchronisation dans l'application
2. Vérifiez que la synchronisation automatique est activée
3. Forcez une synchronisation manuelle (tirez vers le bas dans la liste des emails)
4. Redémarrez l'application

### Impossible d'envoyer des emails

**Solutions :**
1. Vérifiez les paramètres SMTP (port 587 + STARTTLS ou port 465 + SSL)
2. Vérifiez que l'authentification SMTP est activée
3. Vérifiez que le nom d'utilisateur et mot de passe SMTP sont corrects
4. Certains opérateurs mobiles bloquent le port 587, essayez le port 465 avec SSL

## 📱 Applications Compatibles

Ces paramètres fonctionnent avec :
- ✅ Gmail (application)
- ✅ Email (application par défaut Android)
- ✅ Outlook (Microsoft)
- ✅ K-9 Mail
- ✅ Blue Mail
- ✅ Aqua Mail
- ✅ Toute application email supportant IMAP/POP3

## 🔐 Sécurité

- ✅ Utilisez toujours SSL/TLS pour la connexion
- ✅ Ne partagez jamais votre mot de passe
- ✅ Activez l'authentification à deux facteurs si disponible dans OVH
- ✅ Utilisez un mot de passe fort

---

**Date de création** : 6 décembre 2025  
**Email** : contact1@rmouv.fr  
**Fournisseur** : OVH Zimbra







