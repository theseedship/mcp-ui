/**
 * ImageGalleryRenderer Tests
 * Sprint 5: Media Components
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { ImageGalleryRenderer } from './ImageGalleryRenderer'
import type { ImageGalleryParams, GalleryImage } from '../types'

describe('ImageGalleryRenderer', () => {
  const sampleImages: GalleryImage[] = [
    { url: 'https://example.com/image1.jpg', alt: 'Image 1', caption: 'First image' },
    { url: 'https://example.com/image2.jpg', alt: 'Image 2', caption: 'Second image' },
    { url: 'https://example.com/image3.jpg', alt: 'Image 3', caption: 'Third image' },
  ]

  const defaultParams: ImageGalleryParams = {
    images: sampleImages,
  }

  it('renders gallery with images', () => {
    render(() => <ImageGalleryRenderer params={defaultParams} />)

    // Should render all images
    const images = screen.getAllByRole('img')
    expect(images.length).toBe(3)
  })

  it('renders title when provided', () => {
    const paramsWithTitle: ImageGalleryParams = {
      ...defaultParams,
      title: 'Photo Gallery',
    }

    render(() => <ImageGalleryRenderer params={paramsWithTitle} />)

    const title = screen.getByText('Photo Gallery')
    expect(title).toBeTruthy()
  })

  it('does not render title when not provided', () => {
    render(() => <ImageGalleryRenderer params={defaultParams} />)

    const title = screen.queryByText('Photo Gallery')
    expect(title).toBeNull()
  })

  it('uses thumbnail URL when available', () => {
    const paramsWithThumbnails: ImageGalleryParams = {
      images: [
        {
          url: 'https://example.com/full.jpg',
          thumbnail: 'https://example.com/thumb.jpg',
          alt: 'Thumbnail test',
        },
      ],
    }

    render(() => <ImageGalleryRenderer params={paramsWithThumbnails} />)

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe('https://example.com/thumb.jpg')
  })

  it('shows captions when showCaptions is true', () => {
    const paramsWithCaptions: ImageGalleryParams = {
      ...defaultParams,
      showCaptions: true,
    }

    render(() => <ImageGalleryRenderer params={paramsWithCaptions} />)

    expect(screen.getByText('First image')).toBeTruthy()
    expect(screen.getByText('Second image')).toBeTruthy()
    expect(screen.getByText('Third image')).toBeTruthy()
  })

  it('does not show captions by default', () => {
    render(() => <ImageGalleryRenderer params={defaultParams} />)

    // Captions should not be visible without showCaptions
    expect(screen.queryByText('First image')).toBeNull()
  })

  it('applies correct column classes', () => {
    const { container, unmount } = render(() => (
      <ImageGalleryRenderer params={{ ...defaultParams, columns: 4 }} />
    ))

    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-4')

    unmount()

    const { container: container2 } = render(() => (
      <ImageGalleryRenderer params={{ ...defaultParams, columns: 2 }} />
    ))

    const grid2 = container2.querySelector('.grid')
    expect(grid2?.className).toContain('grid-cols-2')
  })

  it('applies correct gap classes', () => {
    const { container } = render(() => (
      <ImageGalleryRenderer params={{ ...defaultParams, gap: 'lg' }} />
    ))

    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('gap-4')
  })

  it('applies correct aspect ratio classes', () => {
    const { container } = render(() => (
      <ImageGalleryRenderer params={{ ...defaultParams, aspectRatio: '16:9' }} />
    ))

    const button = container.querySelector('button')
    expect(button?.className).toContain('aspect-video')
  })

  it('renders buttons for images when lightbox is enabled', () => {
    const { container } = render(() => <ImageGalleryRenderer params={defaultParams} />)

    // Filter to image-trigger buttons (have aria-label "View image …"). The
    // ExpandableWrapper expand button (added in v6.2.0) is excluded.
    // Image-trigger buttons have a tailwind `relative overflow-hidden` group
    // class. The ExpandableWrapper expand button (added v6.2.0) has a
    // different `absolute top-2 right-2` class — this filter excludes it.
    const buttons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.className.includes('relative overflow-hidden')
    )
    expect(buttons.length).toBe(3)
  })

  it('disables lightbox when lightbox is false', () => {
    const paramsNoLightbox: ImageGalleryParams = {
      ...defaultParams,
      lightbox: false,
    }

    const { container } = render(() => <ImageGalleryRenderer params={paramsNoLightbox} />)

    // Same filter as above — ignore the ExpandableWrapper expand button (v6.2.0).
    // Image-trigger buttons have a tailwind `relative overflow-hidden` group
    // class. The ExpandableWrapper expand button (added v6.2.0) has a
    // different `absolute top-2 right-2` class — this filter excludes it.
    const buttons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.className.includes('relative overflow-hidden')
    )
    expect(buttons.length).toBe(3)
  })

  it('uses lazy loading for images', () => {
    render(() => <ImageGalleryRenderer params={defaultParams} />)

    const images = screen.getAllByRole('img') as HTMLImageElement[]
    images.forEach((img) => {
      // jsdom doesn't support loading property, use getAttribute
      expect(img.getAttribute('loading')).toBe('lazy')
    })
  })

  it('sets alt text correctly', () => {
    render(() => <ImageGalleryRenderer params={defaultParams} />)

    expect(screen.getByAltText('Image 1')).toBeTruthy()
    expect(screen.getByAltText('Image 2')).toBeTruthy()
    expect(screen.getByAltText('Image 3')).toBeTruthy()
  })

  it('provides default alt text when not specified', () => {
    const paramsNoAlt: ImageGalleryParams = {
      images: [{ url: 'https://example.com/image.jpg' }],
    }

    render(() => <ImageGalleryRenderer params={paramsNoAlt} />)

    expect(screen.getByAltText('Image 1')).toBeTruthy()
  })

  it('accepts component prop', () => {
    const component = {
      id: 'test-gallery',
      type: 'image-gallery' as const,
      position: { colStart: 1, colSpan: 12 },
      params: defaultParams,
    }

    render(() => <ImageGalleryRenderer component={component} />)

    const images = screen.getAllByRole('img')
    expect(images.length).toBe(3)
  })
})
