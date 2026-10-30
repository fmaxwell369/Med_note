CREATE TABLE medecins (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    mot_de_passe_hash TEXT NOT NULL,
    specialite TEXT,
    actif INTEGER NOT NULL DEFAULT 1
        CHECK (actif IN (0, 1)),
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE patients (
    id TEXT PRIMARY KEY,
    medecin_id TEXT NOT NULL,
    numero_dossier TEXT NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    date_naissance TEXT,
    sexe TEXT,
    telephone TEXT,
    adresse TEXT,
    antecedents TEXT,
    allergies TEXT,
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archive INTEGER NOT NULL DEFAULT 0
        CHECK (archive IN (0, 1)),

    UNIQUE (medecin_id, numero_dossier),
    FOREIGN KEY (medecin_id)
        REFERENCES medecins(id)
);
CREATE TABLE consultations (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    medecin_id TEXT NOT NULL,
    date_consultation TEXT NOT NULL,
    motif TEXT NOT NULL,
    symptomes TEXT,
    constantes TEXT,
    examen_clinique TEXT,
    diagnostic TEXT,
    examens_complementaires TEXT,
    recommandations TEXT,
    statut TEXT NOT NULL DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon', 'finalisee')),
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id),
    FOREIGN KEY (medecin_id)
        REFERENCES medecins(id)
);
CREATE TABLE ordonnances (
    id TEXT PRIMARY KEY,
    consultation_id TEXT NOT NULL,
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    instructions TEXT,

    FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
);
CREATE TABLE lignes_prescription (
    id TEXT PRIMARY KEY,
    ordonnance_id TEXT NOT NULL,
    medicament TEXT NOT NULL,
    dosage TEXT,
    posologie TEXT NOT NULL,
    voie_administration TEXT,
    duree TEXT,
    quantite TEXT,
    instructions TEXT,

    FOREIGN KEY (ordonnance_id)
        REFERENCES ordonnances(id)
);
CREATE TABLE journal_audit (
    id TEXT PRIMARY KEY,
    medecin_id TEXT NOT NULL,
    type_action TEXT NOT NULL,
    type_entite TEXT NOT NULL,
    entite_id TEXT NOT NULL,
    date_action TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif TEXT,
    details TEXT,

    FOREIGN KEY (medecin_id)
        REFERENCES medecins(id)
);
CREATE TABLE operations_sync (
    id TEXT PRIMARY KEY,
    type_entite TEXT NOT NULL,
    entite_id TEXT NOT NULL,
    type_operation TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'en_attente'
        CHECK (
            statut IN (
                'en_attente',
                'en_cours',
                'synchronisee',
                'erreur',
                'conflit'
            )
        ),
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tentatives INTEGER NOT NULL DEFAULT 0
        CHECK (tentatives >= 0),
    erreur TEXT
);
CREATE INDEX idx_patients_medecin
    ON patients(medecin_id);
CREATE INDEX idx_patients_nom
    ON patients(nom, prenom);
CREATE INDEX idx_consultations_patient_date
    ON consultations(patient_id, date_consultation);
CREATE INDEX idx_audit_entite
    ON journal_audit(type_entite, entite_id);
CREATE INDEX idx_sync_statut
    ON operations_sync(statut);