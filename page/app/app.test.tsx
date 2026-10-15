import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dismiss, notices } from '../feedback/notices'
import { type Bridge, useBridge } from '../shell'
import { type StandIn, standInBridge } from '../stand_in_bridge'
import { App } from './app'
import { editor, startNew } from './editor'
import { waiting } from './recovery_screen'
import { account, updates } from './session'
import { setView } from './view'

let bridge: StandIn

beforeEach(() => {
  bridge = standInBridge()
  useBridge(bridge as Bridge)
  startNew()
  setView({ sheet: null, helpMode: false })
  waiting.set(null)
  account.set({ state: 'signed_out' })
  updates.set(null)
  for (const notice of notices.get()) dismiss(notice.id)
})

const settle = () => act(async () => {})

describe('the app', () => {
  it('drags a number field, and the whole drag is one undo step', async () => {
    render(<App />)
    await settle()
    const size = screen.getByLabelText('Size')
    fireEvent.pointerDown(size, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(size, { pointerId: 1, clientX: 110, clientY: 100 })
    fireEvent.pointerMove(size, { pointerId: 1, clientX: 120, clientY: 90 })
    fireEvent.pointerUp(size, { pointerId: 1, clientX: 120, clientY: 90 })
    expect(editor.get().document.size).toBe(79)
    expect(editor.get().undo).toHaveLength(1)
    expect(size).not.toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(editor.get().document.size).toBe(64)
  })

  it('takes a press that did not move for a click: the field is typed in', async () => {
    render(<App />)
    await settle()
    const size = screen.getByLabelText('Size')
    fireEvent.pointerDown(size, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(size, { pointerId: 1, clientX: 101, clientY: 100 })
    expect(size).toHaveFocus()
    await userEvent.clear(size)
    await userEvent.type(size, '120{Enter}')
    expect(editor.get().document.size).toBe(120)
  })

  it('says what a typed number must be, and changes nothing', async () => {
    render(<App />)
    await settle()
    const size = screen.getByLabelText('Size')
    await userEvent.click(size)
    await userEvent.clear(size)
    await userEvent.type(size, 'lots{Enter}')
    expect(editor.get().document.size).toBe(64)
    expect(screen.getByRole('alert')).toHaveTextContent('Size is a number from 8 to 200.')
  })

  it('shows Undo turned off, with why, rather than hiding it', async () => {
    render(<App />)
    await settle()
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    expect(undo).toHaveAttribute('data-says', 'There is nothing to undo.')
  })

  it('checks for updates and says what was found, where the press was', async () => {
    render(<App />)
    await settle()
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const section = screen.getByRole('region', { name: 'Updates' })
    await userEvent.click(within(section).getByRole('button', { name: 'Check for updates' }))
    await settle()
    expect(within(section).getByRole('status')).toHaveTextContent(/^Up to date\. Last checked /)
  })

  it('offers Restart to update when a build is ready, and it is the person’s press', async () => {
    bridge.standIn.nextUpdate = { version: '0.2.0', size: 90_000_000 }
    render(<App />)
    await settle()
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const section = screen.getByRole('region', { name: 'Updates' })
    await userEvent.click(within(section).getByRole('button', { name: 'Check for updates' }))
    await settle()
    expect(within(section).getByRole('status')).toHaveTextContent('Version 0.2.0 is ready.')
    await userEvent.click(within(section).getByRole('button', { name: 'Restart to update' }))
    await settle()
    expect(bridge.standIn.asks.at(-1)).toMatchObject({ door: 'updates', method: 'restart', askedBy: undefined })
  })

  it('signs in through the browser: a code to check, then signed in by itself', async () => {
    render(<App />)
    await settle()
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await settle()
    expect(screen.getByText('WXYZ-2345')).toBeInTheDocument()
    act(() => bridge.standIn.approve('person@example.com'))
    expect(within(screen.getByRole('region', { name: 'Account' })).getByText('Signed in as person@example.com.')).toBeInTheDocument()
  })

  it('offers kept work before anything else, and Discard asks first', async () => {
    bridge.standIn.kept = { state: 'kept', document: { title: 'Kept', size: 30, opacity: 50, turn: 10 } }
    render(<App />)
    await settle()
    const dialog = screen.getByRole('alertdialog', { name: 'Kept work' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard…' }))
    expect(bridge.standIn.kept.state).toBe('kept')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Recover' }))
    expect(editor.get().document.title).toBe('Kept')
    expect(screen.getByText('Edited')).toBeInTheDocument()
  })

  it('tells the shell when the document is unsaved, and hands it over to keep', async () => {
    render(<App />)
    await settle()
    act(() => void editor.set((state) => ({ ...state, document: { ...state.document, size: 99 } })))
    expect(bridge.standIn.asks).toContainEqual(expect.objectContaining({ door: 'app', method: 'unsaved', args: [true] }))
    expect(bridge.standIn.kept).toMatchObject({ state: 'kept', document: { size: 99 } })
  })

  it('runs what the menu asks through the same commands', async () => {
    render(<App />)
    await settle()
    act(() => bridge.standIn.tell({ about: 'ask', value: 'open_settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('does no work when it stands still: no timer is left running', async () => {
    vi.useFakeTimers()
    render(<App />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
