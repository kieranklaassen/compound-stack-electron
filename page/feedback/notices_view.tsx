import { useStore } from '../store'
import { dismiss, notices } from './notices'

/** The notices, at the foot of the window, over the page: nothing moves when one comes or goes. */
export function NoticesView() {
  const list = useStore(notices)
  return (
    <div className="notices" aria-live="polite">
      {list.map((notice) => (
        <div key={notice.id} className="notice" role={notice.kept ? 'status' : 'alert'}>
          <span>{notice.text}</span>
          {notice.action && (
            <button
              type="button"
              className="button quiet"
              data-action="notice_action"
              onClick={() => {
                notice.action?.run()
                dismiss(notice.id)
              }}
            >
              {notice.action.label}
            </button>
          )}
          {notice.kept && (
            <button type="button" className="button quiet" data-action="dismiss_notice" onClick={() => dismiss(notice.id)}>
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
