
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
  listPatients: (medecinId) =>
    ipcRenderer.invoke('patients:list', medecinId),

  createPatient: (patient) =>
    ipcRenderer.invoke('patients:create', patient),
});
