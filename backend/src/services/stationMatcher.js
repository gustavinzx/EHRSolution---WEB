"use strict";

const db = require("../config/db");
const { isInterdicted } = require("./anpStatus");

const DEFAULT_MATCH_RADIUS_M = 150;
const MIN_MATCH_RADIUS_M = 30;
const MAX_MATCH_RADIUS_M = 1000;
const EARTH_RADIUS_M = 6371000;

const CANDIDATES_BOUNDING_BOX_SQL = `
  SELECT id, cnpj, razao_social, municipio, uf, bandeira, lat, lng, situacao_sigaf
  FROM anp_stations
  WHERE is_active = true
    AND lat IS NOT NULL
    AND lng IS NOT NULL
    AND lat BETWEEN $1 AND $2
    AND lng BETWEEN $3 AND $4
`;

const DIRECT_CNPJ_SQL = `
  SELECT id, cnpj, razao_social, municipio, uf, bandeira, lat, lng, situacao_sigaf
  FROM anp_stations
  WHERE cnpj = $1
    AND is_active = true
  LIMIT 1
`;

function validateStationMatchRadius(rawValue = process.env.STATION_MATCH_RADIUS_M) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return DEFAULT_MATCH_RADIUS_M;
  }
  const str = String(rawValue).trim();
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed < MIN_MATCH_RADIUS_M || parsed > MAX_MATCH_RADIUS_M) {
    throw new Error(
      `FATAL ERROR: STATION_MATCH_RADIUS_M inválido ("${str}"). Deve ser um número entre ${MIN_MATCH_RADIUS_M} e ${MAX_MATCH_RADIUS_M} metros.`
    );
  }
  return parsed;
}

function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidCoordPair(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat === "boolean" || typeof lng === "boolean") return false;
  const sLat = String(lat).trim();
  const sLng = String(lng).trim();
  if (sLat === "" || sLng === "") return false;
  const numLat = Number(sLat);
  const numLng = Number(sLng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return false;
  if (numLat === 0 && numLng === 0) return false;
  if (Math.abs(numLat) > 90 || Math.abs(numLng) > 180) return false;
  return true;
}

function buildBoundingBox(lat, lng, radiusM) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  const r = Number(radiusM);
  // Margem de 1% + 1e-6 grau para cobrir arredondamento NUMERIC(10,7) nos limites exatos do raio
  const angularRadiusDeg = ((r * 1.01) / EARTH_RADIUS_M) * (180 / Math.PI) + 1e-6;
  const deltaLat = angularRadiusDeg;
  const cosLat = Math.max(Math.cos((Math.abs(numLat) * Math.PI) / 180), 0.0001);
  const deltaLng = angularRadiusDeg / cosLat;

  return {
    minLat: Number((numLat - deltaLat).toFixed(7)),
    maxLat: Number((numLat + deltaLat).toFixed(7)),
    minLng: Number((numLng - deltaLng).toFixed(7)),
    maxLng: Number((numLng + deltaLng).toFixed(7)),
    deltaLat,
    deltaLng
  };
}

function formatAllowedStation(row) {
  if (!row) return null;
  return {
    id: row.id,
    cnpj: row.cnpj ? String(row.cnpj).trim() : null,
    razao_social: row.razao_social || null,
    municipio: row.municipio || null,
    uf: row.uf ? String(row.uf).trim() : null,
    bandeira: row.bandeira || null,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
    situacao_sigaf: row.situacao_sigaf || null
  };
}

async function resolveStation({ lat, lng, cnpj, radiusM } = {}) {
  const effectiveRadiusM =
    radiusM !== undefined && radiusM !== null
      ? validateStationMatchRadius(radiusM)
      : validateStationMatchRadius(process.env.STATION_MATCH_RADIUS_M);

  const cleanCnpj = cnpj !== undefined && cnpj !== null ? String(cnpj).replace(/\D/g, "") : "";
  const hasValidCoords = isValidCoordPair(lat, lng);

  if (cleanCnpj.length === 14) {
    const { rows } = await db.query(DIRECT_CNPJ_SQL, [cleanCnpj]);
    if (rows.length === 0) {
      return {
        status: "unrecognized",
        station: null,
        distance_m: null,
        interdicted: false
      };
    }
    const row = rows[0];
    let distanceM = 0;
    if (hasValidCoords && isValidCoordPair(row.lat, row.lng)) {
      distanceM = Number(haversineM(Number(lat), Number(lng), Number(row.lat), Number(row.lng)).toFixed(1));
    }
    return {
      status: "matched",
      station: formatAllowedStation(row),
      distance_m: distanceM,
      interdicted: isInterdicted(row.situacao_sigaf)
    };
  }

  if (!hasValidCoords) {
    return {
      status: "no_position",
      station: null,
      distance_m: null,
      interdicted: false
    };
  }

  const numLat = Number(lat);
  const numLng = Number(lng);
  const box = buildBoundingBox(numLat, numLng, effectiveRadiusM);

  const { rows: candidates } = await db.query(CANDIDATES_BOUNDING_BOX_SQL, [
    box.minLat,
    box.maxLat,
    box.minLng,
    box.maxLng
  ]);

  let bestRow = null;
  let bestDistanceM = null;

  for (const cand of candidates) {
    if (!isValidCoordPair(cand.lat, cand.lng)) continue;
    const distM = haversineM(numLat, numLng, Number(cand.lat), Number(cand.lng));
    if (distM <= effectiveRadiusM) {
      if (bestDistanceM === null || distM < bestDistanceM) {
        bestDistanceM = distM;
        bestRow = cand;
      }
    }
  }

  if (!bestRow) {
    return {
      status: "unrecognized",
      station: null,
      distance_m: null,
      interdicted: false
    };
  }

  return {
    status: "matched",
    station: formatAllowedStation(bestRow),
    distance_m: Number(bestDistanceM.toFixed(1)),
    interdicted: isInterdicted(bestRow.situacao_sigaf)
  };
}

module.exports = {
  DEFAULT_MATCH_RADIUS_M,
  MIN_MATCH_RADIUS_M,
  MAX_MATCH_RADIUS_M,
  CANDIDATES_BOUNDING_BOX_SQL,
  validateStationMatchRadius,
  haversineM,
  isValidCoordPair,
  buildBoundingBox,
  formatAllowedStation,
  resolveStation
};
