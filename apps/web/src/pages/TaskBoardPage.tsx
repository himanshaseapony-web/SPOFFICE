import { useMemo, useState } from 'react'
import { TaskBoard } from '../components/TaskBoard'
import { useLayoutActions } from '../layouts/useLayoutActions'
import { useAppData } from '../context/AppDataContext'

export function TaskBoardPage() {
  const { openFilter } = useLayoutActions()
  const { filteredTasks } = useAppData()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const safeSelectedId = useMemo(() => {
    if (selectedTaskId && filteredTasks.some((task) => task.id === selectedTaskId)) {
      return selectedTaskId
    }
    return filteredTasks[0]?.id ?? ''
  }, [selectedTaskId, filteredTasks])

  return (
    <TaskBoard
      tasks={filteredTasks}
      selectedId={safeSelectedId}
      onSelect={setSelectedTaskId}
      onFilter={openFilter}
    />
  )
}

export default TaskBoardPage
