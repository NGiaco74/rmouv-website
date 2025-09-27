#!/bin/bash

echo "🚀 Installation de R'MouV Backend"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js (version 16 ou plus récente)"
    echo "   Téléchargez depuis: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 ou plus récente requis. Version actuelle: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) détecté"

# Navigate to backend directory
cd backend

# Install dependencies
echo "📦 Installation des dépendances..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi

echo "✅ Dépendances installées avec succès"

# Create database directory
mkdir -p ../database

# Initialize database
echo "🗄️  Initialisation de la base de données..."
node -e "
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('../database.sqlite');

db.serialize(() => {
    // Users table
    db.run(\`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        prenom TEXT NOT NULL,
        nom TEXT NOT NULL,
        telephone TEXT,
        objectif TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Courses table
    db.run(\`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL,
        duration INTEGER DEFAULT 60,
        price DECIMAL(10,2) DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Time slots table
    db.run(\`CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        max_capacity INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1,
        FOREIGN KEY (course_id) REFERENCES courses (id)
    )\`);

    // Bookings table
    db.run(\`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time_slot_id INTEGER NOT NULL,
        booking_date DATE NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
    )\`);

    // Waitlist table
    db.run(\`CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time_slot_id INTEGER NOT NULL,
        booking_date DATE NOT NULL,
        position INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
    )\`);

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(\`INSERT OR IGNORE INTO users (email, password, prenom, nom, role) 
            VALUES ('admin@rmouv.fr', ?, 'Admin', 'R\\'MouV', 'admin')\`, [adminPassword]);

    // Insert default courses
    db.run(\`INSERT OR IGNORE INTO courses (name, description, capacity, price) VALUES 
            ('Cours Mobilité', 'Amélioration de la mobilité et flexibilité', 10, 25.00),
            ('Renforcement', 'Renforcement musculaire adapté', 12, 30.00),
            ('Cardio doux', 'Cardio adapté pour tous niveaux', 12, 25.00)\`);

    // Insert default time slots
    db.run(\`INSERT OR IGNORE INTO time_slots (course_id, day_of_week, start_time, end_time, max_capacity) VALUES 
            (1, 1, '10:00', '11:00', 10),
            (2, 3, '18:00', '19:00', 12),
            (3, 5, '09:00', '10:00', 12)\`);

    console.log('✅ Base de données initialisée');
});

db.close();
"

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'initialisation de la base de données"
    exit 1
fi

echo ""
echo "🎉 Installation terminée avec succès !"
echo ""
echo "📋 Informations importantes:"
echo "   • Serveur: http://localhost:3000"
echo "   • Admin: http://localhost:3000/admin-login.html"
echo "   • Identifiants admin: admin@rmouv.fr / admin123"
echo ""
echo "🚀 Pour démarrer le serveur:"
echo "   cd backend && npm start"
echo ""
echo "🔧 Pour le développement:"
echo "   cd backend && npm run dev"
echo ""
echo "📊 Base de données: database.sqlite"
echo ""
