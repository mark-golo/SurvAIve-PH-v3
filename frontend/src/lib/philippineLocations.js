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

export const MUNICIPALITY_PSGC = {
  'Alegria':           { code: '166701000', psgc10: '1606701000', lat: 9.72,  lng: 125.48, province: 'Surigao del Norte' },
  'Bacuag':            { code: '166702000', psgc10: '1606702000', lat: 9.65,  lng: 125.64, province: 'Surigao del Norte' },
  'Burgos':            { code: '166704000', psgc10: '1606704000', lat: 9.53,  lng: 125.53, province: 'Surigao del Norte' },
  'Claver':            { code: '166706000', psgc10: '1606706000', lat: 9.57,  lng: 125.72, province: 'Surigao del Norte' },
  'Dapa':              { code: '166707000', psgc10: '1606707000', lat: 9.76,  lng: 126.05, province: 'Surigao del Norte' },
  'Del Carmen':        { code: '166708000', psgc10: '1606708000', lat: 9.85,  lng: 126.10, province: 'Surigao del Norte' },
  'General Luna':      { code: '166710000', psgc10: '1606710000', lat: 9.80,  lng: 126.17, province: 'Surigao del Norte' },
  'Gigaquit':          { code: '166711000', psgc10: '1606711000', lat: 9.57,  lng: 125.68, province: 'Surigao del Norte' },
  'Mainit':            { code: '166714000', psgc10: '1606714000', lat: 9.53,  lng: 125.55, province: 'Surigao del Norte' },
  'Malimono':          { code: '166715000', psgc10: '1606715000', lat: 9.43,  lng: 125.47, province: 'Surigao del Norte' },
  'Pilar':             { code: '166716000', psgc10: '1606716000', lat: 9.88,  lng: 125.97, province: 'Surigao del Norte' },
  'Placer':            { code: '166717000', psgc10: '1606717000', lat: 9.64,  lng: 125.60, province: 'Surigao del Norte' },
  'San Benito':        { code: '166718000', psgc10: '1606718000', lat: 9.39,  lng: 125.55, province: 'Surigao del Norte' },
  'San Francisco':     { code: '166719000', psgc10: '1606719000', lat: 9.44,  lng: 125.98, province: 'Surigao del Norte' },
  'San Isidro':        { code: '166720000', psgc10: '1606720000', lat: 10.05, lng: 126.17, province: 'Surigao del Norte' },
  'Santa Monica':      { code: '166721000', psgc10: '1606721000', lat: 9.93,  lng: 126.05, province: 'Surigao del Norte' },
  'Sison':             { code: '166722000', psgc10: '1606722000', lat: 9.51,  lng: 125.61, province: 'Surigao del Norte' },
  'Socorro':           { code: '166723000', psgc10: '1606723000', lat: 9.92,  lng: 125.95, province: 'Surigao del Norte' },
  'City of Surigao':   { code: '166724000', psgc10: '1606724000', lat: 9.79,  lng: 125.49, province: 'Surigao del Norte' },
  'Tagana-An':         { code: '166725000', psgc10: '1606725000', lat: 9.82,  lng: 125.48, province: 'Surigao del Norte' },
  'Tubod':             { code: '166727000', psgc10: '1606727000', lat: 9.76,  lng: 125.49, province: 'Surigao del Norte' },
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

// ── Helper Functions (unchanged API) ─────────────────────────────────────────

export function getBarangays(municipality) {
  return (BARANGAYS[municipality] ?? BARANGAYS['_default']).slice().sort((a, b) => a.localeCompare(b))
}

export function getMunicipalities(province) {
  return (MUNICIPALITIES[province] ?? []).slice().sort((a, b) => a.localeCompare(b))
}
