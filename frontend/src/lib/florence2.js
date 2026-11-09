/**
 * Florence-2 Inference Client — Photo Mode AI Analysis
 *
 * Calls the local Python FastAPI inference service (python-ai/) which runs
 * Microsoft Florence-2-base. Returns the same shape as the former yolo11.js
 * so SOSReport.jsx requires no logic changes.
 *
 * Online path:  POST image to VITE_FLORENCE2_SERVICE_URL/analyze
 * Offline path: throws Error('OFFLINE') — caller should let the user decide
 *               whether to submit without analysis or retry later.
 */

// ── Keyword → SOS field mapping (applied to Florence-2 caption text) ──────────
const SCENE_KEYWORDS = [
  { keywords: ['flood', 'water', 'submerged', 'inundated'],    status: 'trapped',  conditions: ['flooding'] },
  { keywords: ['collaps', 'rubble', 'debris', 'structur'],      status: 'trapped',  conditions: ['structural_collapse'] },
  { keywords: ['fire', 'flame', 'burn', 'smoke', 'blaze'],      status: 'injured',  conditions: ['fire'] },
  { keywords: ['rescue', 'victim', 'injur', 'casualt', 'hurt'], status: 'injured',  conditions: [] },
  { keywords: ['safe', 'clear', 'shelter', 'evacuat'],          status: 'safe',     conditions: [] },
]

function deriveFieldsFromCaption(caption, objects) {
  const lower = (caption ?? '').toLowerCase()

  let status = 'trapped'
  let conditions = []

  for (const rule of SCENE_KEYWORDS) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      status = rule.status
      conditions = rule.conditions
      break
    }
  }

  const personCount = objects.filter(o =>
    typeof o.label === 'string' && o.label.toLowerCase().includes('person')
  ).length

  return { status, special_conditions: conditions, people_count: Math.max(1, personCount) }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * analyzeScene(imageFile) → {
 *   classification: { label: string, confidence: null },
 *   detection:      { count: number, objects: string[], boxes: [] },
 *   suggestedFields: { status, special_conditions, people_count },
 *   detailed_caption: string | null,
 *   model: { name, revision, processing_time_ms },
 * }
 *
 * Throws Error('OFFLINE') when the inference service is unreachable.
 */
export async function analyzeScene(imageFile) {
  const serviceUrl = import.meta.env.VITE_FLORENCE2_SERVICE_URL
  const secret     = import.meta.env.VITE_FLORENCE2_SECRET

  if (!serviceUrl) {
    throw new Error('OFFLINE')
  }

  // Check connectivity before attempting the upload
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('OFFLINE')
  }

  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('tasks', 'caption,detailed_caption,object_detection')

  let response
  try {
    response = await fetch(`${serviceUrl}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret ?? ''}` },
      body: formData,
    })
  } catch {
    // Network error — treat as offline
    throw new Error('OFFLINE')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Florence-2 service error ${response.status}: ${text}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error ?? 'Florence-2 analysis failed')
  }

  const objects = Array.isArray(data.objects) ? data.objects : []
  const caption = data.caption ?? null
  const suggestedFields = deriveFieldsFromCaption(caption, objects)

  return {
    classification: {
      label:      caption ?? 'Scene captured',
      confidence: null,  // Florence-2 does not produce classification confidence
    },
    detection: {
      count:   data.object_count ?? objects.length,
      objects: objects.map(o => o.label ?? ''),
      boxes:   objects.map(o => o.bbox ? { class: o.label, bbox: o.bbox } : null).filter(Boolean),
    },
    suggestedFields,
    detailed_caption: data.detailed_caption ?? null,
    model: {
      name:               data.model_name        ?? 'Florence-2-base',
      revision:           data.model_revision    ?? '',
      processing_time_ms: data.processing_time_ms ?? 0,
    },
  }
}
