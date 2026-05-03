import { Component, For, createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'
import { useRenderContext } from './RenderContext'
import type { UIComponent } from '../types'
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper'

export interface CarouselRendererProps {
    items: UIComponent[]
    height?: string
}

export const CarouselRenderer: Component<CarouselRendererProps> = (props) => {
    let scrollContainer: HTMLDivElement | undefined
    const [canScrollLeft, setCanScrollLeft] = createSignal(false)
    const [canScrollRight, setCanScrollRight] = createSignal(true)
    const isExpanded = useExpanded()

    // Use render context to avoid circular dependency
    const { renderComponent } = useRenderContext()

    const checkScroll = () => {
        if (isServer || !scrollContainer) return
        setCanScrollLeft(scrollContainer.scrollLeft > 0)
        setCanScrollRight(
            scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10
        )
    }

    const scroll = (direction: 'left' | 'right') => {
        if (isServer || !scrollContainer) return
        const scrollAmount = scrollContainer.clientWidth * 0.8
        scrollContainer.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        })
    }

    return (
        <ExpandableWrapper
            title={'Carousel'}
            copyData={JSON.stringify(props.items, null, 2)}
            copyLabel="Copy items (JSON)"
        >
        <div class={`relative group ${isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
            {/* Navigation Buttons */}
            <button
                onClick={() => scroll('left')}
                class={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-md border border-gray-200 dark:border-gray-700 transition-opacity ${canScrollLeft() ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <button
                onClick={() => scroll('right')}
                class={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-md border border-gray-200 dark:border-gray-700 transition-opacity ${canScrollRight() ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Scroll Container */}
            <div
                ref={scrollContainer}
                onScroll={checkScroll}
                class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide"
                style={{ "scroll-behavior": "smooth" }}
            >
                <For each={props.items}>
                    {(item) => (
                        <div class="flex-none w-[85%] sm:w-[45%] snap-center">
                            <div class="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                                {renderComponent(item)}
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
        </ExpandableWrapper>
    )
}
