
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

let db;
let databasePath;
let sessionMedecin = null;


function connectDatabase() {
  const dossierDonnees = app.isPackaged
    ? app.getPath('userData')
    : app.getAppPath();

  fs.mkdirSync(dossierDonnees, { recursive: true });

  databasePath = path.join(dossierDonnees, 'Med_notedb.db');

  const nouvelleBase = !fs.existsSync(databasePath);

  db = new Database(databasePath);

  db.pragma('foreign_keys = ON');

  if (nouvelleBase) {
    const schemaPath = path.join(
      __dirname,
      'database',
      'schema.sql'
    );

    const schema = fs.readFileSync(schemaPath, 'utf8');

    db.exec(schema);

    console.log('Structure SQLite initialisée.');
  }

  const integrity = db.pragma('quick_check', { simple: true });

  if (integrity !== 'ok') {
    throw new Error(`Vérification SQLite échouée : ${integrity}`);
  }

  console.log('Base SQLite connectée :', databasePath);
}

async function sauvegarderBase() {
  if (!db || !databasePath) {
    throw new Error('Base de données non disponible pour la sauvegarde.');
  }

  const backupPath = path.join(
    path.dirname(databasePath),
    'Med_notedb.backup.db'
  );

  const temporaryPath = `${backupPath}.tmp`;

  try {
    // Crée une copie cohérente de la base ouverte.
    await db.backup(temporaryPath);

    // Vérifie que la copie peut être ouverte et est intègre.
    const verification = new Database(temporaryPath, {
      readonly: true,
      fileMustExist: true
    });

    try {
      const integrity = verification.pragma('integrity_check', {
        simple: true
      });

      if (integrity !== 'ok') {
        throw new Error(`Sauvegarde invalide : ${integrity}`);
      }
    } finally {
      verification.close();
    }

    // Remplace l'ancienne sauvegarde seulement après validation.
    fs.renameSync(temporaryPath, backupPath);

    console.log('Sauvegarde automatique réussie :', backupPath);
  } catch (error) {
    console.error('Échec de la sauvegarde automatique :', error);

    // Nettoie uniquement le fichier temporaire en cas d'échec.
    try {
      if (fs.existsSync(temporaryPath)) {
        fs.unlinkSync(temporaryPath);
      }
    } catch (cleanupError) {
      console.error('Nettoyage temporaire impossible :', cleanupError);
    }

    throw error;
  }
}

function registerDatabaseHandlers() {
    console.log('Enregistrement des handlers IPC...');

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

try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'Le compte est créé, mais la sauvegarde a échoué :',
    error
  );
}

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

  ipcMain.handle('patients:create', async (_event, patient) => {
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

    try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'Le patient est enregistré, mais la sauvegarde a échoué :',
    error
  );
}

return { id, message: 'Patient enregistré.' };
  });

  // Consultations : vérifier que le médecin est connecté.
  function verifierAccesConsultations() {
    if (!db) {
      throw new Error('La base de données n’est pas connectée.');
    }

    if (!sessionMedecin) {
      throw new Error('Vous devez vous connecter pour accéder aux consultations.');
    }
  }

  // Consultations : lister celles d’un patient appartenant au médecin connecté.
  ipcMain.handle('consultations:list', (_event, patientId) => {
    verifierAccesConsultations();

    if (typeof patientId !== 'string' || !patientId.trim()) {
      throw new Error('Identifiant du patient invalide.');
    }

    const patient = db.prepare(`
      SELECT id FROM patients
      WHERE id = ? AND medecin_id = ? AND archive = 0
    `).get(patientId.trim(), sessionMedecin.id);

    if (!patient) {
      throw new Error('Patient introuvable ou accès non autorisé.');
    }

    return db.prepare(`
      SELECT *
      FROM consultations
      WHERE patient_id = ? AND medecin_id = ?
      ORDER BY date_consultation DESC, date_creation DESC
    `).all(patient.id, sessionMedecin.id);
  });

  // Consultations : créer une consultation.
  ipcMain.handle('consultations:create', async (_event, consultation) => {
    verifierAccesConsultations();

    if (!consultation || typeof consultation !== 'object' || Array.isArray(consultation)) {
      throw new Error('Données de consultation invalides.');
    }

    const patientId = typeof consultation.patient_id === 'string'
      ? consultation.patient_id.trim()
      : '';

    const dateConsultation = typeof consultation.date_consultation === 'string'
      ? consultation.date_consultation.trim()
      : '';

    const motif = typeof consultation.motif === 'string'
      ? consultation.motif.trim()
      : '';

    if (!patientId || !dateConsultation || !motif) {
      throw new Error('Le patient, la date et le motif sont obligatoires.');
    }

    const patient = db.prepare(`
      SELECT id FROM patients
      WHERE id = ? AND medecin_id = ? AND archive = 0
    `).get(patientId, sessionMedecin.id);

    if (!patient) {
      throw new Error('Patient introuvable ou accès non autorisé.');
    }

    const statut = consultation.statut || 'brouillon';

    if (!['brouillon', 'finalisee'].includes(statut)) {
      throw new Error('Statut de consultation invalide.');
    }

    const champs = [
      'symptomes',
      'constantes',
      'examen_clinique',
      'diagnostic',
      'examens_complementaires',
      'recommandations'
    ];

    const valeurs = champs.map((champ) => {
      const valeur = consultation[champ];
      return typeof valeur === 'string' && valeur.trim()
        ? valeur.trim()
        : null;
    });

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO consultations (
        id, patient_id, medecin_id, date_consultation, motif,
        symptomes, constantes, examen_clinique, diagnostic,
        examens_complementaires, recommandations, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      patientId,
      sessionMedecin.id,
      dateConsultation,
      motif,
      ...valeurs,
      statut
    );

    try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'La consultation est enregistrée, mais la sauvegarde a échoué :',
    error
  );
}

return { id, message: 'Consultation enregistrée.' };
  });

  // Consultations : modifier une consultation existante.
  ipcMain.handle('consultations:update', async (_event, consultation) => {
    verifierAccesConsultations();

    if (!consultation || typeof consultation !== 'object' || Array.isArray(consultation)) {
      throw new Error('Données de consultation invalides.');
    }

    const id = typeof consultation.id === 'string'
      ? consultation.id.trim()
      : '';

    const patientId = typeof consultation.patient_id === 'string'
      ? consultation.patient_id.trim()
      : '';

    const dateConsultation = typeof consultation.date_consultation === 'string'
      ? consultation.date_consultation.trim()
      : '';

    const motif = typeof consultation.motif === 'string'
      ? consultation.motif.trim()
      : '';

    if (!id || !patientId || !dateConsultation || !motif) {
      throw new Error('Identifiant, patient, date et motif sont obligatoires.');
    }

    const existante = db.prepare(`
      SELECT id FROM consultations
      WHERE id = ? AND patient_id = ? AND medecin_id = ?
    `).get(id, patientId, sessionMedecin.id);

    if (!existante) {
      throw new Error('Consultation introuvable ou accès non autorisé.');
    }

    const statut = consultation.statut || 'brouillon';

    if (!['brouillon', 'finalisee'].includes(statut)) {
      throw new Error('Statut de consultation invalide.');
    }

    const champs = [
      'symptomes',
      'constantes',
      'examen_clinique',
      'diagnostic',
      'examens_complementaires',
      'recommandations'
    ];

    const valeurs = champs.map((champ) => {
      const valeur = consultation[champ];
      return typeof valeur === 'string' && valeur.trim()
        ? valeur.trim()
        : null;
    });

    db.prepare(`
      UPDATE consultations
      SET date_consultation = ?,
          motif = ?,
          symptomes = ?,
          constantes = ?,
          examen_clinique = ?,
          diagnostic = ?,
          examens_complementaires = ?,
          recommandations = ?,
          statut = ?,
          date_modification = CURRENT_TIMESTAMP
      WHERE id = ? AND patient_id = ? AND medecin_id = ?
    `).run(
      dateConsultation,
      motif,
      ...valeurs,
      statut,
      id,
      patientId,
      sessionMedecin.id
    );

    try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'La consultation est modifiée, mais la sauvegarde a échoué :',
    error
  );
}

return { success: true, message: 'Consultation modifiée.' };
  });

  // Ordonnances : vérifier que la consultation appartient au médecin connecté.
  function verifierConsultationOrdonnance(consultationId) {
    if (typeof consultationId !== 'string' || !consultationId.trim()) {
      throw new Error('Identifiant de consultation invalide.');
    }

    const consultation = db.prepare(`
      SELECT id
      FROM consultations
      WHERE id = ? AND medecin_id = ?
    `).get(consultationId.trim(), sessionMedecin.id);

    if (!consultation) {
      throw new Error('Consultation introuvable ou accès non autorisé.');
    }

    return consultation.id;
  }

  // Ordonnances : vérifier et normaliser les médicaments.
  function normaliserLignesPrescription(lignes) {
    if (!Array.isArray(lignes) || lignes.length === 0) {
      throw new Error('Ajoutez au moins un médicament à l’ordonnance.');
    }

    return lignes.map((ligne) => {
      if (!ligne || typeof ligne !== 'object' || Array.isArray(ligne)) {
        throw new Error('Une ligne de prescription est invalide.');
      }

      const medicament = typeof ligne.medicament === 'string'
        ? ligne.medicament.trim()
        : '';

      const posologie = typeof ligne.posologie === 'string'
        ? ligne.posologie.trim()
        : '';

      if (!medicament || !posologie) {
        throw new Error('Le nom du médicament et la posologie sont obligatoires.');
      }

      const texteOptionnel = (valeur) =>
        typeof valeur === 'string' && valeur.trim()
          ? valeur.trim()
          : null;

      return {
        id: crypto.randomUUID(),
        medicament,
        dosage: texteOptionnel(ligne.dosage),
        posologie,
        voie_administration: texteOptionnel(ligne.voie_administration),
        duree: texteOptionnel(ligne.duree),
        quantite: texteOptionnel(ligne.quantite),
        instructions: texteOptionnel(ligne.instructions)
      };
    });
  }

  // Ordonnances : lister les ordonnances et leurs médicaments.
  ipcMain.handle('ordonnances:list', (_event, consultationId) => {
    verifierAccesConsultations();

    const idConsultation = verifierConsultationOrdonnance(consultationId);

    const ordonnances = db.prepare(`
      SELECT id, consultation_id, date_creation, instructions
      FROM ordonnances
      WHERE consultation_id = ?
      ORDER BY date_creation DESC
    `).all(idConsultation);

    const obtenirLignes = db.prepare(`
      SELECT id, ordonnance_id, medicament, dosage, posologie,
             voie_administration, duree, quantite, instructions
      FROM lignes_prescription
      WHERE ordonnance_id = ?
    `);

    return ordonnances.map((ordonnance) => ({
      ...ordonnance,
      lignes: obtenirLignes.all(ordonnance.id)
    }));
  });

  // Ordonnances : créer une ordonnance et ses médicaments.
  ipcMain.handle('ordonnances:create', async (_event, ordonnance) => {
    verifierAccesConsultations();

    if (!ordonnance || typeof ordonnance !== 'object' || Array.isArray(ordonnance)) {
      throw new Error('Données d’ordonnance invalides.');
    }

    const consultationId = verifierConsultationOrdonnance(
      ordonnance.consultation_id
    );

    const lignes = normaliserLignesPrescription(ordonnance.lignes);

    const instructions =
      typeof ordonnance.instructions === 'string' && ordonnance.instructions.trim()
        ? ordonnance.instructions.trim()
        : null;

    const id = crypto.randomUUID();

    const enregistrer = db.transaction(() => {
      db.prepare(`
        INSERT INTO ordonnances (id, consultation_id, instructions)
        VALUES (?, ?, ?)
      `).run(id, consultationId, instructions);

      const insererLigne = db.prepare(`
        INSERT INTO lignes_prescription (
          id, ordonnance_id, medicament, dosage, posologie,
          voie_administration, duree, quantite, instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ligne of lignes) {
        insererLigne.run(
          ligne.id,
          id,
          ligne.medicament,
          ligne.dosage,
          ligne.posologie,
          ligne.voie_administration,
          ligne.duree,
          ligne.quantite,
          ligne.instructions
        );
      }
    });

    enregistrer();

try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'L’ordonnance est enregistrée, mais la sauvegarde a échoué :',
    error
  );
}

return {
  success: true,
  id,
  message: 'Ordonnance enregistrée.'
};
  });

  // Ordonnances : modifier une ordonnance et remplacer ses médicaments.
  ipcMain.handle('ordonnances:update', async (_event, ordonnance) => {
    verifierAccesConsultations();

    if (!ordonnance || typeof ordonnance !== 'object' || Array.isArray(ordonnance)) {
      throw new Error('Données d’ordonnance invalides.');
    }

    const id = typeof ordonnance.id === 'string'
      ? ordonnance.id.trim()
      : '';

    if (!id) {
      throw new Error('Identifiant d’ordonnance obligatoire.');
    }

    const consultationId = verifierConsultationOrdonnance(
      ordonnance.consultation_id
    );

    const existante = db.prepare(`
      SELECT o.id
      FROM ordonnances o
      JOIN consultations c ON c.id = o.consultation_id
      WHERE o.id = ?
        AND o.consultation_id = ?
        AND c.medecin_id = ?
    `).get(id, consultationId, sessionMedecin.id);

    if (!existante) {
      throw new Error('Ordonnance introuvable ou accès non autorisé.');
    }

    const lignes = normaliserLignesPrescription(ordonnance.lignes);

    const instructions =
      typeof ordonnance.instructions === 'string' && ordonnance.instructions.trim()
        ? ordonnance.instructions.trim()
        : null;

    const modifier = db.transaction(() => {
      db.prepare(`
        UPDATE ordonnances
        SET instructions = ?
        WHERE id = ?
      `).run(instructions, id);

      db.prepare(`
        DELETE FROM lignes_prescription
        WHERE ordonnance_id = ?
      `).run(id);

      const insererLigne = db.prepare(`
        INSERT INTO lignes_prescription (
          id, ordonnance_id, medicament, dosage, posologie,
          voie_administration, duree, quantite, instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ligne of lignes) {
        insererLigne.run(
          ligne.id,
          id,
          ligne.medicament,
          ligne.dosage,
          ligne.posologie,
          ligne.voie_administration,
          ligne.duree,
          ligne.quantite,
          ligne.instructions
        );
      }
    });

    modifier();

try {
  await sauvegarderBase();
} catch (error) {
  console.error(
    'L’ordonnance est modifiée, mais la sauvegarde a échoué :',
    error
  );
}

return {
  success: true,
  id,
  message: 'Ordonnance modifiée.'
};
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


app.whenReady().then(async () => {
  try {
    connectDatabase();
    registerDatabaseHandlers();

    console.log('Handlers IPC enregistrés.');
    console.log('Début de la sauvegarde...');

    await sauvegarderBase();

    console.log('Sauvegarde terminée, ouverture de la fenêtre...');
    createWindow();
  } catch (error) {
    console.error('Erreur au démarrage de Carnet Médical :', error);
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
