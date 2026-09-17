const crypto = require('node:crypto');
const fs = require('node:fs');

const cron = require('node-cron');
const fetch = require('node-fetch');
const ntpClient = require('ntp-client');
const webpush = require('web-push');

const { Mutex } = require('async-mutex');

/**
 *
 * KOCAK .. BALIKAN HTTP STATUS CODE SELALU 200
 * TAPI PAKENYA DI BODY
 * WKWKWK
 *
 * https://www.reddit.com/r/ProgrammerHumor/comments/jnb9fa/when_you_only_validate_the_http_code_of_the/
 *
 */

const REFRESH_PASSWORD = "123qweASD!@#";

let isPresensiRunning = false;
let isCleanupRunning = false;

const mtx = new Mutex();

// --

const jsonConfig = 'config.json';
let jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

const logFile = 'irk-logs.json';
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '[]');
}

// -- --

const defaultHeader = {
  'user-agent': 'Mobile-app',
  'device-agent': 'Android/UP1A.230905.011',
  'device': 'mobile',
  'content-type': 'application/json',
  // 'firebase-key': 'ANAK_SETAN'
};

// -- --

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isValidTime = (val) => {
  if (!val.includes(':')) {
    if (val.includes('.')) {
      return false;
    }

    const num = parseFloat(val);
    return typeof val === 'string' && !isNaN(num) && num >= 0 && num < 24;
  }

  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(val);
};

const toMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// -- --

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request Timeout setelah ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

// -- --

let ntpOffsetMs = 0;

const ntpServers = [
  'time.google.com',
  'time.cloudflare.com',
  'jp.pool.ntp.org',
  'ntp.nict.jp',
  'id.pool.ntp.org',
  'time.bmkg.go.id'
];

async function syncNtpOffset() {
  for (let i = 0; i < ntpServers.length; i++) {
    const server = ntpServers[i];
    try {
      const date = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout pada server ${server}`));
        }, 3000);

        const [ipHost, portStr] = server.split(':');
        const port = portStr ? parseInt(portStr) : 123;

        ntpClient.getNetworkTime(ipHost, port, (err, date) => {
          clearTimeout(timeout);
          if (err) return reject(err);
          resolve(date);
        });
      });

      ntpOffsetMs = date.getTime() - Date.now();
      console.log(`[⏱️ NTP Sync] Offset NTP berhasil diperbarui: ${ntpOffsetMs}ms (Server: ${server})`);

      // Promosikan server yang berhasil merespons ini ke urutan paling depan untuk sync berikutnya!
      if (i > 0) {
        ntpServers.splice(i, 1);
        ntpServers.unshift(server);
      }
      return;
    }
    catch (e) {
      // Coba server berikutnya ~
    }
  }

  console.warn('[⚠️ NTP Sync] Gagal menyinkronkan NTP, menggunakan offset sebelumnya:', ntpOffsetMs);
}

function getCurrentJakartaDate(ntpDate = null) {
  const currentMs = ntpDate ? new Date(ntpDate).getTime() : (Date.now() + ntpOffsetMs);
  const dateObj = new Date(currentMs);
  const jakartaString = dateObj.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta'
  });

  return new Date(jakartaString);
}

// -- --

function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// --

async function writeLogToFile(logMsg, userNik = null) {

  const release = await mtx.acquire();

  try {
    let logs = [];
    if (fs.existsSync(logFile)) {
      const fileData = fs.readFileSync(logFile, { encoding: 'utf8' });
      logs = fileData.trim() ? JSON.parse(fileData) : [];
    }

    const now = getCurrentJakartaDate();
    const formattedTime = new Date(now).toLocaleString('id-ID');

    let logHash = null;
    if (userNik) {
      logHash = crypto.createHash('sha256').update(String(userNik)).digest('hex');
    }

    logs.push({ time: formattedTime, message: logMsg, ref: logHash });
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  }
  catch (err) {
    console.error('Gagal menulis log ke file:', err);
  }
  finally {
    release();
  }
}

// --

const userLat = 'eyJpdiI6ImRQM3hIRnI5SDREMThXaWdVZU0rWGc9PSIsInZhbHVlIjoicFRLcVBvd1ZZV3Z1cnM0cHYzZ2pzUT09In0=';
const userLon = 'eyJpdiI6InJJSEh2QjFLL2prd05keWZBRHpTN0E9PSIsInZhbHVlIjoiSXZjcVMwWW9OMVIwbXJJWXJOMHNTQT09In0=';

function laraEncrypt(plainText) {
  const key = Buffer.from(jsonData.irk.masterKey, 'base64');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(plainText.toString(), 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const jsonContainer = JSON.stringify({
    iv: iv.toString('base64'),
    value: encrypted
  });

  return Buffer.from(jsonContainer).toString('base64');
}

function laraDecrypt(base64Payload) {
  const key = Buffer.from(jsonData.irk.masterKey, 'base64');

  const jsonString = Buffer.from(base64Payload, 'base64').toString('utf8');
  const data = JSON.parse(jsonString);

  const iv = Buffer.from(data.iv, 'base64');
  const encryptedValue = Buffer.from(data.value, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function cekAlamatReal(lat, lon) {
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const gMapUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${jsonData.gcpApiKey}`;

    const options = {
      method: 'GET',
      headers: defaultHeader,
    };

    const result = {
      success: true,
      openStreetMap: null,
      googleMap: null,
      mapLinks: [
        `https://www.google.com/maps?q=${lat},${lon}`,
        `https://www.openstreetmap.org/search?query=${lat},${lon}`
      ]
    };

    const [osmResponse, gMapResponse] = await Promise.all([
      fetchWithTimeout(osmUrl, options),
      fetchWithTimeout(gMapUrl, options)
    ]);

    if (!osmResponse.ok) {
      const errorText = await osmResponse.text();
      result.openStreetMap = `Error OSM: ${osmResponse.status} - ${errorText}`;
    }
    else {
      const osmData = await osmResponse.json();
      result.openStreetMap = osmData.display_name || 'Alamat tidak ditemukan di OSM';
    }

    if (!gMapResponse.ok) {
      const errorText = await gMapResponse.text();
      result.googleMap = `Error GMap: ${gMapResponse.status} - ${errorText}`;
    }
    else {
      const gMapData = await gMapResponse.json();

      if (gMapData.status === 'OK') {
        result.googleMap = gMapData.results[0].formatted_address;
      }
      else {
        result.googleMap = `Google Status: ${gMapData.status}`;
      }
    }

    return result;
  }
  catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

function extractCoords(input) {
  try {
    let lat, lon;
    const url = input.trim();

    if (url.match(/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/)) {
      [lat, lon] = url.split(',').map(s => s.trim());
    }
    else if (url.includes('google.com/maps') || url.includes('maps.app.goo.gl')) {
      const atMatch = url.match(/@([-\d.]+),([-\d.]+)/);
      if (atMatch) {
        lat = atMatch[1];
        lon = atMatch[2];
      }
      else {
        const urlObj = new URL(url.replace(/#.*$/, '')); // buang hash biar gak ganggu URLSearchParams
        const q = urlObj.searchParams.get('q') ||
          urlObj.searchParams.get('query') ||
          urlObj.searchParams.get('ll');

        if (q && q.includes(',')) {
          [lat, lon] = q.split(',');
        }
      }
    }
    else if (url.includes('openstreetmap.org')) {
      const hashMatch = url.match(/#map=\d+\/([-\d.]+)\/([-\d.]+)/);
      if (hashMatch) {
        lat = hashMatch[1];
        lon = hashMatch[2];
      }
      else {
        const urlObj = new URL(url);
        lat = urlObj.searchParams.get('mlat') || urlObj.searchParams.get('lat');
        lon = urlObj.searchParams.get('mlon') || urlObj.searchParams.get('lon');
      }
    }

    if (!lat || !lon) {
      return {
        success: false,
        message: 'URL tidak dikenali. Pastikan URL sudah Benar.'
      };
    }

    const numericLat = parseFloat(lat);
    const numericLon = parseFloat(lon);

    return {
      success: true,
      lat: numericLat.toString(),
      lon: numericLon.toString(),
      isIndonesia: (numericLat < 6 && numericLat > -11) && (numericLon > 95 && numericLon < 141)
    };
  }
  catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

async function infoCoordAddr(input) {
  const coord = extractCoords(input);
  const addr = await cekAlamatReal(coord.lat, coord.lon);
  return {
    coord,
    addr
  };
}

// -- --

async function login(userNik, userPassword) {
  const url = `${jsonData.irk.baseUri}/login`;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`
    },
    body: JSON.stringify({
      data: {
        nik: userNik,
        pass: userPassword
      }
    })
  };

  return fetchWithTimeout(url, options);
}

async function worker(userNik, cookies) {
  const url = `${jsonData.irk.baseUri}/worker`;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`,
      'Cookie': cookies
    },
    body: JSON.stringify({
      data: {
        userid: userNik,
        code: 0,
        converter: 'operatingsystem'
      }
    })
  };

  return fetchWithTimeout(url, options);
}

async function presensiwfh(current_date, userNik, cookies, bulan = null, tahun = null) {
  const url = `${jsonData.irk.baseUri}/presensiwfh`;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`,
      'Cookie': cookies
    },
    body: JSON.stringify({
      data: {
        desc: 'get-tanggal-wfh',
        userid: userNik,
        nik: userNik,
        bulan: (bulan || current_date.getMonth() + 1).toString().padStart(2, '0'),
        tahun: tahun || current_date.getFullYear()
      }
    })
  };

  return fetchWithTimeout(url, options);
}

async function presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies, getTimeOnly = true) {
  const url = `${jsonData.irk.baseUri}/presensi/get`;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`,
      'Cookie': cookies
    }
  };

  if (getTimeOnly) {
    options.body = JSON.stringify({
      userid: userNik,
      code: 'getTime'
    });
  }
  else {
    options.body = JSON.stringify({
      userid: userNik,
      tglAwal: current_yyyyMMdd_dashHyphens,
      tglAkhir: current_yyyyMMdd_dashHyphens
    });
  }

  return fetchWithTimeout(url, options);
}

async function presensipost(userNik, cookies, lat = null, lon = null) {
  const url = `${jsonData.irk.baseUri}/presensi/post`;

  const jitterLat = (parseFloat(lat || '-72.4522217') + (Math.random() - 0.5) * 0.00006).toFixed(7);
  const jitterLon = (parseFloat(lon || '0.9438507') + (Math.random() - 0.5) * 0.00006).toFixed(7);

  const encLat = jsonData.irk.masterKey ? laraEncrypt(jitterLat) : userLat;
  const encLong = jsonData.irk.masterKey ? laraEncrypt(jitterLon) : userLon;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`,
      'Cookie': cookies
    },
    body: JSON.stringify({
      userid: userNik,
      longitude: encLong,
      latitude: encLat
    })
  };

  return fetchWithTimeout(url, options);
}

async function sendNotif(msg, userNik = null) {
  console.log(`[Push Notification] Sending Notif :: ${msg}`);

  let isConfigChanged = false;
  let vapid = jsonData.vapid || jsonData.irk?.vapid;
  const botEmail = jsonData.botEmail || jsonData.irk?.botEmail || 'noreply@fansub.id';

  if (!vapid) {
    vapid = webpush.generateVAPIDKeys();
    jsonData.vapid = vapid;
    const release = await mtx.acquire();
    try {
      let config = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));
      config.vapid = vapid;
      fs.writeFileSync(jsonConfig, JSON.stringify(config, null, 2));
      console.log('[🔑 VAPID Keys] Kunci VAPID baru berhasil di-generate dan disimpan ke config.json!');
    }
    catch (e) {
      console.error('Gagal simpan VAPID keys:', e.message);
    }
    finally {
      release();
    }
  }

  for (const accountData of jsonData.irk.accounts) {
    try {
      if (userNik) {
        if (accountData.nik !== userNik) {
          continue;
        }
      }

      if (!accountData.pushSubscription) {
        console.log(`[Push Notification] ℹ️ Akun NIK ${accountData.nik} belum mengaktifkan notifikasi browser UI (/ui). Notif di-skip.`);
        continue;
      }

      console.log(`[Push Notification] Sending Notif to ${accountData.nik}`);
      webpush.setVapidDetails(`mailto:${botEmail}`, vapid.publicKey, vapid.privateKey);

      let msgClean = msg.replace(/<@[0-9]+>/g, '[@DiscordUser]');

      await webpush.sendNotification(
        accountData.pushSubscription,
        JSON.stringify({
          title: 'IRK Absen',
          body: msgClean,
          url: '/ui'
        })
      );
    }
    catch (e) {
      const statusCode = e.statusCode || e.status;
      const isExpiredOrInvalid = statusCode === 404 || statusCode === 410 || statusCode === 400 ||
        (e.message && (e.message.includes('410') || e.message.includes('404') || e.message.includes('expired') || e.message.includes('unsubscribed')));

      if (isExpiredOrInvalid) {
        console.log(`[Push Notification] Subscription untuk NIK ${accountData.nik} sudah expired/unsubscribed (${statusCode || e.message}). Menghapus token notification...`);
        delete accountData.pushSubscription;
        isConfigChanged = true;
      }
      else {
        console.log(`[Push Notification] Gagal mengirim Notif ke ${accountData.nik}:`, e.message);
      }
    }
  }

  if (isConfigChanged) {
    const release = await mtx.acquire();
    try {
      let config = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));
      for (const acc of jsonData.irk.accounts) {
        if (!acc.pushSubscription) {
          const idx = config.irk.accounts.findIndex(a => a.nik === acc.nik);
          if (idx !== -1) {
            delete config.irk.accounts[idx].pushSubscription;
          }
        }
      }
      fs.writeFileSync(jsonConfig, JSON.stringify(config, null, 2));
      jsonData = config;
      console.log('[🧹 Push Notification] Token push subscription yang expired berhasil dibersihkan dari config.json!');
    }
    catch (err) {
      console.error('Gagal meng-update config.json setelah menghapus pushSubscription expired:', err);
    }
    finally {
      release();
    }
  }
}

async function logNotify(msg, userNik, discordClient = null) {
  console.log(msg);
  await writeLogToFile(msg, userNik);

  if (discordClient) {
    try {
      const guild = discordClient.guilds.get(jsonData.irk.guildId);
      const channel = guild.channels.get(jsonData.irk.channelId);
      channel.send(msg).catch(e => console.error('Gagal mengirim ke Discord:', e.message));
    }
    catch (e) {
      console.error('Gagal mengirim ke Discord:', e.message);
    }
  }

  sendNotif(msg, userNik).catch(e => console.error('Gagal mengirim Push Notif:', e.message));
}

// -- --

async function startIrk(current_date, discordId, userNik, userPassword, lat = null, lon = null, discordClient = null, checkOnly = false) {
  const dayName = current_date.toLocaleString('id-ID', { weekday: 'long' });

  const maskedNik = userNik.length > 4 ? userNik.substring(0, 2) + '*'.repeat(userNik.length - 4) + userNik.substring(userNik.length - 2) : userNik;

  const logger = (msg) => logNotify(msg, userNik, discordClient);

  try {
    let _tempResponseData = null;

    const loginResponse = await login(userNik, userPassword);
    _tempResponseData = await loginResponse.json();
    if (!loginResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'User Name / Password = Salah / Expired, Silahkan Set Ulang';

      let logMsg = `<@${discordId}> ${maskedNik} :: [LOGIN] ${errMsg}`;

      const idx = jsonData.irk.accounts.findIndex(d => d.nik === userNik);
      if (idx >= 0) {
        if (!jsonData.irk.accounts[idx].error_count) {
          jsonData.irk.accounts[idx].error_count = 0;
        }

        jsonData.irk.accounts[idx].error_count++;
        if (jsonData.irk.accounts[idx].error_count >= 2) {
          jsonData.irk.accounts[idx].inactive = true;
          logMsg += ` (Akun akan tidak akan presensi otomatis sampai diset ulang manual)`;
        }
      }

      fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
      logMsg += ` {Percobaan ke-${jsonData.irk.accounts[idx].error_count}}`;
      await logger(logMsg);

      return false;
    }

    let cookies = loginResponse.headers.raw()['set-cookie']
      .map(c => c.split(';')[0])
      .join('; ');

    const workerResponse = await worker(userNik, cookies);
    _tempResponseData = await workerResponse.json();
    if (!workerResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [WORKER] ${errMsg}`);
      return false;
    }

    if (!_tempResponseData.data.user_irk) {
      await logger(`<@${discordId}> ${maskedNik} :: [AKUN] Bukan User Untuk Aplikasi IRK ~`);
      return true;
    }

    const isPresensiAvailable = _tempResponseData.data.isPresensiAvailable;

    const presensiwfhResponse = await presensiwfh(current_date, userNik, cookies);
    _tempResponseData = await presensiwfhResponse.json();
    if (!presensiwfhResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIWFH] ${errMsg}`);
      return false;
    }

    if (_tempResponseData.data.length <= 0) {
      await logger(`<@${discordId}> ${maskedNik} :: [MAINTENIS] Server sedang dalam perbaikan ~`);
      return false;
    }

    const tanggal_wfh = _tempResponseData.data[0].tanggal_wfh;
    const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);
    const isTargetWfhToday = tanggal_wfh.includes(current_yyyyMMdd_dashHyphens);

    if (!isPresensiAvailable || !isTargetWfhToday) {
      await logger(`<@${discordId}> ${maskedNik} :: [JADWAL] ${dayName} :: Tidak Ada WFH, Mungkin Masuk Kantor / Libur Nasional ~`);
      return true;
    }

    if (checkOnly) {
      await logger(`<@${discordId}> ${maskedNik} :: [JADWAL] ${dayName} :: Hari Ini WFH ~`);
      return false;
    }

    let presensigetResponse = await presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIGET_TIME] ${errMsg}`);
      return false;
    }

    const jamAbsen = _tempResponseData.data[0];
    const jamMasuk = jamAbsen.machinein;
    let jamKeluar = null;
    if (dayName === 'Jumat') {
      jamKeluar = jamAbsen.machineout_jumat;
    }
    else {
      jamKeluar = jamAbsen.machineout
    }

    presensigetResponse = await presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies, false);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIGET_HISTORY] ${errMsg}`);
      return false;
    }

    if (_tempResponseData.data.length === 1) {
      const riwayatAbsenSore = _tempResponseData.data[0];
      if (riwayatAbsenSore.location_out?.length > 0) {
        await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIGET_HISTORY] Sudah Ada Data Presensi Sore (Manual)`);
        return true;
      }
    }

    const presensipostResponse = await presensipost(userNik, cookies, lat, lon);
    _tempResponseData = await presensipostResponse.json();
    if (!presensipostResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      const retVal = errMsg?.toUpperCase().trim() === 'SUDAH ADA DATA PRESENSI MASUK UNTUK HARI INI' ? true : false;
      const msgInfo = retVal ? 'Sudah Ada Data Presensi Pagi (Manual)' : errMsg;
      await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIPOST] ${msgInfo}`);
      return retVal;
    }

    presensigetResponse = await presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies, false);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PRESENSIGET_HISTORY] ${errMsg}`);
      return false;
    }

    if (_tempResponseData.data.length === 0) {
      await logger(`<@${discordId}> ${maskedNik} :: [JADWAL] Belum Ada Data WFH, Periksa Juga Tanggal Untuk Ikut Ke Asia/Jakarta ~`);
      return false;
    }

    const riwayatAbsen = _tempResponseData.data[0];
    const absenMasukJam = riwayatAbsen.machinein || '??';
    const absenKeluarJam = riwayatAbsen.machineout || '??';
    // const absenMasukLokasi = riwayatAbsen.location_in?.join(', ') || '??, ??';
    // const absenKeluarLokasi = riwayatAbsen.location_out?.join(', ') || '??, ??';
    await logger(`
      <@${discordId}> ${maskedNik} :: ${dayName}
      [BERANGKAT] ${jamMasuk} => ${absenMasukJam}
      [PULANG] ${jamKeluar} => ${absenKeluarJam}
    `.split('\n').map(line => line.trim()).filter(line => line).join('\n'));

    return true;
  }
  catch (e) {
    await logger(`<@${discordId}> ${maskedNik} :: [ERROR] ${e.message}`);
  }

  return false;
}

async function addEditIrk(discordId, msgData) {
  const release = await mtx.acquire();

  try {
    jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

    let userNik = null;
    let userPassword = null;
    let jamPagi = null;
    let jamSore = null;
    let lat = null;
    let lon = null;

    if (msgData.length === 2 || msgData.length === 4 || msgData.length === 5 || msgData.length === 6) {
      userNik = msgData[0];
      userPassword = msgData[1];

      if (msgData.length >= 4) {
        jamPagi = msgData[2];
        jamSore = msgData[3];
      }

      if (msgData.length === 5) {
        const coord = extractCoords(osmUrl);
        if (!coord.success) {
          return `<@${discordId}> ${userNik} :: [MAPS] ${coord.message}`;
        }

        lat = coord.lat;
        lon = coord.lon;
      }
      else if (msgData.length >= 6) {
        lat = msgData[4];
        lon = msgData[5];
      }
    }
    else if (discordId) {
      return `
        -----
        ❗ Format Yang Dibutuhkan 2/4/5/6 Data (Depannya Harus Tag Saya) <@306076547616473089>
        -----
        'userNik<SPASI>password'
        => 1234567890 MyPass123$%^
        -----
        'userNik<SPASI>password<SPASI>jamMenitPagi<SPASI>jamMenitSore'
        => 1234567890 MyPass123$%^ 7 19
        -----
        'userNik<SPASI>password<SPASI>jamMenitPagi<SPASI>jamMenitSore<SPASI>urlOsm'
        => 1234567890 MyPass123$%^ 7 19 https://www.openstreetmap.org/#map=5/-72.4522217/0.9438507
        -----
        'userNik<SPASI>password<SPASI>jamMenitPagi<SPASI>jamMenitSore<SPASI>LatitudeY<SPASI>LongitudeX'
        => 1234567890 MyPass123$%^ 7 19 -72.4522217 -0.9438507
        -----
        Silahkan Ambil Lat(Y) Lon(X) Dari https://www.openstreetmap.org/#map=ZOOM/LATITUDE/LONGITUDE
        -----
      `.split('\n').map(line => line.trim()).filter(line => line).join('\n');
    }
    else {
      return '❗ Format Salah / Data Tidak Lengkap!';
    }

    let alamat = null;
    if (lat || lon) {
      alamat = await cekAlamatReal(lat, lon);
      if (!alamat.success) {
        return `<@${discordId}> ${userNik} :: [KOORDINAT] Alamat Tidak Tersedia, Silahkan Ambil Lat(Y) Lon(X) Dari URL OpenStreetMap / GoogleMap`;
      }
    }

    const loginResponse = await login(userNik, userPassword);
    _tempResponseData = await loginResponse.json();
    if (!loginResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      return `<@${discordId}> ${userNik} :: [LOGIN] ${errMsg}`;
    }

    const maxPagi = toMinutes('09:00');
    const minSore = toMinutes('16:59');

    if (jamPagi) {
      if (!isValidTime(jamPagi)) {
        return `<@${discordId}> ${userNik} :: [PAGI] Format 'hh24:mm' (Pakai : Titik 2) Tidak Valid`;
      }

      if (jamPagi >= maxPagi && jamPagi <= minSore) {
        return `<@${discordId}> ${userNik} :: [PAGI] Waktu Berada Di Rentang Waktu Yang Salah / Telat Masuk`;
      }

      if (!jamPagi.includes(':')) {
        jamPagi = `${jamPagi.toString().padStart(2, '0')}:00`;
      }
    }
    else {
      jamPagi = null;
    }

    if (jamSore) {
      if (!isValidTime(jamSore)) {
        return `<@${discordId}> ${userNik} :: [SORE] Format 'hh24:mm' Tidak Valid`;
      }

      if (jamSore >= maxPagi && jamSore <= minSore) {
        return `<@${discordId}> ${userNik} :: [SORE] Waktu Berada Di Rentang Waktu Yang Salah / Pulang Lebih Awal`;
      }

      if (!jamSore.includes(':')) {
        jamSore = `${jamSore.toString().padStart(2, '0')}:00`;
      }
    }
    else {
      jamSore = null;
    }

    const idx = jsonData.irk.accounts.findIndex(d => d.nik === userNik);
    if (idx >= 0) {
      if (discordId) {
        jsonData.irk.accounts[idx].authorId = discordId;
      }
      jsonData.irk.accounts[idx].password = userPassword;
      jsonData.irk.accounts[idx].targetPagi = jamPagi;
      jsonData.irk.accounts[idx].targetSore = jamSore;
      jsonData.irk.accounts[idx].latitude = lat;
      jsonData.irk.accounts[idx].longitude = lon;
      jsonData.irk.accounts[idx].inactive = false;
      jsonData.irk.accounts[idx].error_count = 0;
    }
    else {
      jsonData.irk.accounts.push({
        authorId: discordId,
        nik: userNik,
        password: userPassword,
        targetPagi: jamPagi,
        targetSore: jamSore,
        latitude: lat,
        longitude: lon,
        inactive: false,
        error_count: 0
      });
    }

    fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
    jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

    return `
      <@${discordId}> ${userNik}
      (Target Pagi = ${jamPagi}, Sore = ${jamSore} +:30/)
      [Lat (Y) = ${lat}, Lon (X) = ${lon}]
      ${alamat.mapLinks.join('\n')}
      OSM :: ${alamat.openStreetMap}
      GM :: ${alamat.googleMap}
    `.split('\n').map(line => line.trim()).filter(line => line).join('\n');
  }
  finally {
    release();
  }
}

async function refreshPassword(discordId, userNik, userPassword, discordClient = null) {
  const maskedNik = userNik.length > 4 ? userNik.substring(0, 2) + '*'.repeat(userNik.length - 4) + userNik.substring(userNik.length - 2) : userNik;

  const logger = (msg) => logNotify(msg, userNik, discordClient);

  const url = `${jsonData.irk.refreshPasswordUri}/PortalV2`;

  const options = {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': `${jsonData.irk.refreshPasswordOrigin}`,
      'Referer': `${jsonData.irk.refreshPasswordOrigin}/`
    }
  };

  try {
    options.body = JSON.stringify({
      Data: {
        code: "201",
        parm: {
          nik: userNik,
          parmPass: {
            oldPass: userPassword,
            newPass: REFRESH_PASSWORD
          }
        }
      }
    });

    const res1 = await fetchWithTimeout(url, options);
    const data1 = await res1.json();

    if (!res1.ok || data1.Code < 200 || data1.Code > 299) {
      const errMsg = data1.Result?.result || data1.Message || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PASSWORD_TEMPORARY] ${errMsg}`);
      return false;
    }

    options.body = JSON.stringify({
      Data: {
        code: "201",
        parm: {
          nik: userNik,
          parmPass: {
            oldPass: REFRESH_PASSWORD,
            newPass: userPassword
          }
        }
      }
    });

    const res2 = await fetchWithTimeout(url, options);
    const data2 = await res2.json();
    if (!res2.ok || data2.Code < 200 || data2.Code > 299) {
      const errMsg = data2.Result?.result || data2.Message || 'Terjadi Kesalahan ~';
      await logger(`<@${discordId}> ${maskedNik} :: [PASSWORD_ORIGINAL] ${errMsg}`);
      return false;
    }

    return true;
  }
  catch (e) {
    await logger(`<@${discordId}> ${maskedNik} :: [PASSWORD_REFRESH] ${e.message}`);
    return false;
  }
}

// --

async function runCronJobSchedulerIrk(current_date, discordClient = null, forceRun = false) {
  const currentMins = current_date.getHours() * 60 + current_date.getMinutes();
  const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);
  const dayName = current_date.toLocaleString('id-ID', { weekday: 'long' });

  for (const credential of jsonData.irk.accounts) {
    if (credential.inactive) {
      continue;
    }

    let startMins = null;
    let endMins = null;

    let isNeedRunBerangkat = false;
    let isNeedRunPulang = false;

    // Berangkat
    startMins = toMinutes('00:00');
    endMins = toMinutes('07:59');

    if (credential.targetPagi) {
      startMins = toMinutes(credential.targetPagi);
      if (startMins >= toMinutes('08:00')) {
        endMins = toMinutes('08:59');
      }
    }

    const targetBerangkat = currentMins >= startMins && currentMins <= endMins;
    if (!credential.berangkat && targetBerangkat) {
      isNeedRunBerangkat = true;
    }
    else if (credential.berangkat) {
      const lastRunString = new Date(credential.berangkat).toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta'
      });
      const lastRunDate = new Date(lastRunString);
      const lastRunFormatted = getFormattedDate(lastRunDate);

      if (current_yyyyMMdd_dashHyphens !== lastRunFormatted && targetBerangkat) {
        isNeedRunBerangkat = true;
      }
    }

    // Pulang
    startMins = toMinutes('18:00');
    endMins = toMinutes('23:59');

    if (credential.targetSore) {
      startMins = toMinutes(credential.targetSore);
    }

    if (dayName === 'Jumat') {
      startMins += 30;
      if (startMins > endMins) {
        startMins = endMins;
      }
    }

    const targetPulang = currentMins >= startMins && currentMins <= endMins;
    if (!credential.pulang && targetPulang) {
      isNeedRunPulang = true;
    }
    else if (credential.pulang) {
      const lastRunString = new Date(credential.pulang).toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta'
      });
      const lastRunDate = new Date(lastRunString);
      const lastRunFormatted = getFormattedDate(lastRunDate);

      if (current_yyyyMMdd_dashHyphens !== lastRunFormatted && targetPulang) {
        isNeedRunPulang = true;
      }
    }

    let checkOnly = false;
    if (current_date.getHours() === 0 && current_date.getMinutes() === 0) {
      const res = await refreshPassword(
        credential.authorId,
        credential.nik,
        credential.password,
        discordClient
      );

      if (res) {
        checkOnly = true;
      }
    }

    // Run
    if (forceRun || isNeedRunBerangkat || isNeedRunPulang || checkOnly) {
      let res = false;
      if (dayName === 'Sabtu' || dayName === 'Minggu') {
        res = true;
      }
      else {
        res = await startIrk(
          current_date,
          credential.authorId,
          credential.nik,
          credential.password,
          credential.latitude,
          credential.longitude,
          discordClient,
          checkOnly
        );
      }

      if (res) {
        if (isNeedRunBerangkat) {
          credential.berangkat = new Date().toISOString();
        }
        else if (isNeedRunPulang) {
          credential.pulang = new Date().toISOString();
        }

        fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
      }
    }

  }
}

async function runCronJobSchedulerCleanUp(nowJakarta, discordClient = null) {
  if (!discordClient) {
    return;
  }

  const guild = discordClient.guilds.get(jsonData.irk.guildId);
  const channel = guild.channels.get(jsonData.irk.channelId);

  // Start of Yesterday (00:00:00)
  const startOfYesterday = new Date(nowJakarta);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const startTs = startOfYesterday.getTime();

  // End of Yesterday (23:59:59)
  const endOfYesterday = new Date(nowJakarta);
  endOfYesterday.setDate(endOfYesterday.getDate() - 1);
  endOfYesterday.setHours(23, 59, 59, 999);
  const endTs = endOfYesterday.getTime();

  let lastId = null;
  let fetching = true;

  while (fetching) {
    const options = {
      limit: 100
    };

    if (lastId) {
      options.before = lastId;
    }

    const messages = await channel.fetchMessages(options);
    if (messages.size === 0) {
      break;
    }

    const toDelete = [];
    for (const msg of messages.values()) {
      const msgCreatedDate = new Date(msg.createdTimestamp);
      const msgCreatedDateJakarta = getCurrentJakartaDate(msgCreatedDate);
      const tsJakarta = msgCreatedDateJakarta.getTime();

      const candidate = tsJakarta >= startTs && // After or at 00:00 yesterday
        tsJakarta <= endTs && // Before or at 23:59 yesterday
        msg.author.id === discordClient.user.id &&
        msg.content?.startsWith(`<@`);

      if (candidate) {
        if (
          !msg.content.toLowerCase().includes('Failed'.toLowerCase()) &&
          !msg.content.toLowerCase().includes('Error'.toLowerCase()) &&
          !msg.content.toLowerCase().includes('Gagal'.toLowerCase()) &&
          !msg.content.toLowerCase().includes('Login'.toLowerCase())
        ) {
          toDelete.push(msg);
        }
      }
    }

    for (const msg of toDelete) {
      try {
        await msg.delete();
        await new Promise(res => setTimeout(res, 1234));
      }
      catch (err) {
        console.error('Delete failed:', err);
      }
    }

    lastId = messages.last().id;
    if (messages.last().createdTimestamp < startTs) {
      fetching = false;
    }
  }
}

// --

function startCron(discordClient = null) {
  // Sync NTP Offset saat startup dan setiap 15 menit di background
  syncNtpOffset();

  cron.schedule('*/15 * * * *', () => {
    syncNtpOffset();
  });

  // Setiap Menit Ke-0
  cron.schedule('* * * * *', async () => {
    if (isPresensiRunning) {
      console.log('Presensi Masih Berjalan ...');
      return;
    }

    try {
      isPresensiRunning = true;
      jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));
      await delay(15 * 1000);
      const current_date = getCurrentJakartaDate();
      await runCronJobSchedulerIrk(current_date, discordClient);
    }
    catch (err) {
      console.error('IRK failed', err);
    }
    finally {
      isPresensiRunning = false;
    }
  });

  // Run Cleanup Cron sekali sehari pada pukul 00:00 WIB
  cron.schedule('0 0 * * *', async () => {
    if (isCleanupRunning) {
      console.log('Cleanup Masih Berjalan ...');
      return;
    }

    try {
      isCleanupRunning = true;
      await delay(15 * 1000);
      const nowJakarta = getCurrentJakartaDate();
      await runCronJobSchedulerCleanUp(nowJakarta, discordClient);
    }
    catch (e) {
      console.error('Fetching history failed', e);
    }
    finally {
      isCleanupRunning = false;
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  cron.schedule('0 0 * * *', async () => {
    const release = await mtx.acquire();
    try {
      if (fs.existsSync(logFile)) {
        const fileData = fs.readFileSync(logFile, { encoding: 'utf8' });
        let logs = fileData.trim() ? JSON.parse(fileData) : [];

        logs = logs.filter(l => {
          const msg = l.message.toLowerCase();
          return msg.includes('failed') || msg.includes('error') || msg.includes('gagal') || msg.includes('login');
        });

        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        console.log(`[🧹 Log File] File log sukses di-filter (Menyisakan ${logs.length} catatan error)`);
      }
    }
    catch (e) {
      console.error('Gagal memfilter log file:', e);
    }
    finally {
      release();
    }
  }, {
    timezone: 'Asia/Jakarta' // Wajib supaya pas jam 00:00 WIB / 02:00 JST Server
  });
}

module.exports = {
  addEditIrk,
  startCron,
  infoCoordAddr
}