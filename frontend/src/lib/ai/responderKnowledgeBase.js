// Responder Knowledge Base — §4.2 AI Responder Knowledge Assistant.
// Static keyword-indexed procedures replacing RAG.
// Covers documentation, flood rescue, medical, fire, communication, evacuation.

export const KB_CATEGORIES = [
  { key: 'all',          label: 'All'          },
  { key: 'documentation',label: 'Documentation'},
  { key: 'flood_rescue', label: 'Flood Rescue' },
  { key: 'medical',      label: 'Medical'      },
  { key: 'fire',         label: 'Fire'         },
  { key: 'communication',label: 'Communication'},
  { key: 'evacuation',   label: 'Evacuation'   },
]

const KB = [
  // ── Documentation ──────────────────────────────────────────────────────────
  {
    id: 'doc_rescue_completion',
    category: 'documentation',
    title: 'Rescue Completion Report',
    summary: 'Required fields when confirming a completed rescue in SurvAIve PH.',
    keywords: ['rescue', 'completion', 'confirm', 'report', 'record', 'documentation', 'complete', 'finish'],
    content:
`When confirming a completed rescue, record the following fields:

1. **Victims rescued** — total count of individuals extracted and accounted for.
2. **Transfer destination** — name of evacuation center, hospital, or safe location victims were brought to.
3. **Medical assistance provided** — list any first aid or emergency medical care rendered on site.
4. **Responder name and ID** — the confirming responder must be identified on the record.
5. **Confirmation timestamp** — exact date and time the rescue was marked complete.
6. **Original SOS reference** — link or ID of the SOS report being resolved.
7. **Notes** — any additional observations, hazards, or follow-up actions needed.

The rescue is not officially complete until the confirming responder reviews and submits the form.
AI-generated draft reports remain drafts and do not constitute completion.`,
    source: 'SurvAIve PH Responder Field Manual — Section 5: Response Confirmation',
  },
  {
    id: 'doc_incident_summary',
    category: 'documentation',
    title: 'Incident Summary Report',
    summary: 'Structure and required content for an incident summary at mission close.',
    keywords: ['incident', 'summary', 'report', 'closeout', 'after-action', 'final'],
    content:
`An incident summary report is prepared after a rescue operation and includes:

1. **Incident type** — flood, fire, medical, search and rescue, etc.
2. **Date, time, and location** — start and end times; barangay and municipality.
3. **Victims involved** — number affected, number rescued, number referred for medical care.
4. **Resources deployed** — personnel, equipment, vehicles used.
5. **Actions taken** — chronological narrative of the response steps.
6. **Outcome** — final status of all individuals and any unresolved matters.
7. **Recommendations** — lessons learned or follow-up actions for the agency.

Submit to the duty officer within 24 hours of incident close.`,
    source: 'SurvAIve PH Responder Field Manual — Section 6: Incident Documentation',
  },
  {
    id: 'doc_victim_transfer',
    category: 'documentation',
    title: 'Victim Transfer Record',
    summary: 'Information to record when transferring a victim to an evacuation center or hospital.',
    keywords: ['transfer', 'victim', 'evacuation', 'hospital', 'center', 'handover', 'record'],
    content:
`Record the following when transferring a victim:

1. **Victim name and ID** (if known).
2. **Receiving facility** — name and location of evacuation center or hospital.
3. **Receiving staff** — name of the person accepting responsibility at the facility.
4. **Physical condition at transfer** — ambulatory, non-ambulatory, conscious, injured.
5. **Medical interventions performed** — first aid given prior to transfer.
6. **Special needs** — mobility limitations, medication requirements, children, elderly.
7. **Transfer time** — date and time of handover.
8. **Transporting responder** — name and ID of the responder completing the transfer.

Both the transferring responder and the receiving staff should acknowledge the record where possible.`,
    source: 'SurvAIve PH Responder Field Manual — Section 5.3: Transfer Documentation',
  },
  {
    id: 'doc_audit_log',
    category: 'documentation',
    title: 'Audit Log Requirements',
    summary: 'What actions must be logged for accountability and after-action review.',
    keywords: ['audit', 'log', 'accountability', 'trace', 'history', 'review', 'record'],
    content:
`The following actions must generate an audit log entry:

- SOS report received and acknowledged.
- Priority assessment performed or overridden.
- Rescue assigned to a responder.
- Rescue status updates (en route, on site, completed).
- Victim status changes (SAFE / UNSAFE / rescued).
- AI priority review: confirmed, corrected, or rejected.
- Victim transfer or evacuation center intake.

Each log entry must include: action type, responder or system actor, timestamp, and reference IDs.
Audit logs may not be deleted. Corrections are made by adding a new entry referencing the original.`,
    source: 'SurvAIve PH Responder Field Manual — Section 7: Audit and Accountability',
  },

  // ── Flood Rescue ───────────────────────────────────────────────────────────
  {
    id: 'flood_deployment',
    category: 'flood_rescue',
    title: 'Flood Rescue Deployment',
    summary: 'Steps to follow before and during deployment to a flood rescue scene.',
    keywords: ['flood', 'deploy', 'rescue', 'water', 'inundation', 'boat', 'swift'],
    content:
`Before deploying to a flood rescue:

1. Confirm victim location via SOS report and GPS coordinates where available.
2. Assess water depth and current reports from recent responders.
3. Assign a boat team if water depth exceeds wading safety threshold (~1 m).
4. Establish radio contact with the incident commander.
5. Brief all team members on extraction plan and fallback route.

On scene:
- Approach from upstream where possible.
- Use a throw bag or rope before entering moving water.
- Never enter unknown floodwater alone.
- Secure victims with life vests before moving.
- Document victim condition and count on scene.

Do not mark the rescue complete until all individuals are accounted for and transferred.`,
    source: 'SurvAIve PH Responder Field Manual — Section 3.1: Water Rescue',
  },
  {
    id: 'flood_victim_extraction',
    category: 'flood_rescue',
    title: 'Victim Extraction from Flooded Structure',
    summary: 'Procedure for extracting trapped individuals from a flooded building.',
    keywords: ['extraction', 'trapped', 'structure', 'flood', 'building', 'house', 'rescue'],
    content:
`Extracting victims from a flooded structure:

1. **Assess structural integrity** — do not enter if walls or roof show signs of collapse.
2. **Establish communication** with victims before entry (call out, use radio if available).
3. **Clear entry point** — identify the safest and highest entry.
4. **Account for all persons** — confirm the number of individuals reported before entry.
5. **Prioritize mobility-impaired individuals** — elderly, children, injured first.
6. **Verify no one is left behind** — do a final sweep before exiting.
7. **Mark the structure** — note it as cleared once all victims are out.

Report any structural hazards to the incident commander for follow-up.`,
    source: 'SurvAIve PH Responder Field Manual — Section 3.2: Structural Flood Rescue',
  },

  // ── Medical ────────────────────────────────────────────────────────────────
  {
    id: 'medical_documentation',
    category: 'medical',
    title: 'Medical Assistance Documentation',
    summary: 'What to record when first aid or emergency medical care is provided.',
    keywords: ['medical', 'first aid', 'injury', 'documentation', 'treatment', 'vital', 'health'],
    content:
`When providing or documenting medical assistance:

1. **Victim name and age** (if obtainable).
2. **Chief complaint** — primary reason medical assistance is needed.
3. **Observed injuries or symptoms** — describe what you see, not a diagnosis.
4. **Vital signs** (if equipment available) — pulse, respiratory rate, level of consciousness.
5. **First aid administered** — specific actions taken (wound dressing, immobilization, etc.).
6. **Response to treatment** — did condition improve, stay the same, or worsen?
7. **Referral** — name and location of facility the victim was referred to.
8. **Administering responder** — name and certification level.

Responders are not authorized to make medical diagnoses. Document observations and defer medical decisions to licensed medical personnel.`,
    source: 'SurvAIve PH Responder Field Manual — Section 4: Medical Assistance Records',
  },
  {
    id: 'medical_referral',
    category: 'medical',
    title: 'Medical Referral Procedure',
    summary: 'When and how to refer a victim to medical facilities.',
    keywords: ['referral', 'hospital', 'medical', 'emergency', 'ambulance', 'health', 'doctor'],
    content:
`A victim should be referred to a medical facility when:

- Loss of consciousness (current or recent).
- Visible severe injury (open fractures, deep lacerations, crush injuries).
- Difficulty breathing beyond exertion.
- Signs of stroke (facial drooping, arm weakness, speech difficulty).
- Trauma to head, spine, or chest.
- Any condition beyond basic first aid scope.

Referral steps:
1. Notify the nearest available facility of incoming patient and estimated arrival.
2. Accompany the victim or arrange a responsible handover.
3. Provide the receiving facility with the medical documentation record.
4. Log the referral in SurvAIve PH with destination facility and time.`,
    source: 'SurvAIve PH Responder Field Manual — Section 4.3: Medical Referrals',
  },

  // ── Fire ───────────────────────────────────────────────────────────────────
  {
    id: 'fire_scene_safety',
    category: 'fire',
    title: 'Fire Scene Safety Procedures',
    summary: 'Responder safety rules at or near an active fire scene.',
    keywords: ['fire', 'scene', 'safety', 'bfp', 'smoke', 'evacuation', 'burn'],
    content:
`At or near an active fire scene:

1. **Establish a safe perimeter** — do not enter the structure unless you are BFP-trained and equipped.
2. **Account for wind direction** — stay upwind of smoke.
3. **Identify entry and exit routes** before approaching the building.
4. **Never re-enter a burning structure** for equipment or non-critical items.
5. **Coordinate with BFP** — do not perform interior firefighting operations without BFP authorization.
6. **Victim triage area** — establish at least 50 m from the structure, upwind.
7. **Utilities** — request utility shutoff if safe to do so (electricity, LPG).

Document the scene perimeter, victim count, and any hazardous materials observed.`,
    source: 'SurvAIve PH Responder Field Manual — Section 2.1: Fire Response',
  },
  {
    id: 'fire_report',
    category: 'fire',
    title: 'Fire Incident Report',
    summary: 'Required information for a fire incident report.',
    keywords: ['fire', 'report', 'incident', 'documentation', 'bfp', 'arson', 'burn'],
    content:
`A fire incident report must include:

1. **Date, time, and location** of the fire.
2. **Structures affected** — type, number, estimated area.
3. **Cause** (if known or suspected; note if investigation is pending).
4. **Persons affected** — injured, displaced, deceased (if applicable).
5. **BFP response** — unit(s) that responded and approximate arrival time.
6. **Other responders** — MDRRMO, PNP, medical units on scene.
7. **Resources deployed** — vehicles, personnel, equipment.
8. **Fire status at report time** — contained, controlled, extinguished, still active.
9. **Responder observations** — hazards, structural collapse, secondary risks.

Submit to BFP and MDRRMO coordination center.`,
    source: 'SurvAIve PH Responder Field Manual — Section 2.3: Fire Documentation',
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id: 'comm_radio_protocol',
    category: 'communication',
    title: 'Radio Communication Protocol',
    summary: 'Standard format for radio transmissions between responders and command.',
    keywords: ['radio', 'communication', 'protocol', 'dispatch', 'relay', 'channel', 'report', 'sitrep'],
    content:
`Standard radio transmission format (SALUTE or concise situation report):

**Structure:** [Call sign] to [Destination], [Message], over.

**Situation report (sitrep) elements:**
1. Unit and location.
2. Current status (en route, on scene, completed).
3. Number of victims on scene and their condition.
4. Resources needed (additional units, medical, boat).
5. Estimated time for next update.

**Discipline rules:**
- Keep transmissions brief; acknowledge all received messages ("Copy" or "Roger").
- Do not transmit personal names, medical diagnoses, or unconfirmed casualty figures over open channels.
- Use plain language; avoid codes unless all parties are trained on the same set.
- Log transmission time and content in the incident record.`,
    source: 'SurvAIve PH Responder Field Manual — Section 1.2: Communications',
  },
  {
    id: 'comm_situation_update',
    category: 'communication',
    title: 'Situation Update to Command',
    summary: 'When and what to report to the incident commander or operations center.',
    keywords: ['update', 'command', 'situation', 'report', 'status', 'communication', 'inform'],
    content:
`Report to the incident commander or operations center when:

- Arriving at the scene (on-scene confirmation).
- Victim count is confirmed or changes.
- A victim requires urgent medical attention.
- Rescue cannot proceed safely (structural hazard, rising water, hostile conditions).
- The rescue is complete (all individuals accounted for and transferred).
- Resources are depleted or additional support is needed.

Each update should include: your location, current victim status, action being taken, and your next intended step.`,
    source: 'SurvAIve PH Responder Field Manual — Section 1.3: Incident Reporting',
  },

  // ── Evacuation ─────────────────────────────────────────────────────────────
  {
    id: 'evac_center_intake',
    category: 'evacuation',
    title: 'Evacuation Center Intake Procedure',
    summary: 'Steps for registering victims at an evacuation center.',
    keywords: ['evacuation', 'center', 'intake', 'register', 'shelter', 'victim', 'arrivals'],
    content:
`When bringing victims to an evacuation center:

1. **Notify the center in advance** — name, number of individuals, any medical needs.
2. **Hand over documentation** — victim transfer record and any medical notes.
3. **Register each individual** — name, age, barangay of origin, contact (if available).
4. **Flag vulnerabilities** — elderly, children, persons with disabilities, pregnant.
5. **Confirm intake with center staff** — receive acknowledgment before departing.
6. **Update SurvAIve PH** — log the transfer with destination center and time.

Do not leave victims at a center without confirming that staff have accepted responsibility.`,
    source: 'SurvAIve PH Responder Field Manual — Section 5.2: Evacuation Center Operations',
  },
  {
    id: 'evac_vulnerability_tracking',
    category: 'evacuation',
    title: 'Vulnerability Tracking',
    summary: 'How to identify and document vulnerable individuals during evacuation.',
    keywords: ['vulnerable', 'elderly', 'children', 'disability', 'pregnant', 'tracking', 'special'],
    content:
`Identify and document vulnerable individuals at every stage of evacuation:

**Categories to flag:**
- Children under 12 (especially unaccompanied minors).
- Elderly persons (60+), especially those with mobility limitations.
- Persons with physical or cognitive disabilities.
- Pregnant or recently post-partum individuals.
- Persons requiring medication that may not be available.

**Documentation:**
- Record vulnerability type alongside the individual's intake record.
- Flag to evacuation center staff for priority accommodation and monitoring.
- If medical needs exist, initiate a referral before departing.

Vulnerability information is treated as sensitive — handle with discretion and share only with authorized personnel.`,
    source: 'SurvAIve PH Responder Field Manual — Section 5.4: Vulnerable Populations',
  },
]

/**
 * Search the knowledge base by keyword overlap.
 * @param {string} query
 * @param {string} [category] — filter by category key ('all' or omit = no filter)
 * @param {number} [limit]
 * @returns {object[]} top matching entries
 */
export function searchKB(query = '', category = 'all', limit = 4) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const pool   = category && category !== 'all'
    ? KB.filter(e => e.category === category)
    : KB

  if (tokens.length === 0) return pool.slice(0, limit)

  return pool
    .map(entry => {
      const haystack = [
        entry.title.toLowerCase(),
        entry.summary.toLowerCase(),
        ...entry.keywords,
      ].join(' ')
      const score = tokens.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0)
      return { ...entry, _score: score }
    })
    .filter(e => e._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...e }) => e)
}

export function getEntry(id) {
  return KB.find(e => e.id === id) ?? null
}
