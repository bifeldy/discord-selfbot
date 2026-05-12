const crypto = require('node:crypto');
const fs = require('node:fs');
const readline = require('node:readline');

const { Client, TextChannel, version } = require('discord.js');
const { fastify } = require('fastify');
const { Mutex } = require('async-mutex');

const fetch = require('node-fetch');
const webpush = require('web-push');

const { addEditIrk, startCron, infoCoordAddr } = require('./irk-absensi');

const mtx = new Mutex();

const jsonConfig = 'config.json';
let jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

if (!jsonData.vapid) {
  const vapidKeys = webpush.generateVAPIDKeys();
  jsonData.vapid = vapidKeys;
  fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
  console.log('[🔑 VAPID Keys] Kunci baru berhasil di-generate dan disimpan ke config!');
}

webpush.setVapidDetails(
  `mailto:${jsonData.botEmail}`,
  jsonData.vapid.publicKey,
  jsonData.vapid.privateKey
);

const server = new fastify({ logger: jsonData.logging });
const client = new Client();

// Go To Discord, Open DevTools (Ctrl + Shift + I), Under `Application` -> `Local Storage` -> `token`
// Put Your Token Here As String Into `DISCORD_LOGIN_TOKEN` Variable
let DISCORD_LOGIN_TOKEN = process.env.DISCORD_TOKEN || jsonData.token || null;

// Discord Emoji Ping / Tag
const emojiPing = jsonData.ping || [];

// Domain
const current_domain = jsonData.embedDomain;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

server.get('/oembed', (req, res) => {
  res.code(200).header('Content-Type', 'application/json; charset=utf-8').send({
    author_name: req.query.author_name,
    author_url: req.query.author_url,
    provider_name: req.query.site_name,
    provider_url: req.query.site_url,
    title: req.query.title,
    type: 'link',
    version: '1.0'
  });
});

server.get('/', (req, res) => {
  const site_name = req.query.site_name;
  const site_url = req.query.site_url;
  const title = req.query.title;
  const descriptions = req.query.descriptions;
  const author_name = req.query.author_name;
  const author_url = req.query.author_url;
  const image_url = req.query.image_url;
  const video_url = req.query.video_url;
  const width = req.query.width;
  const height = req.query.height;
  const mime = req.query.mime;
  const icon_url = req.query.icon_url;
  const imgTagSmall = `
    <meta name="og:image" property="og:image" content="${icon_url}" />
    <meta name="twitter:image" property="twitter:image" content="${icon_url}" />
  `;
  const imgTagBig = `
    <meta name="og:image" property="og:image" content="${image_url}" />
    <meta name="twitter:image" property="twitter:image" content="${image_url}" />
    <meta name="twitter:card" property="twitter:card" content="summary_large_image" />
  `;
  const vidTag = `
    <meta name="og:video" property="og:video" content="${video_url}" />
    <meta name="og:video:secure_url" property="og:video:secure_url" content="${video_url}" />
    <meta name="og:video:width" property="og:video:width" content="${width}" />
    <meta name="og:video:height" property="og:video:height" content="${height}" />
    <meta name="og:video:type" property="og:video:type" content="${mime}" />
    <meta property="twitter:card" content="player" />
    <meta name="twitter:player" property="twitter:player" content="${video_url}" />
    <meta name="twitter:player:stream" property="twitter:player:stream" content="${video_url}" />
    <meta name="twitter:player:width" property="twitter:player:width" content="${width}" />
    <meta name="twitter:player:height" property="twitter:player:height" content="${height}" />
    <meta name="twitter:player:stream:content_type" property="twitter:player:stream:content_type" content="${mime}" />
  `;
  let urlParam = ``;
  urlParam += `title=${encodeURIComponent(title)}`;
  urlParam += `&author_name=${encodeURIComponent(author_name)}`;
  urlParam += `&author_url=${encodeURIComponent(author_url)}`;
  urlParam += `&site_name=${encodeURIComponent(site_name)}`;
  urlParam += `&site_url=${encodeURIComponent(site_url)}`;
  res.code(200).header('Content-Type', 'text/html; charset=utf-8').send(`
    <!DOCTYPE html>
    <html lang="in">

      <head>
        <base href="/" />

        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta http-equiv="refresh" content="0; url=${site_url}" />

        <meta name="viewport" property="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" property="theme-color" content="#69f0ae" />

        <!-- Site Settings -->
        <title>${title}</title>

        <link rel="shortcut icon" href="${icon_url}" />
        <link rel="icon" href="${icon_url}" />
        <link rel="canonical" href="${site_url}" />
        <link rel="alternate" href="${current_domain}/oembed?${urlParam}" type="application/json+oembed" title="${title}" />

        <!-- Search Engine Settings -->
        <meta name="description" property="description" content="${descriptions}" />
        <meta name="keywords" property="keywords" content="${descriptions}" />
        <meta name="copyright" property="copyright" content="${site_name}" />
        <meta name="author" property="author" content="${author_name}" />

        <!-- Open Graph Protocol -->
        <meta name="og:type" property="og:type" content="article">
        <meta name="og:site_name" property="og:site_name" content="${site_name}" />
        <meta name="og:title" property="og:title" content="${title}" />
        <meta name="og:description" property="og:description" content="${descriptions}" />
        <meta name="og:url" property="og:url" content="${site_url}" />

        <!-- Twitter Card -->
        <meta name="twitter:site" property="twitter:site" content="${site_name}">
        <meta name="twitter:title" property="twitter:title" content="${title}" />
        <meta name="twitter:description" property="twitter:description" content="${descriptions}" />
        <meta name="twitter:creator" property="twitter:creator" content="${author_name}" />

        ${image_url?.trim() ? imgTagBig : imgTagSmall}
        ${video_url?.trim() ? vidTag : ''}

        <!-- Icon In The Highest Resolution We Need It For -->
        <link rel="icon" sizes="192x192" href="${icon_url}" />

        <!-- Reuse Same Icon For Safari -->
        <link rel="apple-touch-icon" href="${icon_url}" />
        <link rel="apple-touch-startup-image" href="${icon_url}" />

        <!-- Multiple Icons For IE -->
        <meta name="msapplication-square310x310logo" content="${icon_url}" />
      </head>

      <body>
        <!-- Empty -->
      </body>

    </html>
  `);
});

// Endpoint untuk menyimpan/mengupdate akun
server.post('/api/account', async (req, res) => {
  const release = await mtx.acquire();

  try {
    const payload = req.body;
    const msgData = [
      payload.nik,
      payload.password,
      payload.targetPagi,
      payload.targetSore,
      payload.latitude,
      payload.longitude
    ];

    const result = await addEditIrk(null, msgData);

    jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

    res.code(200).send({ success: true, message: result });
  }
  finally {
    release();
  }
});

// Proxy Endpoint: Pencarian Nama Jalan ke Koordinat (Google Maps)
server.get('/api/search-address', async (req, res) => {
  const query = req.query.q;
  const apiKey = jsonData.gcpApiKey;

  if (!query || !apiKey) return res.code(400).send({ error: 'Missing query or API Key' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const gMapRes = await fetch(url);
    const data = await gMapRes.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return res.code(200).send({
        lat: location.lat,
        lon: location.lng,
        address: data.results[0].formatted_address
      });
    }
    else {
      return res.code(404).send({ error: 'Alamat tidak ditemukan' });
    }
  }
  catch (e) {
    return res.code(500).send({ error: e.message });
  }
});

// Proxy Endpoint: Koordinat ke Nama Jalan (Google Maps)
server.get('/api/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = jsonData.gcpApiKey;

  if (!lat || !lon || !apiKey) return res.code(400).send({ error: 'Missing lat/lon or API Key' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    const gMapRes = await fetch(url);
    const data = await gMapRes.json();

    if (data.status === 'OK' && data.results.length > 0) {
      return res.code(200).send({ address: data.results[0].formatted_address });
    }
    else {
      return res.code(404).send({ error: 'Alamat tidak ditemukan' });
    }
  }
  catch (e) {
    return res.code(500).send({ error: e.message });
  }
});

server.get('/api/logs', async (req, res) => {
  try {
    const logFile = 'irk-logs.json';
    if (!fs.existsSync(logFile)) {
      return res.code(200).send([]);
    }

    const fileData = fs.readFileSync(logFile, { encoding: 'utf8' });
    const logs = fileData.trim() ? JSON.parse(fileData) : [];

    res.code(200).send(logs);
  }
  catch (err) {
    res.code(500).send({ error: err.message });
  }
});

server.get('/api/hash', (req, res) => {
  const nik = req.query.nik;
  if (!nik) {
    return res.code(200).send({ hash: null });
  }

  const hash = crypto.createHash('sha256').update(String(nik)).digest('hex');
  res.code(200).send({ hash });
});

server.get('/api/vapidPublicKey', (req, res) => {
  res.send({ publicKey: jsonData.vapid.publicKey });
});

server.post('/api/subscribe', async (req, res) => {
  const release = await mtx.acquire();
  try {
    const { nik, subscription } = req.body;
    if (!nik || !subscription) {
      return res.code(400).send({ error: 'Data tidak lengkap' });
    }

    let config = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));
    const idx = config.irk.accounts.findIndex(a => a.nik === nik);

    if (idx !== -1) {
      config.irk.accounts[idx].pushSubscription = subscription; // Simpan token browser!
      fs.writeFileSync(jsonConfig, JSON.stringify(config, null, 2));
      jsonData = config; // Update state memori global
      res.code(200).send({ success: true });
    }
    else {
      res.code(404).send({ error: 'NIK belum terdaftar, silahkan simpan data presensi terlebih dahulu!' });
    }
  } catch (err) {
    res.code(500).send({ error: err.message });
  } finally {
    release();
  }
});

server.get('/sw.js', (req, res) => {
  const swCode = `
    self.addEventListener('push', function(event) {
      let data = { title: 'IRK Absen Update', body: 'Ada aktivitas baru.' };
      if (event.data) {
        data = event.data.json();
      }

      const options = {
        body: data.body,
        icon: 'https://www.fansub.id/assets/img/favicon.png',
        badge: 'https://www.fansub.id/assets/img/favicon.png',
        vibrate: [200, 100, 200]
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    });

    self.addEventListener('notificationclick', function(event) {
      event.notification.close();
      event.waitUntil(clients.matchAll({ type: 'window' }).then(clientsArr => {
        const hadWindowToFocus = clientsArr.some(windowClient => windowClient.url === '/' ? (windowClient.focus(), true) : false);
        if (!hadWindowToFocus) {
          clients.openWindow('/');
        }
      }));
    });
  `;

  res.header('Content-Type', 'application/javascript').send(swCode);
});

server.get('/ui', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>IRK Auto-Absen</title>
      <link rel="shortcut icon" href="https://www.fansub.id/favicon.ico" />
      <link rel="icon" href="https://www.fansub.id/favicon.ico" />
      <link rel="icon" sizes="192x192" href="https://www.fansub.id/favicon.ico" />
      <link rel="apple-touch-icon" href="https://www.fansub.id/favicon.ico" />
      <link rel="apple-touch-startup-image" href="https://www.fansub.id/favicon.ico" />
      <meta name="msapplication-square310x310logo" content="https://www.fansub.id/favicon.ico" />
      <meta name="twitter:image" content="https://www.fansub.id/assets/img/favicon.png" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        body { font-family: sans-serif; background-color: #2c2f33; color: white; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: #23272a; padding: 20px; border-radius: 8px; }
        .form-row { display: flex; gap: 10px; margin-bottom: 15px; }
        .form-group { flex: 1; margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; color: #b9bbbe; }
        input { width: 100%; padding: 10px; box-sizing: border-box; border-radius: 4px; border: 1px solid #202225; background: #40444b; color: white; }
        input:focus { outline: none; border-color: #7289da; }
        button { width: 100%; padding: 12px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px; margin-top: 10px; }
        button:hover { background: #4752C4; }

        .search-container { display: flex; gap: 10px; margin-bottom: 10px; }
        .search-container input { flex: 3; }
        .search-container button { flex: 1; margin-top: 0; background: #3ba55c; }
        .search-container button:hover { background: #2d7d46; }

        #map-osm { height: 300px; width: 100%; border-radius: 8px; margin-bottom: 15px; border: 2px solid #40444b; }

        .btn-locate { background: #f04747; margin-bottom: 15px; }
        .btn-locate:hover { background: #d84040; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>
          <a href="https://discord.gg/aHCeSAaXTC" style="text-decoration: none; cursor: pointer; color: whitesmoke;">
            📍 IRK Auto-Absen
          </a>
        </h2>

        <form id="irkForm">
          <div class="form-row">
            <div class="form-group" style="margin-bottom: 0;">
              <label>NIK</label>
              <input type="text" id="nik" placeholder="1234567890" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Password</label>
              <input type="password" id="password" placeholder="***" required>
            </div>
          </div>

          <div class="form-row">
            <div style="text-align: center;">
              Karena ini hanya untuk biar ga lupa presensi saja,
              sebagai alat bantu dan bukan yang utama,
              disarankan untuk mengatur jam berangkat sesiang mungkin,
              misalnya mepet dan mendekati waktu masuk,
              lalu untuk jam pulang juga semalam mungkin,
              sebagai contoh mendekati ganti hari
              ~ (｡&gt;&#xFE4F;&lt;｡) ~
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Target Masuk (Pagi)</label>
              <input type="time" id="targetPagi" value="07:59" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Target Pulang (Sore)</label>
              <input type="time" id="targetSore" value="23:59" required>
            </div>
          </div>

          <label>Pilih Lokasi Absen (Peta [OpenStreetMap] & Pencarian GeoLoc [GoogleMaps])</label>
          <button type="button" class="btn-locate" onclick="getUserLocation()">🎯 Gunakan Lokasi Saat Ini (GPS)</button>

          <div class="search-container">
            <input type="text" id="searchBox" placeholder="Ketik nama jalan atau toko...">
            <button type="button" onclick="searchAddress()">🔍 Cari</button>
          </div>

          <div id="map-osm"></div>

          <div class="form-row">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Latitude (Y)</label>
              <input type="text" id="latitude" readonly required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Longitude (X)</label>
              <input type="text" id="longitude" readonly required>
            </div>
          </div>

          <button type="submit">💾 Simpan Data Akun</button>
        </form>

        <hr style="border-color: #40444b; margin: 15px 0 15px 0;" />

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="margin: 0;">
            📜 Live Log Absensi
          </h3>
          <button type="button" id="btnNotif" onclick="requestNotifPermission()" style="width: auto; padding: 6px 12px; font-size: 12px; background: #3ba55c; margin-top: 0;">
            🔔 Aktifkan Notifikasi
          </button>
        </div>

        <div id="logBox" style="background: #18191c; padding: 15px; border-radius: 8px; height: 128px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #a3a6aa; white-space: pre-wrap; border: 1px solid #202225;">
          Mohon menunggu ...
        </div>

        <hr style="border-color: #40444b; margin: 15px 0 15px 0;" />

        <h5 style="text-align: center; margin-top: 20px;">
          <a href="https://discord.gg/aHCeSAaXTC" style="text-decoration: none; cursor: pointer; color: whitesmoke;">
            Butuh Lihat Log Absensi (Detail) Lainnya ? https://discord.gg/aHCeSAaXTC !
          </a>
        </h5>

        <h5 style="text-align: center;">
          <a href="https://www.fanshare.id" style="text-decoration: none; cursor: pointer; color: whitesmoke;">
            Butuh Tempat File Sharing ? https://www.fanshare.id !
          </a>
        </h5>

        <h5 style="text-align: center;">
          <a href="https://www.fansub.id" style="text-decoration: none; cursor: pointer; color: whitesmoke;">
            Butuh Database Anime / Drama ? https://www.fansub.id !
          </a>
        </h5>
      </div>

      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

      <script>
        let currentLat = -6.1105416;
        let currentLon = 106.7393686;

        let osmMap, osmMarker;

        async function setLocation(lat, lon, fetchAddress = true) {
          currentLat = parseFloat(lat);
          currentLon = parseFloat(lon);

          document.getElementById('latitude').value = currentLat.toFixed(7);
          document.getElementById('longitude').value = currentLon.toFixed(7);

          if(osmMap && osmMarker) {
            osmMarker.setLatLng([currentLat, currentLon]);
            osmMap.setView([currentLat, currentLon], 16);
          }

          if (fetchAddress) {
            document.getElementById('searchBox').value = 'Mencari alamat via Google ...';
            try {
              const res = await fetch(\`/api/reverse-geocode?lat=\${currentLat}&lon=\${currentLon}\`);
              const data = await res.json();
              if (data.address) {
                document.getElementById('searchBox').value = data.address;
              }
              else {
                document.getElementById('searchBox').value = 'Alamat tidak ditemukan';
              }
            }
            catch (err) {
              document.getElementById('searchBox').value = 'Gagal memuat alamat dari Server';
            }
          }
        }

        osmMap = L.map('map-osm').setView([currentLat, currentLon], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(osmMap);
        osmMarker = L.marker([currentLat, currentLon], { draggable: true }).addTo(osmMap);

        osmMarker.on('dragend', function (e) {
            setLocation(e.target.getLatLng().lat, e.target.getLatLng().lng);
        });

        osmMap.on('click', function (e) {
            setLocation(e.latlng.lat, e.latlng.lng);
        });

        function getUserLocation() {
          if (navigator.geolocation) {
            document.getElementById('searchBox').value = 'Menunggu GPS HP/Komputer...';
            navigator.geolocation.getCurrentPosition(
              function(position) {
                setLocation(position.coords.latitude, position.coords.longitude);
              },
              function(error) {
                alert('Gagal mendapatkan lokasi GPS.');
                document.getElementById('searchBox').value = '';
              },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
          }
        }

        async function searchAddress() {
          const query = document.getElementById('searchBox').value;
          if (!query) {
            return;
          }

          const btn = document.querySelector('.search-container button');
          btn.innerText = "⏳";

          try {
            const res = await fetch(\`/api/search-address?q=\${encodeURIComponent(query)}\`);
            const data = await res.json();

            if (data.lat && data.lon) {
              setLocation(data.lat, data.lon, false);
              document.getElementById('searchBox').value = data.address;
            }
            else {
              alert('Alamat tidak ditemukan di sistem Google Maps.');
            }
          }
          catch (err) {
            alert('Gagal menghubungi server pencarian.');
          }
          btn.innerText = '🔍 Cari';
        }

        window.onload = function() {
          setLocation(currentLat, currentLon);

          const savedNik = localStorage.getItem('irk_saved_nik');
          if (savedNik) {
            document.getElementById('nik').value = savedNik;
          }
        };

        document.getElementById('irkForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          localStorage.setItem('irk_saved_nik', document.getElementById('nik').value);
          const payload = {
            nik: document.getElementById('nik').value,
            password: document.getElementById('password').value,
            targetPagi: document.getElementById('targetPagi').value,
            targetSore: document.getElementById('targetSore').value,
            latitude: document.getElementById('latitude').value,
            longitude: document.getElementById('longitude').value
          };
          const response = await fetch('/api/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const result = await response.json();
          alert(result.message);
        });

        let lastLogCount = 0;

        function urlB64ToUint8Array(base64String) {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding).replace(/\\-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);

          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }

          return outputArray;
        }

        async function requestNotifPermission() {
          const nik = document.getElementById('nik').value.trim();
          if (!nik) {
            return alert("Silahkan ketik NIK kamu dulu di form atas!");
          }

          localStorage.setItem('irk_saved_nik', nik);

          if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return alert("Browser kamu tidak mendukung Web Push Notification.");
          }

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            return alert("Izin notifikasi ditolak oleh browser.");
          }

          try {
            document.getElementById('btnNotif').innerText = "⏳ Sedang Menghubungkan ...";
            const register = await navigator.serviceWorker.register('/sw.js');

            const response = await fetch('/api/vapidPublicKey');
            const vapidData = await response.json();

            const subscription = await register.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(vapidData.publicKey)
            });

            const subRes = await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nik: nik, subscription: subscription })
            });

            const subData = await subRes.json();

            if (subData.success) {
              alert("Mantap! Web Push berhasil diaktifkan. Kamu sekarang bisa close tab ini dan notifikasi akan tetap masuk.");
              document.getElementById('btnNotif').innerText = "🔔 Push Notif Aktif!";
              document.getElementById('btnNotif').style.background = "#4f545c";
            }
            else {
              alert("Error: " + subData.error);
              document.getElementById('btnNotif').innerText = "🔔 Aktifkan Notifikasi";
            }
          }
          catch (err) {
            console.error(err);
            alert("Gagal mengaktifkan notifikasi.");
          }
        }

        async function fetchLogs() {
          try {
            const res = await fetch('/api/logs');
            const logs = await res.json();
            const logBox = document.getElementById('logBox');

            if (logs.length === 0) {
              logBox.innerHTML = '<i>Belum ada aktivitas ...</i>';
              return;
            }

            let htmlStr = '';
            logs.forEach(l => {
              let msg = l.message.replace(/<@[0-9]+>/g, '[@DiscordUser]');
              htmlStr += '<div style="margin-bottom: 8px;">' +
                '<span style="color: #5865F2;">[' + l.time + ']</span> ' +
                '<span style="color: #dcddde;">' + msg + '</span>' +
                '</div>';
            });

            const isScrolledToBottom = logBox.scrollHeight - logBox.clientHeight <= logBox.scrollTop + 10;
            logBox.innerHTML = htmlStr;
            if (isScrolledToBottom) {
              logBox.scrollTop = logBox.scrollHeight;
            }
          }
          catch (err) {
            console.error('Gagal load log:', err);
          }
        }

        fetchLogs();
        setInterval(fetchLogs, 10000);
      </script>
    </body>
    </html>
  `;
  res.code(200).header('Content-Type', 'text/html').send(html);
});

client.on('ready', async () => {
  console.log(`[✨ User Logged In] ${client.user.username}#${client.user.discriminator}`);
  console.log(`[🎉 Discord API & Token] ${version} :: ${client.token}`);
});

client.on('message', async message => {
  try {

    // Logging Message
    if (jsonData.logging) {
      const guildDmChannelName = message.guild ? `[${message.guild.name}] [${message.channel.name}]` : '💌 DM';
      console.log(`${guildDmChannelName} [${message.author.username}#${message.author.discriminator}] ${message.content}`);
    }

    // Test Ping
    if (
      message?.content && (
        message.content == `<@${client.user.id}> ping` ||
        message.content == `<@!${client.user.id}> ping`
      )
    ) {
      const latency = new Date().getTime() - new Date(message.createdTimestamp).getTime();
      await message.channel.send(`<@${message.author.id}> Pong ${latency} ms late!`);
    }

    // Self Bot Area
    else if (message?.content && message.author.id === client.user.id) {

      if (message.content.startsWith(`<@${client.user.id}>`)) {
        message.content = message.content.slice(`<@${client.user.id}>`.length).trim();
      }
      else if (message.content.startsWith(`<@!${client.user.id}>`)) {
        message.content = message.content.slice(`<@!${client.user.id}>`.length).trim();
      }

      // Change Bot Logging
      if (message.content.startsWith('log')) {
        jsonData.logging = !jsonData.logging;
        await message.channel.send(`Logging :: ${jsonData.logging}`);
        fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
      }

      // Change Bot Discriminator
      else if (message.content.startsWith('change-discrim ')) {
        const currentDiscrim = client.user.discriminator;
        const check = /^(\d)(?!\1+$)\d{11}$/;
        const targetDiscrim = message.content.split(' ')[1];
        if (!(
          currentDiscrim.startsWith('000') ||
          currentDiscrim.endsWith('000') ||
          currentDiscrim == targetDiscrim ||
          check.test(currentDiscrim)
        )) {
          const guilds = client.guilds.array();
          for (let guild of guilds) {
            console.log(`[+] Guild ${guild.id}`);
            try {
              guild = await (await guild.fetch()).fetchMembers();
              const members = guild.members.array();
              for (const member of members) {
                console.log(`    [-] ${member.user.username}#${member.user.discriminator}`);
                if (
                  member.user.discriminator == currentDiscrim &&
                  member.user.username !== client.user.username
                ) {
                  console.log(`[=] ${member.user.username}#${member.user.discriminator}`);
                  client.user.setUsername(member.user.username);
                  break;
                }
              }
              if (currentDiscrim != client.user.discriminator) {
                await message.channel.send(`[🎶 New Id] ${client.user.username}#${client.user.discriminator}`);
                break;
              }
            }
            catch (err) {
              await message.channel.send(err.toString());
            }
          };
        }
      }

      // Add Emoji List For Ping
      else if (message.content.startsWith('ping ')) {
        const release = await mutex.acquire();

        try {
          jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

          const emojiToAdd = message.content.slice(5).trim().split(' ');
          for (const emoji of emojiToAdd) {
            if (!emojiPing.includes(emoji)) {
              emojiPing.push(emoji);
            }
          }

          jsonData.ping = emojiPing;

          fs.writeFileSync(jsonConfig, JSON.stringify(jsonData, null, 2));
          jsonData = JSON.parse(fs.readFileSync(jsonConfig, { encoding: 'utf8' }));

          await message.channel.send(`Totals :: ${emojiPing.join('')}`);
        }
        finally {
          release();
        }
      }

      // Upload A Files
      else if (message.content.startsWith('ddl ')) {
        const ddlToUpload = message.content.slice(4).trim();
        if (ddlToUpload) {
          await message.channel.send(`<@${message.author.id}>`, { files: [ddlToUpload] });
        }
      }

      // Example :: Use `!quote <discord_msg_url> <ReplayMsgThat CanAlsoHave SpaceCharacter AndThisIsNotRequired>`
      // !quote https://discord.com/channels/281068107974443009/281068107974443009/767639372023201792 Reply Message Text Here
      else if (message.content.startsWith('quote ')) {
        let captureRegex = null;
        if (message.content.startsWith('quote https://discordapp.com')) {
          captureRegex = /quote (https:\/\/discordapp.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
        }
        else if (message.content.startsWith('quote https://discord.com')) {
          captureRegex = /quote (https:\/\/discord.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+))(.*$)/gi;
        }
        const captureResult = captureRegex.exec(message.content);
        const [rawInput, quotedMessageUrl, serverId, channelId, messageId, textReply] = captureResult;
        if (rawInput && quotedMessageUrl && serverId && channelId && messageId) {
          const quotedServer = await client.guilds.get(serverId);
          const quotedChannel = await quotedServer.channels.get(channelId);
          const textChannel = new TextChannel(quotedServer, quotedChannel);
          const quotedMessage = await textChannel.fetchMessage(messageId);
          // const messageEmbed = new RichEmbed();
          // messageEmbed.setColor(quotedMessage.member?.displayColor || 'WHITE');
          // messageEmbed.setAuthor(
          //   `${quotedMessage.author.username}#${quotedMessage.author.discriminator}`,
          //   quotedMessage.author.avatarURL,
          //   quotedMessageUrl
          // );
          // messageEmbed.setDescription(quotedMessage.content);
          const site_name = `#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name} ~ ${new Date(quotedMessage.createdTimestamp).toUTCString()}`;
          const site_url = quotedMessageUrl;
          const title = ' ';
          const descriptions = quotedMessage.content;
          let author_name = quotedMessage.author.username;
          if (Number(quotedMessage.author.discriminator)) {
            author_name += `#${quotedMessage.author.discriminator}`;
          }
          const author_url = `https://discord.com/users/${quotedMessage.author.id}`;
          let width = '1920';
          let height = '1080';
          let image_url = ' ';
          let video_url = ' ';
          let mime = ' ';
          const icon_url = quotedMessage.author.avatarURL;
          if (quotedMessage.attachments) {
            const attachment = quotedMessage.attachments.entries().next().value;
            if (attachment) {
              const [_, attachmentContent] = attachment;
              width = attachmentContent.width;
              height = attachmentContent.height;
              if (height && width) {
                // messageEmbed.setImage(attachmentContent.url);
                let url = new URL(attachmentContent.url).toString();
                if (url.endsWith('&') || url.endsWith('/') || url.endsWith('?')) {
                  url = url.substring(0, url.length - 1);
                }
                const res = await fetch(url, { method: 'HEAD' });
                mime = res.headers.get('Content-Type');
                if (mime.startsWith('image/')) {
                  image_url = url;
                }
                else if (mime.startsWith('video/')) {
                  video_url = url;
                }
                // else {
                //   const totalFileSize = attachmentContent.filesize.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
                //   messageEmbed.addField(
                //     attachmentContent.filename,
                //     `File Size :: ${totalFileSize} Bytes`
                //   );
              }
            }
          }
          // messageEmbed.setTimestamp(quotedMessage.createdTimestamp);
          // messageEmbed.setFooter(`#${quotedMessage.channel.name} @ ${quotedMessage.channel.guild.name}`);
          // await message.channel.send(textReply, messageEmbed);
          let urlParam = ``;
          urlParam += `site_name=${encodeURIComponent(site_name)}`;
          urlParam += `&site_url=${encodeURIComponent(site_url)}`;
          urlParam += `&author_name=${encodeURIComponent(author_name)}`;
          urlParam += `&author_url=${encodeURIComponent(author_url)}`;
          urlParam += `&width=${encodeURIComponent(width)}`;
          urlParam += `&height=${encodeURIComponent(height)}`;
          urlParam += `&image_url=${encodeURIComponent(image_url)}`;
          urlParam += `&video_url=${encodeURIComponent(video_url)}`;
          urlParam += `&mime=${encodeURIComponent(mime)}`;
          urlParam += `&icon_url=${encodeURIComponent(icon_url)}`;
          urlParam += `&title=${encodeURIComponent(title)}`;
          urlParam += `&descriptions=${encodeURIComponent(descriptions)}`;
          await message.channel.send(`${textReply} [⁖↓](${current_domain}/?${urlParam})`);
        }
        await message.delete();
      }

      // TODO :: You Can Add Other Self Bot Command Here

    }

    // Auto Reply If Someone Tag Me With Sticker / Emoji Ping Angry
    else if (
      message?.content && (
        message.content.includes(`<@${client.user.id}>`) ||
        message.content.includes(`<@!${client.user.id}>`)
      ) && message.author.id !== client.user.id
    ) {

      if (message.content.startsWith(`<@${client.user.id}>`)) {
        message.content = message.content.slice(`<@${client.user.id}>`.length).trim();
      }
      else if (message.content.startsWith(`<@!${client.user.id}>`)) {
        message.content = message.content.slice(`<@!${client.user.id}>`.length).trim();
      }

      if (message.content.startsWith('irk ')) {
        if (message.guild?.id === jsonData.irk.guildId) {
          await message.delete();
        }

        const msgData = message.content.slice(4).trim().split(' ').filter(d => d);
        const result = await addEditIrk(message.author.id, msgData);
        await message.channel.send(result);
      }
      else if (message.content.startsWith('loc ')) {
        const urlCoord = message.content.slice(4).trim();
        const result = await infoCoordAddr(urlCoord);
        await message.channel.send(`<@${message.author.id}>\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
      }

      // You Tagged ~
      else {
        await message.channel.send(emojiPing[Math.floor(Math.random() * emojiPing.length)]);
      }
    }

    // TODO :: You Can Add Other Public Bot Command Here

  }
  catch (err) {
    await message.channel.send(err.toString());
  }
});

async function start() {
  try {
    await client.login(DISCORD_LOGIN_TOKEN);
    await server.listen({ host: '0.0.0.0', port: process.env['PORT'] || 3001 }, (err, addr) => {
      if (err) {
        start();
        console.error(err);
      }
      else {
        startCron(client);
        console.log(`[🌐 Server Listen] ${addr}`);
      }
    });
  }
  catch (err) {
    console.error(err);
    DISCORD_LOGIN_TOKEN = null;
    rl.question('[🏹 Input User Token] ', (token) => {
      DISCORD_LOGIN_TOKEN = token;
      start();
    });
  }
}

start();
