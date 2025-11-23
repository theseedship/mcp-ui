import { Component, Show, For } from 'solid-js'

export interface FooterComponentParams {
    poweredBy?: string
    executionTime?: number
    model?: string
    sourceCount?: number
    customText?: string
    links?: { label: string; url: string }[]
}

export const FooterRenderer: Component<{ params: FooterComponentParams }> = (props) => {
    return (
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-4">
            <Show when={props.params.poweredBy}>
                <span class="font-medium">{props.params.poweredBy}</span>
            </Show>

            <Show when={props.params.executionTime}>
                <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {props.params.executionTime}ms
                </span>
            </Show>

            <Show when={props.params.model}>
                <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {props.params.model}
                </span>
            </Show>

            <Show when={props.params.sourceCount}>
                <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {props.params.sourceCount} sources
                </span>
            </Show>

            <div class="flex-grow" />

            <Show when={props.params.links}>
                <div class="flex gap-3">
                    <For each={props.params.links}>
                        {(link) => (
                            <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                                {link.label}
                            </a>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    )
}
