
import { useEffect, useState } from 'react';

export default function App() {
  const [setupRequired, setSetupRequired] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [doctor, setDoctor] = useState(null);

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

        setDoctor({
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          email: form.email.trim().toLowerCase(),
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

  function logout() {
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

        <section className="dashboard">
          <article className="card">
            <div className="card-icon">♙</div>
            <h3>Patients</h3>
            <p>Le module de gestion des patients reste à connecter à une session sécurisée.</p>
          </article>

          <article className="card">
            <div className="card-icon">▤</div>
            <h3>Consultations</h3>
            <p>Le module de consultations reste à développer.</p>
          </article>

          <article className="card">
            <div className="card-icon">✚</div>
            <h3>Ordonnances</h3>
            <p>Le module des prescriptions reste à développer.</p>
          </article>
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
