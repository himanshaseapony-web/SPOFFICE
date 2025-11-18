import { useOutletContext } from 'react-router-dom'

export type LayoutActions = {
  openCreateTask: () => void
  openFilter: () => void
}

export function useLayoutActions() {
  return useOutletContext<LayoutActions>()
}

