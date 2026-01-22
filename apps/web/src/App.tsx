import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import OverviewPage from './pages/OverviewPage'
import TaskBoardPage from './pages/TaskBoardPage'
import MyTasksPage from './pages/MyTasksPage'
import CompanyChatPage from './pages/CompanyChatPage'
import UpdateCalendarPage from './pages/UpdateCalendarPage'
import InProgressTasksPage from './pages/InProgressTasksPage'
import DepartmentsPage from './pages/DepartmentsPage'
import ReportsPage from './pages/ReportsPage'
import KPIPointsPage from './pages/KPIPointsPage'
import AutomationPage from './pages/AutomationPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="tasks" element={<ProtectedRoute><TaskBoardPage /></ProtectedRoute>} />
          <Route 
            path="my-tasks" 
            element={
              <ProtectedRoute allowedRoles={['Specialist', 'DepartmentHead']}>
                <MyTasksPage />
              </ProtectedRoute>
            } 
          />
          <Route path="company-chat" element={<ProtectedRoute><CompanyChatPage /></ProtectedRoute>} />
          <Route path="update-calendar" element={<ProtectedRoute><UpdateCalendarPage /></ProtectedRoute>} />
          <Route 
            path="in-progress" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <InProgressTasksPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="departments" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
                <DepartmentsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="reports" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
                <ReportsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="kpi-points" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <KPIPointsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="automation" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AutomationPage />
              </ProtectedRoute>
            } 
          />
          <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
