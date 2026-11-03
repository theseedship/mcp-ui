import { createContext, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";

export interface MathRenderOptions {
  displayMode: boolean
}

/** A synchronous, host-supplied renderer. Returned markup is always sanitized by MCP-UI. */
export type MathRenderer = (tex: string, options: MathRenderOptions) => string | null

const MCPUIMathContext = createContext<Accessor<MathRenderer | undefined>>(() => undefined)

export interface MCPUIMathProviderProps {
  /** Omit or pass null to explicitly disable an inherited renderer. */
  renderMath?: MathRenderer | null
  children: JSX.Element
}

export function MCPUIMathProvider(props: MCPUIMathProviderProps): JSX.Element {
  return (
    <MCPUIMathContext value={() => props.renderMath ?? undefined}>
      {props.children}
    </MCPUIMathContext>
  )
}

/**
 * Returns a reactive accessor for the nearest math renderer. Call the accessor
 * at use time; its value changes when a provider swaps or disables its renderer.
 */
export function useMCPUIMath(): Accessor<MathRenderer | undefined> {
  return useContext(MCPUIMathContext)
}
