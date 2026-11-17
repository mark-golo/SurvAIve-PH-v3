// Multilingual emergency lexicon — English (en), Filipino/Tagalog (fil), Bisaya/Cebuano (bis).
// All terms are lowercase and diacritic-free; matching is done on normalized text with
// word boundaries (see emergencyIntelligence.normalizeText / buildMatcher).
// Superset of the voice-keyword regexes previously in SOSReport.applyKeywords.

// Keys mirror the existing service_type taxonomy: mdrrmo | hospital | bfp | pnp | pcg
export const SERVICE_LEXICON = {
  mdrrmo: {
    label: 'Disaster (MDRRMO)',
    subtypes: {
      flood: {
        en:  ['flood', 'flooding', 'rising water', 'water rising', 'submerged', 'flash flood', 'overflow'],
        fil: ['baha', 'bumabaha', 'binabaha', 'lumulubog', 'tumataas ang tubig', 'nagbabaha'],
        bis: ['lunop', 'nagbaha', 'nagataas ang tubig', 'gibahaan'],
      },
      earthquake: {
        en:  ['earthquake', 'aftershock', 'tremor', 'quake'],
        fil: ['lindol', 'paglindol', 'yumanig'],
        bis: ['linog', 'nilinog'],
      },
      typhoon: {
        en:  ['typhoon', 'storm surge', 'strong winds', 'storm', 'cyclone', 'heavy rain'],
        fil: ['bagyo', 'malakas na hangin', 'unos', 'malakas na ulan'],
        bis: ['bagyo', 'kusog nga hangin'],
      },
      landslide: {
        en:  ['landslide', 'mudslide', 'erosion', 'rockslide'],
        fil: ['pagguho ng lupa', 'gumuho ang lupa', 'pagguho'],
        bis: ['pagdahili sa yuta', 'nadahili'],
      },
      collapse: {
        en:  ['collapsed', 'collapse', 'building fell', 'debris', 'rubble', 'cave in'],
        fil: ['gumuho', 'gusali', 'nabagsakan', 'guho'],
        bis: ['nahugno', 'natumpag'],
      },
    },
  },
  hospital: {
    label: 'Medical',
    subtypes: {
      cardiac: {
        en:  ['heart attack', 'chest pain', 'cardiac', 'heart'],
        fil: ['atake sa puso', 'sumasakit ang dibdib', 'puso'],
        bis: ['atake sa kasingkasing', 'sakit sa dughan'],
      },
      breathing: {
        en:  ['cannot breathe', "can't breathe", 'breathing', 'choking', 'asthma', 'difficulty breathing'],
        fil: ['hindi makahinga', 'hirap huminga', 'hika', 'nahihirapang huminga'],
        bis: ['dili makaginhawa', 'lisod moginhawa'],
      },
      bleeding: {
        en:  ['bleeding', 'blood loss', 'hemorrhage', 'deep wound'],
        fil: ['dinudugo', 'dumudugo', 'malalim na sugat'],
        bis: ['nagdugo', 'gidugo', 'lalom nga samad'],
      },
      unconscious: {
        en:  ['unconscious', 'not breathing', 'unresponsive', 'fainted', 'seizure', 'stroke', 'collapsed person'],
        fil: ['walang malay', 'hinimatay', 'nawalan ng malay', 'kombulsyon'],
        bis: ['walay panimuot', 'gikuyapan'],
      },
      labor: {
        en:  ['giving birth', 'labor', 'pregnant emergency', 'contractions'],
        fil: ['manganganak', 'nanganganak', 'naglalabor'],
        bis: ['manganak', 'nagbati'],
      },
      general_medical: {
        en:  ['medical', 'diabetic', 'overdose', 'poisoning', 'high fever', 'injury', 'fracture', 'broken bone'],
        fil: ['nasaktan', 'nalason', 'mataas na lagnat', 'bali', 'may sakit'],
        bis: ['nasamdan', 'nahilo', 'taas nga hilanat'],
      },
    },
  },
  bfp: {
    label: 'Fire (BFP)',
    subtypes: {
      structure_fire: {
        en:  ['fire', 'burning', 'flames', 'house on fire', 'building on fire'],
        fil: ['sunog', 'nasusunog', 'nagliliyab', 'apoy'],
        bis: ['nasunog', 'nagdilaab', 'kalayo'],
      },
      smoke: {
        en:  ['smoke', 'smoke inhalation', 'gas leak', 'lpg leak'],
        fil: ['usok', 'nakalanghap ng usok', 'tagas ng gas'],
        bis: ['aso', 'nakasimhot og aso'],
      },
    },
  },
  pnp: {
    label: 'Crime / Security (PNP)',
    subtypes: {
      violence: {
        en:  ['attacked', 'assault', 'stabbed', 'shot', 'gun', 'knife', 'violence', 'fighting', 'hostage', 'threatened'],
        fil: ['sinaksak', 'binaril', 'baril', 'patalim', 'inaaway', 'ginugulpi', 'tinutukan'],
        bis: ['gidunggab', 'gipusil', 'gikulata'],
      },
      theft: {
        en:  ['robbery', 'robbed', 'stolen', 'burglar', 'thief', 'holdup', 'break in', 'intruder'],
        fil: ['ninakawan', 'nakawan', 'magnanakaw', 'hinoldap', 'akyat bahay'],
        bis: ['gikawatan', 'kawatan', 'gitulis'],
      },
      abduction: {
        en:  ['kidnapped', 'abducted', 'taken', 'kidnapping'],
        fil: ['kinidnap', 'dinukot', 'kidnap'],
        bis: ['gikidnap', 'gidagit'],
      },
    },
  },
  pcg: {
    label: 'Maritime (PCG)',
    subtypes: {
      capsized: {
        en:  ['capsized', 'boat sank', 'sinking', 'boat accident', 'shipwreck', 'vessel'],
        fil: ['tumaob', 'lumubog ang bangka', 'lumulubog', 'aksidente sa bangka'],
        bis: ['nakuyang', 'nalunod ang bangka', 'naunlod'],
      },
      drowning: {
        en:  ['drowning', 'drowned', 'swept away', 'swept by current'],
        fil: ['nalulunod', 'nalunod', 'tinangay ng agos'],
        bis: ['nalumos', 'gianod'],
      },
      lost_at_sea: {
        en:  ['lost at sea', 'missing at sea', 'stranded at sea', 'adrift', 'no fuel at sea'],
        fil: ['nawawala sa dagat', 'naanod', 'walang gasolina sa laot'],
        bis: ['nawala sa dagat', 'gianod sa lawod'],
      },
    },
  },
}

// Victim status — keys mirror the existing SOS status values (trapped | injured | missing)
export const STATUS_LEXICON = {
  trapped: {
    en:  ['trapped', 'stuck', 'cannot move', "can't move", 'cannot get out', "can't get out", 'pinned', 'locked in'],
    fil: ['naipit', 'hindi makalabas', 'nakakulong', 'naiipit', 'nakulong', 'hindi makagalaw'],
    bis: ['napiit', 'dili makagawas', 'nakulong', 'naipit'],
  },
  injured: {
    en:  ['injured', 'hurt', 'bleeding', 'broken', 'wound', 'wounded', 'fracture', 'burned'],
    fil: ['sugatan', 'sugat', 'nasaktan', 'nasugatan', 'bali', 'napaso', 'dinudugo'],
    bis: ['samad', 'nasamdan', 'samdan', 'napaso', 'nagdugo'],
  },
  missing: {
    en:  ['missing', 'lost', 'cannot find', "can't find", 'disappeared'],
    fil: ['nawawala', 'nawala', 'hindi makita', 'di namin makita'],
    bis: ['nawala', 'wala makita', 'nawagtang'],
  },
}

// Special conditions — keys mirror the existing special_conditions values
export const CONDITION_LEXICON = {
  medical_emergency: {
    en:  ['medical', 'heart', 'seizure', 'unconscious', 'breathing', 'stroke', 'diabetic', 'bleeding', 'pregnant', 'giving birth'],
    fil: ['atake sa puso', 'walang malay', 'hindi makahinga', 'dinudugo', 'buntis', 'manganganak', 'may sakit'],
    bis: ['walay panimuot', 'dili makaginhawa', 'nagdugo', 'buntis', 'manganak'],
  },
  fire: {
    en:  ['fire', 'burning', 'flames', 'smoke'],
    fil: ['nasusunog', 'sunog', 'apoy', 'usok', 'nagliliyab'],
    bis: ['nasunog', 'kalayo', 'aso', 'nagdilaab'],
  },
  structural_collapse: {
    en:  ['collapse', 'collapsed', 'debris', 'rubble', 'building fell', 'cave in', 'pinned under'],
    fil: ['gumuho', 'gusali', 'guho', 'nabagsakan', 'naipit sa guho'],
    bis: ['nahugno', 'natumpag', 'naipit sa guba'],
  },
  flooding: {
    en:  ['flood', 'flooding', 'submerged', 'water rising', 'rising water', 'flash flood'],
    fil: ['baha', 'bumabaha', 'binabaha', 'tumataas ang tubig', 'lumulubog'],
    bis: ['lunop', 'nagbaha', 'nagataas ang tubig'],
  },
}

// Vulnerable individuals — child/senior map to victim_age_group; others are flags
export const VULNERABILITY_LEXICON = {
  child: {
    en:  ['child', 'children', 'baby', 'infant', 'kid', 'kids', 'toddler', 'newborn'],
    fil: ['bata', 'mga bata', 'sanggol', 'anak na maliit'],
    bis: ['bata', 'mga bata', 'puya', 'gamay nga bata'],
  },
  senior: {
    en:  ['senior', 'elderly', 'old man', 'old woman', 'grandmother', 'grandfather', 'grandma', 'grandpa'],
    fil: ['matanda', 'lolo', 'lola', 'nakatatanda', 'matandang'],
    bis: ['tigulang', 'lolo', 'lola'],
  },
  pregnant: {
    en:  ['pregnant', 'expecting'],
    fil: ['buntis', 'nagdadalang tao'],
    bis: ['buntis', 'mabdos'],
  },
  pwd: {
    en:  ['disabled', 'wheelchair', 'pwd', 'cannot walk', "can't walk", 'blind', 'deaf', 'paralyzed'],
    fil: ['may kapansanan', 'hindi makalakad', 'di makalakad', 'bulag', 'bingi', 'paralisado'],
    bis: ['dili makalakaw', 'baldado', 'buta', 'bungol'],
  },
}

// Number words for victim-count extraction (digits are handled separately)
export const NUMBER_WORDS = {
  en:  { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  fil: { isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10 },
  bis: { usa: 1, duha: 2, tulo: 3, upat: 4, lima: 5, unom: 6, pito: 7, walo: 8, siyam: 9, napulo: 10 },
}

// Phrases that typically precede a landmark description
export const LANDMARK_MARKERS = {
  en:  ['near the', 'near', 'beside the', 'beside', 'behind the', 'behind', 'in front of', 'next to', 'across from'],
  fil: ['malapit sa', 'tabi ng', 'sa may', 'sa likod ng', 'sa harap ng', 'katapat ng'],
  bis: ['duol sa', 'tapad sa', 'luyo sa', 'atubangan sa'],
}
