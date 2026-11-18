/**
 * policyKnowledgeBase.js — Static keyword-indexed Philippines DRRM policy library.
 *
 * Pattern: same approach as responderKnowledgeBase.js (keyword-indexed procedures
 * replacing full RAG). Each entry cites its authoritative source document.
 *
 * Sources: Republic Act 10121 (PDRRMA 2010), RA 10121 IRR, NDRRMC issuances,
 *          DSWD circulars, DBM Budget Circular 2013-2.
 */

export const POLICY_KB = [
  // ── RA 10121 — Key Definitions ───────────────────────────────────────────────
  {
    id:         'ra10121-s3-disaster',
    title:      'Definition of Disaster',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(d)',
    tags:       ['disaster','definition','hazard','vulnerability','community','serious disruption'],
    body:       'Disaster — a serious disruption of the functioning of a community or a society involving widespread human, material, economic or environmental losses and impacts, which exceeds the ability of the affected community or society to cope using its own resources. Disasters are often described as a result of the combination of exposure to a hazard, the conditions of vulnerability that are present, and insufficient capacity or measures to reduce or cope with the potential negative consequences.',
  },
  {
    id:         'ra10121-s3-drrm',
    title:      'Definition of Disaster Risk Reduction and Management (DRRM)',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(e)',
    tags:       ['drrm','definition','disaster risk reduction','management','systematic','policies'],
    body:       'Disaster Risk Reduction and Management — the systematic process of using administrative directives, organizations, and operational skills and capacities to implement strategies, policies and improved coping capacities in order to lessen the adverse impacts of hazards and the possibility of disaster. Prospective disaster risk reduction and management refers to risk reduction and management activities that address and seek to avoid the development of new or increased disaster risks.',
  },
  {
    id:         'ra10121-s3-stateofcalamity',
    title:      'Definition of State of Calamity',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(aa)',
    tags:       ['state of calamity','declaration','calamity','definition','local government'],
    body:       'State of Calamity — a condition involving mass casualty and/or major damages to property, disruption of means of livelihoods, roads and normal way of life of people in the affected areas as a result of the occurrence of natural or human-induced hazard.',
  },
  // ── RA 10121 — NDRRMC Roles ───────────────────────────────────────────────────
  {
    id:         'ra10121-s6-ndrrmc',
    title:      'National DRRM Council (NDRRMC) Composition and Functions',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 6',
    tags:       ['ndrrmc','national','council','composition','function','coordination','chairperson',
                 'secretary','OCD','national disaster'],
    body:       'The NDRRMC is headed by the Secretary of National Defense as Chairperson. It serves as the national coordinating, integrating, supervising, and advisory body for DRRM. Its functions include advising the President on the status of disaster preparedness, response, and rehabilitation; developing the National DRRM Framework; ensuring a coherent and integrated approach to DRRM; monitoring and evaluating LGU compliance; and recommending disaster risk financing.',
  },
  // ── RA 10121 — LGU Responsibilities ──────────────────────────────────────────
  {
    id:         'ra10121-s11-ldrrmf',
    title:      'Local Disaster Risk Reduction and Management Fund (LDRRMF)',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 21',
    tags:       ['ldrrmf','local fund','5 percent','ira','quick response fund','qrf','standby fund',
                 'lgu budget','resource mobilization','calamity fund'],
    body:       'LGUs shall set aside not less than five percent (5%) of their estimated revenue from regular sources as the Local Disaster Risk Reduction and Management Fund (LDRRMF). Of this amount, 70% shall be allocated for pre-disaster activities such as risk assessment and early warning; and 30% shall be allocated as Quick Response Fund (QRF) or standby fund for relief and recovery programs. The QRF is released immediately after a declaration of a state of calamity or upon determination that such fund is needed to meet the immediate needs of disaster victims.',
  },
  {
    id:         'ra10121-s12-ldrrmo',
    title:      'Local Disaster Risk Reduction and Management Office (LDRRMO) Mandate',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 12',
    tags:       ['ldrrmo','local office','mandate','function','coordinator','local disaster',
                 'municipal','city','province','drrm officer','lgu duties'],
    body:       'Every province, city and municipality shall establish a Local DRRM Office (LDRRMO) which shall be headed by a DRRM Officer. The LDRRMO shall be responsible for: (a) designing, programming and coordinating disaster risk reduction and management activities; (b) formulating the Local DRRM Plan; (c) identifying and assessing disaster risks; (d) operating and maintaining multi-hazard early warning systems; (e) formulating and implementing a comprehensive and integrated DRRM plan; (f) coordinating disaster risk reduction and management research; (g) facilitating risk assessments and contingency planning; (h) disseminating information on disaster risks; and (i) establishing linkages with other LGUs for DRRM activities.',
  },
  {
    id:         'ra10121-s15-bdrrmc',
    title:      'Barangay Disaster Risk Reduction and Management Committee (BDRRMC)',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 15',
    tags:       ['bdrrmc','barangay','committee','composition','punong barangay','function',
                 'community','grassroots','barangay drrm'],
    body:       'Every barangay shall establish a Barangay DRRM Committee (BDRRMC) chaired by the Punong Barangay. The BDRRMC is responsible for: (a) approving and implementing the Barangay DRRM Plan; (b) coordinating, integrating, supervising and evaluating DRRM activities at the barangay level; (c) operating the Barangay DRRM center; (d) preparing and submitting assessment and situation reports; (e) establishing early warning systems at the barangay level; and (f) coordinating with the city/municipal LDRRMO.',
  },
  // ── RA 10121 — Declaration of State of Calamity ──────────────────────────────
  {
    id:         'ra10121-s16-stateofcalamity',
    title:      'Declaration of State of Calamity — Procedure and Effects',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 16',
    tags:       ['state of calamity','declaration','sanggunian','local chief executive','price control',
                 'calamity declaration','lgu','provincial','city council','municipal','effects'],
    body:       'A state of calamity may be declared by the local Sanggunian at the provincial, city, or municipal level upon recommendation of the local chief executive. Effects include: (a) the activation of the Quick Response Fund; (b) no-interest loans extended to disaster victims; (c) price monitoring for basic goods and price controls to prevent hoarding and profiteering; (d) programming/reprogramming of funds by the local chief executive to respond to the disaster; (e) waiver of permits for transport of relief goods; and (f) purchase/lease of necessary equipment and supplies without public bidding up to the emergency amount. The President may lift the declaration when the situation is normalized.',
  },
  // ── Evacuation and Response Protocols ────────────────────────────────────────
  {
    id:         'ra10121-evacuation',
    title:      'Evacuation Center Standards and Management',
    source:     'Republic Act No. 10121 / DSWD Administrative Order No. 01 s. 2016',
    instrument: 'Republic Act and Administrative Order',
    section:    'Section 14 / A.O. No. 01',
    tags:       ['evacuation','evacuation center','standards','shelter','displaced persons',
                 'dswd','management','operation','temporary shelter','camp management'],
    body:       'LGUs are responsible for the establishment, operation, and management of evacuation centers for disaster-affected populations. DSWD Administrative Order No. 01 s. 2016 (Standards on the Operation and Management of Evacuation Centers) prescribes minimum standards including: adequate space per person (3.5 sq. m. per evacuee), potable water (minimum 15 liters/person/day), sanitation facilities (1 toilet per 20 persons, 1 bathing unit per 50 persons), medical services, psychosocial support, and protection for children, women, elderly and persons with disabilities. Camp managers must maintain a registration system and regular reporting.',
  },
  {
    id:         'ra10121-earlywarning',
    title:      'Early Warning Systems — LGU Duty',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 12(b)',
    tags:       ['early warning','warning system','alert level','lgu duty','communication',
                 'information dissemination','hazard','preparedness'],
    body:       'LGUs through their LDRRMOs are mandated to operate and maintain a multi-hazard early warning system, including observation networks, forecasting and analysis, communication and dissemination procedures. Early warning information must reach those at risk in sufficient time to allow protective action to be taken. The LDRRMO shall coordinate with PAGASA, PHIVOLCS, MGB, and other technical agencies for timely warnings.',
  },
  // ── Quick Response Fund (QRF) ─────────────────────────────────────────────────
  {
    id:         'dbm-bc2013-2-qrf',
    title:      'Quick Response Fund — Release and Use',
    source:     'DBM Budget Circular No. 2013-2 / RA 10121 Section 21',
    instrument: 'Budget Circular and Republic Act',
    section:    'Section 21 / BC 2013-2',
    tags:       ['quick response fund','qrf','standby fund','30 percent','release','use',
                 'calamity','emergency','relief','recovery','30%','budget'],
    body:       'The Quick Response Fund (QRF) or standby fund constitutes 30% of the Local DRRM Fund. It is released for emergency purposes upon: (a) declaration of a state of calamity by the local Sanggunian; or (b) a determination by the local chief executive that immediate expenditure is necessary to meet actual or imminent disaster. The QRF is used for relief operations, emergency response activities, procurement of emergency equipment and supplies, and support to displaced persons. Any unexpended QRF at the end of the year does not revert to the general fund but is carried over to the next year.',
  },
  // ── NDRRMC Coordination ───────────────────────────────────────────────────────
  {
    id:         'ra10121-s10-rdrrmcs',
    title:      'Regional and Local DRRM Councils (RDRRMC/LDRRMC)',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 10',
    tags:       ['rdrrmc','ldrrmc','regional','local council','coordination','integration',
                 'governor','mayor','council composition'],
    body:       'Regional DRRMCs (RDRRMCs) are established in each administrative region, chaired by the Regional Director of OCD, with representatives from regional line agencies. Local DRRMCs (LDRRMCs) are established at provincial, city, and municipal levels, chaired by the local chief executive (governor/mayor/municipal mayor). They are responsible for approving and implementing local DRRM plans, coordinating with national and regional bodies, and ensuring adequate resources for local DRRM activities.',
  },
  // ── Preparedness ─────────────────────────────────────────────────────────────
  {
    id:         'ra10121-s3-preparedness',
    title:      'Definition of Disaster Preparedness',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(f)',
    tags:       ['preparedness','definition','disaster preparedness','training','drill',
                 'contingency plan','stockpile','equipment','readiness'],
    body:       'Disaster Preparedness — the knowledge, capacities and institutional arrangements developed by governments, response and recovery organizations, communities and individuals to effectively anticipate, respond to, and recover from the impacts of likely, imminent or current hazards. Preparedness activities include: contingency planning, stockpiling of equipment and supplies, development of response procedures, training/exercises/drills, and information management.',
  },
  // ── Response ─────────────────────────────────────────────────────────────────
  {
    id:         'ra10121-s3-response',
    title:      'Definition of Disaster Response',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(j)',
    tags:       ['response','disaster response','definition','emergency','search rescue','evacuation',
                 'relief','humanitarian','immediate response'],
    body:       'Disaster Response — the provision of emergency services and public assistance during or immediately after a disaster in order to save lives, reduce health impacts, ensure public safety, and meet the basic subsistence needs of the people affected. Disaster response is predominantly focused on immediate and short-term needs. It includes search and rescue, emergency medical care, evacuation, distribution of food and non-food items, and emergency shelter.',
  },
  // ── Rehabilitation and Recovery ───────────────────────────────────────────────
  {
    id:         'ra10121-s3-recovery',
    title:      'Definition of Recovery and Rehabilitation',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 3(i)',
    tags:       ['recovery','rehabilitation','post-disaster','reconstruction','livelihood',
                 'restoration','build back better','recovery plan'],
    body:       'Recovery — the restoration and improvement, where appropriate, of facilities, livelihoods, and living conditions of disaster-affected communities, including efforts to reduce disaster risk factors. Recovery operations begin immediately after the emergency phase is over and may overlap with continued humanitarian assistance. Rehabilitation refers to measures that ensure the abilities of disaster-affected communities to resume normal activities.',
  },
  // ── Accountability ────────────────────────────────────────────────────────────
  {
    id:         'ra10121-s27-audit',
    title:      'Accountability and Audit of DRRM Funds',
    source:     'Republic Act No. 10121',
    instrument: 'Republic Act',
    section:    'Section 27',
    tags:       ['accountability','audit','coa','commission on audit','transparency','ldrrmf',
                 'financial report','fund utilization','lgu'],
    body:       'All DRRM funds shall be subject to the standard government audit and accounting rules and regulations. LGUs shall submit quarterly and annual reports on the utilization of the LDRRMF to the Commission on Audit (COA) and the NDRRMC. Unused funds shall be carried over to the next year. Local officials who misuse DRRM funds may be held criminally, civilly and administratively liable.',
  },
]

/**
 * Search the policy knowledge base using keyword matching.
 * Returns up to `limit` entries ranked by relevance.
 *
 * @param {string} query  — the user's question or keywords
 * @param {number} limit  — max results to return (default 5)
 * @returns {Array}       — matched POLICY_KB entries, ranked
 */
export function searchPolicyKB(query, limit = 5) {
  if (!query || !query.trim()) return []
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  if (!terms.length) return []

  const scored = POLICY_KB.map(entry => {
    const haystack = [
      entry.title,
      entry.body,
      entry.source,
      entry.section,
      ...entry.tags,
    ].join(' ').toLowerCase()

    const score = terms.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0)
    return { entry, score }
  }).filter(r => r.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(r => r.entry)
}
