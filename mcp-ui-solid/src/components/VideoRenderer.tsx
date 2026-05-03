/**
 * VideoRenderer - Video embed component
 * Sprint 5: Media Components
 *
 * Supports YouTube, Vimeo, and direct video files
 */

import { Component, createMemo, Show } from 'solid-js'
import type { UIComponent, VideoComponentParams } from '../types'
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper'

export interface VideoRendererProps {
  /**
   * UIComponent containing video params
   */
  component?: UIComponent

  /**
   * Direct video params (alternative to component)
   */
  params?: VideoComponentParams

  /**
   * Error callback
   */
  onError?: (error: Error) => void
}

/**
 * Video provider type
 */
type VideoProvider = 'youtube' | 'vimeo' | 'direct'

/**
 * Parsed video info
 */
interface VideoInfo {
  provider: VideoProvider
  videoId?: string
}

/**
 * Extract video ID and provider from URL
 */
function parseVideoUrl(url: string): VideoInfo {
  // YouTube patterns:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/v/VIDEO_ID
  // - youtu.be/VIDEO_ID
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (youtubeMatch) {
    return { provider: 'youtube', videoId: youtubeMatch[1] }
  }

  // Vimeo patterns:
  // - vimeo.com/VIDEO_ID
  // - player.vimeo.com/video/VIDEO_ID
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch) {
    return { provider: 'vimeo', videoId: vimeoMatch[1] }
  }

  // Direct video file
  return { provider: 'direct' }
}

export const VideoRenderer: Component<VideoRendererProps> = (props) => {
  const params = () => props.params || (props.component?.params as VideoComponentParams)
  const isExpanded = useExpanded()

  const videoInfo = createMemo(() => parseVideoUrl(params()?.url || ''))

  const embedUrl = createMemo(() => {
    const info = videoInfo()
    const p = params()

    if (!p?.url) return null

    switch (info.provider) {
      case 'youtube': {
        const ytParams = new URLSearchParams({
          autoplay: p.autoplay ? '1' : '0',
          controls: p.controls !== false ? '1' : '0',
          loop: p.loop ? '1' : '0',
          mute: p.muted ? '1' : '0',
        })
        if (p.startTime) {
          ytParams.set('start', String(p.startTime))
        }
        // Use youtube-nocookie.com for privacy
        return `https://www.youtube-nocookie.com/embed/${info.videoId}?${ytParams}`
      }

      case 'vimeo': {
        const vParams = new URLSearchParams({
          autoplay: p.autoplay ? '1' : '0',
          loop: p.loop ? '1' : '0',
          muted: p.muted ? '1' : '0',
        })
        return `https://player.vimeo.com/video/${info.videoId}?${vParams}`
      }

      default:
        return null
    }
  })

  const aspectClass = () => {
    switch (params()?.aspectRatio) {
      case '1:1':
        return 'aspect-square'
      case '4:3':
        return 'aspect-[4/3]'
      case '21:9':
        return 'aspect-[21/9]'
      default:
        return 'aspect-video' // 16:9
    }
  }

  const handleVideoError = (e: Event) => {
    const error = new Error('Video failed to load')
    console.error('Video error:', e)
    props.onError?.(error)
  }

  return (
    <ExpandableWrapper
      title={params()?.title || 'Video'}
      copyData={params()?.url || ''}
      copyLabel="Copy video URL"
    >
    <div class={`w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
      isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''
    }`}>
      {/* Title */}
      <Show when={params()?.title}>
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{params()!.title}</h3>
        </div>
      </Show>

      {/* Video Container — when expanded, fill remaining space (override aspect ratio) */}
      <div class={`relative bg-black ${isExpanded() ? 'flex-1 min-h-0' : aspectClass()}`}>
        <Show
          when={embedUrl()}
          fallback={
            // Direct video file
            <video
              src={params()?.url}
              poster={params()?.poster}
              autoplay={params()?.autoplay}
              controls={params()?.controls !== false}
              loop={params()?.loop}
              muted={params()?.muted}
              playsinline
              class="absolute inset-0 w-full h-full object-contain"
              onError={handleVideoError}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          }
        >
          {/* YouTube/Vimeo embed */}
          <iframe
            src={embedUrl()!}
            title={params()?.title || 'Video'}
            class="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy"
          />
        </Show>
      </div>

      {/* Caption */}
      <Show when={params()?.caption}>
        <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p class="text-sm text-gray-600 dark:text-gray-400">{params()!.caption}</p>
        </div>
      </Show>
    </div>
    </ExpandableWrapper>
  )
}

/**
 * Check if a URL is from a supported video provider
 */
export function isSupportedVideoUrl(url: string): boolean {
  const info = parseVideoUrl(url)
  return info.provider !== 'direct' || url.match(/\.(mp4|webm|ogg|mov)$/i) !== null
}

/**
 * Get video provider from URL
 */
export function getVideoProvider(url: string): VideoProvider {
  return parseVideoUrl(url).provider
}
