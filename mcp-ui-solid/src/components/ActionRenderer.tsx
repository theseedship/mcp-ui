import { Component } from 'solid-js'
// import type { ActionSpec } from '@seed-ship/mcp-ui-spec'
type ActionSpec = any

export interface ActionRendererProps {
    action: ActionSpec
    onExecute: (toolName: string, params: any) => Promise<any>
    disabled?: boolean
}

export const ActionRenderer: Component<ActionRendererProps> = (props) => {
    const handleClick = async () => {
        if (props.disabled) return
        await props.onExecute(props.action.toolName, props.action.params)
    }

    const variantClasses: Record<string, string> = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white'
    }

    return (
        <button
            onClick={handleClick}
            disabled={props.disabled}
            class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${variantClasses[props.action.variant || 'primary']
                } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {props.action.label}
        </button>
    )
}
