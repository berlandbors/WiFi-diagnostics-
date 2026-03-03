        // Modal Functions
        function openModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            if (modalId === 'speedModal' && speedChart) {
                setTimeout(() => {
                    speedChart.resize();
                }, 100);
            }
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }

        // Network Information API
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        function updateNetworkInfo() {
            const statusEl = document.getElementById('connectionStatus');
            if (navigator.onLine) {
                statusEl.textContent = '[OK] ОНЛАЙН';
                statusEl.className = 'status online';
            } else {
                statusEl.textContent = '[ERR] ОФЛАЙН';
                statusEl.className = 'status offline';
            }
            if (connection) {
                document.getElementById('connectionType').textContent = connection.type || 'Неизвестно';
                document.getElementById('effectiveType').textContent = connection.effectiveType || '-';
                document.getElementById('rtt').textContent = connection.rtt ? connection.rtt + ' мс' : '-';
                document.getElementById('saveData').textContent = connection.saveData ? 'Включена' : 'Выключена';
                showWarnings();
            } else {
                document.getElementById('warning').style.display = 'block';
                document.getElementById('warning').textContent = 'Network Information API не поддерживается вашим браузером. Попробуйте Chrome/Edge.';
            }
        }
        
        function showWarnings() {
            const warningEl = document.getElementById('warning');
            let warnings = [];
            if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
                warnings.push('Очень медленное соединение');
            }
            if (connection && connection.rtt > 500) {
                warnings.push('Высокая задержка (RTT > 500ms)');
            }
            if (connection && connection.downlink < 1) {
                warnings.push('Низкая скорость загрузки');
            }
            if (warnings.length > 0) {
                warningEl.style.display = 'block';
                warningEl.innerHTML = warnings.join('<br>');
            } else {
                warningEl.style.display = 'none';
            }
        }

        // Chart.js данные
        let speedData = {
            labels: [],
            datasets: [
                {
                    label: 'Speed (Mbps)',
                    data: [],
                    backgroundColor: 'rgba(0, 255, 65, 0.08)',
                    borderColor: '#00ff41',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y-speed',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#00ff41'
                },
                {
                    label: 'RTT (ms)',
                    data: [],
                    backgroundColor: 'rgba(255,176,0,0.08)',
                    borderColor: '#ffb000',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y-rtt',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#ffb000'
                }
            ]
        };
        
        let speedChart;
        
        // Форматирование времени с миллисекундами для точности
        function formatTime(date) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            const ms = String(date.getMilliseconds()).padStart(3, '0');
            return `${hours}:${minutes}:${seconds}.${ms}`;
        }
        
        window.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('speedChart').getContext('2d');
            speedChart = new Chart(ctx, {
                type: 'line',
                data: speedData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { 
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                color: '#00cc33',
                                font: { family: "'Courier New', monospace", size: 12 }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#0a0a0a',
                            borderColor: '#00ff41',
                            borderWidth: 1,
                            padding: 10,
                            titleColor: '#00ff41',
                            bodyColor: '#00cc33',
                            titleFont: { family: "'Courier New', monospace", size: 13 },
                            bodyFont: { family: "'Courier New', monospace", size: 12 },
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toFixed(2);
                                        label += context.datasetIndex === 0 ? ' Mbps' : ' ms';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            title: { display: true, text: 'TIME', color: '#00cc33', font: { family: "'Courier New', monospace" } },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: { size: 9, family: "'Courier New', monospace" },
                                autoSkip: true,
                                maxTicksLimit: 15,
                                color: '#00cc33'
                            },
                            grid: { color: 'rgba(0,255,65,0.1)' },
                            border: { color: 'rgba(0,255,65,0.3)' }
                        },
                        'y-speed': {
                            title: { display: true, text: 'SPEED (Mbps)', color: '#00ff41', font: { family: "'Courier New', monospace" } },
                            position: 'left',
                            min: 0,
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(1);
                                },
                                color: '#00ff41',
                                font: { family: "'Courier New', monospace" }
                            },
                            grid: { color: 'rgba(0,255,65,0.1)' },
                            border: { color: 'rgba(0,255,65,0.3)' }
                        },
                        'y-rtt': {
                            title: { display: true, text: 'RTT (ms)', color: '#ffb000', font: { family: "'Courier New', monospace" } },
                            position: 'right',
                            min: 0,
                            grid: { drawOnChartArea: false },
                            ticks: {
                                callback: function(value) {
                                    return Math.round(value);
                                },
                                color: '#ffb000',
                                font: { family: "'Courier New', monospace" }
                            },
                            border: { color: 'rgba(255,176,0,0.3)' }
                        }
                    }
                }
            });
            
            showWebRTCResults();
            showIpBrowserInfo();
            runSpeedTest(null, true);
            updateMainLocation();
        });

        function updateAverages() {
            const speedArr = speedData.datasets[0].data;
            const avgSpeed = speedArr.length ? (speedArr.reduce((s, a) => s + a, 0) / speedArr.length).toFixed(2) : "-";
            document.getElementById('avgSpeed').textContent = avgSpeed;
            document.getElementById('speedAvgDisplay').textContent = avgSpeed;
            document.getElementById('downlink').textContent = avgSpeed === "-" ? "-" : (avgSpeed + " Mbps");

            const rttArr = speedData.datasets[1].data.filter(a => typeof a === "number" && !isNaN(a));
            const avgRtt = rttArr.length ? (rttArr.reduce((s, a) => s + a, 0) / rttArr.length).toFixed(0) : "-";
            document.getElementById('avgRtt').textContent = avgRtt;
            document.getElementById('rttAvgDisplay').textContent = avgRtt;
            
            document.getElementById('totalTests').textContent = speedArr.length;
        }

        let isTestRunning = false;

        async function runSpeedTest(event = null, auto = false) {
            if (isTestRunning) {
                console.log('Тест уже выполняется, пропускаем...');
                return;
            }
            
            isTestRunning = true;
            let button;
            if (event) {
                button = event.target;
                button.textContent = '[RUNNING] ТЕСТИРОВАНИЕ...';
                button.disabled = true;
            }
            
            try {
                // Точная фиксация времени начала
                const testStartTime = new Date();
                
                const fileUrl = 'https://raw.githubusercontent.com/github/explore/main/topics/javascript/javascript.png';
                const fileSizeInBytes = 50000;
                const startTime = performance.now();
                const response = await fetch(fileUrl + '?cacheBust=' + Date.now());
                await response.blob();
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000;
                const speedMbps = ((fileSizeInBytes * 8) / (duration * 1024 * 1024)).toFixed(2);

                let rtt = "-";
                if (connection && typeof connection.rtt === "number") {
                    rtt = connection.rtt;
                } else {
                    try {
                        const rttStart = performance.now();
                        await fetch("https://www.google.com/images/branding/googlelogo/1x/googlelogo_light_color_92x30dp.png?cacheBust=" + Date.now(), { mode: 'no-cors' });
                        rtt = Math.round(performance.now() - rttStart);
                    } catch (e) { 
                        rtt = "-"; 
                    }
                }

                // Используем точное время начала теста
                const timeLabel = formatTime(testStartTime);
                
                speedData.labels.push(timeLabel);
                speedData.datasets[0].data.push(Number(speedMbps));
                speedData.datasets[1].data.push(isNaN(rtt) || rtt === "-" ? null : Number(rtt));
                
                // Ограничиваем до последних 30 измерений
                if (speedData.labels.length > 30) {
                    speedData.labels.shift();
                    speedData.datasets[0].data.shift();
                    speedData.datasets[1].data.shift();
                }
                
                if (speedChart) {
                    speedChart.update('none'); // Обновление без анимации для плавности
                }

                document.getElementById('lastTestTime').textContent = timeLabel;
                updateAverages();
                
            } catch (error) {
                console.error('Ошибка при тестировании:', error);
                if (!auto) {
                    alert('Ошибка при тестировании скорости: ' + error.message);
                }
            } finally {
                isTestRunning = false;
                if (button) {
                    button.textContent = '[EXECUTE] ПРОВЕРИТЬ СКОРОСТЬ';
                    button.disabled = false;
                }
            }
        }

        updateNetworkInfo();
        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
        }
        window.addEventListener('online', updateNetworkInfo);
        window.addEventListener('offline', updateNetworkInfo);
        
        // Обновляем информацию о сети каждые 5 секунд
        setInterval(updateNetworkInfo, 500);
        
        // Автоматический тест каждые 10 секунд
        setInterval(() => {
            if (!isTestRunning) {
                runSpeedTest(null, true);
            }
        }, 1000);

        function getWebRTCNetworkInfo(callback) {
            let pc = new RTCPeerConnection({iceServers: [{ urls:'stun:stun.l.google.com:19302' }]});
            pc.createDataChannel("test");
            let results = [];
            pc.onicecandidate = event => {
                if (event.candidate) {
                    let cand = event.candidate.candidate;
                    let ip = cand.match(/(\d{1,3}\.){3}\d{1,3}/)?.[0] ?? "—";
                    let networkType = cand.match(/network-type (\w+)/)?.[1] ?? "—";
                    let typ = cand.match(/typ (\w+)/)?.[1] ?? "—";
                    results.push({ candidate: cand, ip, type: typ, networkType });
                }
            };
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer));
            setTimeout(()=>{
                pc.close();
                callback(results);
            }, 2500);
        }

        function showWebRTCResults() {
            const list = document.getElementById('webrtc-list');
            getWebRTCNetworkInfo(results => {
                if (!results.length) {
                    list.innerHTML = '<small>Нет данных (браузер ограничивает ICE-кандидаты)</small>';
                    return;
                }
                list.innerHTML = results.map((r, i) =>
                    `<div class="cand">
                        <b>Кандидат ${i+1}:</b><br>
                        IP: <b>${r.ip}</b><br>
                        Тип: <b>${r.type}</b> | Сеть: <b>${r.networkType}</b>
                    </div>`
                ).join('');
            });
        }

        function showIpBrowserInfo() {
            fetch("https://api.ipify.org?format=json")
                .then(r=>r.json())
                .then(data=>{
                    document.getElementById('publicIp').textContent = data.ip;
                })
                .catch(()=>{
                    document.getElementById('publicIp').textContent = "Ошибка";
                });

            getWebRTCNetworkInfo(cands => {
                let ip = cands.find(c=>c.type==="host" && c.ip!=="127.0.0.1")?.ip || '—';
                document.getElementById('localIp').textContent = ip;
            });

            let nav = navigator;
            let agent = (nav.userAgentData && nav.userAgentData.brands)
                ? nav.userAgentData.brands.map(v=>v.brand + " " + v.version).join("; ")
                : nav.userAgent;
            document.getElementById('browserData').textContent = agent;
            document.getElementById('platformData').textContent = nav.platform || (nav.userAgentData?.platform || "—");
        }

        // ─── Geolocation ───────────────────────────────────────────────────────────

        let geoMap = null;
        let geoMarker = null;

        // ─── Main Location Display ─────────────────────────────────────────────────

        let cachedLocation = null;
        let cachedAddress = null;
        let lastLocationUpdate = null;

        async function getAddressFromCoords(lat, lon) {
            try {
                const params = new URLSearchParams({ lat, lon, format: 'json', 'accept-language': 'ru' });
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?${params}`,
                    {
                        headers: {
                            'User-Agent': 'WiFi-Diagnostics/1.0'
                        }
                    }
                );

                if (!response.ok) throw new Error('Ошибка получения адреса');

                const data = await response.json();

                const address = data.address;
                let fullAddress = '';

                if (address.road) fullAddress += address.road;
                if (address.house_number) fullAddress += ', ' + address.house_number;
                if (address.city) fullAddress += ', ' + address.city;
                else if (address.town) fullAddress += ', ' + address.town;
                else if (address.village) fullAddress += ', ' + address.village;
                if (address.country) fullAddress += ', ' + address.country;

                return fullAddress || data.display_name;
            } catch (error) {
                console.error('Ошибка reverse geocoding:', error);
                return null;
            }
        }

        async function updateMainLocation() {
            const statusEl = document.getElementById('locationStatus');
            const addressEl = document.getElementById('locationAddress');
            const coordsEl = document.getElementById('locationCoords');
            const addressRow = document.getElementById('addressRow');
            const coordsRow = document.getElementById('coordsRow');
            const btn = document.querySelector('.location-refresh-btn');

            if (btn) btn.disabled = true;

            statusEl.textContent = 'Определение местоположения...';
            statusEl.style.color = 'var(--amber)';
            addressRow.style.display = 'none';
            coordsRow.style.display = 'none';

            if (!navigator.geolocation) {
                statusEl.textContent = '[ERR] Геолокация не поддерживается браузером';
                statusEl.style.color = 'var(--amber)';
                if (btn) btn.disabled = false;
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    cachedLocation = { lat, lon, accuracy };
                    lastLocationUpdate = new Date();

                    statusEl.textContent = '[OK] Местоположение определено';
                    statusEl.style.color = 'var(--green)';

                    coordsEl.textContent = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'} (точность: ±${Math.round(accuracy)}м)`;
                    coordsRow.style.display = 'flex';

                    const address = await getAddressFromCoords(lat, lon);
                    if (address) {
                        cachedAddress = address;
                        addressEl.textContent = address;
                        addressRow.style.display = 'flex';
                    } else {
                        addressEl.textContent = 'Не удалось определить адрес';
                        addressRow.style.display = 'flex';
                    }

                    if (btn) btn.disabled = false;
                },
                (error) => {
                    let errorMsg = '';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg = '[ERR] Доступ к геолокации запрещен';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg = '[ERR] Информация о местоположении недоступна';
                            break;
                        case error.TIMEOUT:
                            errorMsg = '[ERR] Превышено время ожидания';
                            break;
                        default:
                            errorMsg = '[ERR] Неизвестная ошибка геолокации';
                    }
                    statusEl.textContent = errorMsg;
                    statusEl.style.color = 'var(--amber)';
                    if (btn) btn.disabled = false;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }

        /** Open the geolocation modal and immediately request position. */
        function openGeoModal() {
            openModal('geoModal');
            refreshGeolocation();
        }

        /** Request current position and populate the modal. */
        function refreshGeolocation() {
            const container = document.getElementById('geo-data');
            container.innerHTML = '<div class="dim-text">&gt; ОПРЕДЕЛЕНИЕ ПОЗИЦИИ...</div>';

            if (!navigator.geolocation) {
                container.innerHTML = '<div style="color:var(--amber)">[ERR] Геолокация не поддерживается браузером</div>';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
                    const timestamp = new Date(pos.timestamp);

                    container.innerHTML = `
                        <div class="info-row"><span class="label">Широта:</span><span class="value">${latitude.toFixed(6)}°</span></div>
                        <div class="info-row"><span class="label">Долгота:</span><span class="value">${longitude.toFixed(6)}°</span></div>
                        <div class="info-row"><span class="label">Точность:</span><span class="value">±${accuracy.toFixed(0)} м</span></div>
                        <div class="info-row"><span class="label">Высота:</span><span class="value">${altitude !== null ? altitude.toFixed(1) + ' м' : 'Н/Д'}</span></div>
                        <div class="info-row"><span class="label">Скорость:</span><span class="value">${speed !== null ? (speed * 3.6).toFixed(1) + ' км/ч' : 'Н/Д'}</span></div>
                        <div class="info-row"><span class="label">Обновлено:</span><span class="value">${timestamp.toLocaleTimeString('ru-RU')}</span></div>
                    `;

                    // Initialize or update Leaflet map
                    if (!geoMap) {
                        geoMap = L.map('geoMap').setView([latitude, longitude], 15);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        }).addTo(geoMap);
                        geoMarker = L.marker([latitude, longitude]).addTo(geoMap)
                            .bindPopup(`Ваша позиция<br>±${accuracy.toFixed(0)} м`).openPopup();
                    } else {
                        geoMap.setView([latitude, longitude], 15);
                        geoMarker.setLatLng([latitude, longitude]);
                        geoMarker.getPopup().setContent(`Ваша позиция<br>±${accuracy.toFixed(0)} м`);
                    }
                    // Recalculate map size after modal becomes fully visible
                    setTimeout(() => geoMap.invalidateSize(), 150);
                },
                (err) => {
                    let msg;
                    switch (err.code) {
                        case err.PERMISSION_DENIED:    msg = 'Доступ к геолокации запрещён пользователем'; break;
                        case err.POSITION_UNAVAILABLE: msg = 'Информация о местоположении недоступна';     break;
                        case err.TIMEOUT:              msg = 'Превышен таймаут запроса геолокации';        break;
                        default:                       msg = 'Ошибка: ' + err.message;
                    }
                    container.innerHTML = `<div style="color:var(--amber)">[ERR] ${msg}</div>`;
                    console.error('[GEO] Error:', err);
                },
                { timeout: 10000, enableHighAccuracy: true } // 10s timeout; high accuracy for GPS-grade precision
            );
        }

        // ─── Jamming / Interference Detection ─────────────────────────────────────

        // DNS domains used for resolution testing
        const JAM_DNS_DOMAINS = ['google.com', 'cloudflare.com', 'github.com'];

        // Endpoints tested for reachability via fetch (no-cors); priority 1 = critical, 2 = supplementary
        const JAM_ENDPOINTS = [
            { name: 'Google',     url: 'https://www.google.com/generate_204',  priority: 1 },
            { name: 'Cloudflare', url: 'https://cloudflare.com/cdn-cgi/trace', priority: 1 },
            { name: 'OpenDNS',    url: 'https://www.opendns.com/',              priority: 1 },
            { name: 'GitHub',     url: 'https://github.com/',                   priority: 2 },
            { name: 'Microsoft',  url: 'https://www.microsoft.com/',            priority: 2 },
            { name: 'Amazon AWS', url: 'https://aws.amazon.com/',               priority: 2 },
            { name: 'Яндекс',     url: 'https://ya.ru/',                        priority: 1 },
            { name: 'ВКонтакте',  url: 'https://vk.com/',                       priority: 2 }
        ];

        let jamHistory = [];
        let lastJamRecord = null;

        /** Ping a single endpoint and return { name, rtt, success }. */
        async function pingEndpoint(endpoint, timeoutMs = 3000) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), timeoutMs);
            const start = performance.now();
            try {
                await fetch(endpoint.url, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(tid);
                return { name: endpoint.name, rtt: Math.round(performance.now() - start), success: true };
            } catch (e) {
                clearTimeout(tid);
                return { name: endpoint.name, rtt: null, success: false };
            }
        }

        /** Test DNS resolution by probing domains and measuring RTT; returns { dnsFailureRate }. */
        async function testDNSResolution() {
            let failures = 0;
            await Promise.all(JAM_DNS_DOMAINS.map(async domain => {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 3000);
                try {
                    await fetch(`https://${domain}/`, { mode: 'no-cors', signal: controller.signal });
                    clearTimeout(tid);
                } catch {
                    clearTimeout(tid);
                    failures++;
                }
            }));
            return { dnsFailureRate: Math.round((failures / JAM_DNS_DOMAINS.length) * 100) };
        }

        /** Weighted scoring: 0–30 normal, 31–60 suspicious, 61–100 jamming. */
        function calculateJammingScore(data) {
            let score = 0;
            score += Math.min(data.packetLoss * 0.4, 40);   // packet loss  → 0–40 pts
            score += Math.min(data.jitter / 10, 25);         // jitter       → 0–25 pts
            if (data.speedAnomaly) score += 20;              // speed drop   → 0–20 pts
            score += Math.min(data.dnsFailureRate * 0.15, 15); // DNS issues → 0–15 pts
            return Math.round(score);
        }

        /** Analyse recent jamHistory entries for degradation patterns. */
        function analyzeJammingTrends() {
            if (jamHistory.length < 3) {
                return { trend: 'insufficient_data', degrading: false, periodicDips: false };
            }
            const recent = jamHistory.slice(-Math.min(10, jamHistory.length));
            const lossValues = recent.map(r => r.packetLoss);
            const avgLoss = lossValues.reduce((a, b) => a + b, 0) / lossValues.length;

            // Degrading: latest two samples notably worse than earliest two
            const degrading = lossValues.length >= 4 &&
                lossValues.slice(-2).reduce((a, b) => a + b, 0) / 2 >
                (lossValues.slice(0, 2).reduce((a, b) => a + b, 0) / 2) * 1.5;

            // Periodic dips: alternating above/below-average pattern
            let alternations = 0;
            for (let i = 1; i < lossValues.length; i++) {
                if ((lossValues[i] > avgLoss) !== (lossValues[i - 1] > avgLoss)) alternations++;
            }
            const periodicDips = alternations >= Math.floor(lossValues.length * 0.6);

            const nonNormal = recent.filter(r => r.status !== 'normal').length;
            const trend = nonNormal >= recent.length * 0.6 ? 'degraded' :
                          nonNormal >= recent.length * 0.3 ? 'unstable' : 'stable';

            return { trend, degrading, periodicDips, avgLoss: Math.round(avgLoss) };
        }

        /** Play a short alert beep using Web Audio API. */
        function playJamAlert() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880; // A5 note – audible and distinct from ambient sounds
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            } catch (e) {
                console.log('[JAM] Audio unavailable:', e);
            }
        }

        /**
         * Run a full jamming analysis over N rounds and return the result record.
         * @param {number} rounds - number of check rounds (default 1 for background, 3 for interactive)
         * @param {function} [onProgress] - optional callback(text, pct) for UI progress updates
         */
        async function runJammingCheck(rounds = 1, onProgress) {
            onProgress?.('Проверка доступности серверов (1/4)...', 20);

            // DNS test runs concurrently with endpoint rounds
            const dnsPromise = testDNSResolution();
            const allRounds = [];

            for (let i = 0; i < rounds; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 500));
                if (i === 1) onProgress?.('Тестирование DNS резолюции (2/4)...', 45);
                if (i === 2) onProgress?.('Анализ изменений скорости (3/4)...', 70);
                allRounds.push(await Promise.all(JAM_ENDPOINTS.map(ep => pingEndpoint(ep))));
            }

            onProgress?.('Финальный анализ (4/4)...', 90);
            const dnsResult = await dnsPromise;

            // Aggregate per-endpoint results across all rounds
            const endpointSummary = JAM_ENDPOINTS.map((ep, i) => {
                const epRounds = allRounds.map(round => round[i]);
                const successCount = epRounds.filter(r => r.success).length;
                const rtts = epRounds.filter(r => r.rtt !== null).map(r => r.rtt);
                const avgRtt = rtts.length
                    ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length)
                    : null;
                return {
                    name: ep.name,
                    priority: ep.priority,
                    success: successCount >= Math.ceil(rounds / 2), // majority of rounds succeeded
                    successRate: Math.round((successCount / rounds) * 100),
                    rtt: avgRtt
                };
            });

            const failCount = endpointSummary.filter(r => !r.success).length;
            const packetLoss = Math.round((failCount / endpointSummary.length) * 100);

            // Jitter: standard deviation of per-endpoint average RTTs
            const rtts = endpointSummary.filter(r => r.rtt !== null).map(r => r.rtt);
            let jitter = 0;
            if (rtts.length >= 2) {
                const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
                jitter = Math.round(
                    Math.sqrt(rtts.reduce((sum, rtt) => sum + Math.pow(rtt - avg, 2), 0) / rtts.length)
                );
            }

            // Speed anomaly: recent 5-sample average < 30% of prior 5-sample average → sharp sustained drop
            const speeds = speedData.datasets[0].data;
            let speedAnomaly = false;
            if (speeds.length >= 10) {
                const recentSpeeds = speeds.slice(-5);
                const olderSpeeds  = speeds.slice(-10, -5);
                const recentAvg = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
                const olderAvg  = olderSpeeds.reduce((a, b) => a + b, 0)  / olderSpeeds.length;
                if (olderAvg > 0 && recentAvg < olderAvg * 0.3) speedAnomaly = true;
            }

            const checksPerformed = rounds * JAM_ENDPOINTS.length + JAM_DNS_DOMAINS.length;
            const score = calculateJammingScore({
                packetLoss, jitter, speedAnomaly,
                dnsFailureRate: dnsResult.dnsFailureRate
            });
            const status = score >= 61 ? 'jamming' : score >= 31 ? 'suspicious' : 'normal';

            // Confidence improves as jamHistory grows
            const confidenceLevel = jamHistory.length >= 5 ? 'высокий' :
                                    jamHistory.length >= 2 ? 'средний' : 'низкий';
            const dataQuality = checksPerformed >= 20 ? 'отличная' :
                                 checksPerformed >= 15 ? 'хорошая'  : 'удовлетворительная';

            const record = {
                time: new Date(),
                status, packetLoss, jitter, failCount, speedAnomaly,
                results: endpointSummary,
                dnsFailureRate: dnsResult.dnsFailureRate,
                score, checksPerformed, confidenceLevel, dataQuality
            };

            jamHistory.push(record);
            if (jamHistory.length > 20) jamHistory.shift(); // keep last 20 checks in memory
            lastJamRecord = record;

            // Persist non-normal incidents to localStorage
            if (status !== 'normal') {
                try {
                    const incidents = JSON.parse(localStorage.getItem('jamIncidents') || '[]');
                    incidents.push({
                        time: record.time.toISOString(),
                        status, packetLoss, jitter
                    });
                    if (incidents.length > 50) incidents.shift(); // cap localStorage at 50 entries
                    localStorage.setItem('jamIncidents', JSON.stringify(incidents));
                } catch (e) {
                    console.error('[JAM] localStorage error:', e);
                }
                if (status === 'jamming') playJamAlert();
            }

            return record;
        }

        /** Open the jamming modal and start analysis. */
        async function openJamModal() {
            openModal('jamModal');
            await updateJamDisplay();
        }

        /** Run 3-round check with step-by-step progress and refresh the jamming modal content. */
        async function updateJamDisplay() {
            const statusEl  = document.getElementById('jam-status-display');
            const metricsEl = document.getElementById('jam-metrics');
            metricsEl.innerHTML = '';

            statusEl.innerHTML = `
                <div class="dim-text">&gt; Инициализация проверки...</div>
                <div class="jam-progress"><div class="jam-progress-bar" style="width:5%"></div></div>
            `;

            const rec = await runJammingCheck(3, (text, pct) => {
                statusEl.innerHTML = `
                    <div class="dim-text">&gt; ${text}</div>
                    <div class="jam-progress"><div class="jam-progress-bar" style="width:${pct}%"></div></div>
                `;
            });

            const trends = analyzeJammingTrends();

            // Status badge + confidence indicator
            const statusClass = rec.status === 'jamming'    ? 'jamming'    :
                                 rec.status === 'suspicious' ? 'suspicious' : 'normal';
            const statusText  = rec.status === 'jamming'    ? '[JAM] ВОЗМОЖНОЕ ГЛУШЕНИЕ'        :
                                 rec.status === 'suspicious' ? '[WARN] ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ' :
                                                               '[OK] НОРМАЛЬНАЯ РАБОТА';
            const confClass   = rec.confidenceLevel === 'высокий' ? 'confidence-high'   :
                                 rec.confidenceLevel === 'средний'  ? 'confidence-medium' : 'confidence-low';

            statusEl.innerHTML = `
                <div>
                    <span class="jam-status ${statusClass}">${statusText}</span>
                    <span class="confidence-indicator ${confClass}">Уверенность: ${rec.confidenceLevel}</span>
                </div>
                <div class="dim-text" style="font-size:11px;margin-top:6px;margin-bottom:10px;">
                    &gt; Проверено: ${rec.time.toLocaleTimeString('ru-RU')} | Скор: ${rec.score}/100 | Проверок: ${rec.checksPerformed}
                </div>
            `;

            // Colour thresholds
            const lossColor   = rec.packetLoss      > 30  ? 'var(--amber)' : 'var(--green)';
            const jitterColor = rec.jitter           > 100 ? 'var(--amber)' : 'var(--green)';
            const dnsColor    = rec.dnsFailureRate   > 30  ? 'var(--amber)' : 'var(--green)';
            const scoreColor  = rec.score            >= 61 ? 'var(--yellow)' :
                                 rec.score            >= 31 ? 'var(--amber)' : 'var(--green)';

            const trendText  = trends.trend === 'degraded'         ? '[WARN] Устойчивая деградация' :
                                trends.trend === 'unstable'         ? '[WARN] Нестабильность'        :
                                trends.trend === 'stable'           ? '[OK] Стабильно'               :
                                                                      '[INFO] Недостаточно данных';
            const trendColor = trends.trend === 'degraded' ? 'var(--yellow)' :
                                trends.trend === 'unstable' ? 'var(--amber)'  : 'var(--green)';

            const recommendations =
                rec.status === 'jamming'
                    ? 'Обнаружены серьёзные сетевые помехи. Рекомендуется сменить частотный диапазон (2.4/5 ГГц), проверить источники интерференции.'
                    : rec.status === 'suspicious'
                    ? 'Обнаружены аномалии. Проверьте загруженность канала и наличие соседних сетей.'
                    : 'Сеть работает в штатном режиме.';

            metricsEl.innerHTML = `
                <div class="info-row">
                    <span class="label">Скор помех:</span>
                    <span class="value" style="color:${scoreColor}">${rec.score}/100</span>
                </div>
                <div class="info-row">
                    <span class="label">Потеря пакетов:</span>
                    <span class="value" style="color:${lossColor}">${rec.packetLoss}%</span>
                </div>
                <div class="info-row">
                    <span class="label">Джиттер RTT:</span>
                    <span class="value" style="color:${jitterColor}">${rec.jitter} мс</span>
                </div>
                <div class="info-row">
                    <span class="label">DNS проблемы:</span>
                    <span class="value" style="color:${dnsColor}">${rec.dnsFailureRate}%</span>
                </div>
                <div class="info-row">
                    <span class="label">Аномалия скорости:</span>
                    <span class="value" style="color:${rec.speedAnomaly ? 'var(--amber)' : 'var(--green)'}">
                        ${rec.speedAnomaly ? '[WARN] Обнаружена' : '[OK] Норма'}
                    </span>
                </div>
                <div class="info-row">
                    <span class="label">Тренд:</span>
                    <span class="value" style="color:${trendColor}">
                        ${trendText}${trends.periodicDips ? ' (периодические провалы)' : ''}
                    </span>
                </div>
                <div class="info-row">
                    <span class="label">Качество данных:</span>
                    <span class="value" style="color:var(--green)">${rec.dataQuality} (${rec.checksPerformed} проверок)</span>
                </div>
                <div style="margin-top:12px;">
                    <div class="dim-text" style="font-size:12px;margin-bottom:6px;">&gt; ДОСТУПНОСТЬ СЕРВЕРОВ:</div>
                    ${rec.results.map(r => `
                        <div class="info-row">
                            <span class="label">${r.name}${r.priority === 1 ? ' ★' : ''}:</span>
                            <span class="value" style="color:${r.success ? 'var(--green)' : 'var(--amber)'}">
                                ${r.success ? '[OK] ' + (r.rtt !== null ? r.rtt + ' мс' : '—') : '[ERR] Недоступен'} (${r.successRate}%)
                            </span>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:12px;padding:8px;background:var(--bg-card);border:1px solid var(--green-dim);font-size:11px;color:var(--green)">
                    &gt; РЕКОМЕНДАЦИИ: ${recommendations}
                </div>
                <button class="main-btn" onclick="updateJamDisplay()" style="margin-top:12px;">[JAM] ПОВТОРИТЬ АНАЛИЗ</button>
            `;

            showJamIncidents();
        }

        /** Render the recent incident history from localStorage. */
        function showJamIncidents() {
            const el = document.getElementById('jam-incidents');
            let incidents = [];
            try {
                incidents = JSON.parse(localStorage.getItem('jamIncidents') || '[]');
            } catch (e) { /* ignore */ }

            if (!incidents.length) {
                el.innerHTML = '<div class="dim-text" style="margin-top:12px;font-size:12px;">&gt; ИСТОРИЯ ИНЦИДЕНТОВ: нет записей</div>';
                return;
            }

            const recent = incidents.slice(-5).reverse();
            el.innerHTML = `
                <div class="dim-text" style="margin-top:16px;font-size:12px;margin-bottom:6px;">&gt; ИСТОРИЯ ИНЦИДЕНТОВ (последние 5):</div>
                ${recent.map(inc => `
                    <div class="incident-item">
                        ${new Date(inc.time).toLocaleString('ru-RU')} |
                        ${inc.status === 'jamming' ? '[JAM]' : '[WARN]'} |
                        Потери: ${inc.packetLoss}% | Джиттер: ${inc.jitter} мс
                    </div>
                `).join('')}
            `;
        }

        // Automatic non-blocking jamming monitor every 30 seconds
        // (30s balances detection responsiveness against network/CPU overhead)
        setInterval(async () => {
            try {
                const rec = await runJammingCheck();
                console.log('[JAM] Monitor:', rec.status,
                    '| Loss:', rec.packetLoss + '%',
                    '| Jitter:', rec.jitter + 'ms',
                    '| Score:', rec.score);
            } catch (e) {
                console.error('[JAM] Monitor error:', e);
            }
        }, 30000);
