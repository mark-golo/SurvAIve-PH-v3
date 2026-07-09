// Bundled offline location data for Philippine cascading dropdowns
// Subset for demo — in production use full PSGC dataset

export const PROVINCES = [
  'Cebu', 'Leyte', 'Iloilo', 'Metro Manila', 'Davao del Sur',
  'Laguna', 'Cavite', 'Bulacan', 'Batangas', 'Negros Occidental',
  'Pangasinan', 'Nueva Ecija', 'Pampanga', 'Zamboanga del Sur', 'Misamis Oriental',
  'Surigao del Norte',
].sort((a, b) => a.localeCompare(b))

export const MUNICIPALITIES = {
  'Cebu': ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Talisay', 'Danao', 'Carcar', 'Toledo'],
  'Leyte': ['Tacloban City', 'Ormoc City', 'Baybay City', 'Palo', 'Tanauan', 'Dulag'],
  'Iloilo': ['Iloilo City', 'Passi City', 'Oton', 'Pavia', 'Santa Barbara', 'Leganes'],
  'Metro Manila': ['Quezon City', 'Manila', 'Makati', 'Pasig', 'Taguig', 'Caloocan', 'Marikina', 'Parañaque'],
  'Davao del Sur': ['Davao City', 'Digos City', 'Hagonoy', 'Padada', 'Sta. Cruz', 'Sulop'],
  'Laguna': ['Calamba City', 'Santa Rosa City', 'San Pedro City', 'Biñan City', 'Cabuyao City', 'Bay', 'Los Baños'],
  'Cavite': ['Bacoor City', 'Imus City', 'Dasmariñas City', 'General Trias City', 'Trece Martires City', 'Kawit'],
  'Bulacan': ['Malolos City', 'San Jose del Monte City', 'Meycauayan City', 'Marilao', 'Bocaue', 'Balagtas'],
  'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City', 'Santo Tomas', 'Sto. Tomas', 'Taal', 'Lemery'],
  'Negros Occidental': ['Bacolod City', 'Bago City', 'Cadiz City', 'Escalante City', 'Himamaylan City', 'Kabankalan City'],
  'Pangasinan': ['Dagupan City', 'San Carlos City', 'Urdaneta City', 'Alaminos City', 'Lingayen', 'Calasiao'],
  'Nueva Ecija': ['Cabanatuan City', 'Gapan City', 'Palayan City', 'Science City of Muñoz', 'Talavera', 'Guimba'],
  'Pampanga': ['Angeles City', 'San Fernando City', 'Mabalacat City', 'Arayat', 'Candaba', 'Guagua'],
  'Zamboanga del Sur': ['Pagadian City', 'Zamboanga City', 'Molave', 'Dumingag', 'Tambulig'],
  'Misamis Oriental': ['Cagayan de Oro City', 'Gingoog City', 'El Salvador City', 'Villanueva', 'Tagoloan'],
  'Surigao del Norte': [
    'Surigao City', 'Alegria', 'Bacuag', 'Burgos', 'Claver',
    'Dapa', 'Del Carmen', 'General Luna', 'Gigaquit', 'Mainit',
    'Malimono', 'Pilar', 'Placer', 'San Benito', 'San Francisco (Anao-Aon)',
    'San Isidro', 'Santa Monica', 'Sison', 'Socorro', 'Tagana-an', 'Tubod',
  ],
}

export const BARANGAYS = {
  'Tacloban City': ['Barangay 1', 'Barangay 2', 'Barangay 3', 'Abucay', 'Sto. Niño', 'Sagkahan', 'Suhi', 'Utap'],
  'Cebu City':     ['Lahug', 'Mabolo', 'Talamban', 'Banilad', 'Guadalupe', 'Pardo', 'Tisa', 'Basak Pardo'],
  'Quezon City':   ['Batasan Hills', 'Commonwealth', 'Fairview', 'Novaliches', 'Cubao', 'Diliman', 'Kamuning'],
  'Davao City':    ['Agdao', 'Buhangin', 'Bunawan', 'Calinan', 'Marilog', 'Paquibato', 'Talomo', 'Toril'],
  'Iloilo City':   ['Jaro', 'Molo', 'La Paz', 'Arevalo', 'Mandurriao', 'City Proper', 'Lapuz'],
  'Surigao City':  [
    'Alegria', 'Aurora', 'Balibayon', 'Bangcag',
    'Barangay I (Pob.)', 'Barangay II (Pob.)', 'Barangay III (Pob.)',
    'Barangay IV (Pob.)', 'Barangay V (Pob.)', 'Barangay VI (Pob.)',
    'Barangay VII (Pob.)', 'Barangay VIII (Pob.)',
    'Buenavista', 'Cagniog', 'Cagutsan', 'Cantiasay', 'Day-asan',
    'Ipil', 'Lipata', 'Luna', 'Mabua', 'Mabuhay', 'Nonoc', 'Orok',
    'Sabang', 'San Juan', 'Talisay', 'Togbongon', 'Trinidad', 'Washington',
  ],
  'Burgos': ['Baybay', 'Bitaug', 'Matin-ao', 'Poblacion 1', 'Poblacion 2', 'San Mateo'],
  'Dapa': [
    'Bagakay', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
    'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10', 'Barangay 11',
    'Barangay 12', 'Barangay 13', 'Buenavista', 'Cabawa', 'Cambas-ac', 'Consolacion',
    'Corregidor', 'Dagohoy', 'Don Paulino', 'Jubang', 'Montserrat', 'Osmeña',
    'San Carlos', 'San Miguel', 'Santa Fe', 'Santa Filomena', 'Union',
  ],
  'Del Carmen': [
    'Alburo (Bagakay)', 'Antipolo', 'Bitoon', 'Cabugao', 'Cancohoy', 'Caub',
    'Del Carmen', 'Domoyog', 'Esperanza', 'Halian', 'Jamoyaon', 'Katipunan',
    'Lobogon', 'Mabuhay', 'Mahayahay', 'Quezon', 'San Fernando', 'San Jose',
    'Sayak', 'Tuboran',
  ],
  'General Luna': [
    'Anajawan', 'Cabitoonan', 'Catangnan', 'Consuelo', 'Corazon', 'Daku',
    'La Januza', 'Libertad', 'Magsaysay', 'Malinao', 'Poblacion I', 'Poblacion II',
    'Poblacion III', 'Poblacion IV', 'Poblacion V', 'Santa Cruz', 'Santa Fe',
    'Suyangan', 'Tawin-tawin',
  ],
  'Pilar': [
    'Asinan', 'Caridad', 'Centro', 'Consolacion', 'Datu', 'Dayaohay',
    'Jaboy', 'Katipunan', 'Maasin', 'Mabini', 'Mabuhay', 'Pilaring',
    'Punta', 'Salvacion', 'San Roque',
  ],
  'San Benito': ['Bongdo', 'Maribojoc', 'Nuevo Campo', 'San Juan', 'Santa Cruz', 'Talisay'],
  'San Isidro': [
    'Buhing Calipay', 'Del Carmen', 'Del Pilar', 'Macapagal', 'Pacifico',
    'Pelaez', 'Roxas', 'San Miguel', 'Santa Paz', 'Santo Niño', 'Tambacan', 'Tigasao',
  ],
  'Santa Monica': [
    'Abad Santos', 'Alegria', 'Bailan', 'Garcia', 'Libertad',
    'Mabini', 'Mabuhay', 'Magsaysay', 'Rizal', 'T. Arlan', 'Tangbo',
  ],
  'Socorro': [
    'Del Pilar', 'Don Albino Taruc', 'Doña Helene', 'Honrado', 'Navarro',
    'Nueva Estrella', 'Pamosaingan', 'Rizal', 'Salog', 'San Roque',
    'Santa Cruz', 'Sering', 'Songkoy', 'Sudlon',
  ],
  'Claver': [
    'Bagakay', 'Cagdianao', 'Daywan', 'Ibajay', 'Ladgaron',
    'Larap', 'Makna', 'Napnapan Norte', 'Napnapan Sur', 'Panatao',
    'Poblacion I', 'Poblacion II', 'Tayaga', 'Urbiztondo', 'Wangke',
  ],
  'Mainit': [
    'Balibayon', 'Bugta', 'Cantugas', 'Dayano', 'Kahaponan',
    'Matin-ao', 'Matugas Alto', 'Matugas Bajo', 'Ngan', 'Patrocinio',
    'Poblacion I', 'Poblacion II', 'Poblacion III', 'Siana', 'Silop',
  ],
  // default fallback
  '_default': Array.from({ length: 10 }, (_, i) => `Barangay ${i + 1}`),
}

export function getBarangays(municipality) {
  return (BARANGAYS[municipality] ?? BARANGAYS['_default']).slice().sort((a, b) => a.localeCompare(b))
}

export function getMunicipalities(province) {
  return (MUNICIPALITIES[province] ?? []).slice().sort((a, b) => a.localeCompare(b))
}
