
import { useEffect, useState } from 'react';

export default function App() {
  const [setupRequired, setSetupRequired] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [doctor, setDoctor] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeSection, setActiveSection] = useState('patients');
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientError, setPatientError] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientSubmitting, setPatientSubmitting] = useState(false);
  const [patientSuccess, setPatientSuccess] = useState('');
  const [consultations, setConsultations] = useState([]);
  const [patientDossierOrdonnances, setPatientDossierOrdonnances] = useState({});
  const [patientDossierLoading, setPatientDossierLoading] = useState(false);
  const [consultationsLoading, setConsultationsLoading] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [consultationSuccess, setConsultationSuccess] = useState('');
  const [consultationSubmitting, setConsultationSubmitting] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState(null);

  const [consultationForm, setConsultationForm] = useState({
  date_consultation: new Date().toISOString().slice(0, 10),
  motif: '',
  symptomes: '',
  constantes: '',
  examen_clinique: '',
  diagnostic: '',
  examens_complementaires: '',
  recommandations: '',
  statut: 'brouillon',
});

  // Ordonnances
  const [ordonnances, setOrdonnances] = useState([]);
  const [ordonnancesLoading, setOrdonnancesLoading] = useState(false);
  const [ordonnanceError, setOrdonnanceError] = useState('');
  const [ordonnanceSuccess, setOrdonnanceSuccess] = useState('');
  const [ordonnanceSubmitting, setOrdonnanceSubmitting] = useState(false);
  const [showOrdonnanceForm, setShowOrdonnanceForm] = useState(false);
  const [editingOrdonnance, setEditingOrdonnance] = useState(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState('');

  const [ordonnanceForm, setOrdonnanceForm] = useState({
    instructions: '',
    lignes: [
      {
        medicament: '',
        dosage: '',
        posologie: '',
        voie_administration: '',
        duree: '',
        quantite: '',
        instructions: '',
      },
    ],
  });



  const [patientForm, setPatientForm] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    sexe: '',
    telephone: '',
    adresse: '',
  });

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    confirmation: '',
  });

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const result = await window.carnetMedical.getSetupStatus();

        if (active) {
          setSetupRequired(result.setupRequired);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Impossible de vérifier l'état du compte médecin."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

    useEffect(() => {
    if (!doctor) {
      setPatients([]);
      setPatientError('');
      return;
    }

    let active = true;

    async function loadPatients() {
      setPatientsLoading(true);
      setPatientError('');

      try {
        const result = await window.carnetMedical.listPatients();

        if (active) {
          setPatients(result);
        }
      } catch (err) {
        if (active) {
          setPatientError(
            err.message || 'Impossible de charger les patients.'
          );
        }
      } finally {
        if (active) {
          setPatientsLoading(false);
        }
      }
    }

    loadPatients();

    return () => {
      active = false;
    };
  }, [doctor]);

  useEffect(() => {
    if (!doctor || !selectedPatient?.id) {
      setConsultations([]);
      setPatientDossierOrdonnances({});
      setConsultationsLoading(false);
      setPatientDossierLoading(false);
      setConsultationError('');
      return;
    }

    let active = true;

    async function loadPatientHistory() {
      setConsultationsLoading(true);
      setPatientDossierLoading(true);
      setConsultationError('');

      try {
        const result =
          await window.carnetMedical.listConsultations(
            selectedPatient.id
          );

        const consultationsList = Array.isArray(result)
          ? result
          : [];

        if (active) {
          setConsultations(consultationsList);
        }

        try {
          const entries = await Promise.all(
            consultationsList.map(async (consultation) => {
              const ordonnanceResult =
                await window.carnetMedical.listOrdonnances(
                  consultation.id
                );

              return [
                consultation.id,
                Array.isArray(ordonnanceResult)
                  ? ordonnanceResult
                  : [],
              ];
            })
          );

          if (active) {
            setPatientDossierOrdonnances(
              Object.fromEntries(entries)
            );
          }
        } catch (err) {
          console.error(
            'Erreur de chargement des ordonnances :',
            err
          );

          if (active) {
            setPatientDossierOrdonnances({});
          }
        } finally {
          if (active) {
            setPatientDossierLoading(false);
          }
        }
      } catch (err) {
        if (active) {
          setConsultations([]);
          setPatientDossierOrdonnances({});
          setConsultationError(
            err.message ||
              'Impossible de charger l’historique médical.'
          );
          setPatientDossierLoading(false);
        }
      } finally {
        if (active) {
          setConsultationsLoading(false);
        }
      }
    }

    loadPatientHistory();

    return () => {
      active = false;
    };
  }, [doctor, selectedPatient?.id]);


  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (setupRequired) {
        if (form.motDePasse !== form.confirmation) {
          throw new Error('Les deux mots de passe ne correspondent pas.');
        }

        await window.carnetMedical.registerDoctor({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          motDePasse: form.motDePasse,
        });

      setSetupRequired(false);
      setForm({
        nom: '',
        prenom: '',
        email: form.email.trim().toLowerCase(),
        motDePasse: '',
        confirmation: '',
      });

        setSuccess('');
        setError('');
        setSuccess(
          'Compte créé avec succès. Connectez-vous avec vos identifiants.'
        );
      } else {
        const result = await window.carnetMedical.loginDoctor({
          email: form.email,
          motDePasse: form.motDePasse,
        });

        setDoctor(result.medecin);
        setSuccess('Connexion vérifiée.');
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
  try {
    await window.carnetMedical.logoutDoctor();
  } catch (err) {
    setError(err.message || 'Impossible de fermer la session.');
    return;
  }

  setDoctor(null);
  setForm({
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    confirmation: '',
  });
  setSuccess('');
  setError('');
}

  function updatePatientField(event) {
    const { name, value } = event.target;

    setPatientForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handlePatientSubmit(event) {
    event.preventDefault();
    setPatientError('');
    setPatientSuccess('');
    setPatientSubmitting(true);

    try {
      const result = await window.carnetMedical.createPatient({
        nom: patientForm.nom,
        prenom: patientForm.prenom,
        dateNaissance: patientForm.dateNaissance || null,
        sexe: patientForm.sexe || null,
        telephone: patientForm.telephone,
        adresse: patientForm.adresse,
      });

      if (result?.duplicate) {
        setPatientError(
          result.message || 'Ce patient semble déjà enregistré.'
        );
        return;
      }

      const updatedPatients = await window.carnetMedical.listPatients();
      setPatients(updatedPatients);

      setPatientForm({
        nom: '',
        prenom: '',
        dateNaissance: '',
        sexe: '',
        telephone: '',
        adresse: '',
      });

      setShowPatientForm(false);
      setPatientSuccess(
        result?.message || 'Patient enregistré avec succès.'
      );
    } catch (err) {
      setPatientError(
        err.message || 'Impossible d’enregistrer le patient.'
      );
    } finally {
      setPatientSubmitting(false);
    }
  }

  function updateConsultationField(event) {
    const { name, value } = event.target;

    setConsultationForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetConsultationForm() {
    setConsultationForm({
      date_consultation: new Date().toISOString().slice(0, 10),
      motif: '',
      symptomes: '',
      constantes: '',
      examen_clinique: '',
      diagnostic: '',
      examens_complementaires: '',
      recommandations: '',
      statut: 'brouillon',
    });

    setEditingConsultation(null);
    setConsultationError('');
    setConsultationSuccess('');
  }

  function handleEditConsultation(consultation) {
    setEditingConsultation(consultation);

    setConsultationForm({
      date_consultation: consultation.date_consultation || '',
      motif: consultation.motif || '',
      symptomes: consultation.symptomes || '',
      constantes: consultation.constantes || '',
      examen_clinique: consultation.examen_clinique || '',
      diagnostic: consultation.diagnostic || '',
      examens_complementaires:
        consultation.examens_complementaires || '',
      recommandations: consultation.recommandations || '',
      statut: consultation.statut || 'brouillon',
    });

    setConsultationError('');
    setConsultationSuccess('');
    setShowConsultationForm(true);
  }

  async function handleConsultationSubmit(event) {
    event.preventDefault();

    if (!selectedPatient?.id) {
      setConsultationError('Sélectionne d’abord un patient.');
      return;
    }

    setConsultationError('');
    setConsultationSuccess('');
    setConsultationSubmitting(true);

    try {
      const payload = {
        ...(editingConsultation ? { id: editingConsultation.id } : {}),
        patient_id: selectedPatient.id,
        ...consultationForm,
      };

      const result = editingConsultation
        ? await window.carnetMedical.updateConsultation(payload)
        : await window.carnetMedical.createConsultation(payload);

      const updatedConsultations =
        await window.carnetMedical.listConsultations(selectedPatient.id);

      setConsultations(updatedConsultations);
      setConsultationSuccess(
        result?.message ||
          (editingConsultation
            ? 'Consultation modifiée avec succès.'
            : 'Consultation enregistrée avec succès.')
      );

      setConsultationForm({
        date_consultation: new Date().toISOString().slice(0, 10),
        motif: '',
        symptomes: '',
        constantes: '',
        examen_clinique: '',
        diagnostic: '',
        examens_complementaires: '',
        recommandations: '',
        statut: 'brouillon',
      });

      setEditingConsultation(null);
      setShowConsultationForm(false);
    } catch (err) {
      setConsultationError(
        err.message || 'Impossible d’enregistrer la consultation.'
      );
    } finally {
      setConsultationSubmitting(false);
    }
  }


  function resetOrdonnanceForm() {
    setOrdonnanceForm({
      instructions: '',
      lignes: [
        {
          medicament: '',
          dosage: '',
          posologie: '',
          voie_administration: '',
          duree: '',
          quantite: '',
          instructions: '',
        },
      ],
    });

    setEditingOrdonnance(null);
    setOrdonnanceError('');
    setOrdonnanceSuccess('');
    setShowOrdonnanceForm(true);
  }

  async function loadOrdonnances(consultationId) {
    if (!consultationId) {
      setOrdonnances([]);
      return;
    }

    setOrdonnancesLoading(true);
    setOrdonnanceError('');

    try {
      const result =
        await window.carnetMedical.listOrdonnances(consultationId);

      setOrdonnances(Array.isArray(result) ? result : []);
    } catch (err) {
      setOrdonnanceError(
        err.message || 'Impossible de charger les ordonnances.'
      );
    } finally {
      setOrdonnancesLoading(false);
    }
  }

  function handleEditOrdonnance(ordonnance) {
    setEditingOrdonnance(ordonnance);

    setOrdonnanceForm({
      instructions: ordonnance.instructions || '',
      lignes: ordonnance.lignes?.length
        ? ordonnance.lignes.map((ligne) => ({
            medicament: ligne.medicament || '',
            dosage: ligne.dosage || '',
            posologie: ligne.posologie || '',
            voie_administration: ligne.voie_administration || '',
            duree: ligne.duree || '',
            quantite: ligne.quantite || '',
            instructions: ligne.instructions || '',
          }))
        : [
            {
              medicament: '',
              dosage: '',
              posologie: '',
              voie_administration: '',
              duree: '',
              quantite: '',
              instructions: '',
            },
          ],
    });

    setShowOrdonnanceForm(true);
    setOrdonnanceError('');
    setOrdonnanceSuccess('');
  }

  async function handleOrdonnanceSubmit(event) {
    event.preventDefault();

    if (!selectedConsultationId) {
      setOrdonnanceError('Sélectionne une consultation.');
      return;
    }

    setOrdonnanceSubmitting(true);
    setOrdonnanceError('');
    setOrdonnanceSuccess('');

    try {
      const payload = {
        consultation_id: selectedConsultationId,
        instructions: ordonnanceForm.instructions,
        lignes: ordonnanceForm.lignes,
      };

      const result = editingOrdonnance
        ? await window.carnetMedical.updateOrdonnance({
            ...payload,
            id: editingOrdonnance.id,
          })
        : await window.carnetMedical.createOrdonnance(payload);

      await loadOrdonnances(selectedConsultationId);

      setOrdonnanceSuccess(
        result?.message || 'Ordonnance enregistrée.'
      );
      setShowOrdonnanceForm(false);
      setEditingOrdonnance(null);
    } catch (err) {
      setOrdonnanceError(
        err.message || 'Impossible d’enregistrer l’ordonnance.'
      );
    } finally {
      setOrdonnanceSubmitting(false);
    }
  }

  function updateOrdonnanceField(event) {
    const { name, value } = event.target;

    setOrdonnanceForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function updatePrescriptionLine(index, field, value) {
    setOrdonnanceForm((previous) => ({
      ...previous,
      lignes: previous.lignes.map((ligne, ligneIndex) =>
        ligneIndex === index
          ? { ...ligne, [field]: value }
          : ligne
      ),
    }));
  }

  function addPrescriptionLine() {
    setOrdonnanceForm((previous) => ({
      ...previous,
      lignes: [
        ...previous.lignes,
        {
          medicament: '',
          dosage: '',
          posologie: '',
          voie_administration: '',
          duree: '',
          quantite: '',
          instructions: '',
        },
      ],
    }));
  }

  function removePrescriptionLine(index) {
    setOrdonnanceForm((previous) => ({
      ...previous,
      lignes:
        previous.lignes.length > 1
          ? previous.lignes.filter((_, ligneIndex) => ligneIndex !== index)
          : previous.lignes,
    }));
  }



  if (loading) {
    return (
      <main className="app">
        <p>Vérification du compte médecin…</p>
      </main>
    );
  }

  if (doctor) {
    return (
      <main className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">+</div>
            <div>
              <h1>Carnet Médical</h1>
              <p>Gestion des dossiers patients</p>
            </div>
          </div>
          <button type="button" onClick={logout}>
            Se déconnecter
          </button>
        </header>

        <section className="welcome">
          <p className="eyebrow">ESPACE MÉDICAL</p>
          <h2>Bienvenue, Dr {doctor.prenom} {doctor.nom}</h2>
          <p>Votre compte a été vérifié.</p>
        </section>

                <section className="dashboard-summary">
          <article className="stat-card">
            <p className="stat-label">Patients actifs</p>
            <h3>{patientsLoading ? '…' : patients.length}</h3>
            <p className="stat-description">
              Dossiers non archivés
            </p>
          </article>
        </section>

<nav className="section-navigation">
  <button
    type="button"
    className={activeSection === 'patients' ? 'active' : ''}
    onClick={() => setActiveSection('patients')}
  >
    Patients
  </button>

  <button
    type="button"
    className={activeSection === 'consultations' ? 'active' : ''}
    onClick={() => setActiveSection('consultations')}
  >
    Consultations
  </button>

  <button
    type="button"
    className={activeSection === 'ordonnances' ? 'active' : ''}
    onClick={() => setActiveSection('ordonnances')}
  >
    Ordonnances
  </button>
</nav>

<section className="dashboard">
  {/* RUBRIQUE PATIENTS */}
  {activeSection === 'patients' && (
    <article className="card">
      <div className="card-icon">♙</div>
      <h3>Patients</h3>

      <button
        type="button"
        onClick={() => {
          setShowPatientForm((previous) => !previous);
          setPatientError('');
          setPatientSuccess('');
        }}
      >
        {showPatientForm ? 'Annuler' : 'Nouveau patient'}
      </button>

      {patientSuccess && (
        <p className="success-message">{patientSuccess}</p>
      )}

      {showPatientForm && (
        <form onSubmit={handlePatientSubmit}>
          <label>
            Nom *
            <input
              name="nom"
              value={patientForm.nom}
              onChange={updatePatientField}
              required
            />
          </label>

          <label>
            Prénom *
            <input
              name="prenom"
              value={patientForm.prenom}
              onChange={updatePatientField}
              required
            />
          </label>

          <label>
            Date de naissance
            <input
              type="date"
              name="dateNaissance"
              value={patientForm.dateNaissance}
              onChange={updatePatientField}
            />
          </label>

          <label>
            Sexe
            <select
              name="sexe"
              value={patientForm.sexe}
              onChange={updatePatientField}
            >
              <option value="">Non renseigné</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
              <option value="Autre">Autre</option>
            </select>
          </label>

          <label>
            Téléphone
            <input
              type="tel"
              name="telephone"
              value={patientForm.telephone}
              onChange={updatePatientField}
            />
          </label>

          <label>
            Adresse
            <input
              name="adresse"
              value={patientForm.adresse}
              onChange={updatePatientField}
            />
          </label>

          <button type="submit" disabled={patientSubmitting}>
            {patientSubmitting
              ? 'Enregistrement...'
              : 'Enregistrer le patient'}
          </button>
        </form>
      )}

      {patientsLoading && <p>Chargement des patients...</p>}

      {patientError && (
        <p className="error-message">{patientError}</p>
      )}

      {!patientsLoading && !patientError && (
        <>
          <p>
            {patients.length} patient(s) enregistré(s)
          </p>

          {selectedPatient && (
            <section className="patient-details">
              <div className="patient-details-header">
                <h4>Fiche du patient</h4>

                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                >
                  Retour à la liste
                </button>
              </div>

              <p>
                <strong>Numéro de dossier :</strong>{' '}
                {selectedPatient.numero_dossier}
              </p>

              <p>
                <strong>Nom :</strong> {selectedPatient.nom}
              </p>

              <p>
                <strong>Prénom :</strong> {selectedPatient.prenom}
              </p>

              <p>
                <strong>Date de naissance :</strong>{' '}
                {selectedPatient.date_naissance || 'Non renseignée'}
              </p>

              <p>
                <strong>Sexe :</strong>{' '}
                {selectedPatient.sexe === 'M'
                  ? 'Masculin'
                  : selectedPatient.sexe === 'F'
                    ? 'Féminin'
                    : selectedPatient.sexe || 'Non renseigné'}
              </p>

              <p>
                <strong>Téléphone :</strong>{' '}
                {selectedPatient.telephone || 'Non renseigné'}
              </p>

              <p>
                <strong>Adresse :</strong>{' '}
                {selectedPatient.adresse || 'Non renseignée'}
              </p>

              
<button
  type="button"
  onClick={() => {
    resetConsultationForm();
    setConsultationError('');
    setConsultationSuccess('');
    setActiveSection('consultations');
  }}
>
  Nouvelle consultation
</button>

<hr />

<h4>Historique médical</h4>

{consultationsLoading ? (
  <p>Chargement des consultations...</p>
) : consultations.length === 0 ? (
  <p>Aucune consultation enregistrée pour ce patient.</p>
) : (
  <div className="consultations-list">
    {consultations.map((consultation) => (
      <article
        className="consultation-item"
        key={consultation.id}
      >
        <h5>
          {consultation.date_consultation} — {consultation.motif}
        </h5>

        <p>
          <strong>Statut :</strong>{' '}
          {consultation.statut === 'finalisee'
            ? 'Finalisée'
            : 'Brouillon'}
        </p>

        {consultation.symptomes && (
          <p>
            <strong>Symptômes :</strong> {consultation.symptomes}
          </p>
        )}

        {consultation.constantes && (
          <p>
            <strong>Constantes :</strong> {consultation.constantes}
          </p>
        )}

        {consultation.examen_clinique && (
          <p>
            <strong>Examen clinique :</strong>{' '}
            {consultation.examen_clinique}
          </p>
        )}

        {consultation.diagnostic && (
          <p>
            <strong>Diagnostic :</strong> {consultation.diagnostic}
          </p>
        )}

        {consultation.examens_complementaires && (
          <p>
            <strong>Examens complémentaires :</strong>{' '}
            {consultation.examens_complementaires}
          </p>
        )}

        {consultation.recommandations && (
          <p>
            <strong>Recommandations :</strong>{' '}
            {consultation.recommandations}
          </p>
        )}

        <h5>Ordonnances associées</h5>

        {patientDossierLoading ? (
          <p>Chargement des ordonnances...</p>
        ) : (patientDossierOrdonnances[consultation.id] || []).length === 0 ? (
          <p>Aucune ordonnance enregistrée pour cette consultation.</p>
        ) : (
          (patientDossierOrdonnances[consultation.id] || []).map(
            (ordonnance) => (
              <div
                key={ordonnance.id}
                className="prescription-summary"
              >
                <p>
                  <strong>Date :</strong> {ordonnance.date_creation}
                </p>

                {ordonnance.instructions && (
                  <p>
                    <strong>Instructions :</strong>{' '}
                    {ordonnance.instructions}
                  </p>
                )}

                {(ordonnance.lignes || []).map((ligne) => (
                  <div key={ligne.id}>
                    <p>
                      <strong>{ligne.medicament}</strong>
                      {ligne.dosage ? ` — ${ligne.dosage}` : ''}
                    </p>

                    {ligne.posologie && (
                      <p>
                        <strong>Posologie :</strong> {ligne.posologie}
                      </p>
                    )}

                    {ligne.voie_administration && (
                      <p>
                        <strong>Voie d’administration :</strong>{' '}
                        {ligne.voie_administration}
                      </p>
                    )}

                    {ligne.duree && (
                      <p>
                        <strong>Durée :</strong> {ligne.duree}
                      </p>
                    )}

                    {ligne.quantite && (
                      <p>
                        <strong>Quantité :</strong> {ligne.quantite}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          )
        )}
      </article>
    ))}
  </div>
)}
</section>

          )}

          {patients.length === 0 ? (
            <p>Aucun patient enregistré pour le moment.</p>
          ) : (
            <ul>
              {patients.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    className="patient-name-button"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    {patient.nom} {patient.prenom}
                  </button>

                  <br />
                  Dossier : {patient.numero_dossier}
                  <br />
                  Téléphone : {patient.telephone || 'Non renseigné'}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  )}

  {/* RUBRIQUE CONSULTATIONS */}
  {activeSection === 'consultations' && (
    <article className="card">
      <div className="card-icon">▤</div>
      <h3>Consultations</h3>

      {!selectedPatient ? (
        <>
          <p>
            Sélectionnez d'abord un patient dans la rubrique Patients
            pour créer ou consulter son dossier médical.
          </p>
          <button
            type="button"
            onClick={() => setShowPatientSelector((previous) => !previous)}
          >
            {showPatientSelector ? 'Masquer les patients' : 'Choisir un patient'}
          </button>

{showPatientSelector && (
  <div className="patient-selector">
    <h4>Choisir un patient</h4>

    {patientsLoading ? (
      <p>Chargement des patients...</p>
    ) : patients.length === 0 ? (
      <p>Aucun patient enregistré.</p>
    ) : (
      <ul>
        {patients.map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedPatient(patient);
                setShowPatientSelector(false);
                resetConsultationForm();
                setConsultationError('');
                setConsultationSuccess('');
              }}
            >
              {patient.nom} {patient.prenom}
              {' — Dossier : '}
              {patient.numero_dossier}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
)}
</>
      ) : (
        <>
          <section className="patient-details">
            <h4>Patient sélectionné</h4>

            <p>
              <strong>Nom :</strong>{' '}
              {selectedPatient.nom} {selectedPatient.prenom}
            </p>

            <p>
              <strong>Numéro de dossier :</strong>{' '}
              {selectedPatient.numero_dossier}
            </p>

            <button
              type="button"
              onClick={() => setActiveSection('patients')}
            >
              Retour aux patients
            </button>
          </section>

          <div className="patient-details-header">
            <h4>Consultations</h4>

            <button
              type="button"
              onClick={() => {
                if (showConsultationForm) {
                  resetConsultationForm();
                  setShowConsultationForm(false);
                } else {
                  resetConsultationForm();
                  setShowConsultationForm(true);
                }
              }}
            >
              {showConsultationForm
                ? 'Annuler'
                : 'Nouvelle consultation'}
            </button>
          </div>

          {consultationSuccess && (
            <p className="success-message">
              {consultationSuccess}
            </p>
          )}

          {consultationError && (
            <p className="error-message">
              {consultationError}
            </p>
          )}

          {showConsultationForm && (
            <form onSubmit={handleConsultationSubmit}>
              <label>
                Date de consultation *
                <input
                  type="date"
                  name="date_consultation"
                  value={consultationForm.date_consultation}
                  onChange={updateConsultationField}
                  required
                />
              </label>

              <label>
                Motif *
                <textarea
                  name="motif"
                  value={consultationForm.motif}
                  onChange={updateConsultationField}
                  required
                />
              </label>

              <label>
                Symptômes
                <textarea
                  name="symptomes"
                  value={consultationForm.symptomes}
                  onChange={updateConsultationField}
                />
              </label>

              <label>
                Constantes
                <textarea
                  name="constantes"
                  value={consultationForm.constantes}
                  onChange={updateConsultationField}
                  placeholder="Ex. : tension, température, poids…"
                />
              </label>

              <label>
                Examen clinique
                <textarea
                  name="examen_clinique"
                  value={consultationForm.examen_clinique}
                  onChange={updateConsultationField}
                />
              </label>

              <label>
                Diagnostic
                <textarea
                  name="diagnostic"
                  value={consultationForm.diagnostic}
                  onChange={updateConsultationField}
                />
              </label>

              <label>
                Examens complémentaires
                <textarea
                  name="examens_complementaires"
                  value={consultationForm.examens_complementaires}
                  onChange={updateConsultationField}
                />
              </label>

              <label>
                Recommandations
                <textarea
                  name="recommandations"
                  value={consultationForm.recommandations}
                  onChange={updateConsultationField}
                />
              </label>

              <label>
                Statut
                <select
                  name="statut"
                  value={consultationForm.statut}
                  onChange={updateConsultationField}
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="finalisee">Finalisée</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={consultationSubmitting}
              >
                {consultationSubmitting
                  ? 'Enregistrement…'
                  : editingConsultation
                    ? 'Enregistrer les modifications'
                    : 'Enregistrer la consultation'}
              </button>
            </form>
          )}

          <h4>Historique des consultations</h4>

          {consultationsLoading && (
            <p>Chargement des consultations…</p>
          )}

          {!consultationsLoading && consultations.length === 0 && (
            <p>
              Aucune consultation enregistrée pour ce patient.
            </p>
          )}

          {!consultationsLoading && consultations.length > 0 && (
            <div className="consultations-list">
              {consultations.map((consultation) => (
                <article
                  className="consultation-item"
                  key={consultation.id}
                >

                  <h5>
                    {consultation.date_consultation} —{' '}
                    {consultation.motif}
                  </h5>

                  <p>
                    <strong>Statut :</strong>{' '}
                    {consultation.statut === 'finalisee'
                      ? 'Finalisée'
                      : 'Brouillon'}
                  </p>

                  {consultation.diagnostic && (
                    <p>
                      <strong>Diagnostic :</strong>{' '}
                      {consultation.diagnostic}
                    </p>
                  )}

{consultation.symptomes && (
  <p>
    <strong>Symptômes :</strong>{' '}
    {consultation.symptomes}
  </p>
)}

{consultation.constantes && (
  <p>
    <strong>Constantes :</strong>{' '}
    {consultation.constantes}
  </p>
)}

{consultation.examen_clinique && (
  <p>
    <strong>Examen clinique :</strong>{' '}
    {consultation.examen_clinique}
  </p>
)}

{consultation.examens_complementaires && (
  <p>
    <strong>Examens complémentaires :</strong>{' '}
    {consultation.examens_complementaires}
  </p>
)}


                  {consultation.recommandations && (
                    <p>
                      <strong>Recommandations :</strong>{' '}
                      {consultation.recommandations}
                    </p>
                  )}

<div className="patient-prescriptions">
  <h5>Ordonnances associées</h5>

  {patientDossierLoading ? (
    <p>Chargement des ordonnances…</p>
  ) : (patientDossierOrdonnances[consultation.id] || []).length === 0 ? (
    <p>Aucune ordonnance pour cette consultation.</p>
  ) : (
    (patientDossierOrdonnances[consultation.id] || []).map(
      (ordonnance) => (
        <div key={ordonnance.id} className="prescription-summary">
          <p>
            <strong>Date :</strong>{' '}
            {ordonnance.date_creation}
          </p>

          {ordonnance.instructions && (
            <p>
              <strong>Instructions :</strong>{' '}
              {ordonnance.instructions}
            </p>
          )}

          {(ordonnance.lignes || []).map((ligne) => (
            <div key={ligne.id}>
              <p>
                <strong>{ligne.medicament}</strong>
                {ligne.dosage ? ` — ${ligne.dosage}` : ''}
              </p>

              {ligne.posologie && (
                <p>
                  <strong>Posologie :</strong>{' '}
                  {ligne.posologie}
                </p>
              )}

              {ligne.voie_administration && (
                <p>
                  <strong>Voie d’administration :</strong>{' '}
                  {ligne.voie_administration}
                </p>
              )}

              {ligne.duree && (
                <p>
                  <strong>Durée :</strong>{' '}
                  {ligne.duree}
                </p>
              )}

              {ligne.quantite && (
                <p>
                  <strong>Quantité :</strong>{' '}
                  {ligne.quantite}
                </p>
              )}

              {ligne.instructions && (
                <p>
                  <strong>Instructions du médicament :</strong>{' '}
                  {ligne.instructions}
                </p>
              )}
            </div>
          ))}
        </div>
      )
    )
  )}
</div>


                  <button
                    type="button"
                    onClick={() => handleEditConsultation(consultation)}
                  >
                    Modifier
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  )}


  {/* RUBRIQUE ORDONNANCES */}
  {activeSection === 'ordonnances' && (
    <article className="card">
      <div className="card-icon">✚</div>
      <h3>Ordonnances</h3>

      {!selectedPatient ? (
        <>
          <p>
            Sélectionnez d'abord un patient dans la rubrique Patients
            pour consulter ou créer une ordonnance.
          </p>
          <button
            type="button"
            onClick={() => setShowPatientSelector((previous) => !previous)}
>
  {showPatientSelector ? 'Masquer les patients' : 'Choisir un patient'}
</button>

{showPatientSelector && (
  <div className="patient-selector">
    <h4>Choisir un patient</h4>

    {patientsLoading ? (
      <p>Chargement des patients...</p>
    ) : patients.length === 0 ? (
      <p>Aucun patient enregistré.</p>
    ) : (
      <ul>
        {patients.map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedPatient(patient);
                setShowPatientSelector(false);
                setSelectedConsultationId('');
                setOrdonnances([]);
                setShowOrdonnanceForm(false);
                setEditingOrdonnance(null);
                setOrdonnanceError('');
                setOrdonnanceSuccess('');
              }}
            >
              {patient.nom} {patient.prenom}
              {' — Dossier : '}
              {patient.numero_dossier}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
)}



        </>
      ) : (
        <>
          <section className="patient-details">
            <h4>Patient sélectionné</h4>
            <p>
              <strong>Nom :</strong>{' '}
              {selectedPatient.nom} {selectedPatient.prenom}
            </p>
            <p>
              <strong>Dossier :</strong>{' '}
              {selectedPatient.numero_dossier}
            </p>
          </section>

          <label>
            Consultation concernée *
            <select
              value={selectedConsultationId}
              onChange={(event) => {
                const consultationId = event.target.value;
                setSelectedConsultationId(consultationId);
                setShowOrdonnanceForm(false);
                setEditingOrdonnance(null);
                setOrdonnanceError('');
                setOrdonnanceSuccess('');
                loadOrdonnances(consultationId);
              }}
              required
            >
              <option value="">Choisir une consultation</option>
              {consultations.map((consultation) => (
                <option
                  key={consultation.id}
                  value={consultation.id}
                >
                  {consultation.date_consultation} — {consultation.motif}
                </option>
              ))}
            </select>
          </label>

          {consultations.length === 0 && (
            <p>
              Aucune consultation disponible. Créez d'abord une
              consultation pour ce patient.
            </p>
          )}

          {ordonnanceError && (
            <p className="error-message">{ordonnanceError}</p>
          )}

          {ordonnanceSuccess && (
            <p className="success-message">{ordonnanceSuccess}</p>
          )}

          {selectedConsultationId && (
            <>
              <div className="patient-details-header">
                <h4>Ordonnances enregistrées</h4>
                <button
                  type="button"
                  onClick={resetOrdonnanceForm}
                  disabled={ordonnanceSubmitting}
                >
                  Nouvelle ordonnance
                </button>
              </div>

              {ordonnancesLoading && (
                <p>Chargement des ordonnances…</p>
              )}

              {!ordonnancesLoading && ordonnances.length === 0 && (
                <p>Aucune ordonnance pour cette consultation.</p>
              )}

              {!ordonnancesLoading && ordonnances.length > 0 && (
                <div className="consultations-list">
                  {ordonnances.map((ordonnance) => (
                    <article
                      className="consultation-item"
                      key={ordonnance.id}
                    >
                      <h5>
                        Ordonnance du {ordonnance.date_creation}
                      </h5>

                      {ordonnance.instructions && (
                        <p>
                          <strong>Instructions :</strong>{' '}
                          {ordonnance.instructions}
                        </p>
                      )}

                      <h5>Médicaments</h5>
                      {(ordonnance.lignes || []).map((ligne) => (
                        <div key={ligne.id}>
                          <p>
                            <strong>{ligne.medicament}</strong>
                            {ligne.dosage ? ` — ${ligne.dosage}` : ''}
                          </p>
                          <p>
                            <strong>Posologie :</strong>{' '}
                            {ligne.posologie}
                          </p>
                          {ligne.voie_administration && (
                            <p>
                              <strong>Voie :</strong>{' '}
                              {ligne.voie_administration}
                            </p>
                          )}
                          {ligne.duree && (
                            <p>
                              <strong>Durée :</strong> {ligne.duree}
                            </p>
                          )}
                          {ligne.quantite && (
                            <p>
                              <strong>Quantité :</strong> {ligne.quantite}
                            </p>
                          )}
                          {ligne.instructions && (
                            <p>
                              <strong>Précisions :</strong>{' '}
                              {ligne.instructions}
                            </p>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleEditOrdonnance(ordonnance)}
                      >
                        Modifier l'ordonnance
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                      >
                        Imprimer l'ordonnance
                      </button>
                    </article>
                  ))}
                </div>
              )}

              {showOrdonnanceForm && (
                <form onSubmit={handleOrdonnanceSubmit}>
                  <h4>
                    {editingOrdonnance
                      ? "Modifier l'ordonnance"
                      : 'Nouvelle ordonnance'}
                  </h4>

                  <label>
                    Instructions générales
                    <textarea
                      name="instructions"
                      value={ordonnanceForm.instructions}
                      onChange={updateOrdonnanceField}
                      placeholder="Instructions générales de l'ordonnance"
                    />
                  </label>

                  <h4>Médicaments prescrits</h4>

                  {ordonnanceForm.lignes.map((ligne, index) => (
                    <section className="patient-details" key={index}>
                      <h5>Médicament {index + 1}</h5>

                      <label>
                        Médicament *
                        <input
                          value={ligne.medicament}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'medicament',
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        Dosage
                        <input
                          value={ligne.dosage}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'dosage',
                              event.target.value
                            )
                          }
                          placeholder="Ex. : 500 mg"
                        />
                      </label>

                      <label>
                        Posologie *
                        <textarea
                          value={ligne.posologie}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'posologie',
                              event.target.value
                            )
                          }
                          required
                          placeholder="Posologie définie par le médecin"
                        />
                      </label>

                      <label>
                        Voie d'administration
                        <input
                          value={ligne.voie_administration}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'voie_administration',
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Durée
                        <input
                          value={ligne.duree}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'duree',
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Quantité
                        <input
                          value={ligne.quantite}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'quantite',
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        Instructions particulières
                        <textarea
                          value={ligne.instructions}
                          onChange={(event) =>
                            updatePrescriptionLine(
                              index,
                              'instructions',
                              event.target.value
                            )
                          }
                        />
                      </label>

                      {ordonnanceForm.lignes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrescriptionLine(index)}
                        >
                          Supprimer ce médicament
                        </button>
                      )}
                    </section>
                  ))}

                  <button
                    type="button"
                    onClick={addPrescriptionLine}
                  >
                    Ajouter un médicament
                  </button>

                  <button
                    type="submit"
                    disabled={ordonnanceSubmitting}
                  >
                    {ordonnanceSubmitting
                      ? 'Enregistrement…'
                      : editingOrdonnance
                        ? "Enregistrer les modifications"
                        : "Enregistrer l'ordonnance"}
                  </button>

                  <button
                    type="button"
                    disabled={ordonnanceSubmitting}
                    onClick={() => {
                      setShowOrdonnanceForm(false);
                      setEditingOrdonnance(null);
                      setOrdonnanceError('');
                    }}
                  >
                    Annuler
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </article>
  )}

</section>

        <footer>
          Utilisez uniquement des données fictives pendant les tests.
        </footer>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">+</div>
          <div>
            <h1>Carnet Médical</h1>
            <p>Gestion des dossiers patients</p>
          </div>
        </div>
        <span className="status">
          <span className="status-dot" />
          Application locale
        </span>
      </header>

      <section className="welcome">
        <p className="eyebrow">ESPACE MÉDICAL</p>
        <h2>
          {setupRequired
            ? 'Configurez votre compte médecin'
            : 'Heureux de vous revoir'}
        </h2>
        <p>
          {setupRequired
            ? 'Créez le compte initial pour commencer à configurer votre carnet médical.'
            : 'Connectez-vous pour accéder à votre carnet médical.'}
        </p>
      </section>

      <section className="card auth-card">
        <h3>
          {setupRequired ? 'Créer le compte médecin' : 'Connexion'}
        </h3>

        {error && <p role="alert" className="form-error">{error}</p>}
        {success && <p role="status" className="form-success">{success}</p>}

        <form onSubmit={handleSubmit}>
          {setupRequired && (
            <>
              <label htmlFor="nom">Nom</label>
              <input
                id="nom"
                name="nom"
                value={form.nom}
                onChange={updateField}
                autoComplete="family-name"
                required
              />

              <label htmlFor="prenom">Prénom</label>
              <input
                id="prenom"
                name="prenom"
                value={form.prenom}
                onChange={updateField}
                autoComplete="given-name"
                required
              />
            </>
          )}

          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            autoComplete="email"
            required
          />

          <label htmlFor="motDePasse">Mot de passe</label>
          <input
            id="motDePasse"
            name="motDePasse"
            type="password"
            value={form.motDePasse}
            onChange={updateField}
            autoComplete={setupRequired ? 'new-password' : 'current-password'}
            minLength={setupRequired ? 12 : undefined}
            required
          />

          {setupRequired && (
            <>
              <label htmlFor="confirmation">Confirmer le mot de passe</label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                value={form.confirmation}
                onChange={updateField}
                autoComplete="new-password"
                minLength={12}
                required
              />
            </>
          )}

          <button type="submit" disabled={submitting}>
            {submitting
              ? 'Veuillez patienter…'
              : setupRequired
                ? 'Créer mon compte'
                : 'Se connecter'}
          </button>
        </form>
      </section>

      <footer>
        Utilisez uniquement des données fictives pendant les tests.
        La sécurisation complète des données médicales reste à réaliser.
      </footer>
    </main>
  );
}
