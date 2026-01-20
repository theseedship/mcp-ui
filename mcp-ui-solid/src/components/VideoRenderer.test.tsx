/**
 * VideoRenderer Tests
 * Sprint 5: Media Components
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { VideoRenderer, isSupportedVideoUrl, getVideoProvider } from './VideoRenderer'
import type { VideoComponentParams } from '../types'

describe('VideoRenderer', () => {
  describe('Component Rendering', () => {
    it('renders YouTube video embed', () => {
      const params: VideoComponentParams = {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Test Video',
      }

      render(() => <VideoRenderer params={params} />)

      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      expect(iframe).toBeTruthy()
      expect(iframe?.src).toContain('youtube-nocookie.com')
      expect(iframe?.src).toContain('dQw4w9WgXcQ')
    })

    it('renders Vimeo video embed', () => {
      const params: VideoComponentParams = {
        url: 'https://vimeo.com/123456789',
        title: 'Vimeo Test',
      }

      render(() => <VideoRenderer params={params} />)

      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      expect(iframe).toBeTruthy()
      expect(iframe?.src).toContain('player.vimeo.com')
      expect(iframe?.src).toContain('123456789')
    })

    it('renders direct video file', () => {
      const params: VideoComponentParams = {
        url: 'https://example.com/video.mp4',
        title: 'Direct Video',
      }

      render(() => <VideoRenderer params={params} />)

      const video = document.querySelector('video') as HTMLVideoElement
      expect(video).toBeTruthy()
      expect(video?.src).toBe('https://example.com/video.mp4')
    })

    it('renders title when provided', () => {
      const params: VideoComponentParams = {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'My Video Title',
      }

      render(() => <VideoRenderer params={params} />)

      expect(screen.getByText('My Video Title')).toBeTruthy()
    })

    it('renders caption when provided', () => {
      const params: VideoComponentParams = {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        caption: 'This is a video caption',
      }

      render(() => <VideoRenderer params={params} />)

      expect(screen.getByText('This is a video caption')).toBeTruthy()
    })

    it('applies correct aspect ratio', () => {
      const { container, unmount } = render(() => (
        <VideoRenderer params={{ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', aspectRatio: '4:3' }} />
      ))

      expect(container.querySelector('.aspect-\\[4\\/3\\]')).toBeTruthy()

      unmount()

      const { container: container2 } = render(() => (
        <VideoRenderer params={{ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', aspectRatio: '21:9' }} />
      ))

      expect(container2.querySelector('.aspect-\\[21\\/9\\]')).toBeTruthy()
    })

    it('sets YouTube embed parameters correctly', () => {
      const params: VideoComponentParams = {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        autoplay: true,
        muted: true,
        loop: true,
        startTime: 30,
      }

      render(() => <VideoRenderer params={params} />)

      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      expect(iframe?.src).toContain('autoplay=1')
      expect(iframe?.src).toContain('mute=1')
      expect(iframe?.src).toContain('loop=1')
      expect(iframe?.src).toContain('start=30')
    })

    it('sets Vimeo embed parameters correctly', () => {
      const params: VideoComponentParams = {
        url: 'https://vimeo.com/123456',
        autoplay: true,
        muted: true,
        loop: true,
      }

      render(() => <VideoRenderer params={params} />)

      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      expect(iframe?.src).toContain('autoplay=1')
      expect(iframe?.src).toContain('muted=1')
      expect(iframe?.src).toContain('loop=1')
    })

    it('sets direct video attributes correctly', () => {
      const params: VideoComponentParams = {
        url: 'https://example.com/video.mp4',
        poster: 'https://example.com/poster.jpg',
        autoplay: true,
        controls: true,
        loop: true,
        muted: true,
      }

      render(() => <VideoRenderer params={params} />)

      const video = document.querySelector('video') as HTMLVideoElement
      expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg')
      expect(video.hasAttribute('autoplay')).toBe(true)
      expect(video.hasAttribute('controls')).toBe(true)
      expect(video.hasAttribute('loop')).toBe(true)
      // SolidJS sets muted as a property, not attribute in some cases
      expect(video.muted || video.hasAttribute('muted')).toBe(true)
    })

    it('enables controls by default for direct video', () => {
      const params: VideoComponentParams = {
        url: 'https://example.com/video.mp4',
      }

      render(() => <VideoRenderer params={params} />)

      const video = document.querySelector('video') as HTMLVideoElement
      expect(video.hasAttribute('controls')).toBe(true)
    })

    it('accepts component prop', () => {
      const component = {
        id: 'test-video',
        type: 'video' as const,
        position: { colStart: 1, colSpan: 12 },
        params: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Test',
        },
      }

      render(() => <VideoRenderer component={component} />)

      const iframe = document.querySelector('iframe')
      expect(iframe).toBeTruthy()
    })
  })

  describe('URL Parsing', () => {
    it('parses youtube.com/watch URLs', () => {
      expect(getVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    })

    it('parses youtube.com/embed URLs', () => {
      expect(getVideoProvider('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('youtube')
    })

    it('parses youtu.be URLs', () => {
      expect(getVideoProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    })

    it('parses vimeo.com URLs', () => {
      expect(getVideoProvider('https://vimeo.com/123456789')).toBe('vimeo')
    })

    it('parses player.vimeo.com URLs', () => {
      expect(getVideoProvider('https://player.vimeo.com/video/123456789')).toBe('vimeo')
    })

    it('returns direct for other URLs', () => {
      expect(getVideoProvider('https://example.com/video.mp4')).toBe('direct')
    })
  })

  describe('isSupportedVideoUrl', () => {
    it('returns true for YouTube URLs', () => {
      expect(isSupportedVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('returns true for Vimeo URLs', () => {
      expect(isSupportedVideoUrl('https://vimeo.com/123456')).toBe(true)
    })

    it('returns true for video file extensions', () => {
      expect(isSupportedVideoUrl('https://example.com/video.mp4')).toBe(true)
      expect(isSupportedVideoUrl('https://example.com/video.webm')).toBe(true)
      expect(isSupportedVideoUrl('https://example.com/video.ogg')).toBe(true)
      expect(isSupportedVideoUrl('https://example.com/video.mov')).toBe(true)
    })

    it('returns false for unsupported URLs', () => {
      expect(isSupportedVideoUrl('https://example.com/image.jpg')).toBe(false)
      expect(isSupportedVideoUrl('https://example.com/page')).toBe(false)
    })
  })
})
