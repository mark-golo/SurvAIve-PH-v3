// CARAGA Region location data — PSGC-verified (psgc.gitlab.io)
// Pilot scope: Surigao del Norte (full barangay detail)
// Other CARAGA provinces: municipality list only

// ── PSGC Metadata Exports ────────────────────────────────────────────────────

export const REGION_PSGC = {
  CARAGA: { name: 'CARAGA', code: '160000000', psgc10: '1600000000' },
}

export const PROVINCE_PSGC = {
  'Agusan del Norte':  { code: '160200000', psgc10: '1600200000' },
  'Agusan del Sur':    { code: '160300000', psgc10: '1600300000' },
  'Dinagat Islands':   { code: '168600000', psgc10: '1608600000' },
  'Surigao del Norte': { code: '166700000', psgc10: '1606700000' },
  'Surigao del Sur':   { code: '160800000', psgc10: '1600800000' },
}

// Coordinates verified against OpenStreetMap Nominatim API (same tile source as the base map).
// OSM-matched entries use 3-decimal precision. Entries kept from original PSGC data are noted.
export const MUNICIPALITY_PSGC = {
  'Alegria':           { code: '166701000', psgc10: '1606701000', lat: 9.464,  lng: 125.576, province: 'Surigao del Norte' }, // OSM (zip 8425)
  'Bacuag':            { code: '166702000', psgc10: '1606702000', lat: 9.608,  lng: 125.638, province: 'Surigao del Norte' }, // OSM
  'Burgos':            { code: '166704000', psgc10: '1606704000', lat: 10.018, lng: 126.074, province: 'Surigao del Norte' }, // OSM
  'Claver':            { code: '166706000', psgc10: '1606706000', lat: 9.573,  lng: 125.733, province: 'Surigao del Norte' }, // OSM
  'Dapa':              { code: '166707000', psgc10: '1606707000', lat: 9.758,  lng: 126.053, province: 'Surigao del Norte' }, // OSM
  'Del Carmen':        { code: '166708000', psgc10: '1606708000', lat: 9.869,  lng: 125.971, province: 'Surigao del Norte' }, // OSM (was swapped with Pilar)
  'General Luna':      { code: '166710000', psgc10: '1606710000', lat: 9.783,  lng: 126.156, province: 'Surigao del Norte' }, // OSM
  'Gigaquit':          { code: '166711000', psgc10: '1606711000', lat: 9.596,  lng: 125.698, province: 'Surigao del Norte' }, // OSM
  'Mainit':            { code: '166714000', psgc10: '1606714000', lat: 9.538,  lng: 125.523, province: 'Surigao del Norte' }, // OSM
  'Malimono':          { code: '166715000', psgc10: '1606715000', lat: 9.618,  lng: 125.402, province: 'Surigao del Norte' }, // OSM Town (place_rank 18)
  'Pilar':             { code: '166716000', psgc10: '1606716000', lat: 9.864,  lng: 126.100, province: 'Surigao del Norte' }, // OSM (was swapped with Del Carmen)
  'Placer':            { code: '166717000', psgc10: '1606717000', lat: 9.657,  lng: 125.602, province: 'Surigao del Norte' }, // OSM
  'San Benito':        { code: '166718000', psgc10: '1606718000', lat: 9.958,  lng: 126.006, province: 'Surigao del Norte' }, // OSM
  'San Francisco':     { code: '166719000', psgc10: '1606719000', lat: 9.779,  lng: 125.422, province: 'Surigao del Norte' }, // OSM Town (place_rank 18 — municipality centroid)
  'San Isidro':        { code: '166720000', psgc10: '1606720000', lat: 9.937,  lng: 126.087, province: 'Surigao del Norte' }, // OSM
  'Santa Monica':      { code: '166721000', psgc10: '1606721000', lat: 10.019, lng: 126.036, province: 'Surigao del Norte' }, // OSM
  'Sison':             { code: '166722000', psgc10: '1606722000', lat: 9.659,  lng: 125.527, province: 'Surigao del Norte' }, // OSM (zip 8404)
  'Socorro':           { code: '166723000', psgc10: '1606723000', lat: 9.618,  lng: 125.966, province: 'Surigao del Norte' }, // OSM
  'City of Surigao':   { code: '166724000', psgc10: '1606724000', lat: 9.791,  lng: 125.494, province: 'Surigao del Norte' }, // OSM
  'Tagana-An':         { code: '166725000', psgc10: '1606725000', lat: 9.697,  lng: 125.583, province: 'Surigao del Norte' }, // OSM (zip 8403)
  'Tubod':             { code: '166727000', psgc10: '1606727000', lat: 9.555,  lng: 125.570, province: 'Surigao del Norte' }, // OSM (zip 8406)
  // ── Dinagat Islands ──────────────────────────────────────────────────────────
  'Basilisa':          { code: '168601000', psgc10: '1608601000', lat: 9.998,  lng: 125.510, province: 'Dinagat Islands' }, // OSM Town
  'Cagdianao':         { code: '168602000', psgc10: '1608602000', lat: 9.924,  lng: 125.670, province: 'Dinagat Islands' }, // OSM Town
  'Dinagat':           { code: '168603000', psgc10: '1608603000', lat: 9.961,  lng: 125.591, province: 'Dinagat Islands' }, // OSM Town (zip 8427)
  'Libjo':             { code: '168604000', psgc10: '1608604000', lat: 10.194, lng: 125.532, province: 'Dinagat Islands' }, // OSM Town
  'Loreto':            { code: '168605000', psgc10: '1608605000', lat: 10.360, lng: 125.579, province: 'Dinagat Islands' }, // OSM Town
  'San Jose':          { code: '168606000', psgc10: '1608606000', lat: 10.008, lng: 125.570, province: 'Dinagat Islands' }, // OSM Town (zip 8427)
  'Tubajon':           { code: '168607000', psgc10: '1608607000', lat: 10.320, lng: 125.559, province: 'Dinagat Islands' }, // OSM Town
}

// ── Province & Municipality Lists ─────────────────────────────────────────────

export const PROVINCES = [
  'Agusan del Norte',
  'Agusan del Sur',
  'Dinagat Islands',
  'Surigao del Norte',
  'Surigao del Sur',
].sort((a, b) => a.localeCompare(b))

export const MUNICIPALITIES = {
  'Agusan del Norte': [
    'Butuan City', 'Cabadbaran City',
    'Buenavista', 'Carmen', 'Jabonga', 'Kitcharao', 'Las Nieves',
    'Magallanes', 'Nasipit', 'Remedios T. Romualdez', 'Santiago', 'Tubay',
  ],
  'Agusan del Sur': [
    'Bayugan City',
    'Bunawan', 'Esperanza', 'La Paz', 'Loreto', 'Prosperidad',
    'Rosario', 'San Francisco', 'San Luis', 'Santa Josefa',
    'Sibagat', 'Talacogon', 'Trento', 'Veruela',
  ],
  'Dinagat Islands': [
    'Basilisa', 'Cagdianao', 'Dinagat', 'Libjo', 'Loreto', 'San Jose', 'Tubajon',
  ],
  'Surigao del Norte': [
    'Alegria', 'Bacuag', 'Burgos', 'Claver', 'Dapa', 'Del Carmen',
    'General Luna', 'Gigaquit', 'Mainit', 'Malimono', 'Pilar', 'Placer',
    'San Benito', 'San Francisco', 'San Isidro', 'Santa Monica',
    'City of Surigao', 'Sison', 'Socorro', 'Tagana-An', 'Tubod',
  ],
  'Surigao del Sur': [
    'Bislig City', 'Tandag City',
    'Barobo', 'Bayabas', 'Cagwait', 'Cantilan', 'Carmen', 'Carrascal',
    'Cortes', 'Hinatuan', 'Lanuza', 'Lianga', 'Lingig', 'Madrid',
    'Marihatag', 'San Agustin', 'San Miguel', 'Tago',
  ],
}

// ── Barangay Lists ────────────────────────────────────────────────────────────

export const BARANGAYS = {
  // ── Surigao del Norte — full PSGC barangay data ──────────────────────────

  'Alegria': [
    'Alipao', 'Anahaw', 'Budlingin', 'Camp Eduard', 'Ferlda', 'Gamuton',
    'Julio Ouano (Pob.)', 'Ombong', 'Poblacion', 'Pongtud', 'San Juan', 'San Pedro',
  ],

  'Bacuag': [
    'Cabugao', 'Cambuayon', 'Campo', 'Dugsangon', 'Pautao',
    'Payapag', 'Poblacion', 'Pungtod', 'Santo Rosario',
  ],

  'Burgos': [
    'Baybay', 'Bitaug', 'Matin-ao', 'Poblacion 1', 'Poblacion 2', 'San Mateo',
  ],

  'Claver': [
    'Bagakay', 'Cabugo', 'Cagdianao', 'Daywan', 'Hayanggabon',
    'Ladgaron (Pob.)', 'Lapinigan', 'Magallanes', 'Panatao',
    'Sapa', 'Taganito', 'Tayaga', 'Urbiztondo', 'Wangke',
  ],

  'Dapa': [
    'Bagakay',
    'Barangay 1 (Pob.)', 'Barangay 2 (Pob.)', 'Barangay 3 (Pob.)',
    'Barangay 4 (Pob.)', 'Barangay 5 (Pob.)', 'Barangay 6 (Pob.)',
    'Barangay 7 (Pob.)', 'Barangay 8 (Pob.)', 'Barangay 9 (Pob.)',
    'Barangay 10 (Pob.)', 'Barangay 11 (Pob.)', 'Barangay 12 (Pob.)',
    'Barangay 13 (Pob.)',
    'Buenavista', 'Cabawa', 'Cambas-ac', 'Consolacion', 'Corregidor',
    'Dagohoy', 'Don Paulino', 'Jubang', 'Montserrat', 'Osmeña',
    'San Carlos', 'San Miguel', 'Santa Fe', 'Santa Felomina', 'Union',
  ],

  'Del Carmen': [
    'Antipolo', 'Bagakay', 'Bitoon', 'Cabugao', 'Cancohoy', 'Caub',
    'Del Carmen (Pob.)', 'Domoyog', 'Esperanza', 'Halian', 'Jamoyaon',
    'Katipunan', 'Lobogon', 'Mabuhay', 'Mahayahay', 'Quezon',
    'San Fernando', 'San Jose (Pob.)', 'Sayak', 'Tuboran',
  ],

  'General Luna': [
    'Anajawan', 'Cabitoonan', 'Catangnan', 'Consuelo', 'Corazon', 'Daku',
    'La Januza', 'Libertad', 'Magsaysay', 'Malinao',
    'Poblacion I', 'Poblacion II', 'Poblacion III', 'Poblacion IV', 'Poblacion V',
    'Santa Cruz', 'Santa Fe', 'Suyangan', 'Tawin-tawin',
  ],

  'Gigaquit': [
    'Alambique (Pob.)', 'Anibongan', 'Cam-boayon', 'Camam-onan',
    'Ipil (Pob.)', 'Lahi', 'Mahanub', 'Poniente',
    'San Antonio', 'San Isidro', 'Sico-sico', 'Villaflor', 'Villafranca',
  ],

  'Mainit': [
    'Binga', 'Bobona-on', 'Cantugas', 'Dayano', 'Mabini', 'Magpayang',
    'Magsaysay (Pob.)', 'Mansayao', 'Marayag', 'Matin-ao', 'Paco',
    'Quezon (Pob.)', 'Roxas', 'San Francisco', 'San Isidro', 'San Jose',
    'Siana', 'Silop', 'Tagbuyawan', 'Tapi-an', 'Tolingon',
  ],

  'Malimono': [
    'Bunyasan', 'Can-aga', 'Cansayong', 'Cantapoy', 'Cagtinae', 'Cayawan',
    'Doro', 'Hanagdong', 'Karihatag', 'Masgad', 'Pili',
    'San Isidro (Pob.)', 'Tinago', 'Villariza',
  ],

  'Pilar': [
    'Asinan (Pob.)', 'Caridad', 'Centro (Pob.)', 'Consolacion', 'Datu',
    'Dayaohay', 'Jaboy', 'Katipunan', 'Maasin', 'Mabini', 'Mabuhay',
    'Pilaring (Pob.)', 'Punta (Pob.)', 'Salvacion', 'San Roque',
  ],

  'Placer': [
    'Amoslog', 'Anislagan', 'Bad-as', 'Boyongan', 'Bugas-bugas',
    'Central (Pob.)', 'Ellaperal', 'Ipil (Pob.)', 'Lakandula', 'Mabini',
    'Macalaya', 'Magsaysay (Pob.)', 'Magupange', 'Pananay-an', 'Panhutongan',
    'Sani-sani', 'San Isidro', 'Santa Cruz', 'Suyoc', 'Tagbongabong',
  ],

  'San Benito': [
    'Bongdo', 'Maribojoc', 'Nuevo Campo', 'San Juan',
    'Santa Cruz (Pob.)', 'Talisay (Pob.)',
  ],

  'San Francisco': [
    'Amontay', 'Balite', 'Banbanon', 'Diaz', 'Honrado', 'Jubgan',
    'Linongganan', 'Macopa', 'Magtangale', 'Oslao', 'Poblacion',
  ],

  'San Isidro': [
    'Buhing Calipay', 'Del Carmen (Pob.)', 'Del Pilar', 'Macapagal',
    'Pacifico', 'Pelaez', 'Roxas', 'San Miguel', 'Santa Paz',
    'Santo Niño', 'Tambacan', 'Tigasao',
  ],

  'Santa Monica': [
    'Abad Santos', 'Alegria', 'Bailan', 'Garcia', 'Libertad',
    'Mabini', 'Mabuhay (Pob.)', 'Magsaysay', 'Rizal', 'T. Arlan (Pob.)', 'Tangbo',
  ],

  'City of Surigao': [
    'Alang-alang', 'Alegria', 'Anomar', 'Aurora', 'Balibayon', 'Baybay',
    'Bilabid', 'Bitaugan', 'Bonifacio', 'Buenavista', 'Cabongbongan',
    'Cagniog', 'Cagutsan', 'Canlanipa', 'Cantiasay', 'Capalayan',
    'Catadman', 'Danao', 'Danawan', 'Day-asan', 'Ipil', 'Libuac',
    'Lipata', 'Lisondra', 'Luna', 'Mabini', 'Mabua', 'Manyagao',
    'Mapawa', 'Mat-i', 'Nabago', 'Nonoc', 'Orok', 'Poctoy',
    'Punta Bilar', 'Quezon', 'Rizal', 'Sabang', 'San Isidro', 'San Jose',
    'San Juan', 'San Pedro', 'San Roque', 'Serna', 'Sidlakan', 'Silop',
    'Sugbay', 'Sukailang', 'Taft (Pob.)', 'Talisay', 'Togbongon',
    'Trinidad', 'Washington (Pob.)', 'Zaragoza',
  ],

  'Sison': [
    'Biyabid', 'Gacepan', 'Ima', 'Lower Patag', 'Mabuhay', 'Mayag',
    'Poblacion', 'San Isidro', 'San Pablo', 'Tagbayani', 'Tinogpahan', 'Upper Patag',
  ],

  'Socorro': [
    'Albino Taruc', 'Del Pilar', 'Helene', 'Honrado', 'Navarro (Pob.)',
    'Nueva Estrella', 'Pamosaingan', 'Rizal (Pob.)', 'Salog', 'San Roque',
    'Santa Cruz', 'Sering', 'Songkoy', 'Sudlon',
  ],

  'Tagana-An': [
    'Aurora (Pob.)', 'Azucena (Pob.)', 'Banban', 'Cawilan', 'Fabio',
    'Himamaug', 'Laurel', 'Lower Libas', 'Opong', 'Patino',
    'Sampaguita (Pob.)', 'Talavera', 'Union', 'Upper Libas',
  ],

  'Tubod': [
    'Capayahan', 'Cawilan', 'Del Rosario', 'Marga', 'Motorpool',
    'Poblacion', 'San Isidro', 'San Pablo', 'Timamana',
  ],

  // ── Other CARAGA provinces — default fallback ─────────────────────────────
  '_default': Array.from({ length: 10 }, (_, i) => `Barangay ${i + 1}`),
}

// ── PSGC-coded Municipality Boundary Polygons ────────────────────────────────
// Approximate rectangular extents for Surigao del Norte (pilot scope)
// Each entry: name, 10-digit psgc10, 9-digit code, 4-corner coords [lat, lng]

export const MUNICIPALITY_BOUNDS = [
  // Mainland — coords centered on OSM/PSGC verified coordinates (±0.03°)
  { name: 'City of Surigao', psgc10: '1606724000', code: '166724000', coords: [[9.761,125.464],[9.821,125.464],[9.821,125.524],[9.761,125.524]] },
  { name: 'Sison',           psgc10: '1606722000', code: '166722000', coords: [[9.629,125.497],[9.689,125.497],[9.689,125.557],[9.629,125.557]] },
  { name: 'Tagana-An',       psgc10: '1606725000', code: '166725000', coords: [[9.667,125.553],[9.727,125.553],[9.727,125.613],[9.667,125.613]] },
  { name: 'Placer',          psgc10: '1606717000', code: '166717000', coords: [[9.627,125.572],[9.687,125.572],[9.687,125.632],[9.627,125.632]] },
  { name: 'Bacuag',          psgc10: '1606702000', code: '166702000', coords: [[9.578,125.608],[9.638,125.608],[9.638,125.668],[9.578,125.668]] },
  { name: 'Gigaquit',        psgc10: '1606711000', code: '166711000', coords: [[9.566,125.668],[9.626,125.668],[9.626,125.728],[9.566,125.728]] },
  { name: 'Claver',          psgc10: '1606706000', code: '166706000', coords: [[9.543,125.703],[9.603,125.703],[9.603,125.763],[9.543,125.763]] },
  { name: 'Tubod',           psgc10: '1606727000', code: '166727000', coords: [[9.525,125.540],[9.585,125.540],[9.585,125.600],[9.525,125.600]] },
  { name: 'Mainit',          psgc10: '1606714000', code: '166714000', coords: [[9.508,125.493],[9.568,125.493],[9.568,125.553],[9.508,125.553]] },
  { name: 'San Francisco',   psgc10: '1606719000', code: '166719000', coords: [[9.749,125.392],[9.809,125.392],[9.809,125.452],[9.749,125.452]] },
  { name: 'Alegria',         psgc10: '1606701000', code: '166701000', coords: [[9.434,125.546],[9.494,125.546],[9.494,125.606],[9.434,125.606]] },
  { name: 'Malimono',        psgc10: '1606715000', code: '166715000', coords: [[9.588,125.372],[9.648,125.372],[9.648,125.432],[9.588,125.432]] },
  // Siargao Island group — coords centered on OSM verified coordinates (±0.03°)
  { name: 'Santa Monica',    psgc10: '1606721000', code: '166721000', coords: [[9.989,126.006],[10.049,126.006],[10.049,126.066],[9.989,126.066]] },
  { name: 'Burgos',          psgc10: '1606704000', code: '166704000', coords: [[9.988,126.044],[10.048,126.044],[10.048,126.104],[9.988,126.104]] },
  { name: 'San Benito',      psgc10: '1606718000', code: '166718000', coords: [[9.928,125.976],[9.988,125.976],[9.988,126.036],[9.928,126.036]] },
  { name: 'San Isidro',      psgc10: '1606720000', code: '166720000', coords: [[9.907,126.057],[9.967,126.057],[9.967,126.117],[9.907,126.117]] },
  { name: 'Del Carmen',      psgc10: '1606708000', code: '166708000', coords: [[9.839,125.941],[9.899,125.941],[9.899,126.001],[9.839,126.001]] },
  { name: 'Pilar',           psgc10: '1606716000', code: '166716000', coords: [[9.834,126.070],[9.894,126.070],[9.894,126.130],[9.834,126.130]] },
  { name: 'Dapa',            psgc10: '1606707000', code: '166707000', coords: [[9.728,126.023],[9.788,126.023],[9.788,126.083],[9.728,126.083]] },
  { name: 'General Luna',    psgc10: '1606710000', code: '166710000', coords: [[9.753,126.126],[9.813,126.126],[9.813,126.186],[9.753,126.186]] },
  { name: 'Socorro',         psgc10: '1606723000', code: '166723000', coords: [[9.588,125.936],[9.648,125.936],[9.648,125.996],[9.588,125.996]] },
  // Dinagat Islands — coords centered on OSM Town coordinates (±0.03°)
  { name: 'San Jose',        psgc10: '1608606000', code: '168606000', coords: [[9.978,125.540],[10.038,125.540],[10.038,125.600],[9.978,125.600]] },
  { name: 'Dinagat',         psgc10: '1608603000', code: '168603000', coords: [[9.931,125.561],[9.991,125.561],[9.991,125.621],[9.931,125.621]] },
  { name: 'Basilisa',        psgc10: '1608601000', code: '168601000', coords: [[9.968,125.480],[10.028,125.480],[10.028,125.540],[9.968,125.540]] },
  { name: 'Cagdianao',       psgc10: '1608602000', code: '168602000', coords: [[9.894,125.640],[9.954,125.640],[9.954,125.700],[9.894,125.700]] },
  { name: 'Libjo',           psgc10: '1608604000', code: '168604000', coords: [[10.164,125.502],[10.224,125.502],[10.224,125.562],[10.164,125.562]] },
  { name: 'Tubajon',         psgc10: '1608607000', code: '168607000', coords: [[10.290,125.529],[10.350,125.529],[10.350,125.589],[10.290,125.589]] },
  { name: 'Loreto',          psgc10: '1608605000', code: '168605000', coords: [[10.330,125.549],[10.390,125.549],[10.390,125.609],[10.330,125.609]] },
]

// ── Helper Functions (unchanged API) ─────────────────────────────────────────

export function getBarangays(municipality) {
  return (BARANGAYS[municipality] ?? BARANGAYS['_default']).slice().sort((a, b) => a.localeCompare(b))
}

export function getMunicipalities(province) {
  return (MUNICIPALITIES[province] ?? []).slice().sort((a, b) => a.localeCompare(b))
}
