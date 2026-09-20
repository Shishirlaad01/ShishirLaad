import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './thanks.css'
import { CHECKOUT_CHANNEL, downloadKit } from './lib/kit.js'

const kitContents = [
  { title: 'Dashboard.tsx', desc: 'The five-tab Delivery Cockpit dashboard: Overview, Project Life, Release Tracker, Risk Register and Risk Calculator.' },
  { title: 'Dashboard_Instructions.md', desc: 'Standing instructions so Claude rebuilds the dashboard identically from your own sheet.' },
  { title: 'Delivery Management.xlsx', desc: 'The four-tab sheet template the dashboard reads. Copy it to your Google Drive and fill in your project.' },
]

const sessionId = new URLSearchParams(window.location.search).get('session_id')

// This page normally runs in the checkout popup opened from the portfolio. Tell
// the main page the purchase is done; if it answers, it downloads the kit and we
// can close. Resolves false when nobody answers (page opened on its own).
const HANDOFF_WAIT_MS = 1000

function handOffToMainWindow(id) {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false)
  return new Promise(resolve => {
    const channel = new BroadcastChannel(CHECKOUT_CHANNEL)
    const timer = setTimeout(() => { channel.close(); resolve(false) }, HANDOFF_WAIT_MS)
    channel.onmessage = e => {
      if (e.data?.type !== 'ack') return
      clearTimeout(timer)
      channel.close()
      resolve(true)
    }
    channel.postMessage({ type: 'paid', sessionId: id })
  })
}

function Thanks() {
  const [state, setState] = useState({ status: 'idle' })

  async function download() {
    setState({ status: 'loading' })
    const result = await downloadKit(sessionId)
    setState(result.ok
      ? { status: 'done', remaining: result.remaining }
      : { status: 'error', message: result.message })
  }

  // Runs once when the buyer lands here after paying. Marked in sessionStorage
  // first so a reload (or React StrictMode's double effect in dev) doesn't burn
  // another of the purchase's download allowance. The button below remains for
  // re-downloads and for browsers that block automatic downloads.
  useEffect(() => {
    if (!sessionId) return
    const marker = `cockpit-auto-dl:${sessionId}`
    try {
      if (sessionStorage.getItem(marker)) return
      sessionStorage.setItem(marker, '1')
    } catch {
      return // storage unavailable: skip the automatic flow, the button still works
    }
    setState({ status: 'loading' })
    handOffToMainWindow(sessionId).then(handedOff => {
      if (!handedOff) return download()
      setState({ status: 'handoff' })
      window.close() // works for the popup; a plain tab just stays and shows the note
    })
  }, [])

  return (
    <main className="thanks">
      <div className="thanks-card">
        <p className="thanks-eyebrow">Delivery Cockpit</p>
        {sessionId ? (
          <>
            <h1>Thank you for your purchase</h1>
            <p className="thanks-lead">
              Your download should start automatically. Your kit has three things inside one zip:
            </p>
            <ul className="thanks-list">
              {kitContents.map(k => (
                <li key={k.title}>
                  <strong>{k.title}</strong>
                  <span>{k.desc}</span>
                </li>
              ))}
            </ul>
            <button className="thanks-btn" onClick={download} disabled={state.status === 'loading'}>
              {state.status === 'loading' ? 'Preparing…' : state.status === 'done' || state.status === 'handoff' ? 'Download again' : 'Download the kit'}
            </button>
            {state.status === 'handoff' && (
              <p className="thanks-note">
                Your kit is downloading in the main window. You can close this one.
              </p>
            )}
            {state.status === 'done' && (
              <p className="thanks-note">
                Download started.
                {state.remaining != null && ` You can download again from this page (${state.remaining} left).`}
              </p>
            )}
            {state.status === 'error' && <p className="thanks-note is-error" role="alert">{state.message}</p>}
          </>
        ) : (
          <>
            <h1>No purchase found</h1>
            <p className="thanks-lead">This page is shown after a completed payment.</p>
          </>
        )}
        <a className="thanks-home" href="/">← Back to portfolio</a>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><Thanks /></StrictMode>)
