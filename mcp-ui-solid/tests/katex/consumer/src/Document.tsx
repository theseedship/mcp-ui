import type { ParentProps } from 'solid-js'
import { HydrationScript } from '@solidjs/web'

export default function Document(props: ParentProps) {
  return <html lang="en"><head><meta charset="utf-8" /><title>KaTeX tarball qualification</title>
    <HydrationScript /></head><body>{props.children}</body></html>
}
