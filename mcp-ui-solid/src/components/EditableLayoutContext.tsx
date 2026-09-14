/** Private context: editor canvases must keep authored grid positions. */
import { createContext, useContext, type ParentComponent } from 'solid-js'

const EditableLayoutContext = createContext(false)

export const EditableLayoutProvider: ParentComponent = (props) => (
  <EditableLayoutContext.Provider value={true}>{props.children}</EditableLayoutContext.Provider>
)

export function useEditableLayoutPositions(): boolean {
  return useContext(EditableLayoutContext)
}
