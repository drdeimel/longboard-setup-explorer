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
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step: TourStep | undefined = tour.steps[currentStep]
  const isLastStep = currentStep === tour.steps.length - 1
  const isFirstStep = currentStep === 0

  // Find the target element and get its bounding rect
  useEffect(() => {
    if (!step?.targetSelector) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let isMounted = true

    const findTarget = () => {
      const el = document.querySelector(step.targetSelector)
      if (el && isMounted) {
        setTargetRect(el.getBoundingClientRect())
      } else if (isMounted) {
        // Retry after a short delay (element may not be rendered yet)
        timeoutId = setTimeout(findTarget, 100)
      }
    }

    findTarget()

    // Update position on resize/scroll
    const handleResize = () => {
      const el = document.querySelector(step.targetSelector)
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
          transition: 'all 0.3s ease',
        }}
      />

      {/* Explanation box */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          zIndex: 10000,
          ...getTooltipPosition(targetRect, step.position ?? 'bottom'),
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

/**
 * Calculate the absolute position of the tooltip based on target rect and position.
 */
function getTooltipPosition(
  targetRect: DOMRect,
  position: 'top' | 'bottom' | 'left' | 'right' | 'center',
): React.CSSProperties {
  const { top, left, width, height } = targetRect

  switch (position) {
    case 'top':
      return {
        top: top - 12,
        left: left + width / 2,
        transform: 'translateX(-50%) translateY(-100%)',
      }
    case 'bottom':
      return {
        top: top + height + 12,
        left: left + width / 2,
        transform: 'translateX(-50%)',
      }
    case 'left':
      return {
        top: top + height / 2,
        left: left - 12,
        transform: 'translateY(-50%) translateX(-100%)',
      }
    case 'right':
      return {
        top: top + height / 2,
        left: left + width + 12,
        transform: 'translateY(-50%)',
      }
    case 'center':
      return {
        top: top + height / 2,
        left: left + width / 2,
        transform: 'translate(-50%, -50%)',
      }
    default:
      return {
        top: top + height + 12,
        left: left + width / 2,
        transform: 'translateX(-50%)',
      }
  }
}

export default TourOverlay
