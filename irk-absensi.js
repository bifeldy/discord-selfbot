const crypto = require('node:crypto');
const fs = require('node:fs');

const cron = require('node-cron');
const fetch = require('node-fetch');
const ntpClient = require('ntp-client');

/**
 * 
 * KOCAK .. BALIKAN HTTP STATUS CODE SELALU 200
 * TAPI PAKENYA DI BODY
 * WKWKWK
 * 
 * https://www.reddit.com/r/ProgrammerHumor/comments/jnb9fa/when_you_only_validate_the_http_code_of_the/
 * 
 */

let isJobRunning = false;

// --

const jsonConfig = 'config.json';
const jsonFile = fs.readFileSync(jsonConfig, { encoding: 'utf8' });
const jsonData = JSON.parse(jsonFile);

// -- --

const baseUri = jsonData.irk.baseUri;

const defaultHeader = {
  'user-agent': 'Mobile-app',
  'device-agent': 'Android/UP1A.230905.011',
  'device': 'mobile',
  'content-type': 'application/json',
  // 'firebase-key': 'ANAK_SETAN'
};

// -- --

const delay = (ms) => new Promise(resolve => {
  const timer = setInterval(() => {
    clearInterval(timer);
    resolve();
  }, ms);
});

const isValidTime = (val) => {
  if (!val.includes(':')) {
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

const ntpServers = [
  'ntp.bmkg.go.id',
  'time.cloudflare.com',
  'time.google.com'
];

async function getNtpDate() {
  for (const server of ntpServers) {
    try {
      const date = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout pada server ${server}`));
        }, 3000);

        const [ipHost, portStr] = server.split(':');
        const port = portStr ? parseInt(portStr) : 123;

        ntpClient.getNetworkTime(ipHost, port, (err, date) => {
          clearTimeout(timeout);

          if (err) {
            return reject(err);
          }

          resolve(date);
        });
      });

      return date;
    }
    catch (e) {
      // Check Next ~
    }
  }

  throw new Error("Semua server NTP gagal dijangkau.");
}

async function getCurrentJakartaDate(ntpDate = null) {
  if (!ntpDate) {
    ntpDate = await getNtpDate();
  }

  const jakartaString = ntpDate.toLocaleString('en-US', {
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

const MASTER_KEY = jsonData.irk.masterKey;

const userLong = 'eyJpdiI6InJJSEh2QjFLL2prd05keWZBRHpTN0E9PSIsInZhbHVlIjoiSXZjcVMwWW9OMVIwbXJJWXJOMHNTQT09In0=';
const userLat = 'eyJpdiI6ImRQM3hIRnI5SDREMThXaWdVZU0rWGc9PSIsInZhbHVlIjoicFRLcVBvd1ZZV3Z1cnM0cHYzZ2pzUT09In0=';

function laraEncrypt(plainText) {
  const key = Buffer.from(MASTER_KEY, 'base64');
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
  const key = Buffer.from(MASTER_KEY, 'base64');

  const jsonString = Buffer.from(base64Payload, 'base64').toString('utf8');
  const data = JSON.parse(jsonString);

  const iv = Buffer.from(data.iv, 'base64');
  const encryptedValue = Buffer.from(data.value, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function cekAlamatReal(long, lat) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lon=${long}&lat=${lat}`;

  const options = {
    method: 'GET',
    headers: defaultHeader
  };

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.display_name;
}

// -- --

async function login(userNik, userPassword) {
  const url = `${baseUri}/login`;

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

  return fetch(url, options);
}

async function worker(userNik, cookies) {
  const url = `${baseUri}/worker`;

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

  return fetch(url, options);
}

async function presensiwfh(current_date, userNik, cookies, bulan = null, tahun = null) {
  const url = `${baseUri}/presensiwfh`;

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

  return fetch(url, options);
}

async function presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies, getTimeOnly = true) {
  const url = `${baseUri}/presensi/get`;

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

  return fetch(url, options);
}

async function presensipost(userNik, cookies, long = '-0.9438507', lat = '-72.4522217') {
  const url = `${baseUri}/presensi/post`;

  const encLong = MASTER_KEY ? userLong : laraEncrypt(long);
  const encLat = MASTER_KEY ? userLat : laraEncrypt(lat);

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

  return fetch(url, options);
}

// -- --

async function startIrk(current_date, discordId, userNik, userPassword, long = null, lat = null, discordClient = null) {
  let logger = console.log;

  try {
    if (discordClient) {
      // IDM-IT-SD-03 :: 🚮︱bot-spam
      const guild = discordClient.guilds.get(jsonData.irk.guildId);
      const channel = guild.channels.get(jsonData.irk.channelId);
      logger = channel.send.bind(channel);
    }

    let _tempResponseData = null;

    const loginResponse = await login(userNik, userPassword);
    _tempResponseData = await loginResponse.json();
    if (!loginResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'User Name / Password = Salah / Expired, Silahkan Set Ulang';
      logger(`<@${discordId}> ${userNik} :: [LOGIN] ${errMsg}`);
      jsonData.irk.accounts = jsonData.irk.accounts.filter(d => d.nik !== userNik);
      fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
      return false;
    }

    let cookies = loginResponse.headers.raw()['set-cookie']
      .map(c => c.split(';')[0])
      .join('; ');

    const workerResponse = await worker(userNik, cookies);
    _tempResponseData = await workerResponse.json();
    if (!workerResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      logger(`<@${discordId}> ${userNik} :: [WORKER] ${errMsg}`);
      return false;
    }

    if (!_tempResponseData.data.user_irk) {
      logger(`<@${discordId}> ${userNik} :: [AKUN] Bukan User Untuk Aplikasi IRK ~`);
      return true;
    }

    const isPresensiAvailable = _tempResponseData.data.isPresensiAvailable;

    const presensiwfhResponse = await presensiwfh(current_date, userNik, cookies);
    _tempResponseData = await presensiwfhResponse.json();
    if (!presensiwfhResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      logger(`<@${discordId}> ${userNik} :: [PRESENSIWFH] ${errMsg}`);
      return false;
    }

    const tanggal_wfh = _tempResponseData.data[0].tanggal_wfh;
    const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);
    const isTargetWfhToday = tanggal_wfh.includes(current_yyyyMMdd_dashHyphens);

    if (!isPresensiAvailable || !isTargetWfhToday) {
      logger(`<@${discordId}> ${userNik} :: [JADWAL] Tidak Ada WFH, Mungkin Masuk Kantor / Libur Nasional ~`);
      return true;
    }

    let presensigetResponse = await presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      logger(`<@${discordId}> ${userNik} :: [PRESENSIGET_TIME] ${errMsg}`);
      return false;
    }

    const jamAbsen = _tempResponseData.data[0];
    const jamMasuk = jamAbsen.machinein;
    let jamKeluar = null;
    const dayName = current_date.toLocaleString('id-ID', { weekday: 'long' });
    if (dayName === 'Jumat') {
      jamKeluar = jamAbsen.machineout_jumat;
    }
    else {
      jamKeluar = jamAbsen.machineout
    }

    const presensipostResponse = await presensipost(userNik, cookies, long, lat);
    _tempResponseData = await presensipostResponse.json();
    if (!presensipostResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      logger(`<@${discordId}> ${userNik} :: [PRESENSIPOST] ${errMsg}`);
      return false;
    }

    presensigetResponse = await presensiget(current_yyyyMMdd_dashHyphens, userNik, cookies, false);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299 || _tempResponseData.status === 0) {
      const errMsg = _tempResponseData.message || _tempResponseData.result || 'Terjadi Kesalahan ~';
      logger(`<@${discordId}> ${userNik} :: [PRESENSIGET_HISTORY] ${errMsg}`);
      return errMsg?.toUpperCase().trim() === 'SUDAH ADA DATA PRESENSI MASUK UNTUK HARI INI' ? true : false;
    }

    if (_tempResponseData.data.length <= 0) {
      logger(`<@${discordId}> ${userNik} :: [JADWAL] Belum Ada Data WFH, Periksa Juga Tanggal Untuk Ikut Ke Asia/Jakarta ~`);
      return true;
    }

    const riwayatAbsen = _tempResponseData.data[0];
    const absenMasukJam = riwayatAbsen.machinein || '??';
    const absenKeluarJam = riwayatAbsen.machineout || '??';
    const absenMasukLokasi = riwayatAbsen.location_in?.join(', ') || '??, ??';
    const absenKeluarLokasi = riwayatAbsen.location_out?.join(', ') || '??, ??';
    logger(`
      <@${discordId}> ${userNik} :: ${dayName}
      [BERANGKAT] ${jamMasuk} => ${absenMasukJam} | (${absenMasukLokasi})
      [PULANG] ${jamKeluar} => ${absenKeluarJam} | (${absenKeluarLokasi})
    `.split('\n').map(line => line.trim()).filter(line => line).join('\n'));

    return true;
  }
  catch (e) {
    logger(`<@${discordId}> ${userNik} :: [ERROR] ${e.message}`);
  }

  return false;
}

async function addEditIrk(discordId, msgData) {
  let userNik = null;
  let userPassword = null;
  let jamPagi = null;
  let jamSore = null;
  let long = null;
  let lat = null;

  if (msgData.length === 2 || msgData.length === 4 || msgData.length === 6) {
    userNik = msgData[0];
    userPassword = msgData[1];

    if (msgData.length >= 4) {
      jamPagi = msgData[2];
      jamSore = msgData[3];
    }

    if (msgData.length >= 6) {
      long = msgData[4];
      lat = msgData[5];
    }
  }
  else {
    return `
      -----
      ❗ Format Yang Dibutuhkan 2/4/6 Data (Depannya Harus Tag Saya) <@306076547616473089>
      -----
      'userNik<SPASI>password'
      => 1234567890 MyPass123$%^
      -----
      'userNik<SPASI>password<SPASI>jamMenitPagi<SPASI>jamMenitSore'
      => 1234567890 MyPass123$%^ 7 19
      -----
      'userNik<SPASI>password<SPASI>jamMenitPagi<SPASI>jamMenitSore<SPASI>LongitudeX<Spasi>LatitudeY'
      => 1234567890 MyPass123$%^ 7 19 -0.9438507 -72.4522217
      -----
    `.split('\n').map(line => line.trim()).filter(line => line).join('\n');
  }

  let alamat = null;
  if (long || lat) {
    try {
      alamat = await cekAlamatReal(long, lat);
      if (!alamat) {
        return `<@${discordId}> ${userNik} :: [KOORDINAT] Alamat Tidak Tersedia, Silahkan Ambil Long(X) Lat(Y) Dari https://www.openstreetmap.org`;
      }
    }
    catch (e) {
      return `<@${discordId}> ${userNik} :: [ALAMAT] ${e.message}`;
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
      return `<@${discordId}> ${userNik} :: [PAGI] Format 'hh24:mm' Tidak Valid`;
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
    jsonData.irk.accounts[idx].authorId = discordId;
    jsonData.irk.accounts[idx].password = userPassword;
    jsonData.irk.accounts[idx].targetPagi = jamPagi;
    jsonData.irk.accounts[idx].targetSore = jamSore;
    jsonData.irk.accounts[idx].longitude = long;
    jsonData.irk.accounts[idx].latitude = lat;
  }
  else {
    jsonData.irk.accounts.push({
      authorId: discordId,
      nik: userNik,
      password: userPassword,
      targetPagi: jamPagi,
      targetSore: jamSore,
      longitude: long,
      latitude: lat
    });
  }

  fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
  return `<@${discordId}> ${userNik} :: (Target Pagi = ${jamPagi}, Sore = ${jamSore} +:30/), [Long (X) = ${long}, Lat (Y) = ${lat}] ${alamat}`;
}

// --

async function runCronJobSchedulerIrk(current_date, discordClient = null) {
  const currentMins = current_date.getHours() * 60 + current_date.getMinutes();
  const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);
  const dayName = current_date.toLocaleString('id-ID', { weekday: 'long' });

  for (const credential of jsonData.irk.accounts) {
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

    // Run
    if (isNeedRunBerangkat || isNeedRunPulang) {
      const res = await startIrk(
        current_date,
        credential.authorId,
        credential.nik,
        credential.password,
        credential.longitude,
        credential.latitude,
        discordClient
      );

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
      const msgCreatedDateJakarta = await getCurrentJakartaDate(msgCreatedDate);
      const tsJakarta = msgCreatedDateJakarta.getTime();

      const candidate = tsJakarta >= startTs && // After or at 00:00 yesterday
        tsJakarta <= endTs &&   // Before or at 23:59 yesterday
        msg.author.id === discordClient.user.id &&
        msg.content?.startsWith(`<@`);

      if (candidate) {
        toDelete.push(msg);
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
  // Server Restart 6 Jam Sekali :: Hindari detik / menit ke-0

  // Setiap Menit Ke-0
  cron.schedule('* * * * *', async () => {
    if (isJobRunning) {
      console.log('Previous job still running. Skipping this run.');
      return;
    }

    try {
      isJobRunning = true;
      await delay(15 * 1000);
      const current_date = await getCurrentJakartaDate();
      await runCronJobSchedulerIrk(current_date, discordClient);
    }
    catch (err) {
      console.error('IRK failed', err);
    }
    finally {
      isJobRunning = false;
    }
  });

  // Setiap Menit Ke-0
  cron.schedule('* * * * *', async () => {
    try {
      await delay(15 * 1000);
      const nowJakarta = await getCurrentJakartaDate();
      await runCronJobSchedulerCleanUp(nowJakarta, discordClient);
    }
    catch (e) {
      console.error('Fetching history failed', e);
    }
  });
}

module.exports = {
  addEditIrk,
  startCron
}