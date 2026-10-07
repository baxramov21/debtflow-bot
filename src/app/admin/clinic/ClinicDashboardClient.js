'use client'

import { useState } from 'react'
import { connectBot, disconnectBot, saveSettings, logout } from '../actions'

export default function ClinicDashboardClient({ initialBotClinic, stats }) {
  const [botClinic, setBotClinic] = useState(initialBotClinic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleConnect(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.target)
    const result = await connectBot(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      window.location.reload()
    }
    setLoading(false)
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect this bot? Patients will lose access.')) return
    setLoading(true)
    await disconnectBot(botClinic.id)
    window.location.reload()
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')
    const formData = new FormData(e.target)
    const result = await saveSettings(botClinic.id, formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess('Settings saved successfully!')
    }
    setLoading(false)
  }

  if (!botClinic) {
    return (
      <div className="glass-panel animate-fade-in">
        <h3 className="mb-4">Connect Your Telegram Bot</h3>
        <p className="text-gray mb-8">
          To get started, talk to @BotFather on Telegram, create a new bot, and paste the token below.
        </p>
        
        <form onSubmit={handleConnect}>
          <div className="form-group">
            <label className="form-label" htmlFor="token">Bot Token</label>
            <input 
              className="form-input" 
              type="text" 
              id="token" 
              name="token" 
              placeholder="e.g. 123456789:ABCdefGHIjklmNOPqrsTUVwxyz..."
              required 
            />
          </div>
          {error && <div className="error-message mb-4">{error}</div>}
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect Bot'}
            </button>
            <button type="button" onClick={() => logout()} className="btn btn-danger" disabled={loading}>
              Logout
            </button>
          </div>
        </form>
      </div>
    )
  }

  const botUrl = `https://t.me/${botClinic.bot_username}`

  return (
    <div className="animate-fade-in">
      <div className="flex gap-4 mb-8" style={{ flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ flex: '1 1 300px' }}>
          <h3 className="mb-4">Bot Status: <span className="success-message">Connected</span></h3>
          <p className="mb-4">
            <strong>Username:</strong> <a href={botUrl} target="_blank" rel="noreferrer">@{botClinic.bot_username}</a>
          </p>
          <div className="flex gap-4">
             <button onClick={handleDisconnect} className="btn btn-danger" disabled={loading}>
               Disconnect
             </button>
             <button onClick={() => logout()} className="btn btn-danger" disabled={loading}>
               Logout
             </button>
          </div>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(botUrl)}`} 
            alt="Bot QR Code" 
            style={{ borderRadius: '8px' }}
          />
        </div>
      </div>

      {stats && (
        <div className="glass-panel mb-8">
          <h3 className="mb-4">Bot Statistics</h3>
          <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div className="text-gray" style={{ fontSize: '0.9rem' }}>Linked Patients</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.linkedPatients}</div>
            </div>
            <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div className="text-gray" style={{ fontSize: '0.9rem' }}>Bookings (Last 7 Days)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.botBookings7d}</div>
            </div>
            <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div className="text-gray" style={{ fontSize: '0.9rem' }}>Cancellations (Total)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)' }}>{stats.botCancellations}</div>
            </div>
            <div style={{ flex: '1 1 200px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div className="text-gray" style={{ fontSize: '0.9rem' }}>Average Rating</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'gold' }}>{stats.avgRating > 0 ? `${stats.avgRating} ⭐` : 'N/A'}</div>
            </div>
          </div>
          
          {stats.recentLowRatings && stats.recentLowRatings.length > 0 && (
            <div>
              <h4 className="mb-4" style={{ color: 'var(--danger)' }}>Recent Low Ratings (≤ 2 ⭐)</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {stats.recentLowRatings.map((r, i) => (
                  <li key={i} style={{ background: 'rgba(248, 81, 73, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                    <div><strong>{r.patients?.first_name} {r.patients?.last_name}</strong> - {r.rating} ⭐</div>
                    {r.comment && <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>&quot;{r.comment}&quot;</div>}
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel">
        <h3 className="mb-8">Bot Settings</h3>
        <form onSubmit={handleSaveSettings}>
          <div className="flex gap-4 mb-4" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="allow_self_register" defaultChecked={botClinic.allow_self_register} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Allow Patient Self-Registration</span>
          </div>

          <div className="flex gap-4 mb-4" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="allow_cancel" defaultChecked={botClinic.allow_cancel} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Allow Patients to Cancel Appointments</span>
          </div>

          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label className="form-label">Cancel Cutoff Hours</label>
            <input className="form-input" type="number" name="cancel_cutoff_hours" defaultValue={botClinic.cancel_cutoff_hours} />
          </div>

          <div className="flex gap-4 mb-4" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="reminder_2h_enabled" defaultChecked={botClinic.reminder_2h_enabled} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Enable 2-Hour Reminders</span>
          </div>

          <div className="flex gap-4 mb-4" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="feedback_enabled" defaultChecked={botClinic.feedback_enabled} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Enable Feedback Requests</span>
          </div>

          <div className="flex gap-4 mb-4" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="show_balance" defaultChecked={botClinic.show_balance} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Show Patient Balance (Opt-in)</span>
          </div>

          <div className="flex gap-4 mb-8" style={{ alignItems: 'center' }}>
            <label className="toggle-switch">
              <input type="checkbox" name="show_dental_chart" defaultChecked={botClinic.show_dental_chart} />
              <span className="slider"></span>
            </label>
            <span className="form-label" style={{ margin: 0 }}>Show Dental Chart (Opt-in)</span>
          </div>

          {error && <div className="error-message mb-4">{error}</div>}
          {success && <div className="success-message mb-4">{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
