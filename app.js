/**
 * ============================================================================
 * LacakHP Pro - Frontend Application Core (app.js)
 * Versi: 2.5.0 Enterprise (Stitch Enhanced Edition)
 * 
 * Fitur Tambahan Stitch:
 * - Pusat Intervensi OTA (Sirene Ambulans Taktis, Klakson Kritis, Morse SOS)
 * - Modal Transmisi Telemetri Interaktif (Loading Radar -> ACK 200 OK Countdown)
 * - Layar Desktop Signal Recovery Command Center (60/40 Split View)
 * - Pendaftaran Perangkat Baru Bottom Sheet (Scan Barcode + TAC Luhn Valid)
 * ============================================================================
 */

// ============================================================================
// 1. STATE & KONFIGURASI GLOBAL
// ============================================================================
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxGE-g3SPs6JYn46aN8f7yJ9wovsei03eNFwSVn9KEApM5LyoeVz0auo3xnzRd1xrc1/exec';

const AppState = {
  gasUrl: localStorage.getItem('lacakhp_gas_url') || DEFAULT_GAS_URL,
  user: JSON.parse(localStorage.getItem('lacakhp_user') || 'null'),
  activeTab: 'live-tracking', // 'live-tracking' | 'master-devices' | 'staff-client' | 'remote-command' | 'signal-recovery' | 'incidents'
  devices: [],
  kpi: { total: 34, online: 24, standby: 8, hilang: 2 },
  alerts: [],
  currentStaffImei: localStorage.getItem('lacakhp_staff_imei') || '358912345678901',
  dutyActive: localStorage.getItem('lacakhp_duty_active') === 'true',
  
  // Remote Command OTA State
  selectedTargetImei: '358912345678901',
  activeAudioPattern: 'ambulance', // 'ambulance' | 'horn' | 'morse'
  activePatternName: 'Ambulans Taktis',
  configuredDuration: 60,
  isSirenActive: false,
  countdownInterval: null,
  currentCountdown: 60,
  
  // System references
  watchId: null,
  pollTimer: null,
  map: null,
  markers: {},
  routePolyline: null,
  audioCtx: null,
  sirenOscillator: null,
  previewAudioCtx: null,
  isFetching: false
};

// ============================================================================
// 2. DATA MOCK (FALLBACK DEMO INSTAN)
// ============================================================================
const MOCK_DATA = {
  kpi: { total: 34, online: 24, standby: 8, hilang: 2 },
  devices: [
    {
      imei: '358912345678901',
      nama: 'Budi Santoso',
      noWa: '081199887766',
      divisi: 'Divisi Logistik Wilayah II',
      tipe: 'Samsung Galaxy A15',
      warna: 'Black Matte',
      status: 'Hilang',
      subStatus: 'SIRENE AKTIF',
      lat: -6.2118,
      lng: 106.8462,
      lokasiDeskripsi: 'Jl. Raya Industri Blok C-12, Cikarang',
      baterai: 14,
      bateraiStatus: 'Charging',
      jaringan: '4G LTE (Tower T-09)',
      akurasi: 8,
      lastSeenFormatted: '24/11/2026 21:15',
      lastSeenRelative: 'Baru saja',
      pesanRemote: 'Perangkat dilaporkan berpindah tangan. Segera amankan perangkat dan hubungi pusat.',
      tipePesan: 'Kunci_Hilang',
      statusPesan: 'Menunggu_Terkirim'
    },
    {
      imei: '864592041823450',
      nama: 'Siti Rahmawati',
      noWa: '081244558899',
      divisi: 'Kurir Express Jabodetabek',
      tipe: 'Xiaomi Redmi 13',
      warna: 'Midnight Blue',
      status: 'Online',
      subStatus: '1m lalu',
      lat: -6.2088,
      lng: 106.8456,
      lokasiDeskripsi: 'Jl. Jend. Sudirman Kav. 21, Jakarta Pusat',
      baterai: 88,
      bateraiStatus: 'Baterai OK',
      jaringan: '5G Telkomsel',
      kecepatan: 'Speed 42 km/h (On Duty)',
      akurasi: 4,
      lastSeenFormatted: '24/11/2026 21:14',
      lastSeenRelative: '1m lalu',
      pesanRemote: '',
      tipePesan: '',
      statusPesan: 'Tidak_Ada'
    },
    {
      imei: '867123059941102',
      nama: 'Dimas Pratama',
      noWa: '085712345678',
      divisi: 'Operasional Lapangan',
      tipe: 'Infinix Note 40 Pro',
      warna: 'Titan Gold',
      status: 'Hilang',
      subStatus: '3 Jam Lalu',
      lat: -6.1912,
      lng: 106.8390,
      lokasiDeskripsi: 'Pergudangan Cikini Blok B (Statis)',
      baterai: 21,
      bateraiStatus: 'Status Kritis',
      jaringan: 'Putus (No Carrier)',
      kecepatan: 'Tersuspend (Lock Command)',
      akurasi: 12,
      lastSeenFormatted: '24/11/2026 18:15',
      lastSeenRelative: '3j lalu',
      pesanRemote: 'Perangkat terkunci darurat oleh Dispatcher.',
      tipePesan: 'Kunci_Hilang',
      statusPesan: 'Menunggu_Terkirim'
    },
    {
      imei: '352478910023615',
      nama: 'Eko Kurniawan',
      noWa: '082198765432',
      divisi: 'Teknisi Support Lapangan',
      tipe: 'Samsung Galaxy A05',
      warna: 'Silver Light',
      status: 'Standby',
      subStatus: 'Depo Siap Tugas',
      lat: -6.2231,
      lng: 106.8398,
      lokasiDeskripsi: 'Kantor Dispatch Tebet Barat, Jaksel',
      baterai: 95,
      bateraiStatus: 'AC Docked',
      jaringan: 'HQ Office_HQ (WiFi)',
      kecepatan: 'Ready Pool Verifikasi OK',
      akurasi: 5,
      lastSeenFormatted: '24/11/2026 20:30',
      lastSeenRelative: '45m lalu',
      pesanRemote: '',
      tipePesan: '',
      statusPesan: 'Tidak_Ada'
    }
  ],
  alerts: [
    {
      idTiket: 'INC-202611-001',
      waktu: '14:28 WIB',
      imei: '358912345678901',
      nama: 'Budi Santoso',
      lokasi: 'Jl. Raya Industri Blok C-12 (-6.2118, 106.8462)',
      status: 'Sinyal_Pulih',
      catatan: 'Koneksi perangkat pulih kembali. Sirene darurat otomatis dipicu.'
    },
    {
      idTiket: 'INC-202611-002',
      waktu: '11:15 WIB',
      imei: '867123059941102',
      nama: 'Dimas Pratama',
      lokasi: 'Pergudangan Cikini Blok B',
      status: 'Investigasi',
      catatan: 'Sinyal terputus lebih dari 3 jam, status daya 21%.'
    }
  ]
};

AppState.devices = MOCK_DATA.devices;
AppState.kpi = { ...MOCK_DATA.kpi };
AppState.alerts = MOCK_DATA.recentAlerts;

// ============================================================================
// 3. REST API CLIENT (gas-pro-api ANTI-CORS PATTERN)
// ============================================================================
async function callApi(action, payload = {}) {
  if (!AppState.gasUrl) {
    return handleMockApi(action, payload);
  }

  try {
    AppState.isFetching = true;
    updateBackendSyncIndicator('syncing');

    const res = await fetch(AppState.gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: action, data: payload })
    });

    const result = await res.json();
    updateBackendSyncIndicator('connected');
    return result;
  } catch (error) {
    console.warn('API Error (fallback ke mock):', error);
    updateBackendSyncIndicator('offline');
    return handleMockApi(action, payload);
  } finally {
    AppState.isFetching = false;
  }
}

function handleMockApi(action, payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (action === 'getDashboard' || action === 'getData') {
        resolve({ success: true, ...MOCK_DATA });
      } else if (action === 'login') {
        const u = payload.username;
        const p = payload.password;
        if (u === 'admin' && p === 'admin123') {
          resolve({
            success: true,
            role: 'ADMIN',
            name: 'Capt. Raditya M. (Lead Dispatcher)',
            token: 'mock-token-admin'
          });
        } else {
          const found = MOCK_DATA.devices.find(d => d.imei === u);
          if (found) {
            resolve({
              success: true,
              role: 'STAFF',
              imei: found.imei,
              name: found.nama,
              division: found.divisi,
              phone: found.noWa,
              deviceModel: found.tipe,
              token: 'mock-token-staff'
            });
          } else {
            resolve({ success: false, message: 'Username / IMEI atau password salah.' });
          }
        }
      } else if (action === 'saveDevice') {
        const existing = MOCK_DATA.devices.find(d => d.imei === payload.imei);
        if (existing) {
          Object.assign(existing, payload);
        } else {
          MOCK_DATA.devices.unshift({
            imei: payload.imei,
            nama: payload.nama || 'Staf Baru',
            noWa: payload.noWa || '',
            divisi: payload.divisi || 'Operasional Lapangan',
            tipe: payload.tipe || 'Smartphone',
            warna: 'Standard Edition',
            status: payload.status || 'Standby',
            subStatus: 'Siap Pakai',
            lat: -6.2088,
            lng: 106.8456,
            lokasiDeskripsi: 'Kantor Dispatch Pusat',
            baterai: 100,
            bateraiStatus: 'Penuh',
            jaringan: '4G LTE',
            kecepatan: 'Siaga',
            akurasi: 5,
            lastSeenFormatted: 'Baru saja',
            lastSeenRelative: 'Baru saja',
            pesanRemote: '',
            tipePesan: '',
            statusPesan: 'Tidak_Ada'
          });
          MOCK_DATA.kpi.total++;
          if (payload.status === 'Online') MOCK_DATA.kpi.online++;
          else MOCK_DATA.kpi.standby++;
        }
        resolve({ success: true, message: 'Perangkat ' + payload.imei + ' berhasil didaftarkan ke Google Sheets!' });
      } else if (action === 'markLost') {
        const d = MOCK_DATA.devices.find(x => x.imei === payload.imei);
        if (d) {
          d.status = 'Hilang';
          d.subStatus = 'SIRENE DARURAT';
          d.pesanRemote = payload.catatan || 'Perangkat dinas dilaporkan hilang!';
          d.tipePesan = 'Kunci_Hilang';
          d.statusPesan = 'Menunggu_Terkirim';
        }
        resolve({ success: true, message: 'Perangkat resmi berstatus HILANG.' });
      } else if (action === 'updateWA' || action === 'update_wa') {
        const d = MOCK_DATA.devices.find(x => x.imei === payload.imei);
        if (d) d.noWa = payload.noWa;
        resolve({ success: true, message: 'Nomor WhatsApp berhasil disinkronkan!' });
      } else if (action === 'ping') {
        const d = MOCK_DATA.devices.find(x => x.imei === payload.imei);
        const isLost = d && d.status === 'Hilang';
        if (d) {
          d.lat = payload.lat || d.lat;
          d.lng = payload.lng || d.lng;
          d.baterai = payload.bat || d.baterai;
          d.akurasi = payload.acc || d.akurasi;
          d.lastSeenRelative = 'Baru saja';
        }
        resolve({
          success: true,
          imei: payload.imei,
          isLost: isLost,
          remoteMessage: d ? d.pesanRemote : '',
          messageType: d ? d.tipePesan : 'Tidak_Ada',
          triggerSiren: isLost
        });
      } else if (action === 'sendRemoteMsg') {
        resolve({ success: true, message: 'Pesan remote dijadwalkan!' });
      } else {
        resolve({ success: true });
      }
    }, 120);
  });
}

// ============================================================================
// 4. WEB AUDIO SYNTHESIZER MULTI-PATTERN (Stitch Audio Engine)
// ============================================================================
function initAudio() {
  if (!AppState.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      AppState.audioCtx = new AudioContext();
    }
  }
}

// Memutar pola sirene riil
function playSirenPattern(patternType = 'ambulance', durationSec = 60) {
  try {
    initAudio();
    if (!AppState.audioCtx) return;

    if (AppState.audioCtx.state === 'suspended') {
      AppState.audioCtx.resume();
    }

    stopEmergencySiren();

    const ctx = AppState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime;
    const endTime = startTime + durationSec;

    if (patternType === 'ambulance') {
      // Ambulans Taktis: Dual-tone High Frequency modulasi cepat (700Hz - 1100Hz)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, startTime);
      for (let t = startTime; t < endTime; t += 0.6) {
        osc.frequency.linearRampToValueAtTime(1100, t + 0.3);
        osc.frequency.linearRampToValueAtTime(700, t + 0.6);
      }
    } else if (patternType === 'horn') {
      // Klakson Kritis: High-pitch strobe alarm denyut pendek (440Hz pulse)
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, startTime);
      for (let t = startTime; t < endTime; t += 0.4) {
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.setValueAtTime(0.01, t + 0.2);
      }
    } else if (patternType === 'morse') {
      // Morse SOS Internasional (• • • — — — • • •)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, startTime);
    }

    gain.gain.setValueAtTime(0.25, startTime);
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(endTime);

    AppState.sirenOscillator = osc;
    AppState.isSirenActive = true;

  } catch (err) {
    console.warn('Audio synthesizer error:', err);
  }
}

function stopEmergencySiren() {
  if (AppState.sirenOscillator) {
    try {
      AppState.sirenOscillator.stop();
    } catch (e) {}
    AppState.sirenOscillator = null;
  }
  AppState.isSirenActive = false;
}

// Uji coba suara cepat 700ms saat klik icon preview
function previewAudioPattern(patternType) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(0.08, ctx.currentTime);

    if (patternType === 'ambulance') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.35);
      osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.7);
    } else if (patternType === 'horn') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    setTimeout(() => {
      try { ctx.close(); } catch (e) {}
    }, 700);
  } catch (e) {}
}

// ============================================================================
// 5. NAVIGASI INSTAN SPA (gas-instant-ux: 0ms LATENCY)
// ============================================================================
function navigateToTab(tabId) {
  AppState.activeTab = tabId;

  // Toggle sections
  document.querySelectorAll('.tab-view').forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });

  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.add('active');
    targetView.style.display = 'block';
  }

  // Update navbar active classes
  document.querySelectorAll('[data-nav-tab]').forEach(btn => {
    const isCurrent = btn.dataset.navTab === tabId;
    btn.classList.toggle('bg-surface-container-high', isCurrent);
    btn.classList.toggle('text-primary', isCurrent);
    btn.classList.toggle('font-bold', isCurrent);
  });

  // Re-render Leaflet Map if visible
  if (tabId === 'live-tracking' && AppState.map) {
    setTimeout(() => AppState.map.invalidateSize(), 150);
  }

  // Khusus tab Klien Staf
  if (tabId === 'staff-client') {
    renderStaffClientUI();
  }

  // Khusus tab Remote Command
  if (tabId === 'remote-command') {
    renderRemoteCommandUI();
  }
}

// ============================================================================
// 6. INISIALISASI PETA GOOGLE MAPS (GNSS LIVE RADAR COMMAND CENTER)
// ============================================================================
let activeTileLayer = null;
const mapTileLayers = {};

function initLeafletMap() {
  const mapContainer = document.getElementById('leaflet-map');
  if (!mapContainer) return;
  if (typeof L === 'undefined') {
    showToast('Library peta Leaflet gagal dimuat. Periksa koneksi internet.', 'error');
    return;
  }
  
  if (AppState.map) {
    setTimeout(() => AppState.map.invalidateSize(), 100);
    return;
  }

  // Inisialisasi peta Leaflet dengan center Jakarta Pusat
  AppState.map = L.map('leaflet-map', {
    zoomControl: false,
    attributionControl: false,
    fadeAnimation: true
  }).setView([-6.2118, 106.8462], 13);

  // Kontrol zoom di kanan atas
  L.control.zoom({ position: 'topright' }).addTo(AppState.map);

  // 1. Google Maps Roadmap Layer (Standard Google Maps dengan jalan, nama tempat, tol)
  mapTileLayers.roadmap = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps'
  });

  // 2. Google Maps Hybrid Layer (Citra Satelit berlabel jalan Google Maps)
  mapTileLayers.hybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps Satelit'
  });

  // 3. Cyber Dark Layer (CartoDB Dark)
  mapTileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '© CartoDB'
  });

  // Set Google Maps Roadmap sebagai layer aktif default
  activeTileLayer = mapTileLayers.roadmap;
  activeTileLayer.addTo(AppState.map);

  // Fallback otomatis ke OpenStreetMap jika tile Google gagal dimuat
  let googleTileErrorCount = 0;
  mapTileLayers.roadmap.on('tileerror', () => {
    googleTileErrorCount++;
    if (googleTileErrorCount === 3 && activeTileLayer === mapTileLayers.roadmap) {
      AppState.map.removeLayer(activeTileLayer);
      activeTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(AppState.map);
    }
  });

  // Render semua marker perangkat
  renderDeviceMarkers();

  // Resize listener agar peta selalu presisi saat ukuran layar berubah
  window.addEventListener('resize', () => {
    if (AppState.map) AppState.map.invalidateSize();
  });

  // Trigger invalidateSize bertahap untuk memastikan tiles Google Maps ter-render 100%
  setTimeout(() => { if (AppState.map) AppState.map.invalidateSize(); }, 150);
  setTimeout(() => { if (AppState.map) AppState.map.invalidateSize(); }, 500);
  setTimeout(() => { if (AppState.map) AppState.map.invalidateSize(); }, 1200);
}

function switchMapLayer(layerKey) {
  if (!AppState.map || !mapTileLayers[layerKey]) return;

  if (activeTileLayer) {
    AppState.map.removeLayer(activeTileLayer);
  }

  activeTileLayer = mapTileLayers[layerKey];
  activeTileLayer.addTo(AppState.map);

  // Update styling tombol aktif
  ['roadmap', 'hybrid', 'dark'].forEach(k => {
    const btn = document.getElementById(`btn-layer-${k}`);
    if (btn) {
      if (k === layerKey) {
        btn.className = 'px-2.5 py-1 rounded-md bg-primary-container text-on-primary-container font-bold flex items-center gap-1 transition shadow-sm';
      } else {
        btn.className = 'px-2.5 py-1 rounded-md text-slate-300 hover:text-white flex items-center gap-1 transition';
      }
    }
  });

  const layerNames = {
    roadmap: 'Google Maps (Roadmap)',
    hybrid: 'Google Maps Satelit (Hybrid)',
    dark: 'Cyber Dark Mode'
  };
  showToast(`Peta dialihkan ke: ${layerNames[layerKey] || layerKey}`, 'info');
}

function renderDeviceMarkers() {
  if (!AppState.map) return;

  Object.values(AppState.markers).forEach(m => AppState.map.removeLayer(m));
  AppState.markers = {};

  AppState.devices.forEach(device => {
    if (!device.lat || !device.lng) return;

    let markerHtml = '';
    if (device.status === 'Hilang') {
      markerHtml = `
        <div class="relative flex items-center justify-center w-10 h-10">
          <span class="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping"></span>
          <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-xs">
            SOS
          </div>
        </div>
      `;
    } else if (device.status === 'Online') {
      markerHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="absolute w-7 h-7 rounded-full bg-sky-400/30 radar-ping-ring"></span>
          <div class="w-6 h-6 rounded-full bg-sky-500 border-2 border-[#0b1326] flex items-center justify-center shadow-md">
            <span class="w-2 h-2 rounded-full bg-white"></span>
          </div>
        </div>
      `;
    } else {
      markerHtml = `
        <div class="w-6 h-6 rounded-full bg-amber-500/80 border-2 border-[#0b1326] flex items-center justify-center shadow-sm">
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
        </div>
      `;
    }

    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'custom-leaflet-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const marker = L.marker([device.lat, device.lng], { icon: customIcon }).addTo(AppState.map);

    const popupHtml = `
      <div class="p-3 text-xs flex flex-col gap-2 min-w-[220px]">
        <div class="flex items-center justify-between border-b border-surface-highest/60 pb-1.5">
          <span class="font-bold text-sm text-sky-300">${escapeHtml(device.nama)}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${device.status === 'Hilang' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">${device.status}</span>
        </div>
        <div class="flex flex-col gap-1 text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">IMEI:</span>
            <span class="font-mono text-sky-200">${escapeHtml(device.imei)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Model:</span>
            <span>${escapeHtml(device.tipe)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Baterai:</span>
            <span class="font-bold ${device.baterai < 20 ? 'text-rose-400' : 'text-emerald-400'}">${device.baterai}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Lokasi:</span>
            <span class="truncate max-w-[130px]">${escapeHtml(device.lokasiDeskripsi || '-')}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-surface-highest/60">
          <button onclick="bukaRemoteCommandTarget('${device.imei}')" class="px-2 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-center text-[11px] transition">
            Intervensi OTA
          </button>
          <button onclick="fokusRutePerangkat('${device.imei}')" class="px-2 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-center text-[11px] transition">
            Lihat Jejak
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    AppState.markers[device.imei] = marker;
  });
}

function fokusRutePerangkat(imei) {
  const d = AppState.devices.find(x => x.imei === imei);
  if (!d) return;

  if (AppState.activeTab !== 'live-tracking') {
    navigateToTab('live-tracking');
  }
  if (!AppState.map) {
    initLeafletMap();
  }
  if (AppState.map) {
    setTimeout(() => {
      AppState.map.invalidateSize();
      AppState.map.setView([d.lat, d.lng], 16, { animate: true });
      if (AppState.markers[imei]) {
        AppState.markers[imei].openPopup();
      }
    }, 180);
  }
  showToast(`Memusatkan peta ke: ${d.nama} (${d.imei})`, 'info');
}

// ============================================================================
// 7. RENDER DASHBOARD & MASTER FEED (Stitch Card Layout)
// ============================================================================
async function loadDashboardData() {
  const res = await callApi('getDashboard');
  if (res.success) {
    AppState.devices = res.devices || [];
    AppState.kpi = res.kpi || AppState.kpi;
    AppState.alerts = res.recentAlerts || res.alerts || [];

    renderKPIStats();
    renderLiveTelemetryTable();
    renderAlertsPanel();
    renderMasterDeviceCards();
  renderMasterDeviceTable();
    renderDeviceMarkers();
  }
}

function renderKPIStats() {
  const elTotal = document.getElementById('kpi-total');
  const elOnline = document.getElementById('kpi-online');
  const elStandby = document.getElementById('kpi-standby');
  const elHilang = document.getElementById('kpi-hilang');

  if (elTotal) elTotal.textContent = AppState.kpi.total;
  if (elOnline) elOnline.textContent = AppState.kpi.online;
  if (elStandby) elStandby.textContent = AppState.kpi.standby;
  if (elHilang) elHilang.textContent = String(AppState.kpi.hilang).padStart(2, '0');

  // Badge alert
  const badgeInsiden = document.getElementById('badge-count-insiden');
  if (badgeInsiden) {
    badgeInsiden.textContent = AppState.kpi.hilang;
    badgeInsiden.style.display = AppState.kpi.hilang > 0 ? 'inline-flex' : 'none';
  }
}

function renderLiveTelemetryTable() {
  const tbody = document.getElementById('telemetry-tbody');
  if (!tbody) return;

  tbody.innerHTML = AppState.devices.map(device => {
    const isHilang = device.status === 'Hilang';
    const isOnline = device.status === 'Online';
    const statusClass = isHilang ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                        (isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400');

    return `
      <tr class="border-b border-surface-container-high/60 hover:bg-surface-container/50 transition">
        <td class="p-3">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isHilang ? 'bg-rose-500 animate-ping' : (isOnline ? 'bg-emerald-400' : 'bg-amber-400')}"></span>
            <div>
              <div class="font-bold text-on-surface">${escapeHtml(device.nama)}</div>
              <div class="text-[11px] text-on-surface-variant">${escapeHtml(device.divisi)}</div>
            </div>
          </div>
        </td>
        <td class="p-3 font-mono text-xs text-sky-300 font-semibold">${escapeHtml(device.imei)}</td>
        <td class="p-3 text-xs text-slate-300">${escapeHtml(device.tipe)}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold ${statusClass}">
            ${device.status}
          </span>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="w-16 bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
              <div class="h-full ${device.baterai < 20 ? 'bg-rose-500' : 'bg-emerald-400'}" style="width: ${device.baterai}%"></div>
            </div>
            <span class="text-xs font-mono">${device.baterai}%</span>
          </div>
        </td>
        <td class="p-3 text-right">
          <button onclick="bukaRemoteCommandTarget('${device.imei}')" class="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium mr-1 transition">
            Sirene OTA
          </button>
          <button onclick="fokusRutePerangkat('${device.imei}')" class="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-bright text-primary text-xs font-medium transition">
            Lihat Jejak
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAlertsPanel() {
  const container = document.getElementById('alerts-container');
  if (!container) return;

  container.innerHTML = AppState.alerts.map(a => {
    return `
      <div class="p-3 rounded-lg bg-surface-container border-l-4 ${a.status === 'Sinyal_Pulih' ? 'border-rose-500 bg-rose-500/10' : 'border-amber-500'} flex flex-col gap-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs ${a.status === 'Sinyal_Pulih' ? 'text-rose-400 flex items-center gap-1' : 'text-amber-400'}">
            ${a.status === 'Sinyal_Pulih' ? '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> PERINGATAN DARURAT: SINYAL PULIH' : 'BATIS KRITIS & STATIS'}
          </span>
          <span class="text-[10px] text-slate-400 font-mono">${a.waktu}</span>
        </div>
        <div class="text-xs font-semibold text-slate-200">
          ${escapeHtml(a.nama)} <span class="font-mono text-slate-400 font-normal">(${escapeHtml(a.imei)})</span>
        </div>
        <div class="text-[11px] text-slate-300 leading-relaxed">
          ${escapeHtml(a.catatan || a.lokasi)}
        </div>
        <div class="flex gap-2 pt-1.5 mt-1 border-t border-surface-highest/40">
          <button onclick="navigateToTab('signal-recovery')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition">
            <span class="material-symbols-outlined text-[14px]">crisis_alert</span> Buka Command Center
          </button>
          <button onclick="bukaRemoteCommandTarget('${a.imei}')" class="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-medium flex items-center gap-1 transition">
            <span class="material-symbols-outlined text-[14px]">volume_up</span> Sirene OTA
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Master Devices Card Feed (Sesuai kode stitch_lacakhp_pro_mobile_masterperangkat)
function renderMasterDeviceCards() {
  const container = document.getElementById('deviceList');
  if (!container) return;

  const searchInput = (document.getElementById('deviceSearchInput')?.value || '').toLowerCase().trim();
  const activePill = document.querySelector('.filter-pill.active')?.dataset.status || 'all';

  let filtered = AppState.devices.filter(d => {
    const text = `${d.imei} ${d.nama} ${d.noWa} ${d.divisi} ${d.tipe}`.toLowerCase();
    const matchSearch = !searchInput || text.includes(searchInput);
    
    let matchStatus = true;
    if (activePill === 'online') matchStatus = d.status === 'Online';
    else if (activePill === 'sos') matchStatus = d.status === 'Hilang';
    else if (activePill === 'standby') matchStatus = d.status === 'Standby';
    else if (activePill === 'offline') matchStatus = d.status === 'Offline';

    return matchSearch && matchStatus;
  });

  const emptyState = document.getElementById('emptySearchState');
  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(d => {
    const isHilang = d.status === 'Hilang';
    const isOnline = d.status === 'Online';
    const accentColor = isHilang ? 'bg-error-container' : (isOnline ? 'bg-secondary-container' : 'bg-amber-400');

    return `
      <div class="device-card bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col gap-space-md relative overflow-hidden">
        <!-- Visual Accent Indicator -->
        <div class="absolute left-0 top-0 bottom-0 w-1.5 ${accentColor}"></div>
        
        <!-- Header: Staff & Status Badge -->
        <div class="flex items-start justify-between gap-space-sm pl-1">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-10 h-10 rounded-xl ${isHilang ? 'bg-error-container/30 text-tertiary' : 'bg-surface-container-high text-primary'} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[22px]">${isHilang ? 'phone_iphone' : 'smartphone'}</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-title-md text-title-md text-on-surface truncate">${escapeHtml(d.nama)}</span>
              <span class="font-label-md text-label-md text-on-surface-variant truncate">${escapeHtml(d.divisi)}</span>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isHilang ? 'bg-error-container text-tertiary font-bold animate-pulse' : (isOnline ? 'bg-surface-container-high text-secondary-fixed' : 'bg-surface-container-high text-amber-300')} font-label-sm text-label-sm shrink-0">
            <span class="w-1.5 h-1.5 rounded-full ${isHilang ? 'bg-tertiary-container' : (isOnline ? 'bg-emerald-400' : 'bg-amber-400')}"></span>
            ${escapeHtml(d.status)} • ${escapeHtml(d.subStatus || d.lastSeenRelative)}
          </span>
        </div>

        <!-- Technical Specs & IMEI Row -->
        <div class="bg-surface-container rounded-lg p-space-sm flex flex-col gap-1.5 ml-1">
          <div class="flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span class="text-on-surface font-title-md">${escapeHtml(d.tipe)}</span>
            <span class="font-code-tabular text-code-tabular text-outline">${escapeHtml(d.warna || 'Standard')}</span>
          </div>
          <div class="flex items-center justify-between gap-space-xs pt-1">
            <div class="flex items-center gap-1 min-w-0">
              <span class="font-label-sm text-label-sm text-outline uppercase">IMEI:</span>
              <span class="font-code-tabular text-code-tabular text-primary-fixed tracking-wider font-semibold truncate select-all">${escapeHtml(d.imei)}</span>
            </div>
            <button onclick="salinTeks('${d.imei}', 'Nomor IMEI')" class="px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md transition-colors flex items-center gap-1">
              <span class="material-symbols-outlined text-[13px]">content_copy</span>
              <span>Salin</span>
            </button>
          </div>
        </div>

        <!-- Telemetry Metrics Bar (Battery, Signal, Signal Rec) -->
        <div class="grid grid-cols-3 gap-space-xs text-center ml-1">
          <div class="bg-surface-container-high/60 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center">
            <span class="font-label-sm text-label-sm ${d.baterai < 20 ? 'text-tertiary-container' : 'text-emerald-400'} flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">battery_charging_full</span> ${d.baterai}%
            </span>
            <span class="font-label-sm text-label-sm text-outline">${escapeHtml(d.bateraiStatus || 'Normal')}</span>
          </div>
          <div class="bg-surface-container-high/60 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center">
            <span class="font-label-sm text-label-sm text-on-surface flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px] text-primary">cell_wifi</span> ${escapeHtml(d.jaringan || '4G LTE')}
            </span>
            <span class="font-label-sm text-label-sm text-outline">Cell ID Fix</span>
          </div>
          <div class="bg-surface-container-high/60 py-1.5 px-1 rounded-lg flex flex-col items-center justify-center">
            <span class="font-label-sm text-label-sm text-secondary-container font-semibold">${isHilang ? 'Aktif Pulih' : 'On Duty'}</span>
            <span class="font-label-sm text-label-sm text-outline">${d.lastSeenRelative}</span>
          </div>
        </div>

        <!-- Location Pinpoint -->
        <div class="flex items-start gap-space-xs bg-surface-container/70 p-space-sm rounded-lg ml-1">
          <span class="material-symbols-outlined ${isHilang ? 'text-tertiary-container' : 'text-primary'} text-[18px] shrink-0 mt-0.5">pin_drop</span>
          <div class="flex flex-col min-w-0">
            <span class="font-body-sm text-body-sm text-on-surface font-semibold truncate">${escapeHtml(d.lokasiDeskripsi || `${d.lat}, ${d.lng}`)}</span>
            <span class="font-label-sm text-label-sm text-outline">Akurasi GPS ± ${d.akurasi || 4}m • GNSS Lock</span>
          </div>
        </div>

        <!-- WhatsApp & Contact Row -->
        <div class="flex items-center justify-between gap-space-sm ml-1 text-label-md font-label-md">
          <span class="text-on-surface-variant flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] text-secondary">chat</span>
            <span>WA: +62 ${cleanWaNumber(d.noWa).replace(/^62/, '')}</span>
          </span>
          <span class="font-code-tabular text-code-tabular text-outline">Update: ${d.lastSeenRelative}</span>
        </div>

        <!-- Tactical Actions Buttons -->
        <div class="grid grid-cols-3 gap-space-xs pt-1 ml-1">
          <button onclick="bukaRemoteCommandTarget('${d.imei}')" class="py-2 px-1 rounded-lg ${isHilang ? 'bg-error-container hover:bg-tertiary-container text-on-error-container' : 'bg-surface-container-high hover:bg-surface-container-highest text-rose-300'} font-label-md text-label-md flex items-center justify-center gap-1 shadow-sm transition-transform active:scale-95">
            <span class="material-symbols-outlined text-[16px]">volume_up</span>
            <span>${isHilang ? 'Sirene OTA' : 'Pusat OTA'}</span>
          </button>
          <button onclick="fokusRutePerangkat('${d.imei}')" class="py-2 px-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary-container font-label-md text-label-md flex items-center justify-center gap-1 transition-colors active:scale-95">
            <span class="material-symbols-outlined text-[16px]">route</span>
            <span>Rute GPS</span>
          </button>
          <a href="https://wa.me/${cleanWaNumber(d.noWa)}" target="_blank" class="py-2 px-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-md text-label-md flex items-center justify-center gap-1 transition-colors active:scale-95 text-center">
            <span class="material-symbols-outlined text-[16px]">send</span>
            <span>Chat WA</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 8. LOGIKA REMOTE COMMAND OTA INTERVENTION (Pusat Intervensi OTA)
// ============================================================================
function bukaRemoteCommandTarget(imei) {
  AppState.selectedTargetImei = imei;
  navigateToTab('remote-command');
  renderRemoteCommandUI();
}

function renderRemoteCommandUI() {
  const target = AppState.devices.find(d => d.imei === AppState.selectedTargetImei) || AppState.devices[0];
  if (!target) return;

  const elNama = document.getElementById('ota-target-nama');
  const elImei = document.getElementById('ota-target-imei');
  const elModel = document.getElementById('ota-target-model');
  const elStatus = document.getElementById('ota-target-status');
  const elDivisi = document.getElementById('ota-target-divisi');
  const elSummaryTarget = document.getElementById('summaryTargetText');

  if (elNama) elNama.textContent = target.nama;
  if (elImei) elImei.textContent = target.imei;
  if (elModel) elModel.textContent = target.tipe;
  if (elStatus) elStatus.textContent = `${target.status} (${target.baterai}%)`;
  if (elDivisi) elDivisi.textContent = target.divisi;
  if (elSummaryTarget) elSummaryTarget.textContent = `${target.imei} (${target.nama})`;
}

// Eksekusi Sirene OTA dengan Modal Interaktif
function eksekusiSireneOTA() {
  const modal = document.getElementById('transmissionModalOverlay');
  const modalLoading = document.getElementById('modalStateLoading');
  const modalSuccess = document.getElementById('modalStateSuccess');

  if (modal) modal.classList.remove('hidden');
  if (modalLoading) modalLoading.classList.remove('hidden');
  if (modalSuccess) modalSuccess.classList.add('hidden');

  // Mulai audio sirene riil
  playSirenPattern(AppState.activeAudioPattern, AppState.configuredDuration);

  // Simulasi Handshake OTA Gateway 1 detik -> ACK 200 OK
  setTimeout(() => {
    if (modalLoading) modalLoading.classList.add('hidden');
    if (modalSuccess) modalSuccess.classList.remove('hidden');

    // Mulai Countdown
    startSirenCountdown(AppState.configuredDuration);

    // Kirim command ke server
    callApi('sendRemoteMsg', {
      imei: AppState.selectedTargetImei,
      pesan: `Sirene Darurat (${AppState.activePatternName}) Aktif`,
      tipePesan: 'Sirene_OTA'
    });

  }, 1000);
}

function startSirenCountdown(durationSec) {
  clearInterval(AppState.countdownInterval);
  AppState.currentCountdown = durationSec;
  updateCountdownUI(AppState.currentCountdown);

  AppState.countdownInterval = setInterval(() => {
    AppState.currentCountdown--;
    if (AppState.currentCountdown <= 0) {
      stopSirenOTA('Waktu transmisi selesai (Auto-cutoff)');
    } else {
      updateCountdownUI(AppState.currentCountdown);
    }
  }, 1000);
}

function updateCountdownUI(secs) {
  const elModalCd = document.getElementById('modalCountdown');
  const elInlineCd = document.getElementById('inlineCountdownTimer');
  if (elModalCd) elModalCd.textContent = `${secs} dtk`;
  if (elInlineCd) elInlineCd.textContent = `${secs}s tersisa`;
}

function stopSirenOTA(reason = 'Sirene Dihentikan Manual') {
  clearInterval(AppState.countdownInterval);
  stopEmergencySiren();

  const modal = document.getElementById('transmissionModalOverlay');
  if (modal) modal.classList.add('hidden');

  const btnExecText = document.getElementById('btnExecuteText');
  if (btnExecText) btnExecText.textContent = 'Ya, Bunyikan Sirene Sekarang';

  showToast(reason, 'info');
}

// ============================================================================
// 9. BOTTOM SHEET REGISTRASI PERANGKAT BARU (Stitch Modal)
// ============================================================================
function bukaModalRegistrasiPerangkat() {
  const modal = document.getElementById('registerDeviceModal');
  if (modal) modal.classList.remove('hidden');
}

function tutupModalRegistrasiPerangkat() {
  const modal = document.getElementById('registerDeviceModal');
  if (modal) modal.classList.add('hidden');
}

async function submitRegistrasiPerangkat(e) {
  if (e) e.preventDefault();

  const imei = document.getElementById('modal-input-imei')?.value.trim();
  const nama = document.getElementById('modal-input-nama')?.value.trim();
  const wa = document.getElementById('modal-input-wa')?.value.trim();
  const divisi = document.getElementById('modal-input-divisi')?.value;
  const tipe = document.getElementById('modal-input-tipe')?.value.trim();
  const initStatus = document.querySelector('input[name="init_status"]:checked')?.value || 'Standby';

  if (!imei || imei.length < 14) {
    showToast('Nomor IMEI 15 digit wajib diisi dan valid TAC.', 'error');
    return;
  }

  const payload = {
    imei: imei.replace(/\s+/g, ''),
    nama: nama || 'Staf Lapangan',
    noWa: wa.startsWith('0') ? wa : ('0' + wa),
    divisi: divisi || 'Operasional Lapangan',
    tipe: tipe || 'Smartphone',
    status: initStatus
  };

  const res = await callApi('saveDevice', payload);
  if (res.success) {
    showToast(res.message, 'success');
    tutupModalRegistrasiPerangkat();
    await loadDashboardData();
  } else {
    showToast(res.message || 'Gagal menyimpan perangkat.', 'error');
  }
}

// Simulasi Scan Barcode Kamera
function simulasiScanBarcode() {
  bukaModalScanner();
  return;

  showToast('📷 Kamera scanner barcode kardus aktif...', 'info');
  setTimeout(() => {
    const sampleImei = '3589 7721 8890 312';
    const inputImei = document.getElementById('modal-input-imei');
    if (inputImei) {
      inputImei.value = sampleImei;
      showToast('Barcode Kardus Terbaca: IMEI ' + sampleImei, 'success');
    }
  }, 1000);
}

// ============================================================================
// 10. LAYAR KLIEN STAF (MOBILE AGENT PWA)
// ============================================================================
function renderStaffClientUI() {
  const staff = AppState.devices.find(d => d.imei === AppState.currentStaffImei) || AppState.devices[0];
  if (!staff) return;

  const elImei = document.getElementById('staff-imei-display');
  const elNama = document.getElementById('staff-nama-display');
  const elDivisi = document.getElementById('staff-divisi-display');
  const elModel = document.getElementById('staff-model-display');
  const elWa = document.getElementById('staff-wa-display');
  const elBat = document.getElementById('staff-battery-display');
  const elAcc = document.getElementById('staff-acc-display');
  const elDutyBadge = document.getElementById('staff-duty-badge');
  const elDutyBtn = document.getElementById('staff-toggle-duty-btn');

  if (elImei) elImei.textContent = staff.imei;
  if (elNama) elNama.textContent = staff.nama;
  if (elDivisi) elDivisi.textContent = staff.divisi;
  if (elModel) elModel.textContent = staff.tipe;
  if (elWa) elWa.textContent = staff.noWa ? `+62 ${cleanWaNumber(staff.noWa).replace(/^62/, '')}` : '+62 811-9988-7766';
  if (elBat) elBat.textContent = staff.baterai + '%';
  if (elAcc) elAcc.textContent = '±' + (staff.akurasi || 4) + ' Meter';

  if (elDutyBadge) {
    elDutyBadge.textContent = AppState.dutyActive ? 'Tugas Aktif (Transmisi)' : 'Siaga Lapangan';
    elDutyBadge.className = `px-2 py-0.5 rounded-full font-label-sm text-xs ${AppState.dutyActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-surface-container-high text-on-surface-variant'}`;
  }

  if (elDutyBtn) {
    if (AppState.dutyActive) {
      elDutyBtn.innerHTML = `
        <span class="material-symbols-outlined text-[24px]">stop_circle</span>
        <span>Hentikan Jam Tugas (Offline)</span>
      `;
      elDutyBtn.className = 'w-full py-4 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition-all';
    } else {
      elDutyBtn.innerHTML = `
        <span class="material-symbols-outlined text-[24px]">location_searching</span>
        <span>Mulai Jam Tugas (Kirim Lokasi)</span>
      `;
      elDutyBtn.className = 'w-full py-4 px-4 rounded-xl bg-primary-container text-on-primary-container font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]';
    }
  }
}

function startStaffTracking() {
  stopStaffTracking();
  kirimPingTelemetri();
  AppState.watchId = setInterval(() => {
    if (AppState.dutyActive) {
      kirimPingTelemetri();
    }
  }, 15000);
}

function stopStaffTracking() {
  if (AppState.watchId) {
    clearInterval(AppState.watchId);
    AppState.watchId = null;
  }
}

function toggleStaffDuty() {
  AppState.dutyActive = !AppState.dutyActive;
  localStorage.setItem('lacakhp_duty_active', AppState.dutyActive);

  if (AppState.dutyActive) {
    startStaffTracking();
    showToast('Jam Tugas Dimulai. Transmisi koordinat GPS aktif setiap 15 detik.', 'success');
  } else {
    stopStaffTracking();
    showToast('Jam Tugas Dihentikan. Transmisi GPS dinonaktifkan.', 'info');
  }

  renderStaffClientUI();
}

async function kirimPingTelemetri() {
  let lat = -6.2118;
  let lng = 106.8462;
  let acc = 4;
  let bat = 94;

  if ('geolocation' in navigator) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      acc = Math.round(pos.coords.accuracy || 4);
    } catch (e) {}
  }

  if ('getBattery' in navigator) {
    try {
      const b = await navigator.getBattery();
      bat = Math.round(b.level * 100);
    } catch (e) {}
  }

  const res = await callApi('ping', {
    imei: AppState.currentStaffImei,
    lat, lng, acc, bat
  });

  const localDev = AppState.devices.find(d => d.imei === AppState.currentStaffImei);
  if (localDev) {
    localDev.lat = lat;
    localDev.lng = lng;
    localDev.akurasi = acc;
    localDev.baterai = bat;
    if (localDev.status !== 'Hilang') localDev.status = 'Online';
    localDev.lastSeenRelative = 'Baru saja';
  }
  renderDeviceMarkers();
  renderLiveTelemetryTable();
  renderKPIStats();
  if (AppState.activeTab === 'staff-client') {
    renderStaffClientUI();
  }
  return res;
}

// ============================================================================
// 11. DIALOG UPDATE WHATSAPP
// ============================================================================
function bukaModalUpdateWA() {
  const modal = document.getElementById('modal-update-wa');
  const staff = AppState.devices.find(d => d.imei === AppState.currentStaffImei);
  const input = document.getElementById('input-new-wa');

  if (input && staff && staff.noWa) {
    input.value = cleanWaNumber(staff.noWa).replace(/^62/, '');
  }

  if (modal) modal.style.display = 'flex';
}

function tutupModalUpdateWA() {
  const modal = document.getElementById('modal-update-wa');
  if (modal) modal.style.display = 'none';
}

async function simpanNomorWABaru() {
  const input = document.getElementById('input-new-wa');
  const checkbox = document.getElementById('check-confirm-wa');

  if (!input || !input.value.trim()) {
    showToast('Nomor WhatsApp baru wajib diisi!', 'error');
    return;
  }

  if (checkbox && !checkbox.checked) {
    showToast('Silakan centang konfirmasi nomor aktif.', 'error');
    return;
  }

  const raw = input.value.trim().replace(/[^0-9]/g, '');
  const cleanNumber = raw.startsWith('0') ? raw : ('0' + raw);

  const res = await callApi('updateWA', {
    imei: AppState.currentStaffImei,
    noWa: cleanNumber
  });

  if (res.success) {
    showToast('Nomor WhatsApp berhasil diperbarui ke Google Sheets!', 'success');
    tutupModalUpdateWA();
    await loadDashboardData();
    renderStaffClientUI();
  } else {
    showToast(res.message || 'Gagal update WA', 'error');
  }
}

// ============================================================================
// 12. PENGATURAN API URL & AUTENTIKASI
// ============================================================================
function bukaModalSettings() {
  const modal = document.getElementById('modal-settings');
  const input = document.getElementById('input-gas-url');
  if (input) input.value = AppState.gasUrl;
  if (modal) modal.style.display = 'flex';
}

function tutupModalSettings() {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.style.display = 'none';
}

function simpanPengaturanGasUrl() {
  const input = document.getElementById('input-gas-url');
  if (!input) return;

  AppState.gasUrl = input.value.trim();
  localStorage.setItem('lacakhp_gas_url', AppState.gasUrl);

  showToast('URL Google Apps Script REST API tersimpan!', 'success');
  tutupModalSettings();
  loadDashboardData();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById('login-username')?.value.trim();
  const p = document.getElementById('login-password')?.value.trim();

  const res = await callApi('login', { username: u, password: p });
  if (res.success) {
    AppState.user = res;
    localStorage.setItem('lacakhp_user', JSON.stringify(res));
    tutupHalamanLogin();
    showToast(`Selamat datang, ${res.name}!`, 'success');
    if (res.role === 'STAFF') {
      AppState.currentStaffImei = res.imei;
      navigateToTab('staff-client');
    } else {
      navigateToTab('live-tracking');
    }
  } else {
    showToast(res.message || 'Login gagal', 'error');
  }
}

function quickFillLogin(role) {
  const u = document.getElementById('login-username');
  const p = document.getElementById('login-password');
  if (role === 'admin') {
    if (u) u.value = 'admin';
    if (p) p.value = 'admin123';
  } else {
    if (u) u.value = '358912345678901';
    if (p) p.value = 'admin123';
  }
}

function logoutUser() {
  AppState.user = null;
  localStorage.removeItem('lacakhp_user');
  bukaHalamanLogin();
}

function bukaHalamanLogin() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'flex';
}

function tutupHalamanLogin() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'none';
  if (AppState.map) {
    setTimeout(() => AppState.map.invalidateSize(), 150);
  }
}

// ============================================================================
// 13. HELPERS & EVENT LISTENERS
// ============================================================================
function updateBackendSyncIndicator(status) {
  const indicator = document.getElementById('backend-sync-indicator');
  const text = document.getElementById('backend-sync-text');
  if (!indicator || !text) return;

  if (status === 'connected') {
    indicator.className = 'w-2 h-2 rounded-full bg-emerald-400';
    text.textContent = 'GAS Backend Terhubung';
  } else if (status === 'syncing') {
    indicator.className = 'w-2 h-2 rounded-full bg-sky-400 animate-ping';
    text.textContent = 'Menyinkronkan...';
  } else {
    indicator.className = 'w-2 h-2 rounded-full bg-amber-400';
    text.textContent = 'Simulasi Lokal (Demo)';
  }
}

function updateLiveClock() {
  const el = document.getElementById('live-clock');
  const el2 = document.getElementById('live-clock-desktop');
  const now = new Date();
  const str = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} WIB`;
  if (el) el.textContent = str;
  if (el2) el2.textContent = str;
}

function cleanWaNumber(no) {
  if (!no) return '';
  let clean = String(no).replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  return clean;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'error' ? 'error' : (type === 'success' ? 'check_circle' : 'info');
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px] text-${type === 'error' ? 'rose-400' : (type === 'success' ? 'emerald-400' : 'sky-400')}">${icon}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function tampilkanToast(message, type = 'info') {
  return showToast(message, type);
}

function salinTeks(teks, label = 'Teks') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(teks).then(() => {
      showToast(`${label} disalin ke clipboard`, 'success');
    });
  } else {
    showToast(`${label} disalin`, 'info');
  }
}

// Inisialisasi DOM
document.addEventListener('DOMContentLoaded', () => {
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  initLeafletMap();
  loadDashboardData();

  if (!AppState.user) {
    // Sesi default Admin Dispatcher agar Google Maps langsung tampil tanpa halangan login
    AppState.user = {
      role: 'ADMIN',
      name: 'Capt. Raditya M. (Lead Dispatcher)',
      token: 'session-demo'
    };
    localStorage.setItem('lacakhp_user', JSON.stringify(AppState.user));
    tutupHalamanLogin();
    navigateToTab('live-tracking');
  } else {
    tutupHalamanLogin();
    navigateToTab('live-tracking');
  }
  
  // Pastikan render peta aktif
  setTimeout(() => {
    if (AppState.map) AppState.map.invalidateSize();
  }, 300);

  // Sinkronisasi otomatis dashboard setiap 15 detik
  if (AppState.pollTimer) clearInterval(AppState.pollTimer);
  AppState.pollTimer = setInterval(() => {
    if (!AppState.isFetching) loadDashboardData();
  }, 15000);

  if (AppState.dutyActive) {
    startStaffTracking();
  }

  // Filter chips master perangkat
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.remove('active', 'bg-primary-container', 'text-on-primary-container');
        p.classList.add('bg-surface-container', 'text-on-surface-variant');
      });
      pill.classList.remove('bg-surface-container', 'text-on-surface-variant');
      pill.classList.add('active', 'bg-primary-container', 'text-on-primary-container');
      renderMasterDeviceCards();
  renderMasterDeviceTable();
    });
  });

  // Search input master
  const searchInput = document.getElementById('deviceSearchInput');
  const clearSearch = document.getElementById('btnClearSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (clearSearch) clearSearch.classList.toggle('hidden', searchInput.value.trim().length === 0);
      renderMasterDeviceCards();
  renderMasterDeviceTable();
    });
  }
  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearch.classList.add('hidden');
      renderMasterDeviceCards();
  renderMasterDeviceTable();
    });
  }

  // Audio tone choice listeners in Remote Command
  document.querySelectorAll('.siren-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.siren-card').forEach(c => {
        c.classList.remove('bg-gradient-to-r', 'from-primary/10', 'to-transparent', 'bg-surface-container-high');
        c.classList.add('bg-surface-container-low');
        const badge = c.querySelector('.siren-selected-badge');
        if (badge) badge.remove();
      });

      card.classList.remove('bg-surface-container-low');
      card.classList.add('bg-gradient-to-r', 'from-primary/10', 'to-transparent', 'bg-surface-container-high');

      AppState.activeAudioPattern = card.dataset.siren || 'ambulance';
      const titleWrapper = card.querySelector('.siren-title-wrapper');
      AppState.activePatternName = card.querySelector('.siren-name')?.textContent.trim() || 'Sirene';

      const badge = document.createElement('span');
      badge.className = 'siren-selected-badge text-[9px] px-1.5 py-0.5 rounded bg-primary text-on-primary uppercase font-bold tracking-tight';
      badge.textContent = 'Dipilih';
      if (titleWrapper) titleWrapper.appendChild(badge);

      const elSummary = document.getElementById('summaryAudioPattern');
      if (elSummary) elSummary.textContent = `${AppState.activePatternName} • 100% Boost`;
    });
  });

  // Duration chips listeners
  document.querySelectorAll('.duration-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.duration-chip').forEach(c => {
        c.className = 'duration-chip py-2 px-3 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors';
      });
      chip.className = 'duration-chip py-2 px-3 rounded-lg font-label-md text-label-md bg-primary text-on-primary font-bold shadow-sm';
      AppState.configuredDuration = parseInt(chip.dataset.duration || '60', 10);

      const elSummary = document.getElementById('summaryDuration');
      if (elSummary) elSummary.textContent = `${AppState.configuredDuration} Detik Auto-cutoff`;
    });
  });
});


// ============================================================================
// DESKTOP MASTER DATA TABLE (Persis sesuai Stitch code_master_perangkat.html)
// ============================================================================
function renderMasterDeviceTable() {
  const tbody = document.getElementById('deviceDesktopTableBody');
  if (!tbody) return;

  const searchInput = (document.getElementById('desktopTableSearch')?.value || '').toLowerCase().trim();
  const filterStatus = (document.getElementById('desktopFilterStatus')?.value || '').trim();
  const filterDivisi = (document.getElementById('desktopFilterDivisi')?.value || '').trim();

  // Hitung stats ribbon
  const onlineCount = AppState.devices.filter(d => d.status === 'Online').length;
  const hilangCount = AppState.devices.filter(d => d.status === 'Hilang').length;
  const standbyCount = AppState.devices.filter(d => d.status === 'Standby' || d.status === 'Offline').length;

  const statOnlineEl = document.getElementById('desktopStatOnline');
  const statHilangEl = document.getElementById('desktopStatHilang');
  const statStandbyEl = document.getElementById('desktopStatStandby');
  if (statOnlineEl) statOnlineEl.textContent = `${onlineCount} Perangkat`;
  if (statHilangEl) statHilangEl.textContent = `${hilangCount} Insiden`;
  if (statStandbyEl) statStandbyEl.textContent = `${standbyCount} Unit`;

  let filtered = AppState.devices.filter(d => {
    const text = `${d.imei} ${d.nama} ${d.noWa} ${d.divisi} ${d.tipe}`.toLowerCase();
    const matchSearch = !searchInput || text.includes(searchInput);
    const matchStatus = !filterStatus || d.status.toLowerCase() === filterStatus.toLowerCase();
    const matchDivisi = !filterDivisi || d.divisi.toLowerCase().includes(filterDivisi.toLowerCase());
    return matchSearch && matchStatus && matchDivisi;
  });

  const showingEl = document.getElementById('desktopShowingCount');
  const totalEl = document.getElementById('desktopTotalCount');
  if (showingEl) showingEl.textContent = filtered.length;
  if (totalEl) totalEl.textContent = AppState.devices.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-on-surface-variant font-mono">
          <div class="flex flex-col items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[32px] text-outline">search_off</span>
            <span>Tidak ada perangkat yang sesuai dengan filter pencarian.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(d => {
    const isHilang = d.status === 'Hilang';
    const isOnline = d.status === 'Online';
    const isStandby = d.status === 'Standby';

    let statusBadge = '';
    if (isHilang) {
      statusBadge = `
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-error text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-error"></span>
            HILANG (${d.baterai}%)
          </span>
          <span class="px-1.5 py-0.5 rounded bg-error text-on-error font-mono text-[9px] font-bold">SOS</span>
        </div>
      `;
    } else if (isOnline) {
      statusBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-emerald-400 text-[10px] font-semibold">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Online (${d.baterai}%)
        </span>
      `;
    } else if (isStandby) {
      statusBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-amber-300 text-[10px] font-semibold">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Standby (${d.baterai}%)
        </span>
      `;
    } else {
      statusBadge = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-outline text-[10px] font-semibold">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          Offline (0%)
        </span>
      `;
    }

    const rowBg = isHilang ? 'bg-error-container/10 hover:bg-error-container/20' : 'hover:bg-surface-container/60';
    const waClean = (d.noWa || '').replace(/[^0-9]/g, '');
    const waLink = waClean.startsWith('0') ? '62' + waClean.substring(1) : waClean;

    return `
      <tr class="${rowBg} transition-colors">
        <!-- Col 1: IMEI -->
        <td class="py-3 px-4 align-middle">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined ${isHilang ? 'text-error' : 'text-primary'} text-[18px]">qr_code_2</span>
            <span class="font-mono font-semibold ${isHilang ? 'text-error' : 'text-primary'} tracking-wider text-xs select-all">${escapeHtml(d.imei)}</span>
            <button onclick="salinTeks('${d.imei}', 'Nomor IMEI')" title="Salin IMEI" class="p-1 rounded text-outline hover:text-white transition-colors">
              <span class="material-symbols-outlined text-[13px]">content_copy</span>
            </button>
          </div>
        </td>

        <!-- Col 2: Staf & Tipe HP -->
        <td class="py-3 px-4 align-middle">
          <div class="flex flex-col">
            <span class="font-bold text-on-surface text-xs">${escapeHtml(d.nama)}</span>
            <span class="text-[11px] text-on-surface-variant">${escapeHtml(d.tipe)}</span>
          </div>
        </td>

        <!-- Col 3: Divisi -->
        <td class="py-3 px-4 align-middle">
          <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">
            ${escapeHtml(d.divisi)}
          </span>
        </td>

        <!-- Col 4: WhatsApp -->
        <td class="py-3 px-4 align-middle">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px] text-emerald-400">call</span>
            <a href="https://wa.me/${waLink}" target="_blank" class="font-mono text-xs text-on-surface hover:text-emerald-400 transition-colors">
              ${escapeHtml(d.noWa)}
            </a>
          </div>
        </td>

        <!-- Col 5: Status Telemetri -->
        <td class="py-3 px-4 align-middle">
          ${statusBadge}
        </td>

        <!-- Col 6: Lokasi Terakhir -->
        <td class="py-3 px-4 align-middle">
          <div class="flex flex-col">
            <span class="text-xs text-on-surface truncate max-w-[200px]" title="${escapeHtml(d.alamat || '')}">${escapeHtml(d.alamat || 'Sektor Operasional')}</span>
            <span class="font-mono text-[10px] text-outline">${d.lat.toFixed(4)}, ${d.lng.toFixed(4)} • ${escapeHtml(d.waktuUpdate || 'Baru saja')}</span>
          </div>
        </td>

        <!-- Col 7: Aksi -->
        <td class="py-3 px-4 align-middle text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="lacakDeviceById('${d.imei}')" title="Lacak di Peta" class="w-8 h-8 rounded-lg bg-surface-container hover:bg-primary-container hover:text-on-primary-container text-primary flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[16px]">near_me</span>
            </button>
            <a href="https://wa.me/${waLink}" target="_blank" title="Kirim WhatsApp" class="w-8 h-8 rounded-lg bg-surface-container hover:bg-emerald-500 hover:text-white text-emerald-400 flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[16px]">chat</span>
            </a>
            <button onclick="bukaLayarKioskLock({ imei: '${d.imei}', nama: '${escapeHtml(d.nama)}', lat: ${d.lat}, lng: ${d.lng}, alamat: '${escapeHtml(d.alamat || '')}' })" title="Kunci Layar Kiosk" class="w-8 h-8 rounded-lg ${isHilang ? 'bg-error text-white hover:bg-error/80' : 'bg-surface-container text-tertiary hover:bg-surface-container-high'} flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[16px]">lock</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDesktopTable() {
  renderMasterDeviceTable();
}

// Lacak Device Spesifik di Peta Leaflet
function lacakDeviceById(imei) {
  const device = AppState.devices.find(d => d.imei === imei);
  if (!device) return;

  navigateToTab('live-tracking');
  if (!AppState.map) initLeafletMap();
  if (AppState.map && typeof AppState.map.setView === 'function') {
    setTimeout(() => {
      AppState.map.invalidateSize();
      AppState.map.setView([device.lat, device.lng], 16, { animate: true });
      const marker = AppState.markers[imei];
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      }
    }, 180);
  }
  tampilkanToast(`Memusatkan peta ke perangkat: ${device.nama} (${device.imei})`, 'info');
}

// Ekspor Data Master Perangkat ke format CSV Excel
function exportDevicesCSV() {
  if (!AppState.devices || AppState.devices.length === 0) {
    tampilkanToast('Tidak ada data perangkat untuk diekspor.', 'warning');
    return;
  }

  const headers = ['No IMEI', 'Nama Staf', 'Tipe HP', 'Divisi', 'No WhatsApp', 'Status', 'Baterai (%)', 'Latitude', 'Longitude', 'Alamat Terakhir', 'Waktu Update'];
  const rows = AppState.devices.map(d => [
    `"${d.imei}"`,
    `"${d.nama.replace(/"/g, '""')}"`,
    `"${d.tipe.replace(/"/g, '""')}"`,
    `"${d.divisi.replace(/"/g, '""')}"`,
    `"${d.noWa}"`,
    `"${d.status}"`,
    d.baterai,
    d.lat,
    d.lng,
    `"${(d.alamat || '').replace(/"/g, '""')}"`,
    `"${d.waktuUpdate || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `LacakHP_Pro_Master_Perangkat_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  tampilkanToast('Data Master Perangkat berhasil diekspor ke CSV!', 'success');
}

// ============================================================================
// KIOSK LOCK SCREEN LOGIC (Persis sesuai Stitch code_layar_peringatan.html)
// ============================================================================
let kioskCountdownInterval = null;
let kioskAlarmActive = false;
let kioskAlarmOscillator = null;

function bukaLayarKioskLock(device) {
  const modal = document.getElementById('kioskLockModalOverlay');
  if (!modal) return;

  const imei = device?.imei || '356789012345678';
  const nama = device?.nama || 'Aset Operasional';
  const lat = device?.lat !== undefined ? device.lat : -6.2146;
  const lng = device?.lng !== undefined ? device.lng : 106.8451;
  const alamat = device?.alamat || 'DKI Jakarta, Sektor Gambir';

  const elImei = document.getElementById('kioskImei');
  const elTicket = document.getElementById('kioskTicket');
  const elGps = document.getElementById('kioskGps');
  const elAccuracy = document.getElementById('kioskAccuracy');
  const elLocation = document.getElementById('kioskLocationName');
  const elTime = document.getElementById('kioskLockTime');

  if (elImei) elImei.textContent = imei;
  if (elTicket) elTicket.textContent = `INC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  if (elGps) elGps.textContent = `${lat.toFixed(4)}° S, ${lng.toFixed(4)}° E`;
  if (elAccuracy) elAccuracy.textContent = '± 4.8 Meter (A-GPS Valid)';
  if (elLocation) elLocation.textContent = alamat;
  if (elTime) {
    const now = new Date();
    elTime.textContent = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
  }

  modal.classList.remove('hidden');

  // Mulai interval countdown uplink telemetri 30 detik
  let secondsLeft = 30;
  const countdownEl = document.getElementById('kioskCountdown');
  if (countdownEl) countdownEl.textContent = 'TX: 30s';

  if (kioskCountdownInterval) clearInterval(kioskCountdownInterval);
  kioskCountdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) secondsLeft = 30;
    if (countdownEl) countdownEl.textContent = `TX: ${secondsLeft}s`;
  }, 1000);

  tampilkanToast(`Perangkat Dinas ${imei} dikunci dalam Kiosk Mode!`, 'error');
}

function tutupLayarKioskLock() {
  const modal = document.getElementById('kioskLockModalOverlay');
  if (modal) modal.classList.add('hidden');

  if (kioskCountdownInterval) {
    clearInterval(kioskCountdownInterval);
    kioskCountdownInterval = null;
  }

  // Matikan alarm jika sedang bunyi
  if (kioskAlarmActive) {
    toggleKioskAlarm();
  }

  tampilkanToast('Layar Kiosk Darurat ditutup.', 'info');
}

function hubungiAdminPusatKiosk() {
  const adminWa = AppState.config?.adminWa || '081199887711';
  window.location.href = `tel:${adminWa}`;
}

function kirimLokasiWaKiosk() {
  const imei = document.getElementById('kioskImei')?.textContent || '356789012345678';
  const ticket = document.getElementById('kioskTicket')?.textContent || 'INC-DARURAT';
  const gps = document.getElementById('kioskGps')?.textContent || '-6.2146, 106.8451';
  const adminWa = (AppState.config.adminWa || '6281199887711').replace(/[^0-9]/g, '');
  const cleanAdmin = adminWa.startsWith('0') ? '62' + adminWa.substring(1) : adminWa;

  const msg = encodeURIComponent(`[ALERT DARURAT] Perangkat IMEI: ${imei} (Tiket: ${ticket}) sedang diverifikasi di lokasi GPS: ${gps}.`);
  window.open(`https://wa.me/${cleanAdmin}?text=${msg}`, '_blank');
}

function toggleKioskAlarm() {
  const btn = document.getElementById('btnKioskSoundAlarm');
  const label = document.getElementById('kioskAlarmLabel');
  kioskAlarmActive = !kioskAlarmActive;

  if (kioskAlarmActive) {
    if (label) label.textContent = 'Sirene Aktif (Memancarkan 95dB...)';
    if (btn) {
      btn.classList.add('text-error', 'bg-error-container/40');
      btn.classList.remove('text-slate-300');
    }

    // Gunakan Web Audio API audio synthesizer beacon
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      kioskAlarmOscillator = { osc, audioCtx };
    } catch (e) {
      console.warn('Web Audio warning:', e);
    }
  } else {
    if (label) label.textContent = 'Bunyikan Sirene Penanda Lapangan';
    if (btn) {
      btn.classList.remove('text-error', 'bg-error-container/40');
      btn.classList.add('text-slate-300');
    }

    if (kioskAlarmOscillator) {
      try {
        kioskAlarmOscillator.osc.stop();
        kioskAlarmOscillator.audioCtx.close();
      } catch (e) {}
      kioskAlarmOscillator = null;
    }
  }
}


// ============================================================================
// MODAL SCANNER OPTIK BARCODE & QR IMEI (Sesuai Stitch)
// ============================================================================
let scannerTorchActive = true;
let currentScannerMode = 'kardus';

function bukaModalScanner(mode = 'kardus') {
  const modal = document.getElementById('scannerModalOverlay');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchScannerMode(mode);
  tampilkanToast('Kamera Scanner Aktif (60 FPS 1080p)', 'info');
}

function tutupModalScanner() {
  const modal = document.getElementById('scannerModalOverlay');
  if (modal) modal.classList.add('hidden');
}

function switchScannerMode(mode) {
  currentScannerMode = mode;
  const viewKardus = document.getElementById('scannerViewportKardus');
  const viewLayar = document.getElementById('scannerViewportLayar');
  const btnKardus = document.getElementById('btnScanTabKardus');
  const btnLayar = document.getElementById('btnScanTabLayar');
  const btnBatch = document.getElementById('btnScanTabBatch');

  if (btnKardus) {
    btnKardus.className = mode === 'kardus' 
      ? 'flex-1 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all'
      : 'flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all';
  }

  if (btnLayar) {
    btnLayar.className = mode === 'layar'
      ? 'flex-1 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all'
      : 'flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all';
  }

  if (btnBatch) {
    btnBatch.className = mode === 'batch'
      ? 'flex-1 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all'
      : 'flex-1 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all';
  }

  if (mode === 'layar') {
    if (viewKardus) viewKardus.classList.add('hidden');
    if (viewLayar) viewLayar.classList.remove('hidden');
  } else {
    if (viewKardus) viewKardus.classList.remove('hidden');
    if (viewLayar) viewLayar.classList.add('hidden');
  }
}

function toggleScannerTorch() {
  scannerTorchActive = !scannerTorchActive;
  const btn = document.getElementById('scannerTorchBtn');
  if (btn) {
    btn.classList.toggle('text-primary', scannerTorchActive);
    btn.classList.toggle('text-outline', !scannerTorchActive);
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = scannerTorchActive ? 'flashlight_on' : 'flashlight_off';
  }
  tampilkanToast(scannerTorchActive ? 'Flashlight / Senter AKTIF' : 'Flashlight DIMATIKAN', 'info');
}

function terapkanHasilScan(imei, tipe, sn) {
  tutupModalScanner();
  bukaModalRegistrasiPerangkat();

  setTimeout(() => {
    const inputImei = document.getElementById('modal-input-imei') || document.querySelector('input[placeholder*="15 digit"]');
    const inputTipe = document.getElementById('modal-input-tipe') || document.querySelector('input[placeholder*="Galaxy"]');

    if (inputImei) {
      inputImei.value = (imei || '358977218890312').replace(/\s+/g, '');
      inputImei.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (inputTipe && tipe) {
      inputTipe.value = tipe;
    }

    tampilkanToast(`IMEI ${imei} berhasil diterapkan ke formulir registrasi!`, 'success');
  }, 200);
}

// Global hook untuk tombol 'Gunakan Nomor IMEI Ini' di dalam modal scanner
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#useImeiBtn, button');
  if (btn && btn.textContent && btn.textContent.includes('Gunakan Nomor IMEI')) {
    const isLayar = currentScannerMode === 'layar';
    const imei = isLayar ? '358977218890312' : '358977218890312';
    const tipe = isLayar ? 'Samsung Galaxy A15 5G' : 'Xiaomi Redmi 13C';
    terapkanHasilScan(imei, tipe);
  }
});

// ============================================================================
// SIMULASI EKSEKUSI SIRENE OTA (DESKTOP MODAL INTERAKTIF)
// Sesuai Stitch lacakhp_pro_remote_command_mode_darurat_3
// ============================================================================
let desktopCountdownTimer = null;
let desktopRemainingSeconds = 60;
let desktopSirenMuted = false;
let desktopBroadcastSessionCount = 24;

function closeSirenModal() {
  const modal = document.getElementById('siren-confirmation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.add('opacity-0', 'pointer-events-none');
  }
}

function reopenSirenModal() {
  const modal = document.getElementById('siren-confirmation-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.remove('opacity-0', 'pointer-events-none');
  }
}

function executeSirenSequence() {
  const promptState = document.getElementById('modal-state-prompt');
  const transState = document.getElementById('modal-state-transmitting');
  const successState = document.getElementById('modal-state-success');
  const progressBar = document.getElementById('transmit-progress-bar');
  const stepTitle = document.getElementById('transmit-step-title');
  const stepDesc = document.getElementById('transmit-step-desc');
  const stepSub = document.getElementById('transmit-step-sub');
  
  const toneChecked = document.querySelector('input[name="siren-tone"]:checked');
  const toneName = toneChecked ? (toneChecked.value === 'ambulans' ? 'Ambulans Taktis' : (toneChecked.value === 'klakson' ? 'Klakson Kritis' : 'Morse SOS')) : 'Ambulans Taktis';

  // Putar Web Audio synthesizer tone
  playSirenPattern(toneChecked?.value || 'ambulance', 60);

  if (promptState) promptState.classList.add('hidden');
  if (transState) transState.classList.remove('hidden');
  if (successState) successState.classList.add('hidden');

  if (progressBar) progressBar.style.width = '30%';
  if (stepTitle) stepTitle.textContent = 'Mengirim Sinyal Perintah Darurat';
  if (stepDesc) stepDesc.textContent = 'Mengirim payload OTA via Google Apps Script Gateway...';
  if (stepSub) stepSub.textContent = `Payload: SIREN_FORCE_PLAY [Tone: ${toneName}]`;

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '75%';
    if (stepTitle) stepTitle.textContent = 'Mengeksekusi Override Hardware Suara';
    if (stepDesc) stepDesc.textContent = 'Membuka bypass mode senyap pada IMEI target...';
    if (stepSub) stepSub.textContent = 'Menetapkan AudioManager.STREAM_ALARM ke 100% Volume';
  }, 900);

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '100%';
    if (transState) transState.classList.add('hidden');
    if (successState) successState.classList.remove('hidden');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} WIB`;

    const tsEl = document.getElementById('success-timestamp');
    if (tsEl) tsEl.textContent = timeStr;

    const toneEl = document.getElementById('success-tone-name');
    if (toneEl) toneEl.textContent = toneName;

    // Mulai countdown 60s
    startDesktopSirenCountdown();

    // Tambah log ke tabel
    appendDesktopSirenLog(timeStr, toneName);
    tampilkanToast('Sirene Darurat 100% Volume BERHASIL DIAKTIFKAN di HP Staf!', 'error');
  }, 2000);
}

function startDesktopSirenCountdown() {
  if (desktopCountdownTimer) clearInterval(desktopCountdownTimer);
  desktopRemainingSeconds = 60;
  desktopSirenMuted = false;

  const secondsEl = document.getElementById('siren-countdown-seconds');
  const barEl = document.getElementById('siren-countdown-bar');
  if (secondsEl) secondsEl.textContent = '60s / 60s';
  if (barEl) barEl.style.width = '100%';

  desktopCountdownTimer = setInterval(() => {
    desktopRemainingSeconds--;
    if (secondsEl) secondsEl.textContent = `${desktopRemainingSeconds}s / 60s`;
    if (barEl) {
      const pct = Math.max(0, (desktopRemainingSeconds / 60) * 100);
      barEl.style.width = `${pct}%`;
    }

    if (desktopRemainingSeconds <= 0) {
      clearInterval(desktopCountdownTimer);
      desktopCountdownTimer = null;
      handleDesktopSirenCompletedNaturally();
    }
  }, 1000);
}

function handleDesktopSirenCompletedNaturally() {
  stopSirenPattern();
  const badgeText = document.getElementById('badge-siren-text');
  if (badgeText) badgeText.textContent = 'Status: Durasi 60d Berakhir (Selesai)';
  const desc = document.getElementById('cutoff-info-desc');
  if (desc) desc.textContent = 'Durasi pemutaran sirene 60 detik telah selesai secara alami.';
  const btn = document.getElementById('btn-stop-siren');
  if (btn) {
    btn.disabled = true;
    btn.className = 'w-full sm:w-auto px-4 py-2.5 rounded-lg bg-surface-container text-outline cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-1.5';
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">done</span><span>Selesai (Durasi Penuh)</span>';
  }
}

function handleStopSirenNow() {
  if (desktopSirenMuted) return;

  const btn = document.getElementById('btn-stop-siren');
  const cutoffDesc = document.getElementById('cutoff-info-desc');
  const cutoffIcon = document.getElementById('cutoff-info-icon');

  if (btn) {
    btn.disabled = true;
    btn.className = 'w-full sm:w-auto px-4 py-2.5 rounded-lg bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-surface-highest/60';
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin text-primary">sync</span><span>Membatalkan Sirene... Mengirim Payload Cut-off</span>';
  }

  if (cutoffDesc) cutoffDesc.textContent = 'Mengirim sinyal AudioManager.STOP_ALARM ke HP target via Google Play Push Service...';
  if (cutoffIcon) cutoffIcon.textContent = 'sensors';

  if (desktopCountdownTimer) {
    clearInterval(desktopCountdownTimer);
    desktopCountdownTimer = null;
  }

  // Hentikan nada sirene riil
  stopSirenPattern();

  setTimeout(() => {
    desktopSirenMuted = true;

    const mainTitle = document.getElementById('success-main-title');
    if (mainTitle) mainTitle.textContent = 'Sirene Berhasil Dimatikan Lebih Awal (Muted Manually)';

    const mainDesc = document.getElementById('success-main-desc');
    if (mainDesc) mainDesc.innerHTML = 'Perintah Cut-off darurat berhasil dieksekusi. Suara sirene langsung dibungkam sebelum durasi 60 detik selesai.';

    const badgeText = document.getElementById('badge-siren-text');
    if (badgeText) badgeText.textContent = 'Status: Sirene Dibungkam Manual';

    const beacon = document.getElementById('live-audio-beacon');
    if (beacon) beacon.classList.add('hidden');

    const countdownBadgeWrapper = document.getElementById('countdown-badge-wrapper');
    if (countdownBadgeWrapper) countdownBadgeWrapper.classList.add('hidden');

    const countdownBarContainer = document.getElementById('countdown-bar-container');
    if (countdownBarContainer) countdownBarContainer.classList.add('hidden');

    if (cutoffDesc) cutoffDesc.textContent = `Interupsi sukses pada detik ke-${60 - desktopRemainingSeconds}. HP staf kembali senyap.`;

    if (btn) {
      btn.className = 'w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1.5';
      btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">verified</span><span>Sirene Dinonaktifkan (Muted)</span>';
    }

    tampilkanToast('Perintah Cut-off Berhasil: Sirene HP Target Dimatikan!', 'success');
  }, 800);
}

function resetSirenSimulation() {
  if (desktopCountdownTimer) {
    clearInterval(desktopCountdownTimer);
    desktopCountdownTimer = null;
  }
  stopSirenPattern();
  desktopSirenMuted = false;

  const promptState = document.getElementById('modal-state-prompt');
  const transState = document.getElementById('modal-state-transmitting');
  const successState = document.getElementById('modal-state-success');

  if (promptState) promptState.classList.remove('hidden');
  if (transState) transState.classList.add('hidden');
  if (successState) successState.classList.add('hidden');
}

function appendDesktopSirenLog(timestamp, tone) {
  const tbody = document.getElementById('transmission-log-body');
  if (!tbody) return;

  desktopBroadcastSessionCount++;
  const counterEl = document.getElementById('log-counter');
  if (counterEl) counterEl.textContent = `Total Broadcast: ${desktopBroadcastSessionCount} Sesi`;

  const newRow = document.createElement('tr');
  newRow.className = 'hover:bg-surface-container transition-all bg-emerald-950/20 border-l-4 border-l-emerald-400 animate-pulse';

  newRow.innerHTML = `
    <td class="py-3 px-4 font-mono text-xs text-on-surface whitespace-nowrap">${timestamp}</td>
    <td class="py-3 px-4 font-mono text-xs text-primary whitespace-nowrap font-bold">358912345678901</td>
    <td class="py-3 px-4 text-xs font-semibold whitespace-nowrap">
      Budi Santoso
      <span class="block text-[10px] text-outline font-normal">Divisi Lapangan (Samsung A15)</span>
    </td>
    <td class="py-3 px-4 whitespace-nowrap">
      <span class="px-2 py-0.5 rounded bg-error-container/30 text-tertiary text-[10px] font-bold flex items-center gap-1 w-max">
        <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
        Sirene Keras (${tone})
      </span>
    </td>
    <td class="py-3 px-4 text-xs max-w-xs truncate text-on-surface font-medium">
      Perintah Sirene Darurat 100% Volume [Force Override DND]
    </td>
    <td class="py-3 px-4 whitespace-nowrap">
      <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5 w-max border border-emerald-500/30">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
        Terkirim (Sirene Aktif)
      </span>
    </td>
    <td class="py-3 px-4 text-right whitespace-nowrap">
      <div class="flex items-center justify-end gap-1">
        <button onclick="reopenSirenModal(); resetSirenSimulation();" class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-highest text-on-surface text-[10px] transition-colors">Kirim Ulang</button>
      </div>
    </td>
  `;

  tbody.insertBefore(newRow, tbody.firstChild);
  setTimeout(() => newRow.classList.remove('animate-pulse'), 4000);
}
