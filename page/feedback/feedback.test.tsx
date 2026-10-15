import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../kit/button'
import { AskFirst } from './ask_first'
import { brief, BRIEF_MS, dismiss, keep, notices } from './notices'
import { Said, usePressed } from './said'
import { Sentence } from './sentence'

function Refresh({ work }: { work: () => Promise<string> }) {
  const pressed = usePressed()
  return (
    <>
      <Button action="check_for_updates" busy={pressed.busy} onPress={() => pressed.run(work)}>
        Check
      </Button>
      <Said said={pressed.said} busy={pressed.busy} working="Checking…" />
    </>
  )
}

describe('a press says what came of it, where the press was', () => {
  it('is off and says it works, then says what was found', async () => {
    let finish!: (says: string) => void
    render(<Refresh work={() => new Promise((done) => (finish = done))} />)
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('button', { name: 'Check' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Checking…')
    await act(async () => finish('Up to date.'))
    expect(screen.getByRole('status')).toHaveTextContent('Up to date.')
    expect(screen.getByRole('button', { name: 'Check' })).not.toHaveAttribute('aria-disabled')
  })

  it('takes one press for one answer', async () => {
    const work = vi.fn(() => new Promise<string>(() => {}))
    render(<Refresh work={work} />)
    await userEvent.dblClick(screen.getByRole('button', { name: 'Check' }))
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('shows a sentence written for a person, and never an error’s own words', async () => {
    const { unmount } = render(<Refresh work={async () => Promise.reject(new Sentence('Sign in to get updates.'))} />)
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status')).toHaveTextContent('Sign in to get updates.')
    unmount()
    render(<Refresh work={async () => Promise.reject(new Error('ENOENT /Users/someone/secret'))} />)
    await userEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status')).toHaveTextContent('That did not work.')
  })
})

describe('a press that cannot be undone asks first, in its own place', () => {
  const setUp = () => {
    const answered = vi.fn()
    render(<AskFirst action="discard_kept" label="Discard…" question="Throw the kept work away?" answer="Discard" answerAction="discard_kept_answer" onAnswer={answered} />)
    return answered
  }

  it('turns into the question, with Keep where the control stood', async () => {
    const answered = setUp()
    await userEvent.click(screen.getByRole('button', { name: 'Discard…' }))
    expect(answered).not.toHaveBeenCalled()
    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    expect(buttons).toEqual(['Keep', 'Discard'])
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
  })

  it('answers on the answering button, and keeps at Keep and at Escape', async () => {
    const answered = setUp()
    await userEvent.click(screen.getByRole('button', { name: 'Discard…' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Discard…' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(answered).toHaveBeenCalledTimes(1)
  })
})

describe('notices', () => {
  afterEach(() => {
    for (const notice of notices.get()) dismiss(notice.id)
    vi.useRealTimers()
  })

  it('lets a brief one go by itself and keeps a kept one', () => {
    vi.useFakeTimers()
    brief('Saved.')
    keep('An agent changed the poster.', { action: { label: 'Undo', run: () => {} } })
    vi.advanceTimersByTime(BRIEF_MS)
    expect(notices.get().map((notice) => notice.text)).toEqual(['An agent changed the poster.'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('says the same sentence once', () => {
    keep('The same.')
    keep('The same.')
    expect(notices.get()).toHaveLength(1)
  })
})
