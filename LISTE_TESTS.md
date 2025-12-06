# Liste des Tests à Effectuer - Site R'MouV

## 📋 Table des matières
1. [Tests Fonctionnels](#tests-fonctionnels)
2. [Tests d'Authentification](#tests-dauthentification)
3. [Tests de Réservation](#tests-de-réservation)
4. [Tests d'Interface Admin](#tests-dinterface-admin)
5. [Tests de Navigation](#tests-de-navigation)
6. [Tests de Formulaires](#tests-de-formulaires)
7. [Tests Responsive](#tests-responsive)
8. [Tests SEO](#tests-seo)
9. [Tests de Performance](#tests-de-performance)
10. [Tests de Compatibilité](#tests-de-compatibilité)
11. [Tests de Sécurité](#tests-de-sécurité)
12. [Tests de Contenu](#tests-de-contenu)

---

## 1. Tests Fonctionnels

### 1.1. Pages principales
- [ ] **Page d'accueil (index.html)**
  - [ ] Toutes les sections s'affichent correctement
  - [ ] Les liens de navigation fonctionnent
  - [ ] Les boutons "En savoir plus" redirigent vers les bonnes pages
  - [ ] Le logo dans le hero s'affiche correctement avec l'effet de relief
  - [ ] Le texte du hero est lisible par-dessus le logo
  - [ ] Les animations fonctionnent

- [ ] **Page Projet (projet.html)**
  - [ ] Le contenu s'affiche correctement
  - [ ] Les liens internes fonctionnent
  - [ ] Les images s'affichent

- [ ] **Page Équipements (equipements.html)**
  - [ ] La navigation par flèches fonctionne
  - [ ] Les vignettes sont cliquables
  - [ ] Les détails de chaque équipement s'affichent
  - [ ] Le scroll automatique fonctionne
  - [ ] Toutes les images d'équipements s'affichent

- [ ] **Page Équipe (equipe.html)**
  - [ ] Les photos de Camille et Jéromine s'affichent
  - [ ] Les coordonnées sont correctes
  - [ ] Le lien Doctolib fonctionne
  - [ ] La mention "(prise de RDV non disponible)" est visible

- [ ] **Page Contact (contact.html)**
  - [ ] L'adresse est correcte : 400 Rue Barthélemy Thimonnier, 69530 Brignais
  - [ ] Les deux numéros de téléphone sont affichés avec les bons noms
  - [ ] L'email contact1@rmouv.fr est correct
  - [ ] Le formulaire de contact est fonctionnel

- [ ] **Page Rejoindre (rejoindre.html)**
  - [ ] Le contenu s'affiche correctement
  - [ ] Les liens fonctionnent

### 1.2. Pages utilisateur
- [ ] **Page Inscription (inscription.html)**
  - [ ] Le formulaire d'inscription fonctionne
  - [ ] La validation des champs fonctionne
  - [ ] La case à cocher CGU/politique de confidentialité est obligatoire
  - [ ] Les liens vers CGU et politique de confidentialité fonctionnent
  - [ ] Le message d'erreur s'affiche en cas d'email déjà utilisé
  - [ ] Le message de succès s'affiche après inscription

- [ ] **Page Connexion (connexion.html)**
  - [ ] La connexion fonctionne avec un compte valide
  - [ ] Le message d'erreur s'affiche avec des identifiants incorrects
  - [ ] La redirection après connexion fonctionne
  - [ ] Le lien "Mot de passe oublié" fonctionne (si implémenté)

- [ ] **Page Réservation (reservation.html)**
  - [ ] La page nécessite une connexion (redirection si non connecté)
  - [ ] Le calendrier s'affiche correctement
  - [ ] Les créneaux disponibles sont visibles
  - [ ] La réservation d'un créneau fonctionne
  - [ ] La confirmation de réservation s'affiche
  - [ ] L'email de confirmation est envoyé (si implémenté)

- [ ] **Page Mes Réservations (mes-reservations.html)**
  - [ ] La liste des réservations s'affiche
  - [ ] Les réservations passées et à venir sont distinguées
  - [ ] L'annulation d'une réservation fonctionne
  - [ ] La modification d'une réservation fonctionne (si implémenté)

- [ ] **Page Profil (profil.html)**
  - [ ] Les informations du profil s'affichent
  - [ ] La modification des informations fonctionne
  - [ ] La modification du mot de passe fonctionne
  - [ ] La suppression du compte fonctionne (si implémenté)

### 1.3. Pages légales
- [ ] **Mentions Légales (mentions-legales.html)**
  - [ ] Le contenu est complet
  - [ ] Les liens vers politique de confidentialité et CGU fonctionnent
  - [ ] Les informations (SIRET, adresse, téléphone) sont correctes

- [ ] **Politique de Confidentialité (politique-confidentialite.html)**
  - [ ] Le contenu est complet
  - [ ] Les liens vers mentions légales et CGU fonctionnent
  - [ ] La date de mise à jour est correcte

- [ ] **CGU (cgu.html)**
  - [ ] Le contenu est complet
  - [ ] Les liens vers mentions légales et politique de confidentialité fonctionnent
  - [ ] La date de mise à jour est correcte

---

## 2. Tests d'Authentification

### 2.1. Inscription
- [ ] Création de compte avec email valide
- [ ] Création de compte avec email déjà utilisé → erreur
- [ ] Validation du mot de passe (critères de sécurité)
- [ ] Validation des champs obligatoires
- [ ] Acceptation obligatoire des CGU/politique de confidentialité
- [ ] Stockage sécurisé du mot de passe (hashé)

### 2.2. Connexion
- [ ] Connexion avec identifiants valides
- [ ] Connexion avec email incorrect → erreur
- [ ] Connexion avec mot de passe incorrect → erreur
- [ ] Mémorisation de la session (si implémenté)
- [ ] Déconnexion fonctionne
- [ ] Redirection après connexion

### 2.3. Gestion de session
- [ ] La session persiste après rafraîchissement de page
- [ ] La session expire après inactivité (si configuré)
- [ ] Le bouton "Se déconnecter" est visible quand connecté
- [ ] Le menu utilisateur s'affiche correctement
- [ ] Les initiales de l'utilisateur s'affichent

---

## 3. Tests de Réservation

### 3.1. Affichage des créneaux
- [ ] Les créneaux disponibles s'affichent
- [ ] Les créneaux complets sont indiqués
- [ ] Les créneaux passés ne sont pas sélectionnables
- [ ] Le calendrier affiche les bons jours

### 3.2. Réservation
- [ ] Réservation d'un créneau disponible → succès
- [ ] Réservation d'un créneau complet → erreur
- [ ] Réservation d'un créneau passé → erreur
- [ ] Double réservation du même créneau → erreur
- [ ] Confirmation de réservation affichée
- [ ] Email de confirmation envoyé (si implémenté)

### 3.3. Gestion des réservations
- [ ] Annulation d'une réservation → succès
- [ ] Modification d'une réservation (si implémenté)
- [ ] Liste des réservations à venir
- [ ] Liste des réservations passées
- [ ] Historique des réservations

---

## 4. Tests d'Interface Admin

### 4.1. Accès admin
- [ ] Connexion admin avec identifiants valides
- [ ] Accès refusé avec compte utilisateur normal
- [ ] Redirection si tentative d'accès non autorisé

### 4.2. Dashboard admin
- [ ] Les statistiques s'affichent
- [ ] Le nombre de réservations est correct
- [ ] Le nombre d'utilisateurs est correct
- [ ] Les graphiques s'affichent (si présents)

### 4.3. Gestion des réservations
- [ ] Liste de toutes les réservations
- [ ] Filtres par date fonctionnent
- [ ] Filtres par statut fonctionnent
- [ ] Annulation d'une réservation par l'admin
- [ ] Modification d'une réservation par l'admin
- [ ] Export des données (si implémenté)

### 4.4. Gestion des créneaux
- [ ] Création d'un nouveau créneau
- [ ] Modification d'un créneau existant
- [ ] Suppression d'un créneau
- [ ] Création de créneaux récurrents (si implémenté)

---

## 5. Tests de Navigation

### 5.1. Header
- [ ] Le logo redirige vers la page d'accueil
- [ ] Tous les liens de navigation fonctionnent
- [ ] Le menu hamburger s'affiche sur mobile/tablette
- [ ] Le menu hamburger s'ouvre et se ferme correctement
- [ ] Le menu mobile contient tous les liens
- [ ] Les boutons d'authentification s'affichent quand non connecté
- [ ] Le menu utilisateur s'affiche quand connecté
- [ ] Le bouton "Se déconnecter" est en rouge
- [ ] Le menu utilisateur contient tous les liens (réservation, profil, etc.)
- [ ] Le bouton admin s'affiche pour les administrateurs

### 5.2. Footer
- [ ] Tous les liens du footer fonctionnent
- [ ] Les liens vers les pages légales fonctionnent
- [ ] Les informations de contact sont correctes
- [ ] Le copyright est à jour

### 5.3. Liens internes
- [ ] Tous les liens entre pages fonctionnent
- [ ] Les ancres (#projet, #equipements, etc.) fonctionnent
- [ ] Les liens vers les pages légales depuis les formulaires fonctionnent

---

## 6. Tests de Formulaires

### 6.1. Formulaire de contact
- [ ] Tous les champs obligatoires sont validés
- [ ] L'email est au bon format
- [ ] Le téléphone est au bon format
- [ ] La case à cocher politique de confidentialité est obligatoire
- [ ] Le lien vers la politique de confidentialité fonctionne
- [ ] L'envoi du formulaire fonctionne
- [ ] Le message de confirmation s'affiche
- [ ] L'email est reçu (si configuré)

### 6.2. Formulaire d'inscription
- [ ] Validation de l'email (format)
- [ ] Validation du mot de passe (critères)
- [ ] Confirmation du mot de passe
- [ ] Validation des champs obligatoires
- [ ] Case à cocher CGU/politique obligatoire
- [ ] Messages d'erreur appropriés

### 6.3. Formulaire de connexion
- [ ] Validation de l'email
- [ ] Validation du mot de passe
- [ ] Messages d'erreur appropriés

### 6.4. Formulaire de profil
- [ ] Modification des informations fonctionne
- [ ] Validation des champs
- [ ] Sauvegarde des modifications

---

## 7. Tests Responsive

### 7.1. Mobile (320px - 768px)
- [ ] Le header s'adapte (menu hamburger visible)
- [ ] Le menu hamburger contient tous les éléments
- [ ] Le logo du hero s'adapte et ne coupe pas le texte
- [ ] Les sections s'empilent correctement
- [ ] Les images s'adaptent
- [ ] Les formulaires sont utilisables
- [ ] Les boutons sont accessibles
- [ ] Le footer s'adapte

### 7.2. Tablette (768px - 1024px)
- [ ] Le layout s'adapte correctement
- [ ] Le menu hamburger s'affiche (xl:hidden)
- [ ] Les grilles s'adaptent (2 colonnes au lieu de 3-4)
- [ ] Le logo du hero reste visible et bien positionné

### 7.3. Desktop (1024px+)
- [ ] Le menu de navigation horizontal s'affiche
- [ ] Le menu hamburger est caché
- [ ] Les grilles s'affichent en plusieurs colonnes
- [ ] Le logo du hero est bien positionné

### 7.4. Points de rupture spécifiques
- [ ] **xl (1280px)** : Passage du menu hamburger au menu horizontal
- [ ] **md (768px)** : Adaptation des grilles
- [ ] **sm (640px)** : Adaptation du texte et des espacements

---

## 8. Tests SEO

### 8.1. Métadonnées
- [ ] Toutes les pages ont un `<title>` unique
- [ ] Toutes les pages ont une `<meta description>` unique
- [ ] Les balises Open Graph sont présentes sur toutes les pages
- [ ] Les balises canoniques sont présentes sur toutes les pages
- [ ] Les URLs sont propres et descriptives

### 8.2. Données structurées
- [ ] Les données Schema.org sont présentes (index.html)
- [ ] Les données Schema.org sont valides (tester avec Google Rich Results Test)
- [ ] Les informations (adresse, téléphone, etc.) sont correctes

### 8.3. Sitemap
- [ ] Le sitemap.xml est accessible
- [ ] Toutes les pages importantes sont listées
- [ ] Les URLs du sitemap sont correctes (https://rmouv.fr)
- [ ] Les dates de dernière modification sont à jour

### 8.4. Robots.txt
- [ ] Le robots.txt est accessible
- [ ] Le sitemap est référencé
- [ ] Les pages admin sont bloquées

### 8.5. Liens
- [ ] Tous les liens internes fonctionnent
- [ ] Pas de liens cassés (404)
- [ ] Les liens externes s'ouvrent dans un nouvel onglet (si nécessaire)

---

## 9. Tests de Performance

### 9.1. Vitesse de chargement
- [ ] Page d'accueil charge en < 3 secondes
- [ ] Les autres pages chargent rapidement
- [ ] Les images sont optimisées (compression)
- [ ] Les ressources externes (CDN) chargent rapidement

### 9.2. Optimisations
- [ ] Les images ont des attributs `alt` appropriés
- [ ] Les images sont au bon format (WebP si possible)
- [ ] Le CSS est minifié (si applicable)
- [ ] Le JavaScript est optimisé

### 9.3. Outils de test
- [ ] **Google PageSpeed Insights** : Score > 80
- [ ] **GTmetrix** : Note A ou B
- [ ] **WebPageTest** : Temps de chargement acceptable

---

## 10. Tests de Compatibilité

### 10.1. Navigateurs
- [ ] **Chrome** (dernière version)
- [ ] **Firefox** (dernière version)
- [ ] **Safari** (dernière version)
- [ ] **Edge** (dernière version)
- [ ] **Opera** (si nécessaire)

### 10.2. Appareils
- [ ] **iPhone** (Safari)
- [ ] **Android** (Chrome)
- [ ] **iPad** (Safari)
- [ ] **Tablettes Android**

### 10.3. Résolutions d'écran
- [ ] 1920x1080 (Full HD)
- [ ] 1366x768 (Laptop)
- [ ] 768x1024 (Tablette portrait)
- [ ] 375x667 (iPhone SE)
- [ ] 414x896 (iPhone 11 Pro Max)

---

## 11. Tests de Sécurité

### 11.1. Authentification
- [ ] Les mots de passe sont hashés (jamais en clair)
- [ ] Les sessions sont sécurisées
- [ ] Protection contre les attaques brute force
- [ ] Validation des entrées utilisateur

### 11.2. Formulaires
- [ ] Protection CSRF (si applicable)
- [ ] Validation côté serveur
- [ ] Sanitisation des entrées
- [ ] Protection contre l'injection SQL (Supabase gère cela)

### 11.3. HTTPS
- [ ] Le site utilise HTTPS en production
- [ ] Pas de contenu mixte (HTTP/HTTPS)
- [ ] Certificat SSL valide

### 11.4. Données sensibles
- [ ] Les données de santé sont protégées
- [ ] Les données utilisateur sont sécurisées
- [ ] Conformité RGPD

---

## 12. Tests de Contenu

### 12.1. Textes
- [ ] Pas de fautes d'orthographe
- [ ] Pas de textes "Lorem ipsum" ou placeholders
- [ ] Tous les textes sont en français
- [ ] Le ton est cohérent

### 12.2. Images
- [ ] Toutes les images s'affichent
- [ ] Les images ont des attributs `alt` descriptifs
- [ ] Les images sont de bonne qualité
- [ ] Les images sont optimisées (taille de fichier)

### 12.3. Informations de contact
- [ ] L'adresse est correcte : 400 Rue Barthélemy Thimonnier, 69530 Brignais
- [ ] Le téléphone de Camille : 06 67 33 20 15
- [ ] Le téléphone de Jéromine : 06 60 35 22 36
- [ ] L'email : contact1@rmouv.fr
- [ ] L'email de Camille : camille.simonklein@gmail.com

### 12.4. Informations légales
- [ ] Le SIRET est correct : 833 930 779 00024
- [ ] Les mentions légales sont complètes
- [ ] La politique de confidentialité est complète
- [ ] Les CGU sont complètes
- [ ] Les dates de mise à jour sont correctes

---

## 13. Tests d'Accessibilité

### 13.1. Navigation au clavier
- [ ] Tous les éléments sont accessibles au clavier
- [ ] L'ordre de tabulation est logique
- [ ] Les focus sont visibles

### 13.2. Lecteurs d'écran
- [ ] Les images ont des attributs `alt` descriptifs
- [ ] Les formulaires ont des labels
- [ ] La structure HTML est sémantique

### 13.3. Contraste
- [ ] Le contraste texte/fond est suffisant (WCAG AA)
- [ ] Les liens sont visibles
- [ ] Les boutons sont visibles

---

## 14. Tests d'Intégration Supabase

### 14.1. Connexion Supabase
- [ ] La connexion à Supabase fonctionne
- [ ] Les variables d'environnement sont configurées
- [ ] Les clés API sont correctes

### 14.2. Tables de base de données
- [ ] La table `users` existe et fonctionne
- [ ] La table `profiles` existe et fonctionne
- [ ] La table `bookings` existe et fonctionne
- [ ] La table `time_slots` existe et fonctionne
- [ ] Les relations entre tables fonctionnent

### 14.3. Row Level Security (RLS)
- [ ] Les politiques RLS sont actives
- [ ] Les utilisateurs ne peuvent accéder qu'à leurs données
- [ ] Les admins peuvent accéder à toutes les données
- [ ] Les données sont protégées

---

## 15. Tests de Déploiement

### 15.1. Netlify
- [ ] Le site se déploie correctement
- [ ] Les variables d'environnement sont configurées
- [ ] Le domaine personnalisé (rmouv.fr) est configuré
- [ ] Le SSL/HTTPS fonctionne

### 15.2. Post-déploiement
- [ ] Toutes les pages sont accessibles
- [ ] Les formulaires fonctionnent
- [ ] L'authentification fonctionne
- [ ] Les réservations fonctionnent
- [ ] Les emails sont envoyés (si configuré)

---

## 📝 Notes de Test

### Environnement de test
- **URL de développement** : http://localhost:8888 (Netlify CLI)
- **URL de production** : https://rmouv.fr (à configurer)

### Comptes de test
- **Admin** : admin@rmouv.fr / [mot de passe]
- **Utilisateur test** : [créer un compte de test]

### Outils de test recommandés
- **Google PageSpeed Insights** : https://pagespeed.web.dev/
- **Google Rich Results Test** : https://search.google.com/test/rich-results
- **W3C Validator** : https://validator.w3.org/
- **GTmetrix** : https://gtmetrix.com/
- **BrowserStack** : Pour les tests multi-navigateurs

---

## ✅ Checklist de Validation Finale

Avant la mise en production, vérifier :
- [ ] Tous les tests fonctionnels passent
- [ ] Tous les tests d'authentification passent
- [ ] Tous les tests de réservation passent
- [ ] Le site est responsive sur tous les appareils
- [ ] Les métadonnées SEO sont complètes
- [ ] Les performances sont acceptables
- [ ] La sécurité est en place
- [ ] Le contenu est correct et complet
- [ ] Les liens fonctionnent tous
- [ ] Les formulaires fonctionnent
- [ ] Supabase est correctement configuré
- [ ] Le déploiement fonctionne

---

**Date de création** : 29 novembre 2025  
**Dernière mise à jour** : 29 novembre 2025


