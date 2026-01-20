/**
 * useModal - Hooks for modal state management
 * Sprint 3: UX Improvements
 */

import { createSignal, Accessor } from 'solid-js'

/**
 * Return type for useModal hook
 */
export interface UseModalReturn {
  /**
   * Whether the modal is currently open
   */
  isOpen: Accessor<boolean>

  /**
   * Open the modal
   */
  open: () => void

  /**
   * Close the modal
   */
  close: () => void

  /**
   * Toggle the modal open/closed state
   */
  toggle: () => void
}

/**
 * Hook for managing modal open/close state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOpen, open, close } = useModal()
 *
 *   return (
 *     <>
 *       <button onClick={open}>Open Modal</button>
 *       <ModalRenderer
 *         isOpen={isOpen()}
 *         onClose={close}
 *         params={{ title: 'My Modal' }}
 *       >
 *         <p>Modal content</p>
 *       </ModalRenderer>
 *     </>
 *   )
 * }
 * ```
 */
export function useModal(initialOpen = false): UseModalReturn {
  const [isOpen, setIsOpen] = createSignal(initialOpen)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  return { isOpen, open, close, toggle }
}

/**
 * Return type for useConfirmModal hook
 */
export interface UseConfirmModalReturn {
  /**
   * Whether the confirm modal is currently open
   */
  isOpen: Accessor<boolean>

  /**
   * Show the confirm dialog and return a promise that resolves to true/false
   */
  confirm: () => Promise<boolean>

  /**
   * Call this when user confirms (resolves promise with true)
   */
  handleConfirm: () => void

  /**
   * Call this when user cancels (resolves promise with false)
   */
  handleCancel: () => void
}

/**
 * Hook for confirmation dialogs that return a promise
 *
 * @example
 * ```tsx
 * function DeleteButton() {
 *   const { isOpen, confirm, handleConfirm, handleCancel } = useConfirmModal()
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm()
 *     if (confirmed) {
 *       await deleteItem()
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <ModalRenderer
 *         isOpen={isOpen()}
 *         onClose={handleCancel}
 *         params={{ title: 'Confirm Delete', size: 'sm' }}
 *       >
 *         <p>Are you sure you want to delete this item?</p>
 *         <div class="flex gap-2 mt-4">
 *           <button onClick={handleCancel}>Cancel</button>
 *           <button onClick={handleConfirm}>Delete</button>
 *         </div>
 *       </ModalRenderer>
 *     </>
 *   )
 * }
 * ```
 */
export function useConfirmModal(): UseConfirmModalReturn {
  const [isOpen, setIsOpen] = createSignal(false)
  const [resolveRef, setResolveRef] = createSignal<((value: boolean) => void) | null>(null)

  const confirm = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
      setIsOpen(true)
    })
  }

  const handleConfirm = () => {
    resolveRef()?.(true)
    setResolveRef(null)
    setIsOpen(false)
  }

  const handleCancel = () => {
    resolveRef()?.(false)
    setResolveRef(null)
    setIsOpen(false)
  }

  return {
    isOpen,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
