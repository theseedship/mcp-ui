import { Component } from 'solid-js'
import { safeUrl } from '../utils/safe-url'
import { formatMCPUIString, useMCPUIStrings } from '../context/MCPUIStringsContext'

export interface ArtifactComponentParams {
    url: string
    filename: string
    mimeType: string
    size?: number
    description?: string
}

export const ArtifactRenderer: Component<{ params: ArtifactComponentParams }> = (props) => {
    const strings = useMCPUIStrings()
    const getIcon = () => {
        if (props.params.mimeType?.includes('csv')) return '📊'
        if (props.params.mimeType?.includes('json')) return '{}'
        if (props.params.mimeType?.includes('pdf')) return '📄'
        return '📁'
    }

    const formatSize = (bytes?: number) => {
        if (!bytes) return ''
        const oneDecimal = (n: number) =>
            new Intl.NumberFormat(strings.locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
                useGrouping: false,
            }).format(n)
        if (bytes < 1024) return formatMCPUIString(strings.sizeBytes, { size: bytes })
        if (bytes < 1024 * 1024) return formatMCPUIString(strings.sizeKilobytes, { size: oneDecimal(bytes / 1024) })
        return formatMCPUIString(strings.sizeMegabytes, { size: oneDecimal(bytes / (1024 * 1024)) })
    }

    return (
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-md shadow-sm text-xl">
                    {getIcon()}
                </div>
                <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                        {props.params.filename}
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        {formatSize(props.params.size)} • {props.params.description || strings.artifactDescription}
                    </p>
                </div>
            </div>

            <a
                href={safeUrl(props.params.url)}
                download={props.params.filename}
                class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors flex items-center gap-1"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {strings.download}
            </a>
        </div>
    )
}
