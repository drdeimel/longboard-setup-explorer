/**
 * TourSelector component — dropdown/modal for selecting and starting a tour.
 *
 * Renders a "Take a Tour" button in the header. When clicked, shows a dropdown
 * with available tours. Selecting a tour starts it immediately.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { TourDefinition } from '../tours/tourTypes'

/** Props for the TourSelector component. */
interface TourSelectorProps {
  /** Available tours. */
  tours: TourDefinition[]
  /** Callback when user selects a tour to start. */
  onStartTour: (tourId: string) => void
}

/**
 * TourSelector — button + dropdown for tour selection.
 *
 * @param props - Tours list and start callback.
 * @returns Tour selector UI.
 */
const TourSelector: React.FC<TourSelectorProps> = ({ tours, onStartTour }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (tourId: string) => {
    onStartTour(tourId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Tour button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: '1px solid #475569',
          borderRadius: 6,
          color: '#cbd5e1',
          cursor: 'pointer',
          fontSize: 13,
          padding: '6px 12px',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#334155'
          e.currentTarget.style.borderColor = '#64748b'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = '#475569'
        }}
        aria-label="Start a guided tour"
      >
        {/* Tour icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Take a Tour
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            minWidth: 280,
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
              Guided Tours
            </p>
          </div>

          {/* Tour list */}
          <div style={{ padding: 8 }}>
            {tours.map((tour) => (
              <button
                key={tour.id}
                onClick={() => handleSelect(tour.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <p style={{ fontSize: 14, color: '#f1f5f9', margin: 0, fontWeight: 500 }}>
                  {tour.name}
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0 0' }}>
                  {tour.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TourSelector
