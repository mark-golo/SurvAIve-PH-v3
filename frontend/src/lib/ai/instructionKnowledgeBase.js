// AI Emergency Instruction Assistant — curated, bundled, fully offline knowledge base.
// Guidance is derived from general NDRRMC / DOH / BFP public-safety advice.
// It is general safety guidance, NOT a substitute for instructions from responders
// or authorized agencies — every consumer must render the DISCLAIMER.

export const DISCLAIMER = {
  en:  'General safety guidance only — always follow official instructions from responders and authorized agencies.',
  fil: 'Pangkalahatang gabay pangkaligtasan lamang — laging sundin ang opisyal na tagubilin ng mga responder at awtorisadong ahensya.',
  bis: 'Kinatibuk-ang giya sa kaligtasan lamang — kanunay sundon ang opisyal nga sugo sa mga responder ug awtorisadong awtoridad.',
}

const KB = {
  mdrrmo: {
    flood: {
      en: {
        title: 'Flood Safety',
        steps: [
          'Move to the highest safe level of your home or a sturdy building.',
          'Do not walk or drive through moving floodwater — 15 cm can knock you down.',
          'Switch off electricity at the main breaker if water is entering the house.',
          'Keep your phone charged and conserve battery; send your SOS once, not repeatedly.',
          'Wait for responders at a visible, elevated spot if it is safe to do so.',
        ],
        warnings: ['Never swim through floodwater.', 'Avoid downed power lines and submerged outlets.'],
      },
      fil: {
        title: 'Kaligtasan sa Baha',
        steps: [
          'Pumunta sa pinakamataas na ligtas na bahagi ng bahay o matibay na gusali.',
          'Huwag lumakad o magmaneho sa umaagos na baha — sapat na ang 15 cm para matangay ka.',
          'Patayin ang kuryente sa main breaker kung pumapasok ang tubig sa bahay.',
          'Panatilihing may baterya ang telepono; isang beses lang ipadala ang SOS.',
          'Maghintay ng responder sa mataas at nakikitang lugar kung ligtas.',
        ],
        warnings: ['Huwag lumangoy sa baha.', 'Iwasan ang mga nahulog na linya ng kuryente.'],
      },
      bis: {
        title: 'Kaligtasan sa Baha',
        steps: [
          'Adto sa pinakataas nga luwas nga bahin sa balay o lig-on nga bilding.',
          'Ayaw lakaw o magmaneho sa nagdagayday nga baha — 15 cm ra ang makabali sa imong tiil.',
          'Patya ang kuryente sa main breaker kung nagsulod na ang tubig sa balay.',
          'Tipigan ang baterya sa telepono; mapadala ang SOS usa ra ka beses.',
          'Maghulat sa responder sa taas ug makita nga dapit kung luwas.',
        ],
        warnings: ['Ayaw langa sa baha.', 'Likayi ang mga nahulog nga linya sa kuryente.'],
      },
    },
    earthquake: {
      en: {
        title: 'Earthquake Safety',
        steps: [
          'Drop, cover, and hold on under a sturdy table until shaking stops.',
          'Stay away from windows, glass, and heavy objects that can fall.',
          'If trapped under debris, tap on pipes or walls so rescuers can locate you — shout only as a last resort.',
          'Expect aftershocks; do not re-enter damaged buildings.',
          'If near the coast after strong shaking, move to high ground immediately (tsunami risk).',
        ],
        warnings: ['Do not use elevators.', 'Do not light matches — there may be gas leaks.'],
      },
      fil: {
        title: 'Kaligtasan sa Lindol',
        steps: [
          'Dapa, takip, at kapit sa ilalim ng matibay na mesa hanggang tumigil ang pagyanig.',
          'Lumayo sa bintana, salamin, at mabibigat na bagay na maaaring mahulog.',
          'Kung naipit sa guho, kumatok sa tubo o pader para matagpuan ka ng rescuer.',
          'Asahan ang aftershocks; huwag pumasok muli sa sirang gusali.',
          'Kung malapit sa dagat pagkatapos ng malakas na lindol, pumunta agad sa mataas na lugar.',
        ],
        warnings: ['Huwag gumamit ng elevator.', 'Huwag magsindi ng posporo — baka may gas leak.'],
      },
      bis: {
        title: 'Kaligtasan sa Linog',
        steps: [
          'Yapa, takop, ug kupot sa ilalim sa lig-on nga lamesa hangtod mohunong ang pagkurog.',
          'Palayo sa bintana, salamin, ug bug-at nga butang nga mahimong mahulog.',
          'Kung nabilanggo sa guba, kumadto sa tubo o pader aron makit-an ka sa rescuer.',
          'Hulaton ang aftershocks; ayaw sulod pag-usab sa guba nga bilding.',
          'Kung duul sa dagat human sa kusog nga linog, dali adto sa taas nga dapit.',
        ],
        warnings: ['Ayaw gamita ang elevator.', 'Ayaw sugnora ang posporo — basin adunay gas leak.'],
      },
    },
    typhoon: {
      en: {
        title: 'Typhoon Safety',
        steps: [
          'Stay indoors, away from windows; move to the strongest part of the structure.',
          'Follow official evacuation instructions from your barangay or MDRRMO.',
          'Secure drinking water, food, flashlight, and your charged phone in one bag.',
          'Do not go outside during the calm of the eye — winds will return suddenly.',
        ],
        warnings: ['Avoid riversides, coastlines, and landslide-prone slopes.'],
      },
      fil: {
        title: 'Kaligtasan sa Bagyo',
        steps: [
          'Manatili sa loob, malayo sa bintana; pumunta sa pinakamatibay na bahagi ng bahay.',
          'Sundin ang opisyal na utos ng pag-evacuate mula sa barangay o MDRRMO.',
          'Ihanda ang tubig, pagkain, flashlight, at naka-charge na telepono sa isang bag.',
          'Huwag lumabas kapag biglang kumalma — babalik ang malakas na hangin.',
        ],
        warnings: ['Iwasan ang tabing-ilog, tabing-dagat, at madulas na gulod.'],
      },
      bis: {
        title: 'Kaligtasan sa Bagyo',
        steps: [
          'Pabilin sa sulod, palayo sa bintana; adto sa pinaka-lig-on nga bahin sa balay.',
          'Sunda ang opisyal nga sugo sa evacuation gikan sa barangay o MDRRMO.',
          'Andama ang tubig, pagkaon, flashlight, ug naka-charge nga telepono sa usa ka bag.',
          'Ayaw gawas kung kalit nga naghilom — mobalik ang kusog nga hangin.',
        ],
        warnings: ['Likayi ang kilid sa suba, kilid sa dagat, ug madahilis nga bungdo.'],
      },
    },
    landslide: {
      en: {
        title: 'Landslide Safety',
        steps: [
          'Move across the slope, away from the path of moving earth — not downhill in its path.',
          'Listen for rumbling or cracking sounds that may signal further movement.',
          'Stay away from the slide area; slopes can fail again after the first slide.',
          'Report trapped persons and their last known location in your SOS.',
        ],
        warnings: ['Do not attempt to dig for trapped persons alone — wait for responders.'],
      },
      fil: {
        title: 'Kaligtasan sa Pagguho ng Lupa',
        steps: [
          'Lumayo pahalang sa dinadaanan ng gumuguhong lupa, hindi pababa sa daanan nito.',
          'Makinig sa dagundong o lagutok na maaaring senyales ng susunod na pagguho.',
          'Lumayo sa lugar ng pagguho; maaaring gumuho muli ang gulod.',
          'Isama sa SOS ang huling kinaroroonan ng mga naipit.',
        ],
        warnings: ['Huwag maghukay mag-isa para sa mga naipit — hintayin ang responder.'],
      },
      bis: {
        title: 'Kaligtasan sa Pagdahili sa Yuta',
        steps: [
          'Palayo sa pikas nga direksyon sa pagdahili, dili pababa sa agianan niini.',
          'Pamati sa dagundong o lagutok nga timailhan sa laing pagdahili.',
          'Palayo sa lugar sa pagdahili; mahimong mobalik ang pagdahili.',
          'Iapil sa SOS ang katapusang nahibaw-ang dapit sa mga nabiling.',
        ],
        warnings: ['Ayaw mag-ukab mag-inusara alang sa mga nabilanggo — hulaton ang responder.'],
      },
    },
    general: {
      en: {
        title: 'Disaster Safety',
        steps: [
          'Move to the safest accessible location and stay together as a group.',
          'Send one SOS with your location, number of people, and situation.',
          'Conserve phone battery: lower brightness, close other apps.',
          'Follow instructions from your barangay officials and MDRRMO.',
        ],
        warnings: [],
      },
      fil: {
        title: 'Kaligtasan sa Sakuna',
        steps: [
          'Pumunta sa pinakaligtas na lugar at manatiling magkakasama.',
          'Magpadala ng isang SOS na may lokasyon, bilang ng tao, at sitwasyon.',
          'Tipirin ang baterya: hinaan ang liwanag ng screen, isara ang ibang apps.',
          'Sundin ang tagubilin ng barangay at MDRRMO.',
        ],
        warnings: [],
      },
      bis: {
        title: 'Kaligtasan sa Kalamidad',
        steps: [
          'Adto sa labing luwas nga dapit ug pabilin nga magkauban.',
          'Magpadala ug usa ka SOS nga adunay lokasyon, gidaghanon sa tawo, ug sitwasyon.',
          'Tipigan ang baterya: panaphonan ang kahayag sa screen, sirado ang uban apps.',
          'Sunda ang sugo sa barangay ug MDRRMO.',
        ],
        warnings: [],
      },
    },
  },
  hospital: {
    bleeding: {
      en: {
        title: 'Severe Bleeding',
        steps: [
          'Apply firm, direct pressure on the wound with the cleanest cloth available.',
          'Keep pressing without lifting the cloth; add layers if blood soaks through.',
          'If a limb is bleeding, raise it above heart level while keeping pressure.',
          'Keep the person warm, still, and awake while waiting for responders.',
        ],
        warnings: ['Do not remove objects embedded in a wound — press around them.'],
      },
      fil: {
        title: 'Malubhang Pagdurugo',
        steps: [
          'Diinan nang tuloy-tuloy ang sugat gamit ang pinakamalinis na tela.',
          'Huwag angatin ang tela; magpatong pa ng tela kung tumatagos ang dugo.',
          'Kung braso o binti ang dumudugo, itaas ito nang mas mataas sa puso habang nakadiin.',
          'Painitin at panatilihing gising ang pasyente habang naghihintay ng responder.',
        ],
        warnings: ['Huwag bunutin ang bagay na nakabaon sa sugat — diinan ang paligid nito.'],
      },
      bis: {
        title: 'Grabe nga Pagdugo',
        steps: [
          'Pindota nang padayon ang samad gamit ang pinakaputli nga tela.',
          'Ayaw buhata ang tela; dagdag pa ug laing tela kung magpahiagus ang dugo.',
          'Kung bukton o tiil ang nagdugo, itaas kini nga mas taas sa kasingkasing samtang naka-pindot.',
          'Paiinit ug pabantayan ang pasyente samtang naghulat sa responder.',
        ],
        warnings: ['Ayaw buhata ang butang nga naghimutang sa samad — pindota ang palibot niini.'],
      },
    },
    unconscious: {
      en: {
        title: 'Unconscious Person',
        steps: [
          'Check for response: tap shoulders firmly and shout their name.',
          'Check breathing: watch the chest rise for up to 10 seconds.',
          'If breathing, lay them on their side (recovery position) and monitor.',
          'If NOT breathing and you are trained, start chest compressions — hard and fast at the center of the chest.',
          'State "unconscious / not breathing" clearly in your SOS.',
        ],
        warnings: ['Do not give food or water to an unconscious person.'],
      },
      fil: {
        title: 'Taong Walang Malay',
        steps: [
          'Tingnan kung tumutugon: tapikin nang mariin ang balikat at tawagin ang pangalan.',
          'Tingnan kung humihinga: bantayan ang pagtaas ng dibdib nang hanggang 10 segundo.',
          'Kung humihinga, ihiga nang patagilid (recovery position) at bantayan.',
          'Kung HINDI humihinga at marunong ka, simulan ang chest compressions sa gitna ng dibdib.',
          'Isulat nang malinaw sa SOS: "walang malay / hindi humihinga".',
        ],
        warnings: ['Huwag painumin o pakainin ang taong walang malay.'],
      },
      bis: {
        title: 'Tawo nga Walay Panimuot',
        steps: [
          'Susaa kung motubag: tapika pag-ayo ang abaga ug tawga ang iyang ngalan.',
          'Susaa kung nagginhawa: bantayi ang pagtaas sa dughan hangtod 10 segundo.',
          'Kung nagginhawa, ihigda siya sa kilid (recovery position) ug bantayi.',
          'Kung WALA magginhawa ug mahibalo ka, sugdi ang chest compressions sa tunga sa dughan.',
          'Isulat sa SOS: "walay panimuot / wala magginhawa".',
        ],
        warnings: ['Ayaw painuma o pakaona ang tawo nga walay panimuot.'],
      },
    },
    general: {
      en: {
        title: 'Medical Emergency',
        steps: [
          'Keep the patient still, comfortable, and monitored at all times.',
          'List their symptoms, known conditions, and medicines in your SOS notes.',
          'Do not give medicine, food, or drink unless advised by medical personnel.',
          'Prepare a clear path and someone to guide responders to the patient.',
        ],
        warnings: ['This guidance does not diagnose — describe symptoms to responders.'],
      },
      fil: {
        title: 'Medikal na Emergency',
        steps: [
          'Panatilihing nakapahinga at binabantayan ang pasyente.',
          'Isulat sa SOS notes ang sintomas, karamdaman, at iniinom na gamot.',
          'Huwag magbigay ng gamot, pagkain, o inumin maliban kung utos ng medikal na tauhan.',
          'Maghanda ng malinaw na daanan at taga-gabay para sa mga responder.',
        ],
        warnings: ['Hindi ito diagnosis — ilarawan ang sintomas sa mga responder.'],
      },
      bis: {
        title: 'Medikal nga Emergency',
        steps: [
          'Pabilin nga pahulaya ug bantayi ang pasyente.',
          'Isulat sa SOS notes ang mga simtoma, sakit, ug giinumang tambal.',
          'Ayaw hatagi ug tambal, pagkaon, o ilimnon gawas kung sugo sa medikal nga tauhan.',
          'Andama ang klaro nga agianan ug magtugon para sa mga responder.',
        ],
        warnings: ['Dili kini diagnosis — ihulagway ang mga simtoma sa mga responder.'],
      },
    },
  },
  bfp: {
    structure_fire: {
      en: {
        title: 'Fire Safety',
        steps: [
          'Get out immediately and stay out — do not go back for belongings.',
          'Stay low under the smoke; crawl if needed, covering your nose and mouth.',
          'Feel doors with the back of your hand — do not open hot doors.',
          'Once outside, move far from the structure and count everyone.',
          'If clothes catch fire: stop, drop, and roll.',
        ],
        warnings: ['Never use water on electrical or grease fires.', 'Never hide inside — get out.'],
      },
      fil: {
        title: 'Kaligtasan sa Sunog',
        steps: [
          'Lumabas agad at huwag nang bumalik para sa gamit.',
          'Yumuko sa ilalim ng usok; gumapang kung kailangan, takpan ang ilong at bibig.',
          'Kapain ang pinto gamit ang likod ng kamay — huwag buksan ang mainit na pinto.',
          'Paglabas, lumayo sa gusali at bilangin ang lahat.',
          'Kung nasunog ang damit: huminto, dumapa, at gumulong.',
        ],
        warnings: ['Huwag gumamit ng tubig sa sunog mula sa kuryente o mantika.', 'Huwag magtago sa loob — lumabas.'],
      },
      bis: {
        title: 'Kaligtasan sa Sunog',
        steps: [
          'Gawas dayon ug ayaw na mobalik alang sa mga butang.',
          'Yukbo sa ilalim sa aso; gapang kung kinahanglan, tabonan ang ilong ug baba.',
          'Hikapa ang pinto gamit ang likod sa kamot — ayaw bukhara ang mainit nga pinto.',
          'Paggawas, palayo sa bilding ug ihilway ang tanan.',
          'Kung nasunog ang sinina: hunong, humba, ug mugol.',
        ],
        warnings: ['Ayaw gamita ang tubig sa sunog gikan sa kuryente o mantika.', 'Ayaw magtago sulod — gawas.'],
      },
    },
    general: {
      en: {
        title: 'Fire / Smoke Emergency',
        steps: [
          'Evacuate everyone immediately; do not fight a spreading fire yourself.',
          'Close doors behind you to slow the fire’s spread.',
          'Report trapped persons and the exact floor/room in your SOS.',
        ],
        warnings: ['Smoke is the main killer — stay low and get out fast.'],
      },
      fil: {
        title: 'Emergency sa Sunog / Usok',
        steps: [
          'Palabasin agad ang lahat; huwag labanan mag-isa ang kumakalat na apoy.',
          'Isara ang mga pinto pagkalabas para bagalan ang pagkalat ng apoy.',
          'Isama sa SOS kung may naipit at ang eksaktong palapag o kwarto.',
        ],
        warnings: ['Ang usok ang pangunahing pumapatay — yumuko at lumabas agad.'],
      },
      bis: {
        title: 'Emergency sa Sunog / Aso',
        steps: [
          'Palabasa dayon ang tanan; ayaw labana mag-inusara ang nagkuyanap nga kalayo.',
          'Isira ang mga pinto paggawas aron pabagalan ang pagkuyanap sa kalayo.',
          'Iapil sa SOS kung adunay nabilanggo ug ang eksaktong salog o kwarto.',
        ],
        warnings: ['Ang aso ang nag-unang nagpatay — yukbo ug gawas dayon.'],
      },
    },
  },
  pnp: {
    general: {
      en: {
        title: 'Security Emergency',
        steps: [
          'Move to a safe, lockable location away from the threat if possible.',
          'Stay quiet; set your phone to silent while sending your SOS.',
          'Note what you can safely observe: how many persons, weapons, direction of travel.',
          'Do not confront or chase anyone — wait for police responders.',
        ],
        warnings: ['Your safety comes first — do not risk yourself to record or intervene.'],
      },
      fil: {
        title: 'Emergency sa Seguridad',
        steps: [
          'Pumunta sa ligtas at maisasarang lugar, malayo sa banta.',
          'Manahimik; i-silent ang telepono habang nagpapadala ng SOS.',
          'Itala ang ligtas mong namamasid: ilan sila, may armas ba, saan papunta.',
          'Huwag harapin o habulin ang sinuman — hintayin ang pulis.',
        ],
        warnings: ['Kaligtasan mo ang una — huwag makialam para lang maka-video.'],
      },
      bis: {
        title: 'Emergency sa Seguridad',
        steps: [
          'Adto sa luwas ug masiraduhang dapit, palayo sa hulga.',
          'Pugngi ang imong kaugalingon; i-silent ang telepono samtang nagpadala ug SOS.',
          'Itala ang luwas mong nakita: pila sila, adunay armas ba, asa padulong.',
          'Ayaw atubanga o sundon ang bisan kinsa — hulaton ang pulis.',
        ],
        warnings: ['Ang imong kaligtasan ang una — ayaw mag-apil para makakuha ug video.'],
      },
    },
  },
  pcg: {
    capsized: {
      en: {
        title: 'Capsized Vessel',
        steps: [
          'Stay with the boat if it is still floating — it is easier to spot than a swimmer.',
          'Hold on to anything that floats; conserve energy, avoid unnecessary swimming.',
          'Keep the group together; link arms in a circle to stay visible and warm.',
          'Signal rescuers with bright cloth, mirror flashes, or phone light at night.',
        ],
        warnings: ['Do not swim for shore unless it is clearly close and conditions allow.'],
      },
      fil: {
        title: 'Tumaob na Sasakyang-Dagat',
        steps: [
          'Manatili sa bangka kung lumulutang pa — mas madali itong makita kaysa manlalangoy.',
          'Kumapit sa anumang lumulutang; magtipid ng lakas, iwasang lumangoy nang walang dahilan.',
          'Magsama-sama ang grupo; magkabit-bisig nang pabilog para manatiling kita at mainit.',
          'Sumenyas sa rescuer gamit ang makulay na tela o ilaw ng telepono sa gabi.',
        ],
        warnings: ['Huwag lumangoy papunta sa pampang maliban kung tiyak na malapit ito.'],
      },
      bis: {
        title: 'Nabaliskad nga Sakayan',
        steps: [
          'Pabilin sa sakayan kung lumulutaw pa — mas sayon kining makita kaysa sa manlalangoy.',
          'Kupti ang bisan unsa nga lumulutaw; tipigan ang kusog, likayi ang paglangoy nga walay rason.',
          'Magtipon-tipon ang grupo; mag-abrasong bilog aron magpabilin nga makita ug init.',
          'Sunyasan ang rescuer gamit ang hayag nga tela o suga sa telepono sa gabii.',
        ],
        warnings: ['Ayaw langa padulong sa baybayon gawas kung siguradong duul kini.'],
      },
    },
    general: {
      en: {
        title: 'Maritime Emergency',
        steps: [
          'Put on life jackets or hold flotation devices immediately.',
          'Send your SOS with your last known position, vessel name, and persons on board.',
          'Stay together and keep a lookout for rescue vessels.',
        ],
        warnings: ['Follow instructions from the Coast Guard once contact is made.'],
      },
      fil: {
        title: 'Emergency sa Dagat',
        steps: [
          'Magsuot agad ng life jacket o kumapit sa panglutang.',
          'Ipadala ang SOS na may huling posisyon, pangalan ng bangka, at bilang ng sakay.',
          'Magsama-sama at magbantay ng rescue vessel.',
        ],
        warnings: ['Sundin ang tagubilin ng Coast Guard kapag nakausap na.'],
      },
      bis: {
        title: 'Emergency sa Dagat',
        steps: [
          'Isul-ob dayon ang life jacket o kupti ang lumulutaw.',
          'Ipadala ang SOS nga adunay katapusang posisyon, ngalan sa barko, ug gidaghanon sa sakay.',
          'Magtipon-tipon ug magbantay sa rescue vessel.',
        ],
        warnings: ['Sunda ang sugo sa Coast Guard kung nakugnit na.'],
      },
    },
  },
  universal: {
    general: {
      en: {
        title: 'Emergency Guidance',
        steps: [
          'Stay calm and move to the safest accessible place.',
          'Send one SOS with your location, the number of people, and what happened.',
          'Conserve phone battery — lower brightness and close unused apps.',
          'Stay where responders can find you; avoid moving unless unsafe.',
        ],
        warnings: [],
      },
      fil: {
        title: 'Gabay sa Emergency',
        steps: [
          'Manatiling kalmado at pumunta sa pinakaligtas na lugar.',
          'Magpadala ng isang SOS na may lokasyon, bilang ng tao, at nangyari.',
          'Tipirin ang baterya — hinaan ang screen at isara ang ibang apps.',
          'Manatili kung saan ka makikita ng responder, maliban kung delikado.',
        ],
        warnings: [],
      },
      bis: {
        title: 'Giya sa Emergency',
        steps: [
          'Pabilin nga malinawon ug adto sa labing luwas nga dapit.',
          'Magpadala ug usa ka SOS nga adunay lokasyon, gidaghanon sa tawo, ug nahitabo.',
          'Tipigan ang baterya — panaphonan ang screen ug isira ang uban apps.',
          'Pabilin kung diin ka makita sa responder, gawas kung delikado.',
        ],
        warnings: [],
      },
    },
  },
}

// Map condition flags to the most relevant KB entry when no subtype matched
const CONDITION_TO_KB = {
  flooding:            ['mdrrmo', 'flood'],
  fire:                ['bfp', 'structure_fire'],
  structural_collapse: ['mdrrmo', 'earthquake'],
  medical_emergency:   ['hospital', 'general'],
}

export function getAvailableLanguages() { return ['en', 'fil', 'bis'] }

// → { title, steps[], warnings[], source, disclaimer }
// Resolution: service+subtype → service general → condition mapping → universal.
export function getInstructions({ serviceType = null, subtype = null, conditions = [] } = {}, lang = 'en') {
  const L = getAvailableLanguages().includes(lang) ? lang : 'en'
  let entry = null
  if (serviceType && KB[serviceType]) {
    entry = (subtype && KB[serviceType][subtype]) || KB[serviceType].general || null
  }
  if (!entry) {
    for (const c of conditions) {
      const path = CONDITION_TO_KB[c]
      if (path && KB[path[0]]?.[path[1]]) { entry = KB[path[0]][path[1]]; break }
    }
  }
  if (!entry) entry = KB.universal.general
  const localized = entry[L] ?? entry.en
  return {
    ...localized,
    source:     'Bundled offline guidance (NDRRMC / DOH / BFP-derived)',
    disclaimer: DISCLAIMER[L] ?? DISCLAIMER.en,
  }
}
