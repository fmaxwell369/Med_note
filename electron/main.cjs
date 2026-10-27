
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const Database = require('better-sqlite3');

let db;
let sessionMedecin = null;

function connectDatabase() {
  // Utilise la base existante à la racine du projet en développement.
  const databasePath = path.join(app.getAppPath(), 'Med_notedb.db');

  // Ouvre la base existante sans supprimer ni recréer ses tables.
  db = new Database(databasePath);

  // Vérifie l'intégrité de la base.
  const integrity = db.pragma('quick_check', { simple: true });

  if (integrity !== 'ok') {
    throw new Error(`Vérification SQLite échouée : ${integrity}`);
  }

  console.log('Base SQLite connectée :', databasePath);
}

function registerDatabaseHandlers() {

  // Vérifie si un compte médecin existe déjà.
  ipcMain.handle('auth:setup-status', () => {
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    const result = db.prepare(`
      SELECT COUNT(*) AS total
      FROM medecins
    `).get();

    return { setupRequired: result.total === 0 };
  });

  // Crée le premier compte médecin.
  ipcMain.handle('auth:register', async (_event, data) => {
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Données invalides.');
    }

    const nom = typeof data.nom === 'string' ? data.nom.trim() : '';
    const prenom = typeof data.prenom === 'string' ? data.prenom.trim() : '';
    const email = typeof data.email === 'string'
      ? data.email.trim().toLowerCase()
      : '';
    const motDePasse = typeof data.motDePasse === 'string'
      ? data.motDePasse
      : '';

    if (!nom || !prenom || !email) {
      throw new Error('Nom, prénom et e-mail sont obligatoires.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Adresse e-mail invalide.');
    }

    if (motDePasse.length < 12) {
      throw new Error('Le mot de passe doit contenir au moins 12 caractères.');
    }

    // Le premier compte doit être créé une seule fois.
    const id = crypto.randomUUID();
    const motDePasseHash = await argon2.hash(motDePasse);

    const createFirstDoctor = db.transaction(() => {
      const total = db.prepare(`
        SELECT COUNT(*) AS total FROM medecins
      `).get().total;

      if (total !== 0) {
        throw new Error('Le compte initial existe déjà. Connectez-vous.');
      }

      db.prepare(`
        INSERT INTO medecins (
          id, nom, prenom, email, mot_de_passe_hash
        ) VALUES (?, ?, ?, ?, ?)
      `).run(id, nom, prenom, email, motDePasseHash);
    });

    createFirstDoctor();

    return { success: true };
  });

  // Vérifie les identifiants d’un médecin.
  ipcMain.handle('auth:login', async (_event, data) => {
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    const email = typeof data?.email === 'string'
      ? data.email.trim().toLowerCase()
      : '';
    const motDePasse = typeof data?.motDePasse === 'string'
      ? data.motDePasse
      : '';

    if (!email || !motDePasse) {
      throw new Error('E-mail et mot de passe obligatoires.');
    }

    const medecin = db.prepare(`
      SELECT id, nom, prenom, email, mot_de_passe_hash
      FROM medecins
      WHERE email = ? AND actif = 1
    `).get(email);

    if (!medecin || !(await argon2.verify(
      medecin.mot_de_passe_hash,
      motDePasse
    ))) {
      throw new Error('E-mail ou mot de passe incorrect.');
    }

    sessionMedecin = {
      id: medecin.id,
      nom: medecin.nom,
      prenom: medecin.prenom,
      email: medecin.email
    };

    return {
      success: true,
      medecin: sessionMedecin
    };
  });

  ipcMain.handle('auth:logout', () => {
    sessionMedecin = null;
    return { success: true };
  });

  ipcMain.handle('patients:list', (_event) => {
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    if (!sessionMedecin) {
      throw new Error('Vous devez vous connecter pour accéder aux patients.');
    }

    const medecinId = sessionMedecin.id;

    return db.prepare(`
      SELECT
        id,
        numero_dossier,
        nom,
        prenom,
        date_naissance,
        sexe,
        telephone,
        adresse,
        date_creation
      FROM patients
      WHERE medecin_id = ?
        AND archive = 0
      ORDER BY nom ASC, prenom ASC
    `).all(medecinId.trim());
  });

  ipcMain.handle('patients:create', (_event, patient) => {
    if (!sessionMedecin) {
      throw new Error('Vous devez vous connecter pour enregistrer un patient.');
    }
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    if (!patient || typeof patient !== 'object' || Array.isArray(patient)) {
      throw new Error('Données du patient invalides.');
    }

    const requiredFields = ['nom', 'prenom'];

    for (const field of requiredFields) {
      if (
        typeof patient[field] !== 'string' ||
        !patient[field].trim()
      ) {
        throw new Error(`Le champ ${field} est obligatoire.`);
      }
    }

    const medecin = db.prepare(`
      SELECT id FROM medecins WHERE id = ? AND actif = 1
    `).get(sessionMedecin.id);

    if (!medecin) {
      throw new Error('Médecin introuvable ou inactif.');
    }
        const nom = patient.nom.trim();
    const prenom = patient.prenom.trim();
    const telephone = typeof patient.telephone === 'string'
      ? patient.telephone.trim()
      : '';

    if (telephone) {
      const doublon = db.prepare(`
        SELECT id, numero_dossier, nom, prenom, telephone
        FROM patients
        WHERE medecin_id = ?
          AND archive = 0
          AND nom = ? COLLATE NOCASE
          AND prenom = ? COLLATE NOCASE
          AND telephone = ?
        LIMIT 1
      `).get(
        sessionMedecin.id,
        nom,
        prenom,
        telephone
      );

      if (doublon) {
        return {
          duplicate: true,
          existingPatient: doublon,
          message: 'Un patient portant le même nom, prénom et téléphone existe déjà.'
        };
      }
    }

    const id = require('node:crypto').randomUUID();
      const dernierDossier = db.prepare(`
      SELECT numero_dossier
      FROM patients
      WHERE medecin_id = ?
        AND numero_dossier GLOB 'PAT-[0-9]*'
      ORDER BY CAST(SUBSTR(numero_dossier, 5) AS INTEGER) DESC
      LIMIT 1
    `).get(sessionMedecin.id);

    const prochainNumero = dernierDossier
      ? Number(dernierDossier.numero_dossier.slice(4)) + 1
      : 1;

    const numeroDossier = `PAT-${String(prochainNumero).padStart(4, '0')}`;

    db.prepare(`
      INSERT INTO patients (
        id, medecin_id, numero_dossier, nom, prenom,
        date_naissance, sexe, telephone, adresse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionMedecin.id,
      numeroDossier,
      patient.nom.trim(),
      patient.prenom.trim(),
      patient.dateNaissance || null,
      patient.sexe || null,
      patient.telephone || null,
      patient.adresse || null
    );

    return { id, message: 'Patient enregistré.' };
  });

}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'Carnet Médical',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  try {
    connectDatabase();
    registerDatabaseHandlers();
    createWindow();
  } catch (error) {
    console.error('Erreur de connexion à SQLite :', error);
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (db) {
    db.close();
    db = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
