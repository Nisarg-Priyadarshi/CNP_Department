/**
 * Dev-only gallery for components/ui/vis.tsx. Not part of the app build — Vite
 * serves it at /vis-gallery/ because it is an HTML entry in the project root.
 * Delete the folder when the instruments have landed in the real pages.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import '../src/tokens.css';
import '../src/ui.css';
import '../src/components/ui/vis.css';
import './gallery.css';

import {
  AvatarStack,
  Bars,
  Counter,
  DateTile,
  GridBg,
  Heatmap,
  KindGlyph,
  Meter,
  Ring,
  Segments,
  Sparkline,
  Trend,
} from '../src/components/ui/vis';

const KINDS = [
  ['club', 'Club'],
  ['project', 'Project'],
  ['event', 'Event'],
  ['request', 'Request'],
  ['system', 'System'],
  ['inventory', 'Inventory'],
  ['notification', 'Notification'],
  ['member', 'Member'],
  ['mentor', 'Mentor'],
  ['update', 'Update'],
] as const;

const ACTIVITY = [3, 5, 4, 8, 6, 9, 7, 11, 9, 14, 12, 16];
const FLAT = [6, 6, 6, 6, 6, 6, 6];
const ONE = [7];

const RANKED = [
  { label: 'Photography', value: 42, hint: '42 members' },
  { label: 'Robotics', value: 34, hint: '34 members' },
  { label: 'Coding', value: 27, hint: '27 members' },
  { label: 'Debate', value: 19 },
  { label: 'Eco', value: 12 },
  { label: 'Design', value: 8 },
];

const PEOPLE = [
  { name: 'Riya Sharma' },
  { name: 'Arjun Mehta' },
  { name: 'Neha Verma' },
  { name: 'Karan Shah' },
  { name: 'Amit Joshi' },
  { name: 'Priya Nair' },
  { name: 'Vivek Malhotra' },
  { name: 'Divya Rao' },
];

/** 12 weeks of plausible density, ending today. */
function heatCells() {
  const cells: { date: string; value: number; hint?: string }[] = [];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 84; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const roll = rand();
    const base = weekend ? roll * 3 : roll * 8;
    const value = Math.round(base);
    if (value > 0) cells.push({ date: key, value, hint: value === 1 ? '1 event' : `${value} events` });
  }
  return cells;
}

function Panel({
  title,
  meta,
  children,
  wide,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`ui-panel${wide ? ' g-wide' : ''}`}>
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title">{title}</h2>
          {meta ? <span className="ui-panel__meta">{meta}</span> : null}
        </div>
      </header>
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}

function Gallery() {
  const [picked, setPicked] = useState<string | null>(null);
  const cells = heatCells();

  return (
    <div className="g">
      <header className="g-head">
        <div>
          <p className="g-kicker">Components · ui/vis</p>
          <h1 className="g-title">The instrument library</h1>
        </div>
        <p className="g-note">
          Every mark at row and hero scale. Real components, real CSS, real tokens.
        </p>
      </header>

      <div className="g-grid">
        <Panel title="Numbers" meta="Counter · Ring" wide>
          <div className="ui-stats g-stats">
            <div className="ui-stat">
              <div className="ui-stat__value">
                <Counter value={128} />
              </div>
              <div className="ui-stat__label">Members</div>
            </div>
            <div className="ui-stat">
              <div className="ui-stat__value">
                <Counter value={12} duration={640} />
              </div>
              <div className="ui-stat__label">Pending</div>
            </div>
            <div className="ui-stat ui-stat--accent">
              <div className="ui-stat__value">
                <Counter value={0.72} format={(n) => `${Math.round(n * 100)}%`} />
              </div>
              <div className="ui-stat__label">Coverage</div>
            </div>
            <div className="ui-stat">
              <div className="ui-stat__value">
                <Counter value={4820} />
              </div>
              <div className="ui-stat__label">Records</div>
            </div>
          </div>

          <div className="g-rings">
            <Ring value={0.72} size={44} label="72%" />
            <Ring value={0.72} size={56} label="72%" caption="Coverage" />
            <Ring value={0.31} size={72} label="31%" caption="Filled" tone="positive" />
            <Ring value={0.08} size={44} tone="warning" label="8%" />
            <Ring value={1} size={44} tone="ink" label="100%" />
            <Ring value={0} size={44} tone="accent" label="0%" />
            <Ring value={0.68} size={140} label="68%" caption="Semester" />
            <Ring value={0.94} size={140} tone="ink" label="94" caption="Attendance" />
          </div>
        </Panel>

        <Panel title="Sparkline" meta="line · area · marker">
          <div className="g-stack">
            <div className="g-line">
              <Sparkline points={ACTIVITY} width={160} height={36} marker />
              <span className="g-cap">accent, marker</span>
            </div>
            <div className="g-line">
              <Sparkline points={ACTIVITY} width={160} height={44} area tone="ink" />
              <span className="g-cap">ink, area</span>
            </div>
            <div className="g-line">
              <Sparkline points={[3, 9, 5, 12, 8, 15]} width={104} height={24} tone="positive" marker />
              <span className="g-cap">positive, 104×24</span>
            </div>
            <div className="g-line">
              <Sparkline points={FLAT} width={104} height={24} tone="ink" />
              <span className="g-cap">all equal</span>
            </div>
            <div className="g-line">
              <Sparkline points={ONE} width={48} height={24} />
              <span className="g-cap">one point</span>
            </div>
            <div className="g-line">
              <Sparkline points={[]} width={104} height={24} />
              <span className="g-cap">no data</span>
            </div>
            <div className="g-line">
              <Sparkline
                points={[2, 4, 3, 7, 6]}
                width={140}
                height={28}
                marker
                labels={['Mon · 2', 'Tue · 4', 'Wed · 3', 'Thu · 7', 'Fri · 6']}
              />
              <span className="g-cap">hover labels</span>
            </div>
          </div>
        </Panel>

        <Panel title="Ranked bars" meta="accent · ramp · ink">
          <div className="g-stack g-stack--wide">
            <Bars data={RANKED} tone="accent" />
            <Bars data={RANKED} tone="ramp" />
            <Bars data={RANKED.slice(0, 4)} tone="ink" showValues={false} />
            <Bars
              data={[
                { value: 12 },
                { value: 9 },
                { value: 7 },
                { value: 4 },
                { value: 2 },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Density" meta="12 weeks">
          <div className="g-stack">
            <Heatmap cells={cells} weeks={12} />
            <div className="g-heat-row">
              <Heatmap cells={cells} weeks={12} onSelect={setPicked} />
              <span className="g-cap">{picked ?? 'click a day'}</span>
            </div>
            <Sparkline points={ACTIVITY} width={144} height={20} tone="ink" />
          </div>
        </Panel>

        <Panel title="People" meta="AvatarStack">
          <div className="g-stack g-stack--wide">
            <div className="g-line">
              <AvatarStack people={PEOPLE} max={4} />
              <span className="g-cap">max 4 of 8</span>
            </div>
            <div className="g-line">
              <AvatarStack people={PEOPLE.slice(0, 3)} max={4} />
              <span className="g-cap">no overflow</span>
            </div>
            <div className="g-line">
              <AvatarStack people={PEOPLE} max={6} size="lg" />
              <span className="g-cap">lg, max 6</span>
            </div>
            <div className="g-line">
              <AvatarStack people={PEOPLE.slice(0, 2)} size="sm" />
              <span className="g-cap">sm</span>
            </div>
          </div>
        </Panel>

        <Panel title="Dates" meta="DateTile">
          <div className="g-line g-line--loose">
            <DateTile date={new Date()} size="sm" />
            <DateTile date={new Date()} size="md" />
            <DateTile date={new Date()} size="lg" />
            <DateTile date={new Date()} size="md" tone="accent" />
            <DateTile date="2026-11-04" size="md" />
            <DateTile date="2027-01-31" size="md" tone="accent" />
          </div>
        </Panel>

        <Panel title="Scales" meta="Segments · Meter · Trend">
          <div className="g-stack g-stack--wide">
            <div className="g-meter-row">
              <Segments value={8} total={42} />
              <span className="g-cap">8 / 42</span>
            </div>
            <div className="g-meter-row">
              <Segments value={30} total={60} tone="ramp" />
              <span className="g-cap">ramp</span>
            </div>
            <div className="g-meter-row">
              <Segments value={42} total={42} tone="positive" />
              <span className="g-cap">full</span>
            </div>
            <div className="g-meter-row">
              <SegmentShort />
              <span className="g-cap">6 ticks</span>
            </div>
            <div className="g-meter-row">
              <Meter value={0.62} />
              <span className="g-cap">62%</span>
            </div>
            <div className="g-meter-row">
              <Meter value={2} max={12} tone="warning" />
              <span className="g-cap">2 / 12</span>
            </div>
            <div className="g-line">
              <Trend value={0.12} />
              <Trend value={-0.04} />
              <Trend value={0} />
              <Trend value={0.28} label="vs last week, 14 to 18 members" />
              <Trend value={-0.12} suffix="this week" />
            </div>
          </div>
        </Panel>

        <Panel title="Glyphs" meta="KindGlyph">
          <div className="g-glyphs">
            {KINDS.map(([kind, name]) => (
              <div className="g-glyph" key={kind}>
                <KindGlyph kind={kind} size={24} />
                <span>{name}</span>
              </div>
            ))}
          </div>
          <div className="g-glyph-row">
            <KindGlyph kind="event" size={16} />
            <span>Robotics Workshop</span>
            <KindGlyph kind="member" size={16} />
            <span>42 members</span>
            <KindGlyph kind="mentor" size={16} />
            <span>Dr. Neha Verma</span>
          </div>
        </Panel>

        <Panel title="Paper" meta="GridBg">
          <div className="g-canvas">
            <GridBg />
            <div className="g-canvas-in">
              <Ring value={0.46} size={72} label="46%" caption="Used" />
              <div className="g-canvas-text">
                <p className="g-canvas-title">Store room</p>
                <p className="g-cap">GridBg sits behind content; parent is relative.</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="In a row" meta="composed" wide>
          <ul className="ui-rows g-rows">
            <li className="ui-row ui-row--link">
              <DateTile date={new Date()} size="sm" tone="accent" />
              <div className="ui-row__main">
                <p className="ui-row__title">Robotics Workshop</p>
                <p className="ui-row__sub">Engineering Lab · 14:00</p>
              </div>
              <div className="ui-row__meta">
                <AvatarStack people={PEOPLE.slice(0, 5)} max={3} size="sm" />
                <Segments value={18} total={30} className="g-row-seg" />
                <Ring value={0.6} size={28} thickness={2} label="60" />
                <Trend value={0.2} />
              </div>
            </li>
            <li className="ui-row ui-row--link">
              <KindGlyph kind="club" size={18} className="g-row-glyph" />
              <div className="ui-row__main">
                <p className="ui-row__title">Photography Club</p>
                <p className="ui-row__sub">42 members · 8 in core</p>
              </div>
              <div className="ui-row__meta">
                <AvatarStack people={PEOPLE} max={4} size="sm" />
                <Ring value={0.19} size={28} thickness={2} label="19" tone="ink" />
                <span className="ui-tag is-positive">Active</span>
              </div>
            </li>
            <li className="ui-row ui-row--link">
              <KindGlyph kind="request" size={18} className="g-row-glyph" />
              <div className="ui-row__main">
                <p className="ui-row__title">Material request · Tripods</p>
                <p className="ui-row__sub">Raised 2 hours ago</p>
              </div>
              <div className="ui-row__meta">
                <Sparkline points={[1, 2, 1, 4, 6]} width={64} height={18} tone="ink" marker />
                <Meter value={3} max={5} tone="warning" className="g-row-meter" />
                <span className="ui-tag is-warning">Waiting</span>
              </div>
            </li>
          </ul>
        </Panel>
      </div>

      <footer className="g-foot">
        <span>vis · tokens only · reduced motion safe</span>
        <span>1440 / 375</span>
      </footer>
    </div>
  );
}

function SegmentShort() {
  return <Segments value={2} total={6} segments={6} />;
}

createRoot(document.getElementById('gallery')!).render(<Gallery />);
