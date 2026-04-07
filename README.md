# 0373_PR2_TravelDashboard

Pràctica 2 · ASIX 1r any · La Salle

## Descripció
Dashboard de viatge que mostra informació meteorològica i conversió de moneda per a 5 ciutats del món.

## Tecnologies
- HTML5 semàntic
- CSS3 pur (Flexbox + Grid, mobile-first)
- JavaScript vanilla (fetch, async/await, querySelector, addEventListener)

## APIs utilitzades
- **Open-Meteo** (meteorologia) — gratuïta, sense clau
- **Frankfurter** (conversió de moneda) — gratuïta, sense clau, dades del BCE
- **fawazahmed0/exchange-api** (fallback moneda) — gratuïta, sense clau

## Ciutats disponibles
Barcelona · London · Paris · New York · Tokyo

## Funcionalitats
- Selector de ciutat amb actualització automàtica
- Card resum amb temperatura i moneda local
- Widget meteorologia amb barra de pluja visual
- Widget conversió de moneda en temps real (conversió al servidor)
- Missatge de recomanació dinàmic
- Disseny responsive mobile-first