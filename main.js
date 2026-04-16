// 1. CIUTATS
const cities = [
  { name: "Barcelona", country: "España", lat: 41.3851, lon: 2.1734, currency: "EUR" },
  { name: "London", country: "Reino Unido", lat: 51.5074, lon: -0.1278, currency: "GBP" },
  { name: "Paris", country: "Francia", lat: 48.8566, lon: 2.3522, currency: "EUR" },
  { name: "New York", country: "Estados Unidos", lat: 40.7128, lon: -74.0060, currency: "USD" },
  { name: "Tokyo", country: "Japón", lat: 35.6895, lon: 139.6917, currency: "JPY" }
];

// 2. ESTAT
const appState = { currentCity: null, targetCurrency: null, lastConversion: null };

// 3. DOM
const $ = s => document.querySelector(s);

const citySelect = $('#city-select');

const heroLoading = $('#hero-loading'), heroContent = $('#hero-content');
const heroCountry = $('#hero-country'), heroCity = $('#hero-city');
const heroTempIcon = $('#hero-temp-icon'), heroTemp = $('#hero-temp');
const heroCurrency = $('#hero-currency'), heroRainBadge = $('#hero-rain-badge');

const meteoLoading = $('#meteo-loading'), meteoContent = $('#meteo-content');
const meteoTemp = $('#meteo-temp'), rainBar = $('#rain-bar');
const meteoRainText = $('#meteo-rain-text'), meteoRainPct = $('#meteo-rain-pct');

const currencyLoading = $('#currency-loading'), currencyContent = $('#currency-content');
const eurAmountInput = $('#eur-amount');
const currencyResultLabel = $('#currency-result-label');
const currencyResultValue = $('#currency-result-value');
const currencyRateNote = $('#currency-rate-note');

const recIcon = $('#rec-icon'), recMessage = $('#rec-message'), recExtra = $('#rec-extra');

// 4. HELPERS
const show = (l,c)=>{l.hidden=false;c.hidden=true};
const hide = (l,c)=>{l.hidden=true;c.hidden=false};

// 5. SELECT
function initCitySelector(){
  cities.forEach((c,i)=>{
    const o=document.createElement('option');
    o.value=i;
    o.textContent=`${c.name} · ${c.country}`;
    citySelect.appendChild(o);
  });
}

// 6. WEATHER
async function fetchWeather(lat,lon){
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=precipitation_probability&timezone=auto`);
  if(!r.ok) throw new Error('Weather API');
  const d=await r.json();
  return {
    temperature:d.current.temperature_2m,
    rainProbability:d.hourly.precipitation_probability[0]
  };
}

// 7. MONEDA
async function fetchFrank(amount,curr){
  const r=await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=EUR&to=${curr}`);
  if(!r.ok) throw new Error('Frankfurter');
  const d=await r.json();
  const converted=d.rates[curr];
  return {converted,rate:converted/amount,source:'Frankfurter',updated:d.date};
}

async function fetchFallback(amount,curr){
  const r=await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`);
  if(!r.ok) throw new Error('Fallback');
  const d=await r.json();
  const rate=d.eur[curr.toLowerCase()];
  const noDec=['JPY','KRW','IDR','VND','CLP','HUF'];
  const converted=noDec.includes(curr)?Math.round(amount*rate):Math.round(amount*rate*100)/100;
  return {converted,rate,source:'Fallback',updated:d.date};
}

async function fetchConversion(amount,curr){
  if(curr==='EUR') return {converted:amount,rate:1,source:'EUR',updated:null};
  try{return await fetchFrank(amount,curr)}
  catch{ return await fetchFallback(amount,curr)}
}

// 8. HELPERS UI
const getRainInfo=p=>p<=20?{e:'☀️',t:'Sense pluja',l:'low'}:p<=50?{e:'🌦️',t:'Possible precipitacions',l:'mid'}:{e:'🌧️',t:'Probable pluja',l:'high'};
const getTempEmoji=t=>t>=30?'🔥':t>=20?'☀️':t>=10?'🌤️':t>=0?'🧥':'🥶';

// 9. UPDATE UI
function updateHeroCard(city,temp,rain){
  const r=getRainInfo(rain);
  heroCountry.textContent=city.country;
  heroCity.textContent=city.name; // ✅ FIX CLAVE
  heroTempIcon.textContent=getTempEmoji(temp);
  heroTemp.textContent=`${temp}°C`;
  heroCurrency.textContent=city.currency;
  heroRainBadge.textContent=`${r.e} ${r.t}`;
}

function updateMeteo(temp,rain){
  const r=getRainInfo(rain);
  meteoTemp.textContent=temp;
  rainBar.style.width=`${Math.min(rain,100)}%`;
  rainBar.className=`rain-bar-fill rain-${r.l}`;
  meteoRainText.textContent=`${r.e} ${r.t}`;
  meteoRainPct.textContent=`Probabilitat: ${rain}%`;
}

async function updateCurrency(){
  const curr=appState.targetCurrency;
  if(!curr) return;

  const amount=parseFloat(eurAmountInput.value);
  if(isNaN(amount)||amount<0){
    currencyResultValue.textContent='Import no vàlid';return;
  }
  if(amount===0){
    currencyResultValue.textContent=`0 ${curr}`;return;
  }

  try{
    const r=await fetchConversion(amount,curr);
    appState.lastConversion=r;

    const noDec=['JPY','KRW','IDR','VND','CLP','HUF'];
    const d=noDec.includes(curr)?0:2;

    const val=r.converted.toLocaleString('ca-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
    currencyResultLabel.textContent=`${amount} EUR =`;
    currencyResultValue.textContent=`${val} ${curr}`;
    currencyRateNote.textContent=curr==='EUR'?'Zona euro':`1 EUR = ${r.rate.toFixed(4)} ${curr}`;
  }catch{
    currencyResultValue.textContent='Error';
  }
}

function updateRec(temp,rain,city,curr,val){
  let msg=''; let icon='💡';
  if(temp>18&&rain<30){icon='😎';msg=`Bon temps a ${city}`;}
  else if(temp>18){icon='🌂';msg=`Calor però pluja a ${city}`;}
  else if(temp>8){icon='🧥';msg=`Fresquet a ${city}`;}
  else{icon='🥶';msg=`Fred a ${city}`;}

  recIcon.textContent=icon;
  recMessage.textContent=msg;
  recExtra.textContent=curr==='EUR'?'100 EUR = 100 EUR':`💰 100 EUR = ${val} ${curr}`;
}

// 10. LOAD
async function loadCityData(i){
  const city=cities[i];
  appState.currentCity=city;
  appState.targetCurrency=city.currency;

  show(heroLoading,heroContent);
  show(meteoLoading,meteoContent);
  show(currencyLoading,currencyContent);

  try{
    const w=await fetchWeather(city.lat,city.lon);

    updateHeroCard(city,w.temperature,w.rainProbability);
    updateMeteo(w.temperature,w.rainProbability);
    await updateCurrency();

    const base=await fetchConversion(100,city.currency);
    updateRec(w.temperature,w.rainProbability,city.name,city.currency,base.converted);

    hide(heroLoading,heroContent);
    hide(meteoLoading,meteoContent);
    hide(currencyLoading,currencyContent);
  }catch(e){
    recMessage.textContent='Error carregant dades';
  }
}

// 11. EVENTS
citySelect.addEventListener('change',e=>loadCityData(+e.target.value));
eurAmountInput.addEventListener('input',updateCurrency);

// 12. INIT
function init(){
  initCitySelector();
  loadCityData(0);
}
init();