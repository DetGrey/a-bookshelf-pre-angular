import { useEffect, useMemo, useRef, useState } from 'react'

function hashHue(text = '') {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0 // keep 32-bit int
  }
  return Math.abs(hash) % 360
}

function CoverImage({ src, title, alt, className = '', style = {}, lazy = true }) {
  const holderRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(!lazy)
  const [errored, setErrored] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const label = title || alt || 'No cover'
  const hue = useMemo(() => hashHue(label), [label])
  const fallbackStyle = {
    background: `linear-gradient(135deg, hsl(${hue} 60% 35%), hsl(${(hue + 30) % 360} 60% 45%))`,
    ...style,
  }

  useEffect(() => {
    if (!lazy) return
    const el = holderRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      // If IntersectionObserver not available, load immediately in next tick
      const timer = setTimeout(() => setShouldLoad(true), 0)
      return () => clearTimeout(timer)
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      })
    }, { rootMargin: '120px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [lazy])

  // Timeout for broken image URLs (3 seconds)
  useEffect(() => {
    if (!shouldLoad || errored) return
    const timeout = setTimeout(() => {
      setErrored(true)
    }, 3000)
    return () => clearTimeout(timeout)
  }, [shouldLoad, errored])

  // Reset imageLoaded when src changes
  useEffect(() => {
    setImageLoaded(false)
  }, [src])

  const showImage = shouldLoad && src && !errored

  return (
    <span ref={holderRef} className="cover-holder">
      {showImage ? (
        <>
          <img
            className={`cover-image ${className}${!imageLoaded ? ' cover-image--loading' : ''}`}
            src={src}
            alt={alt || title || 'Cover image'}
            onLoad={() => setImageLoaded(true)}
            onError={() => setErrored(true)}
            {...(Object.keys(style).length > 0 && { style })}
            loading="lazy"
          />
          {!imageLoaded && (
            <div className={`cover-fallback ${className}`} style={fallbackStyle}>
              <span>{label}</span>
            </div>
          )}
        </>
      ) : (
        <div className={`cover-fallback ${className}`} style={fallbackStyle}>
          <span>{label}</span>
        </div>
      )}
    </span>
  )
}

export default CoverImage
