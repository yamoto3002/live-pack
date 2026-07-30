import { Music2, X } from 'lucide-react';

export function PageHead({ eyebrow, title, text, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon = Music2, title, text, children }) {
  return (
    <section className="empty-state">
      <span><Icon /></span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children && <div>{children}</div>}
    </section>
  );
}

export function Modal({ title, subtitle, close, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <div>
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" aria-label="閉じる" onClick={close}><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
