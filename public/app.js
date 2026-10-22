/**
 * Herbarium - Database Botanico
 * Client Application Logic with Real-time Sync (SSE)
 */

// Application State
const state = {
  plants: [],
  presetPhotos: [],
  filterHumidity: 'all',
  searchQuery: '',
  sortBy: 'recent',
  editingPlantId: null,
  deletingPlant: null,
  selectedPhotoUrl: '',
  qrCodeInstance: null,
  geminiApiKey: localStorage.getItem('herbarium_gemini_key') || ''
};

// DOM Elements
const elements = {
  // Navigation & Badges
  liveSyncBadge: document.getElementById('liveSyncBadge'),
  openAddModalBtn: document.getElementById('openAddModalBtn'),
  openAiScanBtn: document.getElementById('openAiScanBtn'),
  fabAddBtn: document.getElementById('fabAddBtn'),
  openShareBtn: document.getElementById('openShareBtn'),

  // AI Recognition Elements
  aiScanCard: document.getElementById('aiScanCard'),
  toggleAiKeyBtn: document.getElementById('toggleAiKeyBtn'),
  aiCameraInput: document.getElementById('aiCameraInput'),
  aiUploadInput: document.getElementById('aiUploadInput'),
  aiTriggerBtn: document.getElementById('aiTriggerBtn'),
  aiLoadingIndicator: document.getElementById('aiLoadingIndicator'),
  aiSuccessBanner: document.getElementById('aiSuccessBanner'),
  aiIdentifiedTitle: document.getElementById('aiIdentifiedTitle'),
  aiIdentifiedDetails: document.getElementById('aiIdentifiedDetails'),
  aiKeyDrawer: document.getElementById('aiKeyDrawer'),
  geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  removeApiKeyBtn: document.getElementById('removeApiKeyBtn'),

  // Stats
  statTotalPlants: document.getElementById('statTotalPlants'),
  statHumidityHigh: document.getElementById('statHumidityHigh'),
  statHumidityLow: document.getElementById('statHumidityLow'),
  visibleCountBadge: document.getElementById('visibleCountBadge'),

  // Search & Filters
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  humidityFilterChips: document.getElementById('humidityFilterChips'),
  sortSelect: document.getElementById('sortSelect'),

  // Catalog Grid & States
  plantsGrid: document.getElementById('plantsGrid'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  emptyMessage: document.getElementById('emptyMessage'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),

  // Plant Modal (Add/Edit)
  plantModalBackdrop: document.getElementById('plantModalBackdrop'),
  plantForm: document.getElementById('plantForm'),
  modalTitle: document.getElementById('modalTitle'),
  modalEmoji: document.getElementById('modalEmoji'),
  saveBtnText: document.getElementById('saveBtnText'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),

  // Form Inputs
  plantIdInput: document.getElementById('plantIdInput'),
  plantNameInput: document.getElementById('plantNameInput'),
  scientificNameInput: document.getElementById('scientificNameInput'),
  phInput: document.getElementById('phInput'),
  tempInput: document.getElementById('tempInput'),
  humiditySelect: document.getElementById('humiditySelect'),
  customHumidityInput: document.getElementById('customHumidityInput'),
  sunlightSelect: document.getElementById('sunlightSelect'),
  notesInput: document.getElementById('notesInput'),
  imageUrlInput: document.getElementById('imageUrlInput'),

  // Photo Picker
  photoPreviewBox: document.getElementById('photoPreviewBox'),
  photoPreviewImg: document.getElementById('photoPreviewImg'),
  photoPlaceholder: document.getElementById('photoPlaceholder'),
  removePhotoBtn: document.getElementById('removePhotoBtn'),
  fileUploadInput: document.getElementById('fileUploadInput'),
  toggleGalleryBtn: document.getElementById('toggleGalleryBtn'),
  galleryDrawer: document.getElementById('galleryDrawer'),
  galleryThumbnails: document.getElementById('galleryThumbnails'),
  galleryCount: document.getElementById('galleryCount'),
  closeGalleryDrawerBtn: document.getElementById('closeGalleryDrawerBtn'),
  customUrlInput: document.getElementById('customUrlInput'),

  // Delete Modal
  deleteModalBackdrop: document.getElementById('deleteModalBackdrop'),
  deletePlantPreview: document.getElementById('deletePlantPreview'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),

  // Share Modal
  shareModalBackdrop: document.getElementById('shareModalBackdrop'),
  shareUrlInput: document.getElementById('shareUrlInput'),
  copyShareUrlBtn: document.getElementById('copyShareUrlBtn'),
  closeShareModalBtn: document.getElementById('closeShareModalBtn'),
  closeShareModalFooterBtn: document.getElementById('closeShareModalFooterBtn'),
  qrcodeContainer: document.getElementById('qrcode'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

// Global helper for quick presets in modal pills
window.setPreset = function(inputId, value) {
  const el = document.getElementById(inputId);
  if (el) {
    el.value = value;
    el.focus();
  }
};

/* ==========================================================
   INITIALIZATION
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadInitialData();
  setupRealtimeSync();
});

function initEventListeners() {
  // Open Add Modal
  elements.openAddModalBtn.addEventListener('click', () => openPlantModal());
  elements.fabAddBtn.addEventListener('click', () => openPlantModal());
  elements.emptyAddBtn.addEventListener('click', () => openPlantModal());

  // Open AI Scan directly
  if (elements.openAiScanBtn) {
    elements.openAiScanBtn.addEventListener('click', () => {
      openPlantModal();
      elements.aiCameraInput.click();
    });
  }

  // AI Recognition Camera & File inputs
  if (elements.aiCameraInput) {
    elements.aiCameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) runAiPlantScan(file, null);
    });
  }

  if (elements.aiUploadInput) {
    elements.aiUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) runAiPlantScan(file, null);
    });
  }

  if (elements.aiTriggerBtn) {
    elements.aiTriggerBtn.addEventListener('click', () => {
      if (state.selectedPhotoUrl) {
        runAiPlantScan(null, state.selectedPhotoUrl);
      } else {
        elements.aiCameraInput.click();
      }
    });
  }

  // Toggle AI API Key settings drawer
  if (elements.toggleAiKeyBtn) {
    elements.toggleAiKeyBtn.addEventListener('click', () => {
      const isHidden = elements.aiKeyDrawer.style.display === 'none';
      elements.aiKeyDrawer.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        elements.geminiApiKeyInput.value = state.geminiApiKey;
        elements.geminiApiKeyInput.focus();
        updateApiKeyUI();
      }
    });
  }

  if (elements.saveApiKeyBtn) {
    elements.saveApiKeyBtn.addEventListener('click', () => {
      const key = elements.geminiApiKeyInput.value.trim();
      state.geminiApiKey = key;
      if (key) {
        localStorage.setItem('herbarium_gemini_key', key);
        showToast('Chiave Gemini salvata con successo!', 'success');
      } else {
        localStorage.removeItem('herbarium_gemini_key');
        showToast('Chiave Gemini rimossa', 'info');
      }
      updateApiKeyUI();
    });
  }

  if (elements.removeApiKeyBtn) {
    elements.removeApiKeyBtn.addEventListener('click', () => {
      state.geminiApiKey = '';
      localStorage.removeItem('herbarium_gemini_key');
      elements.geminiApiKeyInput.value = '';
      updateApiKeyUI();
      showToast('Chiave Gemini rimossa', 'info');
    });
  }

  // Close Plant Modal
  elements.closeModalBtn.addEventListener('click', closePlantModal);
  elements.cancelModalBtn.addEventListener('click', closePlantModal);
  elements.plantModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.plantModalBackdrop) closePlantModal();
  });

  // Submit Plant Form
  elements.plantForm.addEventListener('submit', handlePlantFormSubmit);

  // Humidity dropdown change (toggle custom percentage input)
  elements.humiditySelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      elements.customHumidityInput.style.display = 'block';
      elements.customHumidityInput.focus();
    } else {
      elements.customHumidityInput.style.display = 'none';
    }
  });

  // Search & Filter
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderPlants();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    renderPlants();
  });

  // Filter chips (Umidità)
  elements.humidityFilterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    document.querySelectorAll('#humidityFilterChips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    state.filterHumidity = chip.getAttribute('data-filter');
    renderPlants();
  });

  // Sort dropdown
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderPlants();
  });

  // Photo handlers
  elements.fileUploadInput.addEventListener('change', handleFileUpload);
  elements.toggleGalleryBtn.addEventListener('click', toggleGalleryDrawer);
  elements.closeGalleryDrawerBtn.addEventListener('click', () => {
    elements.galleryDrawer.style.display = 'none';
  });
  elements.removePhotoBtn.addEventListener('click', clearSelectedPhoto);
  elements.customUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      setPhotoPreview(url);
    }
  });

  // Delete Modal
  elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  elements.deleteModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.deleteModalBackdrop) closeDeleteModal();
  });

  // Share Modal
  elements.openShareBtn.addEventListener('click', openShareModal);
  elements.closeShareModalBtn.addEventListener('click', closeShareModal);
  elements.closeShareModalFooterBtn.addEventListener('click', closeShareModal);
  elements.copyShareUrlBtn.addEventListener('click', copyShareUrl);
  elements.shareModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.shareModalBackdrop) closeShareModal();
  });

  // ESC key to close any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePlantModal();
      closeDeleteModal();
      closeShareModal();
    }
  });
}

/* ==========================================================
   DATA FETCHING & REALTIME SYNC (SSE)
   ========================================================== */
async function loadInitialData() {
  try {
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.plantsGrid.innerHTML = '';

    const [plantsRes, photosRes] = await Promise.all([
      fetch('/api/plants'),
      fetch('/api/preset-photos')
    ]);

    if (!plantsRes.ok) throw new Error('Impossibile caricare le piante');

    state.plants = await plantsRes.json();
    state.presetPhotos = await photosRes.json();

    elements.galleryCount.textContent = state.presetPhotos.length;
    renderGalleryThumbnails();

    elements.loadingState.style.display = 'none';
    renderPlants();
  } catch (err) {
    console.error(err);
    elements.loadingState.style.display = 'none';
    showToast('Errore nel caricamento del database', 'error');
  }
}

function setupRealtimeSync() {
  const eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    updateSyncBadge(true);
  };

  eventSource.addEventListener('botanical-update', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleRealtimeUpdate(data);
    } catch (err) {
      console.error('Errore parsing SSE:', err);
    }
  });

  eventSource.onerror = () => {
    updateSyncBadge(false);
  };
}

function updateSyncBadge(isConnected) {
  if (isConnected) {
    elements.liveSyncBadge.innerHTML = `
      <span class="pulse-dot"></span>
      <span class="badge-text">Sincronizzato</span>
    `;
    elements.liveSyncBadge.style.background = '#ecfdf5';
    elements.liveSyncBadge.style.borderColor = '#a7f3d0';
    elements.liveSyncBadge.style.color = '#065f46';
  } else {
    elements.liveSyncBadge.innerHTML = `
      <span class="pulse-dot" style="background-color: #f59e0b; box-shadow: none;"></span>
      <span class="badge-text">Riconnessione...</span>
    `;
    elements.liveSyncBadge.style.background = '#fffbeb';
    elements.liveSyncBadge.style.borderColor = '#fde68a';
    elements.liveSyncBadge.style.color = '#b45309';
  }
}

function handleRealtimeUpdate({ type, payload }) {
  if (type === 'created') {
    const exists = state.plants.some(p => p.id === payload.id);
    if (!exists) {
      state.plants.unshift(payload);
      renderPlants();
      showToast(`Nuova pianta aggiunta: "${payload.name}"`, 'info');
    }
  } else if (type === 'updated') {
    const idx = state.plants.findIndex(p => p.id === payload.id);
    if (idx !== -1) {
      state.plants[idx] = payload;
      renderPlants();
    }
  } else if (type === 'deleted') {
    state.plants = state.plants.filter(p => p.id !== payload.id);
    renderPlants();
    showToast(`La pianta "${payload.name || 'selezionata'}" è stata rimossa`, 'info');
  }
}

function getHumidityCategory(humStr) {
  if (!humStr) return 'Media';
  const str = String(humStr).toLowerCase();
  const match = str.match(/(\d+)%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val <= 25) return 'Bassa';
    if (val >= 50) return 'Alta';
    return 'Media';
  }
  if (str.includes('bassa')) return 'Bassa';
  if (str.includes('alta')) return 'Alta';
  return 'Media';
}

/* ==========================================================
   RENDER CATALOG & STATS
   ========================================================== */
function renderPlants() {
  // Update overall stats
  elements.statTotalPlants.textContent = state.plants.length;
  elements.statHumidityHigh.textContent = state.plants.filter(p => getHumidityCategory(p.humidity) === 'Alta').length;
  elements.statHumidityLow.textContent = state.plants.filter(p => getHumidityCategory(p.humidity) === 'Bassa').length;

  // Filter
  let filtered = [...state.plants];

  if (state.filterHumidity !== 'all') {
    filtered = filtered.filter(p => getHumidityCategory(p.humidity) === state.filterHumidity);
  }

  if (state.searchQuery) {
    filtered = filtered.filter(p => {
      const name = (p.name || '').toLowerCase();
      const sciName = (p.scientificName || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      return name.includes(state.searchQuery) ||
             sciName.includes(state.searchQuery) ||
             notes.includes(state.searchQuery);
    });
  }

  // Sort
  if (state.sortBy === 'name-asc') {
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (state.sortBy === 'name-desc') {
    filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (state.sortBy === 'ph-asc') {
    filtered.sort((a, b) => {
      const getPhNum = s => parseFloat((s || '').replace(/[^0-9.]/g, '')) || 0;
      return getPhNum(a.ph) - getPhNum(b.ph);
    });
  } else {
    // recent
    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  elements.visibleCountBadge.textContent = `${filtered.length} visualizzate`;

  if (filtered.length === 0) {
    elements.plantsGrid.innerHTML = '';
    elements.emptyState.style.display = 'flex';
    if (state.plants.length === 0) {
      elements.emptyMessage.textContent = 'Il catalogo è attualmente vuoto. Inizia inserendo la tua prima pianta!';
    } else {
      elements.emptyMessage.textContent = 'Nessuna pianta corrisponde ai criteri di ricerca e filtro selezionati.';
    }
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.plantsGrid.innerHTML = filtered.map(plant => createPlantCardHTML(plant)).join('');

  // Attach card action listeners
  elements.plantsGrid.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openPlantModal(id);
    });
  });

  elements.plantsGrid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openDeleteModal(id);
    });
  });
}

function createPlantCardHTML(plant) {
  // Humidity badge color
  let humClass = 'badge-med';
  let humIcon = 'fa-droplet';
  const humStr = (plant.humidity || '').toLowerCase();
  if (humStr.includes('bassa') || humStr.includes('10%') || humStr.includes('15%') || humStr.includes('20%')) {
    humClass = 'badge-low';
    humIcon = 'fa-sun';
  } else if (humStr.includes('alta') || humStr.includes('60%') || humStr.includes('65%') || humStr.includes('70%')) {
    humClass = 'badge-high';
    humIcon = 'fa-water';
  } else if (humStr.includes('%')) {
    humClass = 'badge-custom';
    humIcon = 'fa-droplet';
  } else {
    humClass = 'badge-med';
    humIcon = 'fa-droplet';
  }

  // Media section
  const mediaHTML = plant.imageUrl
    ? `<img src="${escapeHtml(plant.imageUrl)}" alt="${escapeHtml(plant.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-media-placeholder\\'><i class=\\'fa-solid fa-leaf\\'></i><span>${escapeHtml(plant.name)}</span></div>';">`
    : `<div class="card-media-placeholder"><i class="fa-solid fa-leaf"></i><span>${escapeHtml(plant.name)}</span></div>`;

  return `
    <article class="plant-card" data-plant-id="${plant.id}">
      <div class="card-media">
        ${mediaHTML}
      </div>

      <div class="card-body">
        <div class="card-header-titles">
          <div class="name-entry">
            <span class="name-category-label">Nome comune</span>
            <h4 class="plant-title">${escapeHtml(plant.name)}</h4>
          </div>
          <div class="name-entry scientific-entry">
            <span class="name-category-label">Nome scientifico</span>
            <p class="plant-scientific">${escapeHtml(plant.scientificName || 'Non specificato')}</p>
          </div>
        </div>

        <div class="metrics-grid">
          <!-- pH Terreno -->
          <div class="metric-item">
            <span class="metric-icon">🧪</span>
            <div class="metric-content">
              <span class="metric-label">pH Terreno</span>
              <span class="metric-val">${escapeHtml(plant.ph || 'N/D')}</span>
            </div>
          </div>

          <!-- Temperatura -->
          <div class="metric-item">
            <span class="metric-icon">🌡️</span>
            <div class="metric-content">
              <span class="metric-label">Temp. Ideale</span>
              <span class="metric-val">${escapeHtml(plant.temperature || 'N/D')}</span>
            </div>
          </div>

          <!-- Umidità -->
          <div class="metric-item">
            <span class="metric-icon">💧</span>
            <div class="metric-content">
              <span class="metric-label">Umidità</span>
              <span class="metric-val">${escapeHtml(plant.humidity || 'Media')}</span>
            </div>
          </div>

          <!-- Luce -->
          <div class="metric-item">
            <span class="metric-icon">☀️</span>
            <div class="metric-content">
              <span class="metric-label">Esposizione</span>
              <span class="metric-val" title="${escapeHtml(plant.sunlight || 'Non specificata')}">${escapeHtml(plant.sunlight || 'Non specificata')}</span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button type="button" class="btn-card-action btn-card-edit" data-action="edit" data-id="${plant.id}">
            <i class="fa-solid fa-pen-to-square"></i> Modifica
          </button>
          <button type="button" class="btn-card-action btn-card-delete" data-action="delete" data-id="${plant.id}">
            <i class="fa-solid fa-trash-can"></i> Elimina
          </button>
        </div>
      </div>
    </article>
  `;
}

/* ==========================================================
   PLANT MODAL (ADD / EDIT)
   ========================================================= */
function openPlantModal(plantId = null) {
  state.editingPlantId = plantId;
  elements.plantForm.reset();
  elements.galleryDrawer.style.display = 'none';
  elements.customHumidityInput.style.display = 'none';

  if (elements.aiLoadingIndicator) elements.aiLoadingIndicator.style.display = 'none';
  if (elements.aiSuccessBanner) elements.aiSuccessBanner.style.display = 'none';
  if (elements.aiKeyDrawer) elements.aiKeyDrawer.style.display = 'none';
  if (elements.aiTriggerBtn) elements.aiTriggerBtn.style.display = 'none';
  updateApiKeyUI();

  if (plantId) {
    const plant = state.plants.find(p => p.id === plantId);
    if (!plant) return;

    elements.modalTitle.textContent = 'Modifica Pianta';
    elements.modalEmoji.textContent = '✏️';
    elements.saveBtnText.textContent = 'Salva Modifiche';

    if (elements.aiScanCard) elements.aiScanCard.style.display = 'none';

    elements.plantIdInput.value = plant.id;
    elements.plantNameInput.value = plant.name || '';
    elements.scientificNameInput.value = plant.scientificName || '';
    elements.phInput.value = plant.ph || '';
    elements.tempInput.value = plant.temperature || '';

    // Handle humidity options
    if (['Bassa', 'Media', 'Alta'].includes(plant.humidity)) {
      elements.humiditySelect.value = plant.humidity;
    } else if (plant.humidity) {
      elements.humiditySelect.value = 'custom';
      elements.customHumidityInput.style.display = 'block';
      elements.customHumidityInput.value = plant.humidity;
    } else {
      elements.humiditySelect.value = 'Media';
    }

    elements.sunlightSelect.value = plant.sunlight || 'Luce indiretta luminosa';
    elements.notesInput.value = plant.notes || '';

    // Photo
    setPhotoPreview(plant.imageUrl || '');
  } else {
    elements.modalTitle.textContent = 'Aggiungi Nuova Pianta';
    elements.modalEmoji.textContent = '🌿';
    elements.saveBtnText.textContent = 'Aggiungi Pianta';

    if (elements.aiScanCard) elements.aiScanCard.style.display = 'flex';

    elements.plantIdInput.value = '';
    elements.humiditySelect.value = 'Media';
    elements.sunlightSelect.value = 'Luce indiretta luminosa';
    clearSelectedPhoto();
  }

  elements.plantModalBackdrop.style.display = 'flex';
  setTimeout(() => elements.plantNameInput.focus(), 100);
}

function closePlantModal() {
  elements.plantModalBackdrop.style.display = 'none';
  state.editingPlantId = null;
  clearSelectedPhoto();
}

/* ==========================================================
   AI BOTANICAL RECOGNITION (SCAN & FILL)
   ========================================================== */
async function runAiPlantScan(file, imageUrl = null) {
  try {
    elements.aiLoadingIndicator.style.display = 'flex';
    elements.aiSuccessBanner.style.display = 'none';
    if (elements.aiTriggerBtn) elements.aiTriggerBtn.style.display = 'none';

    if (file) {
      const tempUrl = URL.createObjectURL(file);
      setPhotoPreview(tempUrl);
    } else if (imageUrl) {
      setPhotoPreview(imageUrl);
    }

    const formData = new FormData();
    if (file) {
      formData.append('photo', file);
    }
    if (imageUrl) {
      formData.append('imageUrl', imageUrl);
    }

    const headers = {};
    if (state.geminiApiKey) {
      headers['x-gemini-key'] = state.geminiApiKey;
    }

    const res = await fetch('/api/ai-identify', {
      method: 'POST',
      headers,
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Errore durante la scansione AI');
    }

    const data = await res.json();
    const plant = data.plant;

    if (!plant) throw new Error('Nessun dato botanico identificato');

    // Auto-compilazione di tutti i campi!
    if (plant.name) elements.plantNameInput.value = plant.name;
    if (plant.scientificName) elements.scientificNameInput.value = plant.scientificName;
    if (plant.ph) elements.phInput.value = plant.ph;
    if (plant.temperature) elements.tempInput.value = plant.temperature;
    if (plant.sunlight) elements.sunlightSelect.value = plant.sunlight;
    if (plant.notes) elements.notesInput.value = plant.notes;

    // Gestione umidità percentuale o classe
    if (plant.humidity) {
      if (['Bassa', 'Media', 'Alta'].includes(plant.humidity)) {
        elements.humiditySelect.value = plant.humidity;
        elements.customHumidityInput.style.display = 'none';
      } else {
        elements.humiditySelect.value = 'custom';
        elements.customHumidityInput.style.display = 'block';
        elements.customHumidityInput.value = plant.humidity;
      }
    }

    // Imposta immagine permanente restituita dal server
    if (plant.imageUrl) {
      setPhotoPreview(plant.imageUrl);
    }

    // Mostra banner di successo AI
    elements.aiLoadingIndicator.style.display = 'none';
    elements.aiSuccessBanner.style.display = 'flex';
    elements.aiIdentifiedTitle.textContent = `✨ Riconosciuta: ${plant.name}`;
    elements.aiIdentifiedDetails.textContent = `${plant.scientificName || ''} | pH: ${plant.ph || 'N/D'} | Umidità: ${plant.humidity || 'N/D'} | Temp: ${plant.temperature || 'N/D'}`;

    showToast(`✨ Pianta riconosciuta: "${plant.name}"! Tutti i campi sono stati compilati.`, 'success');
  } catch (err) {
    console.error('Errore runAiPlantScan:', err);
    elements.aiLoadingIndicator.style.display = 'none';
    showToast(`Riconoscimento AI: ${err.message}`, 'error');
  }
}

function updateApiKeyUI() {
  if (!elements.toggleAiKeyBtn) return;
  if (state.geminiApiKey) {
    if (elements.removeApiKeyBtn) elements.removeApiKeyBtn.style.display = 'inline-flex';
    if (elements.saveApiKeyBtn) elements.saveApiKeyBtn.textContent = 'Aggiorna';
    elements.toggleAiKeyBtn.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#16a34a;"></i> AI Gemini Attiva';
  } else {
    if (elements.removeApiKeyBtn) elements.removeApiKeyBtn.style.display = 'none';
    if (elements.saveApiKeyBtn) elements.saveApiKeyBtn.textContent = 'Salva';
    elements.toggleAiKeyBtn.innerHTML = '<i class="fa-solid fa-gear"></i> Impostazioni AI';
  }
}

async function handlePlantFormSubmit(e) {
  e.preventDefault();

  const name = elements.plantNameInput.value.trim();
  const ph = elements.phInput.value.trim();
  const temperature = elements.tempInput.value.trim();
  
  let humidity = elements.humiditySelect.value;
  if (humidity === 'custom') {
    humidity = elements.customHumidityInput.value.trim() || 'Media';
  }

  if (!name) {
    showToast('Il nome della pianta è obbligatorio', 'error');
    elements.plantNameInput.focus();
    return;
  }
  if (!ph) {
    showToast('Inserisci il pH del terreno (es. 6.0 - 6.5)', 'error');
    elements.phInput.focus();
    return;
  }
  if (!temperature) {
    showToast('Inserisci la temperatura ideale (es. 18°C - 24°C)', 'error');
    elements.tempInput.focus();
    return;
  }

  const payload = {
    name,
    scientificName: elements.scientificNameInput.value.trim(),
    ph,
    temperature,
    humidity,
    sunlight: elements.sunlightSelect.value,
    notes: elements.notesInput.value.trim(),
    imageUrl: state.selectedPhotoUrl || ''
  };

  const isEditing = Boolean(state.editingPlantId);
  const url = isEditing ? `/api/plants/${state.editingPlantId}` : '/api/plants';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    elements.saveBtnText.textContent = 'Salvataggio...';
    document.getElementById('savePlantBtn').disabled = true;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Errore durante il salvataggio');

    const savedPlant = await res.json();

    if (isEditing) {
      const idx = state.plants.findIndex(p => p.id === savedPlant.id);
      if (idx !== -1) state.plants[idx] = savedPlant;
      showToast(`Pianta "${savedPlant.name}" modificata con successo!`, 'success');
    } else {
      state.plants.unshift(savedPlant);
      showToast(`Pianta "${savedPlant.name}" aggiunta al database!`, 'success');
    }

    renderPlants();
    closePlantModal();
  } catch (err) {
    console.error(err);
    showToast('Errore durante il salvataggio nel database', 'error');
  } finally {
    document.getElementById('savePlantBtn').disabled = false;
    elements.saveBtnText.textContent = isEditing ? 'Salva Modifiche' : 'Aggiungi Pianta';
  }
}

/* ==========================================================
   PHOTO HANDLING (Upload, Gallery, URL)
   ========================================================== */
function setPhotoPreview(url) {
  state.selectedPhotoUrl = url;
  elements.imageUrlInput.value = url;
  if (url) {
    elements.photoPreviewImg.src = url;
    elements.photoPreviewImg.style.display = 'block';
    elements.photoPlaceholder.style.display = 'none';
    elements.removePhotoBtn.style.display = 'flex';
    elements.customUrlInput.value = url.startsWith('http') ? url : '';
    if (elements.aiTriggerBtn && !state.editingPlantId) {
      elements.aiTriggerBtn.style.display = 'inline-flex';
    }
  } else {
    clearSelectedPhoto();
  }
}

function clearSelectedPhoto() {
  state.selectedPhotoUrl = '';
  elements.imageUrlInput.value = '';
  elements.customUrlInput.value = '';
  elements.fileUploadInput.value = '';
  elements.photoPreviewImg.src = '';
  elements.photoPreviewImg.style.display = 'none';
  elements.photoPlaceholder.style.display = 'flex';
  elements.removePhotoBtn.style.display = 'none';
  if (elements.aiTriggerBtn) elements.aiTriggerBtn.style.display = 'none';
  if (elements.aiSuccessBanner) elements.aiSuccessBanner.style.display = 'none';
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('selected'));
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  try {
    showToast('Caricamento immagine in corso...', 'info');
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Caricamento fallito');
    const data = await res.json();

    setPhotoPreview(data.url);
    showToast('Foto caricata con successo!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Errore durante il caricamento della foto', 'error');
  }
}

function toggleGalleryDrawer() {
  const isHidden = elements.galleryDrawer.style.display === 'none';
  elements.galleryDrawer.style.display = isHidden ? 'block' : 'none';
}

function renderGalleryThumbnails() {
  if (!state.presetPhotos.length) {
    elements.galleryThumbnails.innerHTML = '<span style="font-size:0.8rem; color:#888;">Nessuna foto predefinita trovata.</span>';
    return;
  }

  elements.galleryThumbnails.innerHTML = state.presetPhotos.map(photoUrl => `
    <img src="${photoUrl}" alt="Foto Pianta" class="gallery-thumb" onclick="pickPresetPhoto('${photoUrl}', this)">
  `).join('');
}

window.pickPresetPhoto = function(photoUrl, thumbEl) {
  setPhotoPreview(photoUrl);
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('selected'));
  if (thumbEl) thumbEl.classList.add('selected');
  elements.galleryDrawer.style.display = 'none';
};

/* ==========================================================
   DELETE MODAL
   ========================================================== */
function openDeleteModal(plantId) {
  const plant = state.plants.find(p => p.id === plantId);
  if (!plant) return;

  state.deletingPlant = plant;
  elements.deletePlantPreview.innerHTML = `
    <strong>🌿 ${escapeHtml(plant.name)}</strong>
    ${plant.scientificName ? `<br><small><em>${escapeHtml(plant.scientificName)}</em></small>` : ''}
  `;
  elements.deleteModalBackdrop.style.display = 'flex';
}

function closeDeleteModal() {
  elements.deleteModalBackdrop.style.display = 'none';
  state.deletingPlant = null;
}

async function handleConfirmDelete() {
  if (!state.deletingPlant) return;

  const { id, name } = state.deletingPlant;

  try {
    elements.confirmDeleteBtn.disabled = true;
    elements.confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminazione...';

    const res = await fetch(`/api/plants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore durante l\'eliminazione');

    state.plants = state.plants.filter(p => p.id !== id);
    renderPlants();
    closeDeleteModal();
    showToast(`Pianta "${name}" eliminata dal database`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Impossibile eliminare la pianta', 'error');
  } finally {
    elements.confirmDeleteBtn.disabled = false;
    elements.confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Elimina Pianta';
  }
}

/* ==========================================================
   SHARE MODAL & QR CODE
   ========================================================== */
function openShareModal() {
  const currentUrl = window.location.href;
  elements.shareUrlInput.value = currentUrl;

  // Render QR Code
  elements.qrcodeContainer.innerHTML = '';
  if (window.QRCode) {
    state.qrCodeInstance = new QRCode(elements.qrcodeContainer, {
      text: currentUrl,
      width: 180,
      height: 180,
      colorDark: '#142a1c',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  elements.shareModalBackdrop.style.display = 'flex';
}

function closeShareModal() {
  elements.shareModalBackdrop.style.display = 'none';
}

function copyShareUrl() {
  const url = elements.shareUrlInput.value;
  if (!url) return;

  navigator.clipboard.writeText(url).then(() => {
    const originalText = elements.copyShareUrlBtn.innerHTML;
    elements.copyShareUrlBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiato!';
    elements.copyShareUrlBtn.classList.add('btn-secondary');
    elements.copyShareUrlBtn.classList.remove('btn-primary');

    showToast('Link copiato negli appunti! Condividilo con chiunque.', 'success');

    setTimeout(() => {
      elements.copyShareUrlBtn.innerHTML = originalText;
      elements.copyShareUrlBtn.classList.add('btn-primary');
      elements.copyShareUrlBtn.classList.remove('btn-secondary');
    }, 2500);
  }).catch(() => {
    elements.shareUrlInput.select();
    document.execCommand('copy');
    showToast('Link selezionato! Premi CTRL+C per copiare.', 'info');
  });
}

/* ==========================================================
   TOAST NOTIFICATIONS
   ========================================================== */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'info') icon = 'fa-bell';

  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <span class="toast-text">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Chiudi avviso">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', dismiss);
  elements.toastContainer.appendChild(toast);

  // Auto-dismiss after 4.5 seconds
  setTimeout(dismiss, 4500);
}

/* ==========================================================
   UTILITY FUNCTIONS
   ========================================================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
