const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rmouv-secret-key-2024';

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'file://'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
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
    )`);

    // Courses table
    db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL,
        duration INTEGER DEFAULT 60,
        price DECIMAL(10,2) DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Time slots table
    db.run(`CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
        start_time TEXT NOT NULL, -- HH:MM format
        end_time TEXT NOT NULL,
        max_capacity INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1,
        FOREIGN KEY (course_id) REFERENCES courses (id)
    )`);

    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time_slot_id INTEGER NOT NULL,
        booking_date DATE NOT NULL,
        status TEXT DEFAULT 'confirmed', -- confirmed, cancelled, completed
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
    )`);

    // Waitlist table
    db.run(`CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time_slot_id INTEGER NOT NULL,
        booking_date DATE NOT NULL,
        position INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
    )`);

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (email, password, prenom, nom, role) 
            VALUES ('admin@rmouv.fr', ?, 'Admin', 'R\'MouV', 'admin')`, [adminPassword]);

    // Insert default courses
    db.run(`INSERT OR IGNORE INTO courses (name, description, capacity, price) VALUES 
            ('Cours Mobilité', 'Amélioration de la mobilité et flexibilité', 10, 25.00),
            ('Renforcement', 'Renforcement musculaire adapté', 12, 30.00),
            ('Cardio doux', 'Cardio adapté pour tous niveaux', 12, 25.00)`);

    // Insert default time slots
    db.run(`INSERT OR IGNORE INTO time_slots (course_id, day_of_week, start_time, end_time, max_capacity) VALUES 
            (1, 1, '10:00', '11:00', 10), -- Lundi Mobilité
            (2, 3, '18:00', '19:00', 12), -- Mercredi Renforcement  
            (3, 5, '09:00', '10:00', 12)`); -- Vendredi Cardio
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès administrateur requis' });
    }
    next();
};

// Validation middleware
const validateUser = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('prenom').notEmpty().trim(),
    body('nom').notEmpty().trim(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'R\'MouV API is running' });
});

// User registration
app.post('/api/register', validateUser, async (req, res) => {
    try {
        const { email, password, prenom, nom, telephone, objectif } = req.body;
        
        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur base de données' });
            }
            if (user) {
                return res.status(400).json({ error: 'Email déjà utilisé' });
            }

            // Hash password and create user
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.run(
                'INSERT INTO users (email, password, prenom, nom, telephone, objectif) VALUES (?, ?, ?, ?, ?, ?)',
                [email, hashedPassword, prenom, nom, telephone, objectif],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur lors de la création du compte' });
                    }
                    
                    const token = jwt.sign(
                        { id: this.lastID, email, role: 'user' },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );
                    
                    res.status(201).json({
                        message: 'Compte créé avec succès',
                        token,
                        user: {
                            id: this.lastID,
                            email,
                            prenom,
                            nom,
                            initials: (prenom.charAt(0) + nom.charAt(0)).toUpperCase()
                        }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// User login
app.post('/api/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                email: user.email,
                prenom: user.prenom,
                nom: user.nom,
                initials: (user.prenom.charAt(0) + user.nom.charAt(0)).toUpperCase(),
                role: user.role
            }
        });
    });
});

// Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, email, prenom, nom, telephone, objectif, role FROM users WHERE id = ?', 
           [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.json({
            ...user,
            initials: (user.prenom.charAt(0) + user.nom.charAt(0)).toUpperCase()
        });
    });
});

// Get available courses
app.get('/api/courses', (req, res) => {
    db.all('SELECT * FROM courses WHERE active = 1', (err, courses) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        res.json(courses);
    });
});

// Get time slots for a specific date
app.get('/api/time-slots/:date', (req, res) => {
    const { date } = req.params;
    const dayOfWeek = new Date(date).getDay();
    
    const query = `
        SELECT ts.*, c.name as course_name, c.description, c.price,
               COUNT(b.id) as booked_count
        FROM time_slots ts
        JOIN courses c ON ts.course_id = c.id
        LEFT JOIN bookings b ON ts.id = b.time_slot_id 
            AND b.booking_date = ? AND b.status = 'confirmed'
        WHERE ts.day_of_week = ? AND ts.active = 1
        GROUP BY ts.id
    `;
    
    db.all(query, [date, dayOfWeek], (err, slots) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        
        const slotsWithAvailability = slots.map(slot => ({
            ...slot,
            available_spots: slot.max_capacity - slot.booked_count,
            is_full: slot.booked_count >= slot.max_capacity
        }));
        
        res.json(slotsWithAvailability);
    });
});

// Create booking
app.post('/api/bookings', authenticateToken, (req, res) => {
    const { time_slot_id, booking_date } = req.body;
    
    // Check if slot exists and is available
    db.get(`
        SELECT ts.*, c.name as course_name,
               COUNT(b.id) as booked_count
        FROM time_slots ts
        JOIN courses c ON ts.course_id = c.id
        LEFT JOIN bookings b ON ts.id = b.time_slot_id 
            AND b.booking_date = ? AND b.status = 'confirmed'
        WHERE ts.id = ? AND ts.active = 1
        GROUP BY ts.id
    `, [booking_date, time_slot_id], (err, slot) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        if (!slot) {
            return res.status(404).json({ error: 'Créneau non trouvé' });
        }
        if (slot.booked_count >= slot.max_capacity) {
            return res.status(400).json({ error: 'Créneau complet' });
        }
        
        // Check if user already has a booking for this slot
        db.get('SELECT id FROM bookings WHERE user_id = ? AND time_slot_id = ? AND booking_date = ? AND status = "confirmed"',
               [req.user.id, time_slot_id, booking_date], (err, existingBooking) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur base de données' });
            }
            if (existingBooking) {
                return res.status(400).json({ error: 'Vous êtes déjà inscrit à ce créneau' });
            }
            
            // Create booking
            db.run('INSERT INTO bookings (user_id, time_slot_id, booking_date) VALUES (?, ?, ?)',
                   [req.user.id, time_slot_id, booking_date], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de la réservation' });
                }
                
                res.status(201).json({
                    message: 'Réservation créée avec succès',
                    booking_id: this.lastID
                });
            });
        });
    });
});

// Get user bookings
app.get('/api/bookings', authenticateToken, (req, res) => {
    const query = `
        SELECT b.*, ts.start_time, ts.end_time, c.name as course_name, c.price
        FROM bookings b
        JOIN time_slots ts ON b.time_slot_id = ts.id
        JOIN courses c ON ts.course_id = c.id
        WHERE b.user_id = ? AND b.status = 'confirmed'
        ORDER BY b.booking_date, ts.start_time
    `;
    
    db.all(query, [req.user.id], (err, bookings) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        res.json(bookings);
    });
});

// Cancel booking
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
    const bookingId = req.params.id;
    
    db.run('UPDATE bookings SET status = "cancelled" WHERE id = ? AND user_id = ?',
           [bookingId, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Réservation non trouvée' });
        }
        
        res.json({ message: 'Réservation annulée avec succès' });
    });
});

// ADMIN ROUTES

// Get all bookings (admin)
app.get('/api/admin/bookings', authenticateToken, requireAdmin, (req, res) => {
    const { date, status } = req.query;
    let query = `
        SELECT b.*, u.prenom, u.nom, u.email,
               ts.start_time, ts.end_time, c.name as course_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN time_slots ts ON b.time_slot_id = ts.id
        JOIN courses c ON ts.course_id = c.id
        WHERE 1=1
    `;
    const params = [];
    
    if (date) {
        query += ' AND b.booking_date = ?';
        params.push(date);
    }
    if (status) {
        query += ' AND b.status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY b.booking_date, ts.start_time';
    
    db.all(query, params, (err, bookings) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        res.json(bookings);
    });
});

// Get dashboard stats (admin)
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total_users FROM users WHERE role = "user"',
        'SELECT COUNT(*) as total_bookings FROM bookings WHERE status = "confirmed"',
        'SELECT COUNT(*) as today_bookings FROM bookings WHERE booking_date = date("now") AND status = "confirmed"',
        'SELECT COUNT(*) as total_courses FROM courses WHERE active = 1'
    ];
    
    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.get(query, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        })
    )).then(results => {
        res.json({
            total_users: results[0].total_users,
            total_bookings: results[1].total_bookings,
            today_bookings: results[2].today_bookings,
            total_courses: results[3].total_courses
        });
    }).catch(err => {
        res.status(500).json({ error: 'Erreur base de données' });
    });
});

// Serve static files (frontend)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erreur serveur interne' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 R'MouV API server running on port ${PORT}`);
    console.log(`📊 Admin access: admin@rmouv.fr / admin123`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});
