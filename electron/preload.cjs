
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('carnetMedical', {
  version: '1.0.0',
  platform: process.platform,

  // Authentification
  getSetupStatus: () =>
    ipcRenderer.invoke('auth:setup-status'),

  registerDoctor: (data) =>
    ipcRenderer.invoke('auth:register', data),

  loginDoctor: (data) =>
    ipcRenderer.invoke('auth:login', data),

    logoutDoctor: () => ipcRenderer.invoke('auth:logout'),

  // Patients
 
  // Patients
  listPatients: (medecinId) =>
    ipcRenderer.invoke('patients:list', medecinId),

  createPatient: (patient) =>
    ipcRenderer.invoke('patients:create', patient),

  // Consultations
  listConsultations: (patientId) =>
    ipcRenderer.invoke('consultations:list', patientId),

  createConsultation: (consultation) =>
    ipcRenderer.invoke('consultations:create', consultation),

  updateConsultation: (consultation) =>
    ipcRenderer.invoke('consultations:update', consultation),

  // Ordonnances
  listOrdonnances: (consultationId) =>
    ipcRenderer.invoke('ordonnances:list', consultationId),

  createOrdonnance: (ordonnance) =>
    ipcRenderer.invoke('ordonnances:create', ordonnance),

  updateOrdonnance: (ordonnance) =>
    ipcRenderer.invoke('ordonnances:update', ordonnance),
});

