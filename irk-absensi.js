const fs = require('node:fs');

const cron = require('node-cron');
const fetch = require('node-fetch');

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

const userLong = 'eyJpdiI6InJJSEh2QjFLL2prd05keWZBRHpTN0E9PSIsInZhbHVlIjoiSXZjcVMwWW9OMVIwbXJJWXJOMHNTQT09In0\u003d';
const userLat = 'eyJpdiI6ImRQM3hIRnI5SDREMThXaWdVZU0rWGc9PSIsInZhbHVlIjoicFRLcVBvd1ZZV3Z1cnM0cHYzZ2pzUT09In0\u003d';

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

const isValidHour = (val) => {
  const num = parseFloat(val);
  return typeof val === 'string' && !isNaN(num) && num >= 0 && num < 24;
};

function getCurrentJakartaDate() {
  const jakartaString = new Date().toLocaleString('en-US', {
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

async function presensiwfh(userNik, cookies, bulan = null, tahun = null) {
  const current_date = getCurrentJakartaDate();
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

async function presensiget(userNik, cookies, getTimeOnly = true) {
  const current_date = getCurrentJakartaDate();
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
    const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);

    options.body = JSON.stringify({
      userid: userNik,
      tglAwal: current_yyyyMMdd_dashHyphens,
      tglAkhir: current_yyyyMMdd_dashHyphens
    });
  }

  return fetch(url, options);
}

async function presensipost(userNik, cookies) {
  const url = `${baseUri}/presensi/post`;

  const options = {
    method: 'POST',
    headers: {
      ...defaultHeader,
      'device-agent': `${defaultHeader['device-agent']}_${userNik}`,
      'Cookie': cookies
    },
    body: JSON.stringify({
      userid: userNik,
      latitude: userLat,
      longitude: userLong
    })
  };

  return fetch(url, options);
}

// -- --

async function startIrk(discordClient = null, discordId, userNik, userPassword) {
  let logger = console.log;

  try {
    const current_date = getCurrentJakartaDate();

    // IDM-IT-SD-03 :: 🚮︱bot-spam
    if (discordClient) {
      const guild = discordClient.guilds.get(jsonData.irk.guildId);
      const channel = guild.channels.get(jsonData.irk.channelId);
      logger = channel.send.bind(channel);
    }

    let _tempResponseData = null;

    const loginResponse = await login(userNik, userPassword);
    _tempResponseData = await loginResponse.json();
    if (!loginResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
    }

    let cookies = loginResponse.headers.raw()['set-cookie']
      .map(c => c.split(';')[0])
      .join('; ');

    const workerResponse = await worker(userNik, cookies);
    _tempResponseData = await workerResponse.json();
    if (!workerResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
    }

    if (!_tempResponseData.data.user_irk) {
      logger(`<@${discordId}> ${userNik} :: [USER] Bukan User Untuk Aplikasi IRK ~`);
      return;
    }

    const isPresensiAvailable = _tempResponseData.data.isPresensiAvailable;

    const presensiwfhResponse = await presensiwfh(userNik, cookies);
    _tempResponseData = await presensiwfhResponse.json();
    if (!presensiwfhResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
    }

    const tanggal_wfh = _tempResponseData.data[0].tanggal_wfh;
    const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);
    const isTargetWfhToday = tanggal_wfh.includes(current_yyyyMMdd_dashHyphens);

    if (!isPresensiAvailable || !isTargetWfhToday) {
      logger(`<@${discordId}> ${userNik} :: [JADWAL] Tidak Ada WFH, Mungkin Masuk Kantor / Libur Nasional ~`);
      return;
    }

    let presensigetResponse = await presensiget(userNik, cookies);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
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

    const presensipostResponse = await presensipost(userNik, cookies);
    _tempResponseData = await presensipostResponse.json();
    if (!presensipostResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
    }

    presensigetResponse = await presensiget(userNik, cookies, false);
    _tempResponseData = await presensigetResponse.json();
    if (!presensigetResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
      return;
    }

    if (_tempResponseData.data.length <= 0) {
      logger(`<@${discordId}> ${userNik} :: [JADWAL] Belum Ada Data WFH, Periksa Juga Tanggal Untuk Ikut Ke Asia/Jakarta ~`);
      return;
    }

    const riwayatAbsen = _tempResponseData.data[0];
    const absenMasukJam = riwayatAbsen.machinein;
    const absenKeluarJam = riwayatAbsen.machineout;
    const absenMasukLokasi = riwayatAbsen.location_in?.join(', ');
    const absenKeluarLokasi = riwayatAbsen.location_out?.join(', ');
    logger(`
      <@${discordId}> ${userNik}
      [ABSENSI_BERANGKAT] ${absenMasukJam} => ${absenMasukLokasi}
      [ABSENSI_PULANG] ${absenKeluarJam} => ${absenKeluarLokasi}
    `.replace(/\s+/g, ' '));
  }
  catch (e) {
    logger(`<@${discordId}> ${userNik} :: [ERROR] ${e.message}`);
  }
}

async function addEditIrk(discordId, userNik, userPassword, jamPagi = null, jamSore = null) {
  if (!isValidHour(jamPagi) || !isValidHour(jamSore)) {
    return false;
  }

  const pagi = parseFloat(jamPagi);
  const sore = parseFloat(jamSore);

  const loginResponse = await login(userNik, userPassword);
  _tempResponseData = await loginResponse.json();
  if (!loginResponse.ok || _tempResponseData.statuscode < 200 || _tempResponseData.statuscode > 299) {
    return false;
  }

  const idx = jsonData.irk.accounts.findIndex(d => d.nik === userNik);
  if (idx >= 0) {
    jsonData.irk.accounts[idx].authorId = discordId;
    jsonData.irk.accounts[idx].password = userPassword;
    jsonData.irk.accounts[idx].targetPagi = pagi;
    jsonData.irk.accounts[idx].targetSore = sore;
  }
  else {
    jsonData.irk.accounts.push({
      authorId: discordId,
      nik: userNik,
      password: userPassword,
      targetPagi: pagi,
      targetSore: sore
    });
  }

  fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
  return true;
}

async function runCronJobScheduler(discordClient = null) {
  const current_date = getCurrentJakartaDate();
  const current_yyyyMMdd_dashHyphens = getFormattedDate(current_date);

  for (const credential of jsonData.irk.accounts) {
    let isNeedRunBerangkat = false;
    let isNeedRunPulang = false;

    // Berangkat
    let targetBerangkat = current_date.getHours() >= 0 && current_date.getHours() <= 3;
    if (credential.targetPagi) {
      targetBerangkat = current_date.getHours() === credential.targetPagi;
    }

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
    let targetPulang = current_date.getHours() >= 21 && current_date.getHours() <= 23;
    if (credential.targetSore) {
      targetPulang = current_date.getHours() === credential.targetSore;
    }

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
      await startIrk(discordClient, credential.authorId, credential.nik, credential.password);

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

function startCron(discordClient = null) {
  cron.schedule('* * * * *', async () => {
    if (isJobRunning) {
      console.log('Previous job still running. Skipping this run.');
      return;
    }
    try {
      isJobRunning = true;
      await delay(10 * 1000);
      await runCronJobScheduler(discordClient);
    }
    finally {
      isJobRunning = false;
    }
  });
}

// runCronJobScheduler();

module.exports = {
  addEditIrk,
  startCron
}