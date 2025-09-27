# R'MouV - Centre Sport-Santé

## 🎯 Description

R'MouV est une plateforme complète pour un centre de sport-santé avec :
- **Site web** moderne avec système de réservation
- **Backend API** avec base de données
- **Espace administrateur** pour la gestion
- **Système d'authentification** sécurisé

## 🚀 Installation Rapide

### Prérequis
- Node.js 16+ ([télécharger](https://nodejs.org/))
- Git

### Installation automatique
```bash
# Cloner le projet
git clone <votre-repo>
cd rmouv-website

# Installation automatique (Linux/Mac)
chmod +x install.sh
./install.sh

# Ou installation manuelle (Windows)
cd backend
npm install
npm start
```

### Installation manuelle
```bash
# 1. Installer les dépendances
cd backend
npm install

# 2. Démarrer le serveur
npm start
```

## 🌐 Accès

- **Site principal** : http://localhost:3000
- **Espace admin** : http://localhost:3000/admin-login.html
- **API** : http://localhost:3000/api/

## 👤 Comptes de test

### Administrateur
- **Email** : `admin@rmouv.fr`
- **Mot de passe** : `admin123`

### Utilisateurs (après inscription)
- Créez un compte via le formulaire d'inscription
- Ou utilisez les comptes prédéfinis dans le code

## 📊 Fonctionnalités

### Frontend
- ✅ Design responsive avec Tailwind CSS
- ✅ Système d'authentification (inscription/connexion)
- ✅ Réservation de créneaux en temps réel
- ✅ Gestion des places disponibles
- ✅ Interface utilisateur moderne

### Backend API
- ✅ Authentification JWT sécurisée
- ✅ Base de données SQLite
- ✅ API REST complète
- ✅ Validation des données
- ✅ Gestion des erreurs

### Espace Administrateur
- ✅ Dashboard avec statistiques
- ✅ Gestion des réservations
- ✅ Filtres par date et statut
- ✅ Export des données
- ✅ Interface d'administration moderne

## 🗄️ Base de données

### Tables principales
- **users** : Utilisateurs et administrateurs
- **courses** : Types de cours disponibles
- **time_slots** : Créneaux horaires
- **bookings** : Réservations des utilisateurs
- **waitlist** : Liste d'attente

### Structure
```
database.sqlite
├── users (id, email, password, prenom, nom, role, ...)
├── courses (id, name, description, capacity, price, ...)
├── time_slots (id, course_id, day_of_week, start_time, ...)
├── bookings (id, user_id, time_slot_id, booking_date, ...)
└── waitlist (id, user_id, time_slot_id, position, ...)
```

## 🔧 Configuration

### Variables d'environnement
```bash
PORT=3000                    # Port du serveur
JWT_SECRET=your-secret-key   # Clé secrète JWT
```

### Personnalisation
- **Couleurs** : Modifier `tailwind.config` dans les fichiers HTML
- **Cours** : Ajouter/modifier dans la base de données
- **Créneaux** : Gérer via l'API ou directement en base

## 📡 API Endpoints

### Authentification
- `POST /api/register` - Inscription utilisateur
- `POST /api/login` - Connexion
- `GET /api/profile` - Profil utilisateur

### Réservations
- `GET /api/courses` - Liste des cours
- `GET /api/time-slots/:date` - Créneaux disponibles
- `POST /api/bookings` - Créer une réservation
- `GET /api/bookings` - Mes réservations
- `DELETE /api/bookings/:id` - Annuler une réservation

### Administration
- `GET /api/admin/stats` - Statistiques dashboard
- `GET /api/admin/bookings` - Toutes les réservations
- `POST /api/admin/bookings/:id/cancel` - Annuler une réservation

## 🛠️ Développement

### Scripts disponibles
```bash
npm start          # Démarrer en production
npm run dev        # Démarrer en développement (nodemon)
npm run init-db    # Réinitialiser la base de données
```

### Structure du projet
```
rmouv-website/
├── index.html              # Site principal
├── admin.html              # Espace administrateur
├── admin-login.html        # Connexion admin
├── backend/
│   ├── server.js           # Serveur principal
│   ├── package.json        # Dépendances
│   └── routes/             # Routes API (optionnel)
├── database.sqlite         # Base de données
└── install.sh              # Script d'installation
```

## 🔒 Sécurité

- **Mots de passe** : Hashés avec bcrypt
- **JWT** : Tokens sécurisés avec expiration
- **Validation** : Toutes les entrées sont validées
- **Rate limiting** : Protection contre les attaques
- **CORS** : Configuration sécurisée

## 🚀 Déploiement

### Production
1. **Serveur** : Node.js + PM2
2. **Base de données** : SQLite (ou PostgreSQL/MySQL)
3. **Reverse proxy** : Nginx
4. **SSL** : Certificat HTTPS

### Variables de production
```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=your-production-secret-key
DATABASE_URL=your-database-url
```

## 📈 Améliorations futures

- [ ] Système de paiement intégré
- [ ] Notifications email automatiques
- [ ] Application mobile
- [ ] Intégration calendrier externe
- [ ] Système de facturation
- [ ] Multi-centres
- [ ] API mobile

## 🆘 Support

### Problèmes courants

**Erreur "Port déjà utilisé"**
```bash
# Trouver le processus
lsof -i :3000
# Tuer le processus
kill -9 <PID>
```

**Base de données corrompue**
```bash
rm database.sqlite
npm run init-db
```

**Problèmes de permissions**
```bash
chmod +x install.sh
sudo npm install -g nodemon
```

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

**R'MouV** - Reprends ton corps en main. Révèle-toi. ✨