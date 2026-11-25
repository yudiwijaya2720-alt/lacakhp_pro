/**
 * ============================================================================
 * LacakHP Pro - Enterprise Backend Engine (Google Apps Script)
 * Versi: 2.0.0 (Pure REST API JSON - Decoupled Architecture)
 * 
 * Standar & Pola:
 * - gas-pro-api: REST API JSON murni (doGet & doPost) bebas CORS, tanpa iframe
 * - gas-scale-turbo: Caching berlapis (CacheService), pembacaan batch, responsif
 * - gas-rahasia-script-properties: Zero literal secrets via Script Properties
 * - gas-notifikasi-wa-crm: WhatsApp API (Fonnte) & Email alert otomatis
 * ============================================================================
 */

const APP_VERSION = 'v2.0.0-PRO';

// Nama Sheet Database
const SHEET_NAMES = {
  MASTER: 'Master_Perangkat',
  LOGS: 'Log_Pelacakan',
  INSIDEN: 'Insiden_Hilang',
  CONFIG: 'Pengaturan_Sistem'
};

// Durasi Cache dalam detik (gas-scale-turbo)
const CACHE_TTL = {
  DASHBOARD: 15, // 15 detik untuk live dashboard
  DEVICES: 30,   // 30 detik untuk master perangkat
  CONFIG: 300    // 5 menit untuk konfigurasi sistem
};

/**
 * ============================================================================
 * ENTRY POINT: doGet(e) - Melayani Permintaan Baca Data (GET)
 * ============================================================================
 */
function doGet(e) {
  const t0 = Date.now();
  let result;
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'ping';

    switch (action) {
      case 'ping':
        result = { success: true, message: 'LacakHP Pro REST API Server Online', version: APP_VERSION, time: new Date().toISOString() };
        break;
      case 'getDashboard':
      case 'getData':
        result = getDashboardData();
        break;
      case 'getDevices':
        result = getMasterPerangkat(params.q || '', params.status || 'all');
        break;
      case 'getRoute':
        result = getRiwayatRute(params.imei || '');
        break;
      case 'getConfig':
        result = getPublicConfig();
        break;
      case 'setup':
        result = setupDatabase();
        break;
      default:
        result = { success: false, message: 'Action GET tidak dikenali: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  result.ms = Date.now() - t0;
  result.v = APP_VERSION;
  return buildJsonResponse(result);
}

/**
 * ============================================================================
 * ENTRY POINT: doPost(e) - Melayani Permintaan Mutasi & Telemetri (POST)
 * Menangani fetch dari client dengan format text/plain guna memintas CORS preflight
 * ============================================================================
 */
function doPost(e) {
  const t0 = Date.now();
  let result;
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || 'ping';
    const data = payload.data || payload;

    switch (action) {
      case 'ping':
        result = handleClientPing(data);
        break;
      case 'login':
        result = loginUser(data.username, data.password);
        break;
      case 'saveDevice':
        result = simpanPerangkat(data);
        break;
      case 'deleteDevice':
        result = hapusPerangkat(data.imei);
        break;
      case 'markLost':
        result = tandaiPerangkatHilang(data.imei, data.catatan);
        break;
      case 'sendRemoteMsg':
        result = kirimPesanRemote(data.imei, data.pesan, data.tipePesan, data.bunyikanSirene);
        break;
      case 'updateWA':
      case 'update_wa':
        result = handleClientUpdateWA(data);
        break;
      case 'getRoute':
        result = getRiwayatRute(data.imei);
        break;
      case 'getDashboard':
        result = getDashboardData();
        break;
      case 'setupDatabase':
        result = setupDatabase();
        break;
      default:
        result = { success: false, message: 'Action POST tidak dikenali: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  result.ms = Date.now() - t0;
  result.v = APP_VERSION;
  return buildJsonResponse(result);
}

/**
 * Membangun output respons JSON standar
 */
function buildJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================================
 * MANAJEMEN RAHASIA & SCRIPT PROPERTIES (gas-rahasia-script-properties)
 * ============================================================================
 */
function getConfigValue(key) {
  const props = PropertiesService.getScriptProperties();
  const val = props.getProperty(key);
  if (val !== null && val !== '') return val;

  // Fallback dari Sheet Pengaturan_Sistem jika ada
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          const sheetVal = String(data[i][1]).trim();
          if (sheetVal) {
            props.setProperty(key, sheetVal); // Simpan ke properties agar request berikutnya kilat
            return sheetVal;
          }
        }
      }
    }
  } catch (e) {
    // Spreadsheet belum dibuka atau error
  }
  return '';
}

function getPublicConfig() {
  return {
    success: true,
    appName: 'LacakHP Pro Enterprise',
    version: APP_VERSION,
    adminPhone: getConfigValue('ADMIN_WA_NUMBER') || '6281199887766',
    autoSiren: getConfigValue('AUTO_SIREN_ON_RECOVERY') === 'TRUE',
    serverTime: new Date().toISOString()
  };
}

/**
 * Mendapatkan Spreadsheet yang aktif atau via ID Script Property
 */
function getSpreadsheet() {
  const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propId) {
    try {
      return SpreadsheetApp.openById(propId);
    } catch (e) {
      console.warn('Gagal buka via SPREADSHEET_ID, fallback ke active spreadsheet');
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ============================================================================
 * AUTENTIKASI PENGGUNA (Admin / Staf)
 * ============================================================================
 */
function loginUser(username, password) {
  const adminUser = getConfigValue('ADMIN_USERNAME') || 'admin';
  const adminPass = getConfigValue('ADMIN_PASSWORD') || 'admin123';

  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // 1. Cek Admin
  if (cleanUser.toLowerCase() === adminUser.toLowerCase() && cleanPass === adminPass) {
    return {
      success: true,
      role: 'ADMIN',
      token: Utilities.base64Encode('ADMIN:' + cleanUser + ':' + Date.now()),
      name: 'Admin Dispatcher',
      division: 'Command Center Pusat',
      email: Session.getEffectiveUser().getEmail() || 'admin.dispatch@perusahaan.co.id'
    };
  }

  // 2. Cek Staf (Login via Nomor IMEI)
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const imei = String(data[i][0]).trim();
      if (imei === cleanUser) {
        return {
          success: true,
          role: 'STAFF',
          imei: imei,
          name: data[i][1] || 'Staf Lapangan',
          division: data[i][3] || 'Operasional',
          phone: data[i][2] || '',
          deviceModel: data[i][4] || 'Smartphone',
          token: Utilities.base64Encode('STAFF:' + imei + ':' + Date.now())
        };
      }
    }
  }

  return { success: false, message: 'Kredensial Username/IMEI atau Password tidak valid.' };
}

/**
 * ============================================================================
 * DASHBOARD & TELEMETRI AGREGAT (gas-scale-turbo)
 * ============================================================================
 */
function getDashboardData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('dashboard_data');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      parsed.cached = true;
      return parsed;
    } catch (e) {}
  }

  const ss = getSpreadsheet();
  let sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  if (!sheetMaster) {
    setupDatabase();
    sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  }

  const data = sheetMaster.getDataRange().getValues();
  let devices = [];
  let total = 0, online = 0, standby = 0, hilang = 0;
  const now = Date.now();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    total++;

    const lastSeen = row[8] ? new Date(row[8]).getTime() : 0;
    const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
    let status = String(row[5] || 'Offline').trim();

    // Kalkulasi status aktif otomatis
    if (status !== 'Hilang') {
      if (diffMinutes <= 5) {
        status = 'Online';
        online++;
      } else if (diffMinutes <= 20) {
        status = 'Standby';
        standby++;
      } else {
        status = 'Offline';
      }
    } else {
      hilang++;
    }

    devices.push({
      imei: String(row[0]).trim(),
      nama: row[1] || 'Petugas Lapangan',
      noWa: row[2] || '',
      divisi: row[3] || 'Umum',
      tipe: row[4] || 'Device',
      status: status,
      lat: Number(row[6]) || 0,
      lng: Number(row[7]) || 0,
      lastSeenFormatted: row[8] ? Utilities.formatDate(new Date(row[8]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '-',
      lastSeenRelative: formatRelativeTime(diffMinutes),
      baterai: Number(row[9]) || 0,
      akurasi: Number(row[10]) || 0,
      pesanRemote: row[11] || '',
      tipePesan: row[12] || '',
      statusPesan: row[13] || 'Tidak_Ada'
    });
  }

  // Ambil Insiden Terkini
  const sheetInsiden = ss.getSheetByName(SHEET_NAMES.INSIDEN);
  let insidenList = [];
  if (sheetInsiden) {
    const insidenData = sheetInsiden.getDataRange().getValues();
    const startIdx = Math.max(1, insidenData.length - 8);
    for (let j = startIdx; j < insidenData.length; j++) {
      if (insidenData[j][0]) {
        insidenList.push({
          idTiket: insidenData[j][0],
          waktu: insidenData[j][1] ? Utilities.formatDate(new Date(insidenData[j][1]), 'Asia/Jakarta', 'dd/MM HH:mm') : '-',
          imei: String(insidenData[j][2]),
          nama: insidenData[j][3],
          lokasi: insidenData[j][5] || '-',
          status: insidenData[j][6] || 'Investigasi',
          catatan: insidenData[j][8] || ''
        });
      }
    }
  }

  const result = {
    success: true,
    kpi: { total, online, standby, hilang },
    devices: devices,
    recentAlerts: insidenList.reverse(),
    cached: false
  };

  // Simpan ke CacheService
  try {
    cache.put('dashboard_data', JSON.stringify(result), CACHE_TTL.DASHBOARD);
  } catch (err) {
    console.warn('Gagal simpan cache dashboard:', err);
  }

  return result;
}

function formatRelativeTime(diffMinutes) {
  if (diffMinutes <= 1) return 'Baru saja';
  if (diffMinutes < 60) return diffMinutes + 'm lalu';
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return hours + 'j lalu';
  return Math.floor(hours / 24) + ' hari lalu';
}

/**
 * ============================================================================
 * MASTER PERANGKAT (Search & Filter)
 * ============================================================================
 */
function getMasterPerangkat(query, statusFilter) {
  const dashData = getDashboardData();
  let list = dashData.devices || [];

  if (statusFilter && statusFilter !== 'all') {
    list = list.filter(d => d.status.toLowerCase() === statusFilter.toLowerCase());
  }

  if (query && query.trim() !== '') {
    const q = query.toLowerCase().trim();
    list = list.filter(d =>
      d.imei.toLowerCase().includes(q) ||
      d.nama.toLowerCase().includes(q) ||
      d.noWa.toLowerCase().includes(q) ||
      d.divisi.toLowerCase().includes(q) ||
      d.tipe.toLowerCase().includes(q)
    );
  }

  return { success: true, list: list };
}

/**
 * ============================================================================
 * TAMBAH / UPDATE PERANGKAT (Invalidate Cache)
 * ============================================================================
 */
function simpanPerangkat(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  const rows = sheet.getDataRange().getValues();
  const imeiInput = String(data.imei).trim();

  if (!imeiInput) {
    return { success: false, message: 'Nomor IMEI wajib diisi.' };
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imeiInput) {
      // Update data baris
      sheet.getRange(i + 1, 2).setValue(data.nama || rows[i][1]);
      sheet.getRange(i + 1, 3).setValue(data.noWa || rows[i][2]);
      sheet.getRange(i + 1, 4).setValue(data.divisi || rows[i][3]);
      sheet.getRange(i + 1, 5).setValue(data.tipe || rows[i][4]);
      
      CacheService.getScriptCache().remove('dashboard_data');
      return { success: true, message: 'Data perangkat IMEI ' + imeiInput + ' berhasil diperbarui!' };
    }
  }

  // Tambah baru
  sheet.appendRow([
    imeiInput,
    data.nama || 'Staf Lapangan',
    data.noWa || '',
    data.divisi || 'Lapangan',
    data.tipe || 'Smartphone',
    'Offline',
    0, 0,
    new Date(),
    100, 0,
    '', '', 'Tidak_Ada'
  ]);

  CacheService.getScriptCache().remove('dashboard_data');
  return { success: true, message: 'Perangkat baru IMEI ' + imeiInput + ' berhasil didaftarkan!' };
}

/**
 * ============================================================================
 * HAPUS PERANGKAT BERDASARKAN IMEI (Invalidate Cache)
 * ============================================================================
 */
function hapusPerangkat(imei) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  if (!sheet) return { success: false, message: 'Sheet Master_Perangkat tidak ditemukan.' };

  const imeiTarget = String(imei || '').trim();
  if (!imeiTarget) return { success: false, message: 'Nomor IMEI wajib diisi.' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imeiTarget) {
      sheet.deleteRow(i + 1);
      CacheService.getScriptCache().remove('dashboard_data');
      return { success: true, message: 'Perangkat IMEI ' + imeiTarget + ' berhasil dihapus dari Google Sheets!' };
    }
  }

  return { success: false, message: 'Perangkat IMEI ' + imeiTarget + ' tidak ditemukan.' };
}

/**
 * ============================================================================
 * AKTIVASI MODE HILANG (Lost Mode) & TIKET INSIDEN
 * ============================================================================
 */
function tandaiPerangkatHilang(imei, catatan) {
  const ss = getSpreadsheet();
  const sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  const rows = sheetMaster.getDataRange().getValues();
  const imeiTarget = String(imei).trim();
  let found = false;
  let deviceName = '', devicePhone = '', lastLocation = '';

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imeiTarget) {
      sheetMaster.getRange(i + 1, 6).setValue('Hilang');
      sheetMaster.getRange(i + 1, 12).setValue(catatan || 'Perangkat ini dilaporkan hilang. Segera hubungi kantor pusat.');
      sheetMaster.getRange(i + 1, 13).setValue('Kunci_Hilang');
      sheetMaster.getRange(i + 1, 14).setValue('Menunggu_Terkirim');

      deviceName = rows[i][1];
      devicePhone = rows[i][2];
      lastLocation = (rows[i][6] || '0') + ', ' + (rows[i][7] || '0');
      found = true;
      break;
    }
  }

  if (!found) return { success: false, message: 'Nomor IMEI ' + imeiTarget + ' tidak ditemukan.' };

  // Tambah ke Sheet Insiden_Hilang
  const sheetInsiden = ss.getSheetByName(SHEET_NAMES.INSIDEN);
  const ticketId = 'INC-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMM') + '-' + Math.floor(100 + Math.random() * 900);
  sheetInsiden.appendRow([
    ticketId,
    new Date(),
    imeiTarget,
    deviceName,
    devicePhone,
    lastLocation,
    'Investigasi',
    '',
    catatan || 'Laporan kehilangan resmi oleh Admin Dispatcher'
  ]);

  CacheService.getScriptCache().remove('dashboard_data');
  return { success: true, message: 'Perangkat resmi berstatus HILANG. Tiket ID: ' + ticketId, ticketId: ticketId };
}

/**
 * ============================================================================
 * KIRIM PERINTAH REMOTE / PESAN LAYAR POP-UP KE HP STAF
 * ============================================================================
 */
function kirimPesanRemote(imei, pesan, tipePesan, bunyikanSirene) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  const rows = sheet.getDataRange().getValues();
  const imeiTarget = String(imei).trim();

  // Jika broadcast ke seluruh perangkat
  if (imeiTarget === 'ALL') {
    for (let i = 1; i < rows.length; i++) {
      sheet.getRange(i + 1, 12).setValue(pesan);
      sheet.getRange(i + 1, 13).setValue(tipePesan || 'Pesan_Biasa');
      sheet.getRange(i + 1, 14).setValue('Menunggu_Terkirim');
    }
    CacheService.getScriptCache().remove('dashboard_data');
    return { success: true, message: 'Pesan broadcast berhasil dikirim ke seluruh perangkat aktif.' };
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imeiTarget) {
      sheet.getRange(i + 1, 12).setValue(pesan);
      sheet.getRange(i + 1, 13).setValue(tipePesan || 'Pesan_Biasa');
      sheet.getRange(i + 1, 14).setValue('Menunggu_Terkirim');

      CacheService.getScriptCache().remove('dashboard_data');
      return { success: true, message: 'Perintah pesan remote terkirim ke IMEI ' + imeiTarget };
    }
  }

  return { success: false, message: 'Perangkat dengan IMEI ' + imeiTarget + ' tidak ditemukan.' };
}

/**
 * ============================================================================
 * HANDLER TELEMETRI PING DARI HP STAF (Heartbeat)
 * ============================================================================
 */
function handleClientPing(payload) {
  const ss = getSpreadsheet();
  let sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  if (!sheetMaster) {
    setupDatabase();
    sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  }

  const imei = String(payload.imei || '').trim();
  const lat = Number(payload.lat || 0);
  const lng = Number(payload.lng || 0);
  const acc = Number(payload.acc || 0);
  const bat = Number(payload.bat || 0);
  const now = new Date();

  if (!imei) {
    return { success: false, message: 'IMEI wajib disertakan dalam transmisi telemetri' };
  }

  const rows = sheetMaster.getDataRange().getValues();
  let remoteMessage = '';
  let messageType = 'Tidak_Ada';
  let shouldTriggerSiren = false;
  let isLostDevice = false;
  let staffName = '';
  let rowFound = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imei) {
      rowFound = i + 1;
      staffName = rows[i][1];
      const prevStatus = rows[i][5];

      // Jika sebelumnya hilang dan sekarang mengirim telemetri: SINYAL PULIH!
      if (prevStatus === 'Hilang') {
        isLostDevice = true;
        pemicuSignalRecovery(imei, staffName, lat, lng, bat);
      } else {
        sheetMaster.getRange(rowFound, 6).setValue('Online');
      }

      // Update telemetri
      sheetMaster.getRange(rowFound, 7).setValue(lat);
      sheetMaster.getRange(rowFound, 8).setValue(lng);
      sheetMaster.getRange(rowFound, 9).setValue(now);
      sheetMaster.getRange(rowFound, 10).setValue(bat);
      sheetMaster.getRange(rowFound, 11).setValue(acc);

      // Cek apakah ada pesan remote dari Admin
      if (rows[i][13] === 'Menunggu_Terkirim') {
        remoteMessage = rows[i][11];
        messageType = rows[i][12];
        sheetMaster.getRange(rowFound, 14).setValue('Terbaca');
      }

      if (isLostDevice && getConfigValue('AUTO_SIREN_ON_RECOVERY') === 'TRUE') {
        shouldTriggerSiren = true;
      }
      break;
    }
  }

  // Jika belum terdaftar di Master, buat entri registrasi otomatis
  if (rowFound === -1) {
    sheetMaster.appendRow([
      imei, 'Staf Baru (' + imei.slice(-4) + ')', '', 'Lapangan', 'Mobile Device',
      'Online', lat, lng, now, bat, acc, '', '', 'Tidak_Ada'
    ]);
  }

  // Simpan ke Log_Pelacakan jika koordinat valid
  if (lat !== 0 && lng !== 0) {
    const sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (sheetLogs) {
      const logId = Utilities.getUuid().slice(0, 8);
      sheetLogs.appendRow([
        logId, now, imei, staffName || ('Staf ' + imei.slice(-4)), lat, lng, acc, bat,
        isLostDevice ? 'Hilang_Pulih' : 'Online', ''
      ]);
    }
  }

  // Invalidate cache dashboard
  CacheService.getScriptCache().remove('dashboard_data');

  return {
    success: true,
    imei: imei,
    isLost: isLostDevice,
    remoteMessage: remoteMessage,
    messageType: messageType,
    triggerSiren: shouldTriggerSiren,
    serverTime: now.toISOString()
  };
}

/**
 * ============================================================================
 * PEMICU RECOVERY SINYAL DARURAT (WhatsApp & Email Alert)
 * ============================================================================
 */
function pemicuSignalRecovery(imei, nama, lat, lng, bat) {
  const adminWa = getConfigValue('ADMIN_WA_NUMBER');
  const nowFormatted = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  const mapsUrl = 'https://www.google.com/maps?q=' + lat + ',' + lng;

  const pesanAlert = '🚨 *[ALERT DARURAT LACAKHP PRO]*\n\n' +
    'Perangkat yang dilaporkan *HILANG* terdeteksi *AKTIF KEMBALI*!\n' +
    '📱 *IMEI:* `' + imei + '`\n' +
    '👤 *Nama Staf:* ' + nama + '\n' +
    '🔋 *Baterai:* ' + bat + '%\n' +
    '📍 *Koordinat:* ' + lat + ', ' + lng + '\n' +
    '🕒 *Waktu Terdeteksi:* ' + nowFormatted + ' WIB\n\n' +
    '🗺️ *Tautan Google Maps:* ' + mapsUrl + '\n\n' +
    '_Sistem secara otomatis mengaktifkan transmisi pelacakan prioritas tinggi dan mengunci layar ponsel._';

  // 1. Kirim Pesan WhatsApp ke Nomor Admin
  if (adminWa) {
    kirimPesanWhatsApp(adminWa, pesanAlert);
  }

  // 2. Kirim Email Notifikasi via GmailApp
  try {
    const adminEmail = Session.getEffectiveUser().getEmail();
    if (adminEmail) {
      GmailApp.sendEmail(
        adminEmail,
        '[URGENT LACAKHP PRO] Sinyal Pulih: HP ' + nama + ' (' + imei + ')',
        pesanAlert,
        { htmlBody: pesanAlert.replace(/\n/g, '<br>') }
      );
    }
  } catch (err) {
    console.error('Gagal kirim email alert:', err);
  }

  // 3. Update status tiket insiden
  try {
    const ss = getSpreadsheet();
    const sheetInsiden = ss.getSheetByName(SHEET_NAMES.INSIDEN);
    if (sheetInsiden) {
      const data = sheetInsiden.getDataRange().getValues();
      for (let k = data.length - 1; k >= 1; k--) {
        if (String(data[k][2]).trim() === String(imei).trim() && data[k][6] !== 'Ditutup') {
          sheetInsiden.getRange(k + 1, 7).setValue('Sinyal_Pulih');
          sheetInsiden.getRange(k + 1, 8).setValue(new Date());
          break;
        }
      }
    }
  } catch (e) {
    console.error('Gagal update tiket insiden:', e);
  }
}

/**
 * ============================================================================
 * PEMBARUAN NOMOR WHATSAPP OLEH STAF
 * ============================================================================
 */
function handleClientUpdateWA(payload) {
  const imei = String(payload.imei || '').trim();
  const noWaBaru = String(payload.noWa || '').trim();

  if (!imei || !noWaBaru) {
    return { success: false, message: 'IMEI dan Nomor WhatsApp baru wajib diisi.' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === imei) {
      sheet.getRange(i + 1, 3).setValue(noWaBaru);
      CacheService.getScriptCache().remove('dashboard_data');
      return {
        success: true,
        message: 'Nomor WhatsApp berhasil diperbarui ke: ' + noWaBaru + ' di Master_Perangkat.'
      };
    }
  }

  return { success: false, message: 'Perangkat dengan nomor IMEI ' + imei + ' belum terdaftar.' };
}

/**
 * ============================================================================
 * INTEGRASI WHATSAPP GATEWAY (Fonnte API)
 * ============================================================================
 */
function kirimPesanWhatsApp(targetNomor, pesan) {
  const token = getConfigValue('FONNTE_TOKEN');
  if (!token) {
    console.warn('FONNTE_TOKEN belum diset di Script Properties.');
    return false;
  }

  try {
    const url = 'https://api.fonnte.com/send';
    const cleanNumber = String(targetNomor).replace(/[^0-9]/g, '');
    const options = {
      method: 'post',
      headers: {
        'Authorization': token
      },
      payload: {
        'target': cleanNumber,
        'message': pesan
      },
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(url, options);
    return res.getResponseCode() === 200;
  } catch (e) {
    console.error('Gagal fetch Fonnte WhatsApp:', e);
    return false;
  }
}

/**
 * ============================================================================
 * RIWAYAT RUTE JEJAK (Polyline GPS)
 * ============================================================================
 */
function getRiwayatRute(imei) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
  if (!sheet) return { success: true, points: [] };

  const data = sheet.getDataRange().getValues();
  const points = [];
  const target = String(imei).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === target) {
      const dt = data[i][1] ? new Date(data[i][1]) : null;
      points.push({
        lat: Number(data[i][4]),
        lng: Number(data[i][5]),
        time: dt ? Utilities.formatDate(dt, 'Asia/Jakarta', 'HH:mm') : '-',
        fullTime: dt ? Utilities.formatDate(dt, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss') : '-',
        isoTime: dt ? dt.toISOString() : '',
        acc: Number(data[i][6]) || 0,
        bat: Number(data[i][7]) || 0,
        status: String(data[i][8] || 'Online'),
        note: String(data[i][9] || '')
      });
    }
  }

  return { success: true, points: points };
}

/**
 * ============================================================================
 * INISIALISASI DATABASE OTOMATIS (SETUP SEKALI KLIK)
 * ============================================================================
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Simpan ID Spreadsheet ke Script Properties
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  // 1. Master_Perangkat
  let sheetMaster = ss.getSheetByName(SHEET_NAMES.MASTER);
  if (!sheetMaster) {
    sheetMaster = ss.insertSheet(SHEET_NAMES.MASTER);
    sheetMaster.appendRow([
      'IMEI', 'Nama_Staf', 'No_WA_Staf', 'Divisi', 'Tipe_Perangkat', 
      'Status_Koneksi', 'Lat_Terakhir', 'Lng_Terakhir', 'Waktu_Aktif_Terakhir',
      'Level_Baterai', 'Akurasi_Meter', 'Pesan_Remote_Admin', 'Tipe_Pesan_Remote', 'Status_Pesan'
    ]);
    sheetMaster.getRange('A1:N1').setBackground('#171f33').setFontColor('#8ed5ff').setFontWeight('bold');
    sheetMaster.setFrozenRows(1);
    
    // Data bawaan untuk simulasi demo
    sheetMaster.appendRow([
      '358912345678901', 'Budi Santoso', '081287654321', 'Lapangan', 'Samsung Galaxy A15',
      'Online', -6.2088, 106.8456, new Date(), 94, 4, '', '', 'Tidak_Ada'
    ]);
    sheetMaster.appendRow([
      '356789012345678', 'Siti Aminah', '081399887766', 'Kurir', 'Xiaomi Redmi 13',
      'Hilang', -6.2146, 106.8451, new Date(), 12, 8, 'Perangkat ini dilaporkan berpindah tangan di luar wewenang. Segera amankan perangkat dan hubungi kantor pusat kendali.', 'Kunci_Hilang', 'Menunggu_Terkirim'
    ]);
    sheetMaster.appendRow([
      '351234567890123', 'Agus Prasetyo', '081122334455', 'Logistik', 'Oppo A58',
      'Standby', -6.2231, 106.8398, new Date(Date.now() - 12 * 60 * 1000), 65, 6, '', '', 'Tidak_Ada'
    ]);
    sheetMaster.appendRow([
      '357890123456789', 'Dimas Permana', '085712345678', 'Lapangan', 'Infinix Note 40 Pro',
      'Online', -6.3012, 107.0981, new Date(), 81, 5, '', '', 'Tidak_Ada'
    ]);
    sheetMaster.appendRow([
      '354567890123456', 'Eko Sujarwo', '082198765432', 'Operasional', 'Vivo Y27s',
      'Offline', -6.1890, 106.9012, new Date(Date.now() - 6 * 3600 * 1000), 7, 14, '', '', 'Tidak_Ada'
    ]);
  }

  // 2. Log_Pelacakan
  let sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
  if (!sheetLogs) {
    sheetLogs = ss.insertSheet(SHEET_NAMES.LOGS);
    sheetLogs.appendRow([
      'Log_ID', 'Timestamp', 'IMEI', 'Nama_Staf', 'Latitude', 'Longitude', 
      'Akurasi_Meter', 'Level_Baterai', 'Status_Koneksi', 'Alamat_Perkiraan'
    ]);
    sheetLogs.getRange('A1:J1').setBackground('#171f33').setFontColor('#8ed5ff').setFontWeight('bold');
    sheetLogs.setFrozenRows(1);
    
    // Seed sample route logs for Budi Santoso
    const budiLogs = [
      [-6.2120, 106.8410, 96],
      [-6.2105, 106.8430, 95],
      [-6.2095, 106.8445, 95],
      [-6.2088, 106.8456, 94]
    ];
    budiLogs.forEach((pt, idx) => {
      sheetLogs.appendRow([
        'LOG-00' + (idx + 1),
        new Date(Date.now() - (4 - idx) * 5 * 60 * 1000),
        '358912345678901',
        'Budi Santoso',
        pt[0], pt[1], 4, pt[2], 'Online', 'Jl. M.H. Thamrin'
      ]);
    });
  }

  // 3. Insiden_Hilang
  let sheetInsiden = ss.getSheetByName(SHEET_NAMES.INSIDEN);
  if (!sheetInsiden) {
    sheetInsiden = ss.insertSheet(SHEET_NAMES.INSIDEN);
    sheetInsiden.appendRow([
      'ID_Tiket', 'Waktu_Dilaporkan', 'IMEI', 'Nama_Staf', 'No_WA_Staf', 
      'Lokasi_Terakhir', 'Status_Penanganan', 'Waktu_Sinyal_Pulih', 'Catatan_Admin'
    ]);
    sheetInsiden.getRange('A1:I1').setBackground('#93000a').setFontColor('#ffffff').setFontWeight('bold');
    sheetInsiden.setFrozenRows(1);
    
    sheetInsiden.appendRow([
      'INC-202611-001',
      new Date(Date.now() - 45 * 60 * 1000),
      '356789012345678',
      'Siti Aminah',
      '081399887766',
      '-6.2146, 106.8451 (Gatot Subroto No. 45)',
      'Sinyal_Pulih',
      new Date(),
      'Sinyal GPS terdeteksi kembali. Kiosk-Lock dan sirene darurat telah dipicu.'
    ]);
  }

  // 4. Pengaturan_Sistem
  let sheetConfig = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEET_NAMES.CONFIG);
    sheetConfig.appendRow(['Kunci_Pengaturan', 'Nilai_Pengaturan', 'Deskripsi']);
    sheetConfig.getRange('A1:C1').setBackground('#171f33').setFontColor('#8ed5ff').setFontWeight('bold');
    sheetConfig.appendRow(['ADMIN_USERNAME', 'admin', 'Username login Admin']);
    sheetConfig.appendRow(['ADMIN_PASSWORD', 'admin123', 'Password login Admin']);
    sheetConfig.appendRow(['ADMIN_WA_NUMBER', '6281199887766', 'Nomor WA Admin penerima alert']);
    sheetConfig.appendRow(['FONNTE_TOKEN', '', 'Token API WhatsApp Gateway (Fonnte)']);
    sheetConfig.appendRow(['AUTO_SIREN_ON_RECOVERY', 'TRUE', 'Bunyikan sirene otomatis saat HP hilang online']);
  }

  // Set default properties
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_USERNAME')) props.setProperty('ADMIN_USERNAME', 'admin');
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', 'admin123');
  if (!props.getProperty('ADMIN_WA_NUMBER')) props.setProperty('ADMIN_WA_NUMBER', '6281199887766');

  // Bersihkan cache
  CacheService.getScriptCache().remove('dashboard_data');

  return { success: true, message: 'Database LacakHP Pro v2.0 & Script Properties berhasil diinisialisasi!' };
}
