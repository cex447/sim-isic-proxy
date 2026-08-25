# SIM+ iSIC Proxy (diagnóstico)

Worker de diagnóstico independiente de SIM+.

## Objetivo
Comprobar qué devuelve realmente:
`https://geotren.fgc.cat/isic/<estacion>`

Ejemplo una vez desplegado:
`https://sim-isic-proxy.<tu-subdominio>.workers.dev/?station=pc`

## Estaciones admitidas inicialmente
`pc`, `sr`, `na`, `pn`, `tb`, `gr`, `mn`, `tt`, `re`

## Importante
- No modifica SIM+.
- No contiene credenciales.
- Solo permite CORS desde `https://cex447.github.io`.
- Está pensado primero como sonda técnica. Cuando confirmemos el formato real de iSIC,
  se sustituirá la salida de diagnóstico por un JSON limpio con las vías.
