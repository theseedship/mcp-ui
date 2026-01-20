/**
 * ImageGalleryRenderer - Gallery view for multiple images
 * Sprint 5: Media Components
 */

import { Component, createSignal, For, Show } from 'solid-js'
import type { UIComponent, ImageGalleryParams } from '../types'
import { LightboxOverlay } from './LightboxOverlay'

export interface ImageGalleryRendererProps {
  /**
   * UIComponent containing gallery params
   */
  component?: UIComponent

  /**
   * Direct gallery params (alternative to component)
   */
  params?: ImageGalleryParams
}

export const ImageGalleryRenderer: Component<ImageGalleryRendererProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null)

  const params = () => props.params || (props.component?.params as ImageGalleryParams)

  const columnsClass = () => {
    switch (params()?.columns) {
      case 2:
        return 'grid-cols-2'
      case 3:
        return 'grid-cols-3'
      case 4:
        return 'grid-cols-4'
      case 5:
        return 'grid-cols-5'
      default:
        return 'grid-cols-3'
    }
  }

  const gapClass = () => {
    switch (params()?.gap) {
      case 'none':
        return 'gap-0'
      case 'sm':
        return 'gap-1'
      case 'lg':
        return 'gap-4'
      default:
        return 'gap-2'
    }
  }

  const aspectClass = () => {
    switch (params()?.aspectRatio) {
      case '1:1':
        return 'aspect-square'
      case '16:9':
        return 'aspect-video'
      case '4:3':
        return 'aspect-[4/3]'
      default:
        return ''
    }
  }

  const handleImageClick = (index: number) => {
    if (params()?.lightbox !== false) {
      setSelectedIndex(index)
    }
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Title */}
      <Show when={params()?.title}>
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{params()!.title}</h3>
        </div>
      </Show>

      {/* Gallery Grid */}
      <div class={`grid ${columnsClass()} ${gapClass()} p-4`}>
        <For each={params()?.images}>
          {(image, index) => (
            <button
              class={`relative overflow-hidden rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none group ${aspectClass()}`}
              onClick={() => handleImageClick(index())}
              type="button"
              aria-label={image.alt || `View image ${index() + 1}`}
            >
              <img
                src={image.thumbnail || image.url}
                alt={image.alt || `Image ${index() + 1}`}
                srcset={image.srcset}
                sizes={image.sizes}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

              {/* Caption overlay */}
              <Show when={image.caption && params()?.showCaptions}>
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 pt-4">
                  <span class="truncate block">{image.caption}</span>
                </div>
              </Show>

              {/* Zoom icon on hover */}
              <Show when={params()?.lightbox !== false}>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div class="bg-white/90 dark:bg-gray-800/90 rounded-full p-2">
                    <svg
                      class="w-5 h-5 text-gray-700 dark:text-gray-200"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                  </div>
                </div>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Lightbox */}
      <LightboxOverlay
        images={params()?.images || []}
        selectedIndex={selectedIndex()}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
      />
    </div>
  )
}
