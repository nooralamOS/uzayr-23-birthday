// A light "click" when a photo snaps into place.
// Android: the Vibration API. iOS Safari 18+: toggling a hidden switch plays the system haptic.
// Both only work inside a user gesture (tap / swipe release), which is where this gets called.

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export function tick() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
      return
    }
    if (!isIOS) return
    const label = document.createElement('label')
    label.ariaHidden = 'true'
    label.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    label.append(input)
    document.head.append(label)
    label.click()
    label.remove()
  } catch {
    // Haptics are a nice-to-have; never let them break navigation.
  }
}
