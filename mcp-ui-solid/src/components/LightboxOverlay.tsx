/**
 * LightboxOverlay - Fullscreen image viewer
 * Sprint 5: Media Components
 */

import { Component, Show, createEffect, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { GalleryImage } from '../types'

export interface LightboxOverlayProps {
  /**
   * Array of images to navigate through
   */
  images: GalleryImage[]

  /**
   * Currently selected image index (null when closed)
   */
  selectedIndex: number | null

  /**
   * Callback when lightbox should close
   */
  onClose: () => void

  /**
   * Callback when navigating to a different image
   */
  onNavigate: (index: number) => void
}

export const LightboxOverlay: Component<LightboxOverlayProps> = (props) => {
  const isOpen = () => props.selectedIndex !== null
  const currentImage = () =>
    props.selectedIndex !== null ? props.images[props.selectedIndex] : null
  const canGoPrev = () => props.selectedIndex !== null && props.selectedIndex > 0
  const canGoNext = () =>
    props.selectedIndex !== null && props.selectedIndex < props.images.length - 1

  const handlePrev = () => {
    if (canGoPrev()) {
      props.onNavigate(props.selectedIndex! - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext()) {
      props.onNavigate(props.selectedIndex! + 1)
    }
  }

  // Keyboard navigation
  createEffect(() => {
    if (!isOpen()) return

    const handleKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          props.onClose()
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'ArrowRight':
          handleNext()
          break
      }
    }

    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
    })
  })

  return (
    <Show when={isOpen()}>
      <Portal>
        <div
          class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={props.onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          {/* Close button */}
          <button
            class="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={props.onClose}
            aria-label="Close lightbox"
          >
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Previous button */}
          <Show when={canGoPrev()}>
            <button
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              aria-label="Previous image"
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </Show>

          {/* Next button */}
          <Show when={canGoNext()}>
            <button
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              aria-label="Next image"
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </Show>

          {/* Image */}
          <img
            src={currentImage()?.url}
            alt={currentImage()?.alt || ''}
            srcset={currentImage()?.srcset}
            sizes={currentImage()?.sizes}
            class="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          <Show when={currentImage()?.caption}>
            <div class="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg max-w-[80vw] text-center">
              {currentImage()!.caption}
            </div>
          </Show>

          {/* Counter */}
          <div class="absolute top-4 left-4 text-white/80 bg-black/40 px-3 py-1 rounded-full text-sm">
            {(props.selectedIndex ?? 0) + 1} / {props.images.length}
          </div>
        </div>
      </Portal>
    </Show>
  )
}
