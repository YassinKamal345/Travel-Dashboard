/* 1. CIUTATS */
const cities = [
  { name: "Barcelona", country: "España", lat: 41.3851, lon: 2.1734, currency: "EUR" },
  { name: "London", country: "Reino Unido", lat: 51.5074, lon: -0.1278, currency: "GBP" },
  { name: "Paris", country: "Francia", lat: 48.8566, lon: 2.3522, currency: "EUR" },
  { name: "New York", country: "Estados Unidos", lat: 40.7128, lon: -74.0060, currency: "USD" },
  { name: "Tokyo", country: "Japón", lat: 35.6895, lon: 139.6917, currency: "JPY" }
];

/* 2. ESTAT GLOBAL */
const appState = {
  currentCity: null,    // ciutat actual
  targetCurrency: null, // moneda destí
  lastConversion: null  // últim resultat conversió
};

/* 3. DOM */
const citySelect = document.querySelector('#city-select');

// Hero
const heroLoading = document.querySelector('#hero-loading');
const heroContent = document.querySelector('#hero-content');
const heroCountry = document.querySelector('#hero-country');
const heroCity = document.querySelector('#hero-city');
const heroTempIcon = document.querySelector('#hero-temp-icon');
const heroTemp = document.querySelector('#hero-temp');
const heroCurrency = document.querySelector('#hero-currency');
const heroRainBadge = document.querySelector('#hero-rain-badge');

// Meteo
const meteoLoading = document.querySelector('#meteo-loading');
const meteoContent = document.querySelector('#meteo-content');
const meteoTemp = document.querySelector('#meteo-temp');
const rainBar = document.querySelector('#rain-bar');
const meteoRainText = document.querySelector('#meteo-rain-text');
const meteoRainPct = document.querySelector('#meteo-rain-pct');

// Moneda
const currencyLoading = document.querySelector('#currency-loading');
const currencyContent = document.querySelector('#currency-content');
const eurAmountInput = document.querySelector('#eur-amount');
const currencyResultLabel = document.querySelector('#currency-result-label');
const currencyResultValue = document.querySelector('#currency-result-value');
const currencyRateNote = document.querySelector('#currency-rate-note');

// Recomanació
const recIcon = document.querySelector('#rec-icon');
const recMessage = document.querySelector('#rec-message');
const recExtra = document.querySelector('#rec-extra');

/* 4. HELPERS */
function showLoading(l, c) {
  l.removeAttribute('hidden');
  c.setAttribute('hidden', '');
}
function hideLoading(l, c) {
  l.setAttribute('hidden', '');
  c.removeAttribute('hidden');
}

/* 5. SELECT CIUTATS */
function initCitySelector() {
  cities.forEach((city, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${city.name} · ${city.country}`;
    citySelect.appendChild(option);
  });
}

/* 6. API METEO */
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=precipitation_probability&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error API: ${res.status}`);
  const data = await res.json();
  return {
    temperature: data.current.temperature_2m,
    rainProbability: data.hourly.precipitation_probability[0]
  };
}

/* 7. API MONEDA */
async function fetchConversionFromFrankfurter(amount, targetCurrency) {
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=EUR&to=${targetCurrency}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const data = await res.json();

  const converted = data.rates?.[targetCurrency];
  if (converted === undefined) throw new Error(`sense resultat ${targetCurrency}`);

  return {
    converted,
    rate: converted / amount,
    source: 'Frankfurter · BCE',
    updated: data.date
  };
}

// fallback CDN
async function fetchConversionFromFawaz(amount, targetCurrency) {
  const t = targetCurrency.toLowerCase();
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fawaz ${res.status}`);
  const data = await res.json();

  const rate = data.eur?.[t];
  if (!rate) throw new Error(`sense dades ${t}`);

  const noDec = ['JPY','KRW','IDR','VND','CLP','HUF'];
  const converted = noDec.includes(targetCurrency)
    ? Math.round(amount * rate)
    : Math.round(amount * rate * 100) / 100;

  return { converted, rate, source: 'fawazahmed0 · CDN', updated: data.date };
}

// principal + fallback
async function fetchConversion(amount, targetCurrency) {
  if (targetCurrency === 'EUR')
    return { converted: amount, rate: 1, source: 'Zona Euro', updated: null };

  try {
    return await fetchConversionFromFrankfurter(amount, targetCurrency);
  } catch {
    return await fetchConversionFromFawaz(amount, targetCurrency);
  }
}

/* 8. METEO INFO */
function getRainInfo(pct) {
  if (pct <= 20) return { emoji: '☀️', text: 'Sense pluja', level: 'low' };
  if (pct <= 50) return { emoji: '🌦️', text: 'Possible precipitacions', level: 'mid' };
  return { emoji: '🌧️', text: 'Probable pluja', level: 'high' };
}

function getTempEmoji(t) {
  if (t >= 30) return '🔥';
  if (t >= 20) return '☀️';
  if (t >= 10) return '🌤️';
  if (t >= 0) return '🧥';
  return '🥶';
}

/* 9. RECOMANACIÓ */
function updateRecommendation(temp, rain, city, currency, conv100) {
  let icon = '💡', msg = '';

  if (temp > 18 && rain < 30)
    [icon, msg] = ['😎', `Bon temps a ${city} (${temp}°C)`];
  else if (temp > 18)
    [icon, msg] = ['🌂', `Calor a ${city}, porta paraigua`];
  else if (temp > 8)
    [icon, msg] = ['🧥', `Fresquet a ${city} (${temp}°C)`];
  else if (temp > 0)
    [icon, msg] = ['🥶', `Fred a ${city} (${temp}°C)`];
  else
    [icon, msg] = ['❄️', `Sota zero a ${city}`];

  const noDec = ['JPY','KRW','IDR','VND','CLP','HUF'];
  const dec = noDec.includes(currency) ? 0 : 2;

  const extra = currency === 'EUR'
    ? '100 EUR = 100 EUR'
    : `💰 100 EUR = ${conv100.toLocaleString('ca-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec})} ${currency}`;

  recIcon.textContent = icon;
  recMessage.textContent = msg;
  recExtra.textContent = extra;
}

/* 10. METEO UI */
function updateMeteoWidget(temp, rain) {
  const r = getRainInfo(rain);
  meteoTemp.textContent = temp;
  rainBar.style.width = `${Math.min(rain,100)}%`;
  rainBar.className = `rain-bar-fill rain-${r.level}`;
  meteoRainText.textContent = `${r.emoji} ${r.text}`;
  meteoRainPct.textContent = `Probabilitat: ${rain}%`;
}

/* 11. MONEDA UI */
async function updateCurrencyWidget() {
  const { targetCurrency } = appState;
  if (!targetCurrency) return;

  const amount = parseFloat(eurAmountInput.value);
  if (isNaN(amount) || amount < 0) {
    currencyResultValue.textContent = 'Import no vàlid';
    return;
  }

  if (amount === 0) {
    currencyResultValue.textContent = `0 ${targetCurrency}`;
    return;
  }

  try {
    const res = await fetchConversion(amount, targetCurrency);
    appState.lastConversion = res;

    const noDec = ['JPY','KRW','IDR','VND','CLP','HUF'];
    const dec = noDec.includes(targetCurrency) ? 0 : 2;

    const val = res.converted.toLocaleString('ca-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec});

    currencyResultLabel.textContent = `${amount} EUR =`;
    currencyResultValue.textContent = `${val} ${targetCurrency}`;
    currencyRateNote.textContent = targetCurrency === 'EUR'
      ? 'Zona euro'
      : `1 EUR = ${res.rate.toFixed(6)} ${targetCurrency} · ${res.source} · ${res.updated}`;

  } catch (e) {
    currencyResultValue.textContent = '⚠️ Error';
    currencyRateNote.textContent = e.message;
  }
}

/* 12. HERO */
function updateHeroCard(city, temp, rain) {
  const r = getRainInfo(rain);
  heroCountry.textContent = city.country;
  heroCity.textContent = city.name;
  heroTempIcon.textContent = getTempEmoji(temp);
  heroTemp.textContent = `${temp}°C`;
  heroCurrency.textContent = city.currency;
  heroRainBadge.textContent = `${r.emoji} ${r.text}`;
}

/* 13. LOAD DATA */
async function loadCityData(i) {
  const city = cities[i];
  appState.currentCity = city;
  appState.targetCurrency = city.currency;

  showLoading(heroLoading, heroContent);
  showLoading(meteoLoading, meteoContent);
  showLoading(currencyLoading, currencyContent);

  recMessage.textContent = 'Carregant...';

  try {
    const [{ temperature, rainProbability }] = await Promise.all([
      fetchWeather(city.lat, city.lon)
    ]);

    updateHeroCard(city, temperature, rainProbability);
    updateMeteoWidget(temperature, rainProbability);
    await updateCurrencyWidget();

    const base = await fetchConversion(100, city.currency);
    updateRecommendation(temperature, rainProbability, city.name, city.currency, base.converted);

    hideLoading(heroLoading, heroContent);
    hideLoading(meteoLoading, meteoContent);
    hideLoading(currencyLoading, currencyContent);

  } catch (e) {
    recMessage.textContent = 'Error carregant dades';
  }
}

/* 14. EVENTS */
citySelect.addEventListener('change', e => loadCityData(parseInt(e.target.value)));
eurAmountInput.addEventListener('input', () => updateCurrencyWidget());

/* 15. INIT */
function init() {
  initCitySelector();
  loadCityData(0);
}
init();