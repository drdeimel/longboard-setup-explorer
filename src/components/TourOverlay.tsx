/**
 * TourOverlay component — renders a translucent circle highlight and explanation box
 * for the current step in a guided tour.
 *
 * Features:
 * - Semi-transparent dark backdrop over the entire page
 * - Translucent circle highlighting the target element
 * - Hovering explanation box with title, description, and navigation
 * - Keyboard navigation: Escape to exit, Arrow keys to navigate
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { TourDefinition, TourStep } from '../tours/tourTypes'

/** Props for the TourOverlay component. */
interface TourOverlayProps {
  /** Current tour definition. */
  tour: TourDefinition
  /** Current step index (0-based). */
  currentStep: number
  /** Callback when user advances to next step. */
  onNext: () => void
  /** Callback when user goes back to previous step. */
  onPrev: () => void
  /** Callback when user exits the tour. */
  onExit: () => void
}


/**
 * TourOverlay — renders the current tour step with highlight and tooltip.
 *
 * @param props - Tour state and navigation callbacks.
 * @returns Overlay element with highlight and explanation.
 */
const TourOverlay: React.FC<TourOverlayProps> = ({
  tour,
  currentStep,
  onNext,
  onPrev,
  onExit,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<React.CSSProperties>({})
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step: TourStep | undefined = tour.steps[currentStep]
  const isLastStep = currentStep === tour.steps.length - 1
  const isFirstStep = currentStep === 0

  const findVisibleTarget = () => {
    return Array.from(document.querySelectorAll(step?.targetSelector ?? '')).find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  }

  // Find the target element and get its bounding rect
  useEffect(() => {
    if (!step?.targetSelector) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let isMounted = true

    const findTarget = () => {
      const el = findVisibleTarget()
      if (el && isMounted) {
        setTargetRect(el.getBoundingClientRect())
        // Scroll the target element into view smoothly
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      } else if (isMounted) {
        // Retry after a short delay (element may not be rendered yet)
        timeoutId = setTimeout(findTarget, 100)
      }
    }

    findTarget()

    // Update position on resize/scroll
    const handleResize = () => {
      const el = findVisibleTarget()
      if (el && isMounted) {
        setTargetRect(el.getBoundingClientRect())
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [step?.targetSelector, currentStep])

  // Clamp tooltip position to viewport bounds
  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const tooltipRect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const margin = 16 // margin from viewport edges

    const { top: targetTop, left: targetLeft, width, height } = targetRect
    const preferredPosition = step.position ?? 'bottom'
    const positions = [preferredPosition, 'bottom', 'right', 'left', 'top'].filter(
      (position, index, all) => all.indexOf(position) === index,
    )
    const targetPadding = 8

    const getTooltipBounds = (top: number, left: number, transform: string) => {
      let x = left
      let y = top
      if (transform.includes('translateX(-50%)')) x -= tooltipRect.width / 2
      if (transform.includes('translateX(-100%)')) x -= tooltipRect.width
      if (transform.includes('translateY(-50%)')) y -= tooltipRect.height / 2
      if (transform.includes('translateY(-100%)')) y -= tooltipRect.height
      if (transform.includes('translate(-50%, -50%)')) {
        x -= tooltipRect.width / 2
        y -= tooltipRect.height / 2
      }
      return { left: x, top: y, right: x + tooltipRect.width, bottom: y + tooltipRect.height }
    }

    const overlapsTarget = (bounds: ReturnType<typeof getTooltipBounds>) =>
      bounds.left < targetRect.right + targetPadding &&
      bounds.right > targetRect.left - targetPadding &&
      bounds.top < targetRect.bottom + targetPadding &&
      bounds.bottom > targetRect.top - targetPadding

    let chosenPosition: { top: number; left: number; transform: string } | null = null

    for (const position of positions) {
      let top: number
      let left: number
      let transform: string

      switch (position) {
        case 'top':
          top = targetTop - 12
          left = targetLeft + width / 2
          transform = 'translateX(-50%) translateY(-100%)'
          break
        case 'left':
          top = targetTop + height / 2
          left = targetLeft - 12
          transform = 'translateY(-50%) translateX(-100%)'
          break
        case 'right':
          top = targetTop + height / 2
          left = targetLeft + width + 12
          transform = 'translateY(-50%)'
          break
        case 'center':
          top = targetTop + height / 2
          left = targetLeft + width / 2
          transform = 'translate(-50%, -50%)'
          break
        default:
          top = targetTop + height + 12
          left = targetLeft + width / 2
          transform = 'translateX(-50%)'
      }

      let bounds = getTooltipBounds(top, left, transform)
      if (bounds.left < margin) left += margin - bounds.left
      if (bounds.right > viewportWidth - margin) left -= bounds.right - (viewportWidth - margin)
      if (bounds.top < margin) top += margin - bounds.top
      if (bounds.bottom > viewportHeight - margin) top -= bounds.bottom - (viewportHeight - margin)
      bounds = getTooltipBounds(top, left, transform)

      if (!overlapsTarget(bounds)) {
        chosenPosition = { top, left, transform }
        break
      }
    }

    if (chosenPosition) setTooltipPosition(chosenPosition)
  }, [targetRect, step.position])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore keyboard events if the user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === 'Escape') {
        onExit()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        onNext()
      } else if (e.key === 'ArrowLeft') {
        onPrev()
      }
    },
    [onNext, onPrev, onExit],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!step || !targetRect) {
    return null
  }

  return (
    <>
      {/* Dark backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9998,
        }}
        onClick={onExit}
      />

      {/* Translucent circle highlight */}
      <div
        style={{
          position: 'fixed',
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          borderRadius: 12,
          border: '2px solid rgba(96, 165, 250, 0.8)',
          backgroundColor: 'rgba(96, 165, 250, 0.15)',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(96, 165, 250, 0.3)',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'all 0.8s ease',
        }}
      />

      {/* Explanation box */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          zIndex: 10000,
          ...tooltipPosition,
          maxWidth: 360,
          minWidth: 280,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          color: '#e2e8f0',
        }}
      >
        {/* Step counter */}
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
          Step {currentStep + 1} of {tour.steps.length}
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
          {step.title}
        </h3>

        {/* Description */}
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#cbd5e1', marginBottom: 16 }}>
          {step.description.split('\n\n').map((paragraph, index, arr) => (
            <p
              key={index}
              style={{ marginBottom: index === arr.length - 1 ? 0 : 12 }}
              dangerouslySetInnerHTML={{ __html: paragraph }}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onExit}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
              padding: '4px 8px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            Exit Tour
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onPrev}
              disabled={isFirstStep}
              style={{
                background: isFirstStep ? 'transparent' : '#334155',
                border: '1px solid #475569',
                borderRadius: 4,
                color: isFirstStep ? '#475569' : '#e2e8f0',
                cursor: isFirstStep ? 'not-allowed' : 'pointer',
                fontSize: 13,
                padding: '6px 12px',
                opacity: isFirstStep ? 0.5 : 1,
              }}
            >
              ← Back
            </button>

            <button
              onClick={onNext}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                padding: '6px 16px',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
            >
              {isLastStep ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default TourOverlay
