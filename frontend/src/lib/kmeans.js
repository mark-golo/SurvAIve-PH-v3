function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function kmeans(points, k, maxIter = 30) {
  if (points.length === 0) return []
  const n = Math.min(k, points.length)

  // K-means++ initialization
  const centroids = [points[Math.floor(Math.random() * points.length)].slice()]
  while (centroids.length < n) {
    const dists = points.map(p => Math.min(...centroids.map(c => dist(p, c))))
    const total = dists.reduce((s, d) => s + d, 0)
    let r = Math.random() * total
    for (let i = 0; i < points.length; i++) {
      r -= dists[i]
      if (r <= 0) { centroids.push(points[i].slice()); break }
    }
    // Fallback if floating-point never reaches 0
    if (centroids.length < n + 1 - (n - centroids.length)) {
      centroids.push(points[Math.floor(Math.random() * points.length)].slice())
    }
  }

  let assignments = new Array(points.length).fill(0)
  for (let iter = 0; iter < maxIter; iter++) {
    const next = points.map(p => {
      let best = 0, bestD = Infinity
      centroids.forEach((c, i) => { const d = dist(p, c); if (d < bestD) { bestD = d; best = i } })
      return best
    })
    if (next.every((a, i) => a === assignments[i])) break
    assignments = next
    for (let i = 0; i < n; i++) {
      const members = points.filter((_, j) => assignments[j] === i)
      if (members.length > 0) {
        centroids[i] = [
          members.reduce((s, p) => s + p[0], 0) / members.length,
          members.reduce((s, p) => s + p[1], 0) / members.length,
        ]
      }
    }
  }

  return centroids
    .map((centroid, i) => ({ centroid, indices: assignments.flatMap((a, j) => a === i ? [j] : []) }))
    .filter(c => c.indices.length > 0)
}

export function clusterSOS(reports) {
  const valid = reports.filter(r => r.lat != null && r.lng != null)
  if (valid.length === 0) return []

  const k = Math.min(5, Math.max(1, Math.round(valid.length / 7)))
  const points = valid.map(r => [Number(r.lat), Number(r.lng)])
  const raw = kmeans(points, k)

  return raw.map(({ centroid, indices }) => {
    const members = indices.map(i => valid[i])
    const avgScore = members.reduce((s, r) => s + (r.ai_priority_score ?? 50), 0) / members.length
    const barangays = [...new Set(members.map(r => r.barangay).filter(Boolean))]
    const criticalCount = members.filter(r => r.priority === 'CRITICAL').length
    return {
      centroid,
      count: members.length,
      avgScore: Math.round(avgScore),
      priority: avgScore >= 80 ? 'CRITICAL' : avgScore >= 60 ? 'HIGH' : avgScore >= 40 ? 'MODERATE' : 'LOW',
      barangays,
      criticalCount,
    }
  }).sort((a, b) => b.avgScore - a.avgScore)
}
