/* ══════════════════════════════════════════════════════
   1. DADES DE CIUTATS (objecte de configuració)
   ══════════════════════════════════════════════════════ */
const cities = [
  { name: "Barcelona", country: "España",        lat: 41.3851, lon:   2.1734, currency: "EUR" },
  { name: "London",    country: "Reino Unido",   lat: 51.5074, lon:  -0.1278, currency: "GBP" },
  { name: "Paris",     country: "Francia",       lat: 48.8566, lon:   2.3522, currency: "EUR" },
  { name: "New York",  country: "Estados Unidos", lat: 40.7128, lon: -74.0060, currency: "USD" },
  { name: "Tokyo",     country: "Japón",         lat: 35.6895, lon: 139.6917, currency: "JPY" }
];

/* ══════════════════════════════════════════════════════
   2. ESTAT GLOBAL DE L'APLICACIÓ
   Guardem l'última taxa de canvi per no fer crides
   innecessàries en canviar l'import EUR.
   ══════════════════════════════════════════════════════ */
const appState = {
  currentCity:      null,  // Objecte de la ciutat seleccionada
  targetCurrency:   null,  // Codi moneda destí ("GBP", "USD"…)
  lastConversion:   null,  // Últim resultat de fetchConversion {converted,rate,source,updated}
};

/* ══════════════════════════════════════════════════════
   3. SELECTORS DEL DOM (agrupats aquí per claredat)
   ══════════════════════════════════════════════════════ */
const citySelect = document.querySelector('#city-select');

// Card hero
const heroLoading  = document.querySelector('#hero-loading');
const heroContent  = document.querySelector('#hero-content');
const heroCountry  = document.querySelector('#hero-country');
const heroCity     = document.querySelector('#hero-city');
const heroTempIcon = document.querySelector('#hero-temp-icon');
const heroTemp     = document.querySelector('#hero-temp');
const heroCurrency = document.querySelector('#hero-currency');
const heroRainBadge = document.querySelector('#hero-rain-badge');

// Widget meteorologia
const meteoLoading  = document.querySelector('#meteo-loading');
const meteoContent  = document.querySelector('#meteo-content');
const meteoTemp     = document.querySelector('#meteo-temp');
const rainBar       = document.querySelector('#rain-bar');
const meteoRainText = document.querySelector('#meteo-rain-text');
const meteoRainPct  = document.querySelector('#meteo-rain-pct');

// Widget moneda
const currencyLoading     = document.querySelector('#currency-loading');
const currencyContent     = document.querySelector('#currency-content');
const eurAmountInput      = document.querySelector('#eur-amount');
const currencyResultLabel = document.querySelector('#currency-result-label');
const currencyResultValue = document.querySelector('#currency-result-value');
const currencyRateNote    = document.querySelector('#currency-rate-note');

// Recomanació
const recIcon    = document.querySelector('#rec-icon');
const recMessage = document.querySelector('#rec-message');
const recExtra   = document.querySelector('#rec-extra');

/* ══════════════════════════════════════════════════════
   4. HELPERS D'INTERFÍCIE
   Funcions reutilitzables per mostrar/amagar loading
   ══════════════════════════════════════════════════════ */

/**
 * Mostra l'spinner de càrrega i amaga el contingut real.
 * @param {HTMLElement} loadingEl - Element spinner
 * @param {HTMLElement} contentEl - Element contingut
 */
function showLoading(loadingEl, contentEl) {
  loadingEl.removeAttribute('hidden');
  contentEl.setAttribute('hidden', '');
}

/**
 * Amaga l'spinner i mostra el contingut real.
 * @param {HTMLElement} loadingEl - Element spinner
 * @param {HTMLElement} contentEl - Element contingut
 */
function hideLoading(loadingEl, contentEl) {
  loadingEl.setAttribute('hidden', '');
  contentEl.removeAttribute('hidden');
}

/* ══════════════════════════════════════════════════════
   5. INICIALITZAR EL SELECTOR DE CIUTATS
   Genera les <option> del <select> a partir de l'array
   ══════════════════════════════════════════════════════ */

/**
 * Omple dinàmicament el <select> amb les ciutats de l'array.
 */
function initCitySelector() {
  cities.forEach((city, index) => {
    const option = document.createElement('option');
    option.value = index;                             // Usem l'índex com a valor
    option.textContent = `${city.name} · ${city.country}`;
    citySelect.appendChild(option);
  });
}

/* ══════════════════════════════════════════════════════
   6. API METEOROLÒGICA (Open-Meteo, sense clau)
   ══════════════════════════════════════════════════════ */

/**
 * Obté dades meteorològiques de l'API Open-Meteo.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @returns {Promise<{temperature: number, rainProbability: number}>}
 */
async function fetchWeather(lat, lon) {
  // URL exacta indicada a la pràctica
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=precipitation_probability&timezone=auto`;

  const response = await fetch(url);

  // Comprovem que la resposta sigui correcta (codi 2xx)
  if (!response.ok) {
    throw new Error(`Error API meteorologia: ${response.status}`);
  }

  const data = await response.json();

  // Extreure temperatura actual i probabilitat de pluja (primer valor = hora actual)
  const temperature    = data.current.temperature_2m;
  const rainProbability = data.hourly.precipitation_probability[0];

  return { temperature, rainProbability };
}

/* ══════════════════════════════════════════════════════
   7. API CONVERSIÓ DE MONEDA
   ══════════════════════════════════════════════════════
   ESTRATÈGIA: Frankfurter fa la conversió AL SERVIDOR
   passant el paràmetre ?amount=, eliminant completament
   l'aritmètica de coma flotant al client.
   Fallback: fawazahmed0/exchange-api (CDN, sense clau).
   ══════════════════════════════════════════════════════ */

/**
 * API PRINCIPAL: frankfurter.app
 * Projecte open-source basat en dades del Banc Central Europeu.
 * Clau característica: accepta ?amount= i retorna el resultat
 * ja calculat pel servidor → 0 errors de coma flotant al client.
 *
 * URL: https://api.frankfurter.app/latest?amount=777&from=EUR&to=JPY
 * Resposta: { "amount": 777, "base": "EUR", "date": "2025-03-19",
 *             "rates": { "JPY": 124567.89 } }
 *
 * @param {number} amount - Import en EUR a convertir
 * @param {string} targetCurrency - Codi moneda destí (ex: "JPY")
 * @returns {Promise<{converted: number, rate: number, source: string, updated: string}>}
 */
async function fetchConversionFromFrankfurter(amount, targetCurrency) {
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=EUR&to=${targetCurrency}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`frankfurter HTTP ${response.status}`);
  const data = await response.json();

  // El resultat convertit ja ve calculat pel servidor
  const converted = data.rates?.[targetCurrency];
  if (converted === undefined) throw new Error(`frankfurter: sense resultat per ${targetCurrency}`);

  // Obtenim també la taxa base (1 EUR → X) per mostrar-la a la UI
  // dividint el resultat entre l'import (o fent una crida addicional amb amount=1)
  const rate = converted / amount;

  return {
    converted,                            // Import ja convertit (calculat al servidor)
    rate,                                 // Taxa base 1 EUR → X
    source: 'Frankfurter · BCE',
    updated: data.date,
  };
}

/**
 * API FALLBACK: fawazahmed0/exchange-api (CDN jsDelivr)
 * Completament gratuïta, sense clau, sense límit de peticions.
 * En aquest cas no té endpoint ?amount=, per tant fem la
 * conversió localment però amb Math.round per a JPY.
 *
 * @param {number} amount - Import en EUR a convertir
 * @param {string} targetCurrency - Codi moneda destí
 * @returns {Promise<{converted: number, rate: number, source: string, updated: string}>}
 */
async function fetchConversionFromFawaz(amount, targetCurrency) {
  const tCurr = targetCurrency.toLowerCase();
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fawazahmed0 HTTP ${response.status}`);
  const data = await response.json();

  const rate = data.eur?.[tCurr];
  if (!rate) throw new Error(`fawazahmed0: sense dades per ${tCurr}`);

  // Per a JPY i altres monedes sense decimals, arrodonir a enters
  const noDecimals = ['JPY', 'KRW', 'IDR', 'VND', 'CLP', 'HUF'];
  const converted = noDecimals.includes(targetCurrency)
    ? Math.round(amount * rate)
    : Math.round(amount * rate * 100) / 100;

  return {
    converted,
    rate,
    source: 'fawazahmed0 · CDN',
    updated: data.date,
  };
}

/**
 * Funció principal de conversió de moneda.
 * Retorna SEMPRE un objecte { converted, rate, source, updated }.
 *
 * Flux:
 *   1r → frankfurter.app  (conversió al servidor, màxima precisió)
 *   2n → fawazahmed0/CDN  (fallback si frankfurter falla)
 *
 * Cas especial EUR→EUR: retorna directament sense crida API.
 *
 * @param {number} amount - Import en EUR
 * @param {string} targetCurrency - Codi moneda destí
 * @returns {Promise<{converted: number, rate: number, source: string, updated: string}>}
 */
async function fetchConversion(amount, targetCurrency) {
  // Cas especial: EUR → EUR no necessita crida API
  if (targetCurrency === 'EUR') {
    return { converted: amount, rate: 1, source: 'Zona Euro', updated: null };
  }

  try {
    const result = await fetchConversionFromFrankfurter(amount, targetCurrency);
    console.log(`[Moneda] ${result.source}: ${amount} EUR = ${result.converted} ${targetCurrency}`);
    return result;
  } catch (err1) {
    console.warn(`[Moneda] Frankfurter ha fallat (${err1.message}), provant fawazahmed0...`);
    try {
      const result = await fetchConversionFromFawaz(amount, targetCurrency);
      console.log(`[Moneda] ${result.source}: ${amount} EUR = ${result.converted} ${targetCurrency}`);
      return result;
    } catch (err2) {
      throw new Error(`Ambdues APIs han fallat per ${targetCurrency}. (${err2.message})`);
    }
  }
}

/* ══════════════════════════════════════════════════════
   8. DETERMINAR MISSATGE METEOROLÒGIC
   Retorna emoji + text per a la probabilitat de pluja
   ══════════════════════════════════════════════════════ */

/**
 * Retorna l'objecte de descripció de pluja segons el percentatge.
 * Criteris exactes del PDF de la pràctica:
 *   0-20%  → ☀️ Sense pluja
 *   20-50% → 🌦️ Possible precipitacions
 *   >50%   → 🌧️ Probable pluja
 * @param {number} pct - Percentatge de probabilitat de pluja (0-100)
 * @returns {{emoji: string, text: string, level: string}}
 */
function getRainInfo(pct) {
  if (pct <= 20) {
    return { emoji: '☀️', text: 'Sense pluja',              level: 'low'  };
  } else if (pct <= 50) {
    return { emoji: '🌦️', text: 'Possible precipitacions',  level: 'mid'  };
  } else {
    return { emoji: '🌧️', text: 'Probable pluja',           level: 'high' };
  }
}

/**
 * Retorna l'emoji de temperatura per a la card hero.
 * @param {number} temp - Temperatura en °C
 * @returns {string}
 */
function getTempEmoji(temp) {
  if (temp >= 30) return '🔥';
  if (temp >= 20) return '☀️';
  if (temp >= 10) return '🌤️';
  if (temp >= 0)  return '🧥';
  return '🥶';
}

/* ══════════════════════════════════════════════════════
   9. GENERAR RECOMANACIÓ DE VIATGE (dinàmica)
   Exemples del PDF implementats aquí
   ══════════════════════════════════════════════════════ */

/**
 * Genera el missatge de recomanació i l'actualitza al DOM.
 * Condicions del PDF:
 *   - Temp > 18°C i pluja < 30% → bon temps
 *   - Temp baixa                → porta jaqueta
 *   - Sempre mostra exemple conversió 100 EUR
 * @param {number} temp - Temperatura actual
 * @param {number} rainPct - Probabilitat de pluja
 * @param {string} cityName - Nom de la ciutat
 * @param {string} currency - Codi moneda
 * @param {number} rate - Taxa de canvi
 */
function updateRecommendation(temp, rainPct, cityName, currency, conversionOf100) {
  let icon    = '💡';
  let message = '';

  // Determinar el missatge principal basat en temperatura i pluja
  if (temp > 18 && rainPct < 30) {
    icon    = '😎';
    message = `Avui fa bon temps per passejar per ${cityName}! Temperatura agradable de ${temp}°C i poc risc de pluja.`;
  } else if (temp > 18 && rainPct >= 30) {
    icon    = '🌂';
    message = `Fa calor a ${cityName} (${temp}°C), però porta un paraigua per si de cas!`;
  } else if (temp <= 18 && temp > 8) {
    icon    = '🧥';
    message = `Recorda portar jaqueta! A ${cityName} fa ${temp}°C, una mica fresquet.`;
  } else if (temp <= 8 && temp > 0) {
    icon    = '🥶';
    message = `Fa molt de fred a ${cityName} (${temp}°C). Abriga't bé i porta roba d'abric!`;
  } else {
    icon    = '❄️';
    message = `Temperatura sota zero a ${cityName}! (${temp}°C). Compte amb el gel i la neu.`;
  }

  // Exemple de conversió: 100 EUR → X moneda (resultat ja calculat pel servidor)
  let extraText = '';
  if (currency === 'EUR') {
    extraText = '100 EUR són 100 EUR (zona euro, no cal canviar moneda!).';
  } else {
    const noDecimals = ['JPY', 'KRW', 'IDR', 'VND', 'CLP', 'HUF'];
    const decimals   = noDecimals.includes(currency) ? 0 : 2;
    const formatted  = conversionOf100.toLocaleString('ca-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    extraText = `💰 100 EUR són ${formatted} ${currency}`;
  }

  // Actualitzar el DOM de la secció de recomanació
  recIcon.textContent    = icon;
  recMessage.textContent = message;
  recExtra.textContent   = extraText;
}

/* ══════════════════════════════════════════════════════
   10. ACTUALITZAR WIDGET METEOROLOGIA
   ══════════════════════════════════════════════════════ */

/**
 * Actualitza tots els elements visuals del widget de meteorologia.
 * @param {number} temp - Temperatura en °C
 * @param {number} rainPct - Probabilitat de pluja (0-100)
 */
function updateMeteoWidget(temp, rainPct) {
  const rainInfo = getRainInfo(rainPct);

  // Temperatura gran
  meteoTemp.textContent = temp;

  // Barra de progrés visual: amplada = percentatge, color = nivell
  rainBar.style.width = `${Math.min(rainPct, 100)}%`;
  rainBar.className   = `rain-bar-fill rain-${rainInfo.level}`;

  // Text descriptiu de pluja
  meteoRainText.textContent = `${rainInfo.emoji} ${rainInfo.text}`;
  meteoRainPct.textContent  = `Probabilitat: ${rainPct}%`;
}

/* ══════════════════════════════════════════════════════
   11. ACTUALITZAR WIDGET CONVERSIÓ DE MONEDA
   ══════════════════════════════════════════════════════ */

/**
 * Demana la conversió actualitzada al servidor (fetchConversion) i
 * actualitza el widget de moneda. Es crida cada vegada que canvia
 * l'import de l'input O quan es selecciona una nova ciutat.
 *
 * Ús de async/await: la crida a fetchConversion és asíncrona perquè
 * Frankfurter fa la conversió al servidor, evitant errors de coma flotant.
 */
async function updateCurrencyWidget() {
  const { targetCurrency } = appState;
  if (!targetCurrency) return;

  const amount = parseFloat(eurAmountInput.value);
  // Validació: import ha de ser un nombre positiu
  if (isNaN(amount) || amount < 0) {
    currencyResultLabel.textContent = '';
    currencyResultValue.textContent = 'Import no vàlid';
    currencyRateNote.textContent    = '';
    return;
  }

  // Cas 0 EUR: mostrar 0 sense crida API
  if (amount === 0) {
    currencyResultLabel.textContent = '0 EUR =';
    currencyResultValue.textContent = `0 ${targetCurrency}`;
    currencyRateNote.textContent    = '';
    return;
  }

  try {
    // La conversió la fa el servidor → cap multiplicació al client
    const result = await fetchConversion(amount, targetCurrency);
    appState.lastConversion = result;

    // Format localitzat: monedes sense decimals (JPY, KRW…) → 0 decimals
    const noDecimals = ['JPY', 'KRW', 'IDR', 'VND', 'CLP', 'HUF'];
    const decimals   = noDecimals.includes(targetCurrency) ? 0 : 2;

    const formattedResult = result.converted.toLocaleString('ca-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    // Actualitzar DOM
    currencyResultLabel.textContent = `${amount} EUR =`;
    currencyResultValue.textContent = `${formattedResult} ${targetCurrency}`;

    if (targetCurrency === 'EUR') {
      currencyRateNote.textContent = 'Zona euro: no cal conversió.';
    } else {
      const rateStr  = result.rate.toFixed(6);
      const source   = result.source  || '—';
      const updated  = result.updated || '—';
      currencyRateNote.textContent =
        `1 EUR = ${rateStr} ${targetCurrency} · ${source} · ${updated}`;
    }
  } catch (err) {
    currencyResultValue.textContent = '⚠️ Error de conversió';
    currencyRateNote.textContent    = err.message;
  }
}

/* ══════════════════════════════════════════════════════
   12. ACTUALITZAR CARD HERO
   ══════════════════════════════════════════════════════ */

/**
 * Actualitza la card resum principal amb les dades de la ciutat i temps.
 * @param {object} city - Objecte de la ciutat
 * @param {number} temp - Temperatura
 * @param {number} rainPct - Probabilitat pluja
 */
function updateHeroCard(city, temp, rainPct) {
  const rainInfo = getRainInfo(rainPct);

  heroCountry.textContent  = city.country;
  heroCity.textContent     = city.name;
  heroTempIcon.textContent = getTempEmoji(temp);
  heroTemp.textContent     = `${temp}°C`;
  heroCurrency.textContent = city.currency;
  heroRainBadge.textContent = `${rainInfo.emoji} ${rainInfo.text}`;
}

/* ══════════════════════════════════════════════════════
   13. FUNCIÓ PRINCIPAL: CARREGAR DADES DE LA CIUTAT
   Orquestra totes les crides API i actualitzacions del DOM
   ══════════════════════════════════════════════════════ */

/**
 * Funció principal async que:
 *   1. Mostra els spinners de càrrega
 *   2. Fa les crides fetch en paral·lel (Promise.all)
 *   3. Actualitza tots els widgets
 *   4. Gestiona errors amb try/catch
 * @param {number} cityIndex - Índex de la ciutat a l'array cities
 */
async function loadCityData(cityIndex) {
  const city = cities[cityIndex];
  appState.currentCity    = city;
  appState.targetCurrency = city.currency;

  // Mostrar spinners mentre es carreguen les dades
  showLoading(heroLoading,     heroContent);
  showLoading(meteoLoading,    meteoContent);
  showLoading(currencyLoading, currencyContent);

  // Missatge de recomanació en espera
  recIcon.textContent    = '⏳';
  recMessage.textContent = 'Carregant dades de la destinació…';
  recExtra.textContent   = '';

  try {
    // ── Peticions API en paral·lel per millorar el rendiment ──
    // Nota: la conversió de moneda la gestiona updateCurrencyWidget de forma independent
    const [weatherData] = await Promise.all([
      fetchWeather(city.lat, city.lon),
    ]);

    const { temperature, rainProbability } = weatherData;

    // ── Actualitzar tots els widgets ──
    updateHeroCard(city, temperature, rainProbability);
    updateMeteoWidget(temperature, rainProbability);
    await updateCurrencyWidget();   // async: fa la conversió al servidor

    // Per a la recomanació, obtenim la taxa base (100 EUR → X)
    const baseConv = await fetchConversion(100, city.currency);
    updateRecommendation(temperature, rainProbability, city.name, city.currency, baseConv.converted);

    // Amagar spinners i mostrar contingut
    hideLoading(heroLoading,     heroContent);
    hideLoading(meteoLoading,    meteoContent);
    hideLoading(currencyLoading, currencyContent);

  } catch (error) {
    // ── Gestió d'errors: mostrar missatge a l'usuari ──
    console.error('Error carregant dades:', error);

    heroLoading.innerHTML  = '⚠️ Error carregant dades meteorològiques.';
    meteoLoading.innerHTML = '⚠️ Error API';
    currencyLoading.innerHTML = '⚠️ Error API';

    recIcon.textContent    = '⚠️';
    recMessage.textContent = `No s'han pogut carregar les dades de ${city.name}. Comprova la connexió.`;
    recExtra.textContent   = error.message;
  }
}

/* ══════════════════════════════════════════════════════
   14. EVENT LISTENERS
   ══════════════════════════════════════════════════════ */

/**
 * Listener: canvi en el selector de ciutat.
 * Carrega les dades de la nova destinació seleccionada.
 */
citySelect.addEventListener('change', (event) => {
  const index = parseInt(event.target.value, 10);
  loadCityData(index);
});

/**
 * Listener: canvi en l'input d'euros.
 * Recalcula la conversió en temps real sense fer cap crida API.
 */
// updateCurrencyWidget és async; la cridem sense await perquè
// els errors queden capturats dins la pròpia funció async.
eurAmountInput.addEventListener('input', () => { updateCurrencyWidget(); });

/* ══════════════════════════════════════════════════════
   15. INICIALITZACIÓ DE L'APLICACIÓ
   S'executa quan el DOM està llest (script al final del body)
   ══════════════════════════════════════════════════════ */

/**
 * Inicialitza el selector i carrega la primera ciutat per defecte.
 */
function init() {
  // Omplir el <select> amb les opcions de ciutats
  initCitySelector();

  // Carregar la primera ciutat automàticament en obrir la pàgina
  loadCityData(0);
}

// Executar la inicialització
init();