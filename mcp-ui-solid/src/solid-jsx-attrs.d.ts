/**
 * Solid JSX augmentation — `attr:credentialless` (v6.21.0).
 *
 * `credentialless` is listed in dom-expressions' `Properties` set, so the
 * plain `credentialless={…}` form compiles to a JS property assignment
 * (`el.credentialless = v`) and never reaches the DOM as an attribute in an
 * engine that does not reflect it (jsdom, and any pre-110 browser). The
 * `attr:` namespace forces `setAttribute` / `ssrAttribute` instead.
 *
 * Solid types `attr:*` only for keys declared in `JSX.ExplicitAttributes`,
 * which ships empty — hence this augmentation. The value type is
 * `true | undefined` on purpose: `undefined` removes the attribute, so the
 * boolean attribute is never emitted as `credentialless="false"`.
 */

import 'solid-js'

declare module 'solid-js' {
  namespace JSX {
    interface ExplicitAttributes {
      credentialless: true | undefined
    }
  }
}
