import { useState } from 'react'
import { AccessGuard } from '../components/AccessGuard'

type AutomationRule = {
  id: string
  name: string
  description: string
  enabled: boolean
}

export function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Overdue escalation',
      description: 'When a task is 2 days overdue, notify the department manager and move it to Review.',
      enabled: true,
    },
    {
      id: '2',
      name: 'Chat sync',
      description: 'Post a summary to the department chat when a task transitions to Completed.',
      enabled: true,
    },
    {
      id: '3',
      name: 'Calendar reminder',
      description: 'Add a calendar event for tasks marked High priority with a due date within 3 days.',
      enabled: false,
    },
  ])
  const [isCreating, setIsCreating] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', description: '', enabled: true })

  const handleToggle = async (ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)),
    )
    // TODO: Save to Firestore
  }

  const handleCreate = () => {
    if (!newRule.name.trim() || !newRule.description.trim()) return

    const rule: AutomationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      description: newRule.description,
      enabled: newRule.enabled,
    }
    setRules((prev) => [...prev, rule])
    setNewRule({ name: '', description: '', enabled: true })
    setIsCreating(false)
    // TODO: Save to Firestore
  }

  const handleDelete = (ruleId: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    // TODO: Delete from Firestore
  }

  return (
    <AccessGuard allowedRoles={['Admin']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Automation Rules</h2>
            <p>Automate reminders, escalations, and cross-tool workflows.</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'Cancel' : 'Create Rule'}
          </button>
        </header>
        {isCreating && (
          <div className="automation-form">
            <label>
              <span>Rule Name</span>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g., Auto-assign high priority tasks"
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                rows={3}
                placeholder="Describe what this automation does..."
              />
            </label>
            <label>
              <span>Enabled</span>
              <div className="toggle">
                <input
                  type="checkbox"
                  checked={newRule.enabled}
                  onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                />
                <div className="toggle-display" />
              </div>
            </label>
            <button type="button" className="primary-button" onClick={handleCreate}>
              Create Rule
            </button>
          </div>
        )}
        <ul className="automation-list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <p>{rule.description}</p>
                <small style={{ color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </small>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                  />
                  <span>Enable</span>
                </label>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AccessGuard>
  )
}

export default AutomationPage
