/* The loading state keeps the dashboard's exact composition — head, term strip,
   ticket + crests, rails + inbox — so nothing jumps when the data lands. */
export function DashboardSkeleton() {
  return (
    <div className="sd-dash sd-skel" aria-busy="true" aria-label="Loading your dashboard" role="status">
      <div className="ui-page-head sd-head">
        <div className="ui-page-head__text sd-head__text">
          <div className="ui-skel sd-skel__title" />
          <div className="sd-skel__marks">
            <div className="ui-skel sd-skel__mark" />
            <div className="ui-skel sd-skel__mark" />
            <div className="ui-skel sd-skel__mark" />
          </div>
        </div>
        <div className="sd-head__actions">
          <div className="ui-skel sd-skel__key" />
          <div className="ui-skel sd-skel__key sd-skel__key--wide" />
        </div>
      </div>

      <div className="sd-compose">
        <section className="sd-region sd-term" aria-hidden="true">
          <div className="sd-region__head">
            <div className="ui-skel sd-skel__label" />
            <div className="ui-skel sd-skel__action" />
          </div>
          <div className="sd-skel__plot">
            <div className="sd-skel__plot-rules">
              {[0, 1, 2, 3, 4].map((index) => (
                <span className="ui-skel sd-skel__plot-rule" key={index} />
              ))}
            </div>
            <span className="ui-skel sd-skel__plot-mark" />
          </div>
          <div className="sd-skel__weeks">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div className="ui-skel sd-skel__week" key={index} />
            ))}
          </div>
        </section>

        <section className="sd-region sd-next" aria-hidden="true">
          <div className="sd-region__head">
            <div className="ui-skel sd-skel__label" />
            <div className="ui-skel sd-skel__action" />
          </div>
          <div className="sd-skel__ticket">
            <div className="ui-skel sd-skel__stub" />
            <div className="sd-skel__ticket-copy">
              <div className="ui-skel sd-skel__line sd-skel__line--xs" />
              <div className="ui-skel sd-skel__line sd-skel__line--lg" />
              <div className="ui-skel sd-skel__line sd-skel__line--sm" />
            </div>
            <div className="ui-skel sd-skel__ring" />
          </div>
        </section>

        <section className="sd-region sd-clubs" aria-hidden="true">
          <div className="sd-region__head">
            <div className="ui-skel sd-skel__label" />
            <div className="ui-skel sd-skel__action" />
          </div>
          <div className="sd-skel__rows">
            {[0, 1, 2].map((index) => (
              <div className="sd-skel__crest" key={index}>
                <div className="ui-skel sd-skel__plate" />
                <div className="sd-skel__crest-copy">
                  <div className="ui-skel sd-skel__line sd-skel__line--sm" />
                  <div className="ui-skel sd-skel__bar" />
                </div>
                <div className="ui-skel sd-skel__num" />
              </div>
            ))}
          </div>
        </section>

        <section className="sd-region sd-projects" aria-hidden="true">
          <div className="sd-region__head">
            <div className="ui-skel sd-skel__label" />
            <div className="ui-skel sd-skel__action" />
          </div>
          <div className="sd-skel__rows">
            {[0, 1, 2].map((index) => (
              <div className="sd-skel__rail" key={index}>
                <div className="ui-skel sd-skel__line sd-skel__line--md" />
                <div className="ui-skel sd-skel__steps" />
              </div>
            ))}
          </div>
        </section>

        <section className="sd-region sd-signal-region" aria-hidden="true">
          <div className="sd-region__head">
            <div className="ui-skel sd-skel__label" />
            <div className="ui-skel sd-skel__action" />
          </div>
          <div className="sd-skel__rows">
            {[0, 1].map((index) => (
              <div className="sd-skel__signal" key={index}>
                <div className="ui-skel sd-skel__line sd-skel__line--xs" />
                <div className="ui-skel sd-skel__num" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <span className="ui-visually-hidden">Loading your dashboard</span>
    </div>
  );
}
