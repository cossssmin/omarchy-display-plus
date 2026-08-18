// ---- Display (brightness / scale / monitors), from omarchy.monitor ----

function clampBrightness(value) {
  var n = Number(value)
  if (!isFinite(n)) return 1
  return Math.max(1, Math.min(100, Math.round(n)))
}

function normalizeScale(scale) {
  var n = parseFloat(String(scale || ""))
  if (!isFinite(n)) return ""
  return String(Math.round(n * 100) / 100)
}

function gcd(a, b) {
  while (b) {
    var remainder = a % b
    a = b
    b = remainder
  }
  return a
}

function cleanScale(scale, width, height) {
  var requested = Number(scale)
  var modeWidth = Number(width)
  var modeHeight = Number(height)
  if (!isFinite(requested) || !isFinite(modeWidth) || !isFinite(modeHeight)
      || requested <= 0 || modeWidth <= 0 || modeHeight <= 0) return ""

  var divisor = gcd(Math.round(modeWidth * 120), Math.round(modeHeight * 120))
  var scaleUnits = Math.round(requested * 120)
  if (scaleUnits > divisor) scaleUnits = divisor
  while (divisor % scaleUnits !== 0) scaleUnits++
  return normalizeScale(scaleUnits / 120)
}

function matchingScaleIndex(scales, currentScale, width, height) {
  var current = Number(currentScale)
  if (!Array.isArray(scales) || !isFinite(current)) return -1

  var bestIndex = -1
  var bestDistance = Infinity
  var normalizedCurrent = normalizeScale(current)
  for (var i = 0; i < scales.length; i++) {
    if (cleanScale(scales[i], width, height) !== normalizedCurrent) continue

    var distance = Math.abs(Number(scales[i]) - current)
    if (distance < bestDistance) {
      bestIndex = i
      bestDistance = distance
    }
  }
  return bestIndex
}

function availableScales(scales, width, height) {
  if (!Array.isArray(scales) || Number(width) <= 0 || Number(height) <= 0) return scales || []

  var byEffectiveScale = {}
  for (var i = 0; i < scales.length; i++) {
    var requested = Number(scales[i])
    var effective = Number(cleanScale(requested, width, height))

    if (!isFinite(requested) || !isFinite(effective)) continue

    var key = normalizeScale(effective)
    var existing = byEffectiveScale[key]
    if (!existing || Math.abs(requested - effective) < existing.distance) {
      byEffectiveScale[key] = {
        value: String(scales[i]),
        index: i,
        distance: Math.abs(requested - effective)
      }
    }
  }

  return Object.keys(byEffectiveScale)
    .map(function(key) { return byEffectiveScale[key] })
    .sort(function(a, b) { return a.index - b.index })
    .map(function(candidate) { return candidate.value })
}

function brightnessName(percent) {
  var p = Math.round(percent)
  if (p >= 95) return "Sun blast"
  if (p >= 80) return "Solar flare"
  if (p >= 65) return "Golden hour"
  if (p >= 45) return "Even day"
  if (p >= 30) return "Soft glow"
  if (p >= 20) return "Lamp light"
  if (p >= 10) return "Candlelit"
  return "Night owl"
}

function parseDisplays(raw) {
  var displays = []
  try {
    displays = raw ? JSON.parse(String(raw)) : []
  } catch (e) {
    displays = []
  }
  if (!Array.isArray(displays)) displays = []

  var count = 0
  for (var i = 0; i < displays.length; i++) {
    if (displays[i] && displays[i].enabled) count++
  }

  return {
    displays: displays,
    enabledDisplayCount: count
  }
}

// ---- Sandman idle timers, from lgse.sandman ----

var screensaverPresets = [0, 60, 120, 300, 600, 900, 1800]
var displayPresets = [0, 60, 120, 300, 600, 900, 1800]
var lockPresets = [0, 300, 600, 900, 1800, 3600]
var sleepPresets = [0, 900, 1800, 3600, 7200]
var hibernatePresets = [0, 1800, 3600, 7200, 14400, 28800]
var lidActions = ["system", "nothing", "display", "sleep", "hibernate"]

var maxTimeoutSeconds = 7 * 24 * 60 * 60

// Validate a caller-supplied timeout, including one arriving over IPC. Returns
// whole seconds in [0, maxTimeoutSeconds], or -1 when the value is unusable.
// Callers must treat -1 as "reject" and never as 0: coercing a bad value to 0
// would read as "Off" and stand auto-lock down.
function requestedSeconds(value) {
  var number = Number(value)
  if (!isFinite(number)) return -1
  number = Math.round(number)
  if (number < 0 || number > maxTimeoutSeconds) return -1
  return number
}

// Normalize a value already on disk. Unlike requestedSeconds there is no caller
// to report back to, so an oversized value is clamped rather than rejected.
function normalizedSeconds(value, fallback, allowOff) {
  var number = Number(value)
  if (!isFinite(number)) return fallback
  number = Math.round(number)
  if (allowOff && number === 0) return 0
  if (number <= 0) return fallback
  return Math.min(number, maxTimeoutSeconds)
}

function normalizedLidAction(value) {
  var action = String(value || "system")
  return lidActions.indexOf(action) >= 0 ? action : "system"
}

function parseConfig(raw) {
  var parsed = {}
  try { parsed = JSON.parse(String(raw || "{}")) }
  catch (error) { parsed = {} }

  return {
    screensaver: normalizedSeconds(parsed.screensaver, 150, true),
    display: normalizedSeconds(parsed.display, 0, true),
    lock: normalizedSeconds(parsed.lock, 300, true),
    sleep: normalizedSeconds(parsed.sleep, 0, true),
    hibernate: normalizedSeconds(parsed.hibernate, 0, true),
    lid: normalizedLidAction(parsed.lid)
  }
}

function lidActionLabel(action) {
  var normalized = normalizedLidAction(action)
  switch (normalized) {
  case "nothing": return "Do nothing"
  case "display": return "Display off"
  case "sleep": return "Sleep"
  case "hibernate": return "Hibernate"
  default: return "System default"
  }
}

function formatDuration(seconds) {
  var value = Number(seconds)
  if (!isFinite(value) || value <= 0) return "Off"
  if (value < 60) return Math.round(value) + " sec"

  var minutes = value / 60
  if (minutes < 60) {
    var minuteLabel = minutes === Math.round(minutes)
      ? String(Math.round(minutes)) : minutes.toFixed(1).replace(/\.0$/, "")
    return minuteLabel + " min"
  }

  var hours = minutes / 60
  return (hours === Math.round(hours) ? String(Math.round(hours)) : hours.toFixed(1)) + (hours === 1 ? " hour" : " hours")
}

// Slider index whose preset is closest to the current setting. A value written
// off-notch (e.g. from the CLI) snaps to the nearest tick without losing the
// real value shown in the header.
function nearestPresetIndex(seconds, presets) {
  var target = Number(seconds)
  if (!isFinite(target)) return 0
  var bestIndex = 0
  var bestDistance = Infinity
  for (var i = 0; i < presets.length; i++) {
    var distance = Math.abs(Number(presets[i]) - target)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }
  return bestIndex
}

function statusSummary(screensaver, display, lock, sleep, hibernate) {
  var summary = "Screen " + formatDuration(screensaver)
    + " · Displays " + formatDuration(display)
    + " · Lock " + formatDuration(lock)
    + " · Sleep " + formatDuration(sleep)
  if (Number(hibernate) > 0) summary += " · Hibernate +" + formatDuration(hibernate)
  return summary
}
