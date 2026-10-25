import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../services/api';
import { usePageLoading } from '../../context/LoadingContext';
import { AvatarStack, Counter, KindGlyph, Segments } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpsOverlay } from './OpsOverlay';
import './ops.css';

interface InventoryPerson {
  _id?: string;
  name?: string;
  email?: string;
  department?: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  totalQuantity: number;
  availableQuantity: number;
  /** The department's own reorder floor. 0 means the item has no threshold. */
  minimumStock?: number;
  location?: string;
  createdBy?: InventoryPerson;
  createdAt?: string;
  updatedAt?: string;
}

interface Allocation {
  _id: string;
  quantity?: number;
  allocatedAt?: string;
  inventoryItemId?: { _id?: string; name?: string };
  projectId?: { _id?: string; name?: string };
  allocatedBy?: InventoryPerson;
  materialRequestId?: { quantity?: number };
}

interface ItemForm {
  name: string;
  description: string;
  category: string;
  totalQuantity: number;
  minimumStock: number;
  location: string;
}

type StockState = 'ok' | 'low' | 'out';

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  category: '',
  totalQuantity: 0,
  minimumStock: 0,
  location: '',
};

/* "Low" is the department's own reorder floor, returned by the API as
   `minimumStock`. 0 means the item has no floor and can never be low. */
const stockState = (item: InventoryItem): StockState => {
  if (item.availableQuantity <= 0) return 'out';
  const floor = item.minimumStock ?? 0;
  if (floor > 0 && item.availableQuantity <= floor) return 'low';
  return 'ok';
};

const ratioOf = (item: InventoryItem): number =>
  item.totalQuantity > 0
    ? Math.max(0, Math.min(item.availableQuantity / item.totalQuantity, 1))
    : 0;

/** The reorder floor as a fraction of the item's own total, for the shelf marker. */
const thresholdOf = (item: InventoryItem): number =>
  item.totalQuantity > 0 ? Math.max(0, Math.min((item.minimumStock ?? 0) / item.totalQuantity, 1)) : 0;

const severity: Record<StockState, number> = { out: 0, low: 1, ok: 2 };

const formatDay = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    : 'Unknown';

const formatStamp = (value?: string) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

const rise = (index: number): CSSProperties => ({ '--i': Math.min(index, 7) } as CSSProperties);

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function RestockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 9V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
      <path d="M4 9v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 5.5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" />
      <path d="M4 8l2-4h12l2 4M9 12h6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface BinProps {
  item: InventoryItem;
  index: number;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onRemove: (item: InventoryItem) => void;
}

/**
 * One shelf cell. The fill is the reading: available stock against the item's
 * own total, drawn from the floor of the well. The dashed line is the item's
 * own reorder floor, so the policy is visible instead of explained.
 */
function Bin({ item, index, onAdjust, onEdit, onRemove }: BinProps) {
  const state = stockState(item);
  const ratio = ratioOf(item);
  const threshold = thresholdOf(item);
  const facts = [
    `${item.availableQuantity} of ${item.totalQuantity} on the shelf`,
    state === 'low' ? 'low stock' : state === 'out' ? 'out of stock' : null,
    item.category || null,
    item.location ? `shelf ${item.location}` : null,
    item.description || null,
    `updated ${formatDay(item.updatedAt || item.createdAt)}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <li
      className={`ops-bin ops-bin--${state}`}
      style={{ ...rise(index), '--ops-fill': ratio, '--ops-low': threshold } as CSSProperties}
      aria-label={facts}
      role="group"
    >
      <div className="ops-bin__top">
        <span className="ops-bin__glyph" aria-hidden="true">
          <KindGlyph kind="inventory" size={14} />
        </span>
        <span
          className="ops-bin__name"
          title={item.description ? `${item.name} — ${item.description}` : item.name}
        >
          {item.name}
        </span>
        {state !== 'ok' && (
          <span className={`ops-bin__state ops-bin__state--${state}`}>
            <span className="ops-bin__dot" aria-hidden="true" />
            {state === 'low' ? 'Low' : 'Out'}
          </span>
        )}
        <div className="ops-bin__actions">
          <button
            type="button"
            className="ui-icon-btn"
            aria-label={`Adjust stock for ${item.name}`}
            title="Adjust stock"
            onClick={() => onAdjust(item)}
          >
            <RestockIcon />
          </button>
          <button
            type="button"
            className="ui-icon-btn"
            aria-label={`Edit ${item.name}`}
            title="Edit item"
            onClick={() => onEdit(item)}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="ui-icon-btn ops-icon--danger"
            aria-label={`Delete ${item.name}`}
            title="Delete item"
            onClick={() => onRemove(item)}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div
        className="ops-bin__well"
        role="img"
        aria-label={`${item.availableQuantity} of ${item.totalQuantity} available. Low under ${threshold + 1}.`}
        title={`${item.availableQuantity} of ${item.totalQuantity} available · low under ${threshold + 1}`}
      >
        <span className="ops-bin__fill" aria-hidden="true" />
        <span className="ops-bin__line" aria-hidden="true" />
        <span className="ops-bin__hover" aria-hidden="true">
          {[item.category, item.location ? `Shelf ${item.location}` : null, formatDay(item.updatedAt || item.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      <div className="ops-bin__base">
        <span className="ops-bin__qty">
          {item.availableQuantity}
          <span className="ops-bin__of"> / {item.totalQuantity}</span>
        </span>
      </div>
    </li>
  );
}

export default function Inventory() {
  const { setPageLoading } = usePageLoading();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  // Form: create + edit share one modal and one body shape.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<ItemForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [restock, setRestock] = useState<InventoryItem | null>(null);
  const [restockMode, setRestockMode] = useState<'increase' | 'decrease'>('increase');
  const [restockAmount, setRestockAmount] = useState(1);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<InventoryItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const focusReturn = useRef<HTMLElement | null>(null);

  const loadData = async () => {
    try {
      setPageLoading(true);
      setError(null);
      const [invRes, allocRes] = await Promise.all([
        api<any>('GET', '/inventory'),
        api<any>('GET', '/allocations').catch(() => ({ data: [] })),
      ]);
      setItems(invRes.data);
      setAllocations(allocRes.data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category?.trim()).filter(Boolean) as string[])).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    // MOCK: search and the category filter run client-side; GET /inventory returns the full list.
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (category !== 'all' && (item.category || '') !== category) return false;
        if (!needle) return true;
        return [item.name, item.description, item.category, item.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      // The emptiest shelf reads first: the wall is ordered by urgency, not by id.
      .sort((a, b) => {
        const byState = severity[stockState(a)] - severity[stockState(b)];
        if (byState !== 0) return byState;
        const byFill = ratioOf(a) - ratioOf(b);
        if (byFill !== 0) return byFill;
        return a.name.localeCompare(b.name);
      });
  }, [items, query, category]);

  const totals = useMemo(() => {
    const totalUnits = items.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    const availableUnits = items.reduce((sum, item) => sum + (item.availableQuantity || 0), 0);
    const lowItems = items.filter((item) => stockState(item) !== 'ok');
    const projectNames = Array.from(
      new Map(
        allocations
          .filter((a) => a.projectId?._id)
          .map((a) => [a.projectId!._id as string, a.projectId?.name || 'Untitled project']),
      ).values(),
    );
    const lastUpdated = items.reduce<string | undefined>((latest, item) => {
      if (!item.updatedAt) return latest;
      return !latest || new Date(item.updatedAt) > new Date(latest) ? item.updatedAt : latest;
    }, undefined);
    return {
      totalUnits,
      availableUnits,
      allocatedUnits: Math.max(totalUnits - availableUnits, 0),
      lowItems,
      projectNames,
      lastUpdated,
    };
  }, [items, allocations]);

  const rememberFocus = () => {
    focusReturn.current = document.activeElement as HTMLElement | null;
  };
  const restoreFocus = () => {
    window.requestAnimationFrame(() => focusReturn.current?.focus());
  };

  const openCreate = () => {
    rememberFocus();
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    rememberFocus();
    setEditing(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      category: item.category || '',
      totalQuantity: item.totalQuantity || 0,
      minimumStock: item.minimumStock || 0,
      location: item.location || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
    restoreFocus();
  };

  const openRestock = (item: InventoryItem) => {
    rememberFocus();
    setRestock(item);
    setRestockMode('increase');
    setRestockAmount(1);
    setRestockError(null);
  };

  const closeRestock = () => {
    setRestock(null);
    setRestockError(null);
    restoreFocus();
  };

  const openRemove = (item: InventoryItem) => {
    rememberFocus();
    setRemoveTarget(item);
    setRemoveError(null);
  };

  const closeRemove = () => {
    setRemoveTarget(null);
    setRemoveError(null);
    restoreFocus();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setSaving(true);
      await api('POST', '/inventory', formData);
      setFormOpen(false);
      setFormData(EMPTY_FORM);
      await loadData();
      restoreFocus();
    } catch (e: any) {
      setFormError(e.message || 'Failed to create inventory item');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    try {
      setSaving(true);
      await api('PUT', `/inventory/${editing._id}`, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        minimumStock: formData.minimumStock,
        location: formData.location,
      });
      setFormOpen(false);
      setEditing(null);
      await loadData();
      restoreFocus();
    } catch (e: any) {
      setFormError(e.message || 'Failed to update inventory item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setRemoving(true);
      setRemoveError(null);
      await api('DELETE', `/inventory/${id}`);
      setRemoveTarget(null);
      await loadData();
      restoreFocus();
    } catch (e: any) {
      setRemoveError(e.message || 'Failed to delete');
    } finally {
      setRemoving(false);
    }
  };

  const handleAdjustQuantity = async (id: string, amount: number) => {
    try {
      setAdjusting(true);
      setRestockError(null);
      const action = amount > 0 ? 'increase' : 'decrease';
      await api('PATCH', `/inventory/${id}/quantity`, { action, amount: Math.abs(amount) });
      await loadData();
      setRestock(null);
      restoreFocus();
    } catch (e: any) {
      setRestockError(e.message || 'Failed to adjust quantity');
    } finally {
      setAdjusting(false);
    }
  };

  const submitRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restock) return;
    const amount = Math.max(1, Math.floor(restockAmount || 0));
    handleAdjustQuantity(restock._id, restockMode === 'increase' ? amount : -amount);
  };

  useEffect(() => {
    const overlayOpen = formOpen || !!restock || !!removeTarget;
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (formOpen) closeForm();
      else if (restock) closeRestock();
      else closeRemove();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [formOpen, restock, removeTarget]);

  const restockAfter = restock
    ? restockMode === 'increase'
      ? restock.availableQuantity + Math.max(1, Math.floor(restockAmount || 0))
      : Math.max(restock.availableQuantity - Math.max(1, Math.floor(restockAmount || 0)), 0)
    : 0;

  const shelfCount = filteredItems.length === items.length
    ? `${items.length}`
    : `${filteredItems.length} of ${items.length}`;

  return (
    <div className="ops-page">
      <header className="ui-page-head ops-rise" style={rise(0)}>
        <div className="ui-page-head__text">
          <h1 className="ui-title">Inventory</h1>
        </div>
        <div className="ui-page-actions ops-head-tools">
          <div className="ui-search ops-search">
            <SearchIcon />
            <label className="ui-visually-hidden" htmlFor="ops-inventory-search">Search inventory</label>
            <input
              id="ops-inventory-search"
              className="ui-field"
              type="search"
              placeholder="Search items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </div>
          {categories.length > 0 && (
            <div className="ops-select ops-filter">
              <label className="ui-visually-hidden" htmlFor="ops-inventory-category">Filter by category</label>
              <select
                id="ops-inventory-category"
                className="ui-field ui-field--select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                <option value="all">All categories</option>
                {categories.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <ChevronDownIcon />
            </div>
          )}
          <button type="button" className="ui-btn ui-btn--primary" onClick={openCreate} disabled={loading}>
            <PlusIcon />
            Add item
          </button>
        </div>
      </header>

      <div className="ops-body">
        {error && (
          <div className="ui-notice ui-notice--error" role="alert">
            <div className="ui-grow">
              <p>Inventory could not be loaded.</p>
              <p className="ops-note">{error}</p>
            </div>
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadData}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="ops-stack" aria-busy="true">
            <div className="ops-console ops-console--skel" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <div className="ops-console__cell" key={n}>
                  <div className="ui-skel ops-skel-line ops-skel-line--sm" />
                  <div className="ui-skel ops-skel-line ops-skel-line--value" />
                  <div className="ui-skel ops-skel-line ops-skel-line--rail" />
                </div>
              ))}
            </div>
            <div className="ops-region" aria-hidden="true">
              <div className="ops-region__head">
                <div className="ui-skel ops-skel-line ops-skel-line--head" />
              </div>
              <div className="ops-bins">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <div className="ops-bin ops-bin--skel" key={n}>
                    <div className="ui-skel ops-skel-line" />
                    <div className="ui-skel ops-skel-well" />
                    <div className="ui-skel ops-skel-line ops-skel-line--sm" />
                  </div>
                ))}
              </div>
            </div>
            <span className="ui-visually-hidden" role="status">Loading inventory</span>
          </div>
        ) : items.length === 0 ? (
          <div className="ui-empty">
            <span className="ui-empty__mark"><BoxIcon /></span>
            <p className="ui-empty__title">The store room is empty</p>
            <p className="ui-empty__text">Add the first item so project teams can request it.</p>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={openCreate}>
              <PlusIcon />
              Add the first item
            </button>
          </div>
        ) : (
          <>
            <section className="ops-console ops-rise" style={rise(1)} aria-label="Store room totals">
              <div className="ops-console__cell ops-console__cell--first">
                <span className="ops-console__label">On the shelf</span>
                <span className="ops-console__num">
                  <Counter value={totals.availableUnits} />
                  <span className="ops-console__of">of {totals.totalUnits}</span>
                </span>
                <Segments
                  value={totals.availableUnits}
                  total={totals.totalUnits}
                  segments={18}
                  tone="accent"
                  className="ops-console__scale"
                  ariaLabel={`${totals.availableUnits} of ${totals.totalUnits} units on the shelf`}
                />
              </div>

              <div className="ops-console__cell">
                <span className="ops-console__label">Issued</span>
                <span className="ops-console__num">
                  <Counter value={totals.allocatedUnits} />
                  <span className="ops-console__of">units</span>
                </span>
                {totals.projectNames.length > 0 ? (
                  <AvatarStack
                    people={totals.projectNames.map((name) => ({ name }))}
                    max={5}
                    size="sm"
                    className="ops-console__stack"
                  />
                ) : (
                  <span className="ops-console__empty" aria-hidden="true" />
                )}
              </div>

              <div className="ops-console__cell">
                <Tooltip label="Items at or below their own reorder floor">
                  <span className="ops-console__label ops-console__label--hint" tabIndex={0}>
                    Low
                  </span>
                </Tooltip>
                <span className="ops-console__num">
                  <Counter value={totals.lowItems.length} />
                  <span className="ops-console__of">items</span>
                </span>
                <span
                  className="ops-ticks"
                  role="img"
                  aria-label={totals.lowItems.length
                    ? `Low: ${totals.lowItems.map((item) => item.name).join(', ')}`
                    : 'No low items'}
                >
                  {totals.lowItems.length > 0
                    ? totals.lowItems.slice(0, 8).map((item) => (
                        <span
                          className="ops-ticks__cell is-on"
                          key={item._id}
                          title={`${item.name} · ${item.availableQuantity} of ${item.totalQuantity}`}
                        />
                      ))
                    : Array.from({ length: 8 }, (_, n) => (
                        <span className="ops-ticks__cell" key={n} aria-hidden="true" />
                      ))}
                  {totals.lowItems.length > 8 ? (
                    <span className="ops-ticks__more">+{totals.lowItems.length - 8}</span>
                  ) : null}
                </span>
              </div>
            </section>

            <section className="ops-region ops-rise" style={rise(2)} aria-labelledby="ops-shelf-title">
              <header className="ops-region__head">
                <div className="ops-region__titles">
                  <h2 className="ops-region__title" id="ops-shelf-title">Shelves</h2>
                  <span className="ops-region__n">{shelfCount}</span>
                </div>
                <div className="ops-region__tools">
                  <Tooltip label={`Updated ${formatStamp(totals.lastUpdated)}`}>
                    <button
                      type="button"
                      className="ui-icon-btn"
                      aria-label="Refresh inventory"
                      onClick={loadData}
                      disabled={loading}
                    >
                      <RefreshIcon />
                    </button>
                  </Tooltip>
                </div>
              </header>

              {filteredItems.length > 0 ? (
                <ul className="ops-bins">
                  {filteredItems.map((item, index) => (
                    <Bin
                      key={item._id}
                      item={item}
                      index={index}
                      onAdjust={openRestock}
                      onEdit={openEdit}
                      onRemove={openRemove}
                    />
                  ))}
                </ul>
              ) : (
                <div className="ops-empty-wrap">
                  <div className="ui-empty">
                    <span className="ui-empty__mark"><SearchIcon /></span>
                    <p className="ui-empty__title">No items match</p>
                    <p className="ui-empty__text">Nothing on the shelves matches that search.</p>
                    <button
                      type="button"
                      className="ui-btn ui-btn--quiet ui-btn--sm"
                      onClick={() => {
                        setQuery('');
                        setCategory('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="ui-panel ops-rise" style={rise(3)} aria-labelledby="ops-alloc-title">
              <header className="ui-panel__head">
                <div className="ui-panel__titles">
                  <h2 className="ui-panel__title" id="ops-alloc-title">Allocations</h2>
                  <span className="ui-panel__meta">{allocations.length}</span>
                </div>
                <Tooltip label="Each approval deducts the request once and records it here">
                  <span className="ops-info" tabIndex={0} aria-label="How allocations are recorded">i</span>
                </Tooltip>
              </header>
              <div className="ui-panel__body ui-panel__body--flush">
                {allocations.length > 0 ? (
                  <ul className="ui-rows ops-allocs">
                    {allocations.map((allocation) => (
                      <li className="ui-row ops-alloc" key={allocation._id}>
                        <span className="ops-alloc__delta">
                          −{allocation.materialRequestId?.quantity || allocation.quantity || 1}
                        </span>
                        <div className="ui-row__main">
                          <p className="ui-row__title">
                            {allocation.inventoryItemId?.name || 'Deleted item'}
                          </p>
                          <p
                            className="ui-row__sub"
                            title={[
                              allocation.projectId?.name,
                              allocation.allocatedBy?.name
                                ? `by ${allocation.allocatedBy.name}`
                                : null,
                              formatStamp(allocation.allocatedAt),
                            ].filter(Boolean).join(' · ')}
                          >
                            {allocation.projectId?.name || 'Unknown project'}
                          </p>
                        </div>
                        <span className="ops-alloc__when">
                          {formatDay(allocation.allocatedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ops-empty">
                    <p className="ops-empty__title">No allocations yet</p>
                    <p>Stock leaves the store room when a request is approved.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {formOpen && (
        <OpsOverlay onClose={closeForm}>
          <div
            className="ui-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-item-form-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-item-form-title">
                  {editing ? 'Edit item' : 'Add inventory item'}
                </h2>
                {editing && <p className="ops-modal__sub">{editing.name}</p>}
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeForm} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <form onSubmit={editing ? handleUpdate : handleCreate}>
              <div className="ui-modal__body">
                <div className="ops-form-grid">
                  <div className="ops-field--wide">
                    <label className="ui-label" htmlFor="ops-item-name">Item name</label>
                    <input
                      id="ops-item-name"
                      className="ui-field"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label className="ui-label" htmlFor="ops-item-category">Category</label>
                    <input
                      id="ops-item-category"
                      className="ui-field"
                      type="text"
                      list="ops-item-categories"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      autoComplete="off"
                      placeholder="Optional"
                    />
                    <datalist id="ops-item-categories">
                      {categories.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="ui-label" htmlFor="ops-item-quantity">Total quantity</label>
                    {editing ? (
                      <div className="ops-readonly">
                        <span>Available {editing.availableQuantity} of {editing.totalQuantity}</span>
                        <button
                          type="button"
                          className="ops-readonly__action"
                          onClick={() => {
                            const item = editing;
                            closeForm();
                            openRestock(item);
                          }}
                        >
                          Restock
                        </button>
                      </div>
                    ) : (
                      <input
                        id="ops-item-quantity"
                        className="ui-field"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.totalQuantity}
                        onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || 0 })}
                        required
                      />
                    )}
                  </div>

                  <div className="ops-field--wide">
                    <label className="ui-label" htmlFor="ops-item-description">Description</label>
                    <textarea
                      id="ops-item-description"
                      className="ui-field ui-field--area"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="ui-label" htmlFor="ops-item-minimum">Reorder floor</label>
                    <input
                      id="ops-item-minimum"
                      className="ui-field"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.minimumStock}
                      onChange={(e) =>
                        setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="ui-hint">At or below this, the shelf reads as low. 0 disables it.</p>
                  </div>

                  <div className="ops-field--wide">
                    <label className="ui-label" htmlFor="ops-item-location">Location</label>
                    <input
                      id="ops-item-location"
                      className="ui-field"
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      autoComplete="off"
                      placeholder="Cupboard or lab shelf"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="ui-notice ui-notice--error ops-form-error" role="alert">
                    {formError}
                  </div>
                )}
              </div>
              <footer className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
                </button>
              </footer>
            </form>
          </div>
        </OpsOverlay>
      )}

      {restock && (
        <OpsOverlay onClose={closeRestock}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-restock-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-restock-title">Adjust stock</h2>
                <p className="ops-modal__sub">{restock.name}</p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeRestock} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <form onSubmit={submitRestock}>
              <div className="ui-modal__body">
                <div className="ops-stack">
                  <div className="ops-restock__now">
                    <div>
                      <div className="ops-restock__label">Available now</div>
                      <div className="ops-restock__num">
                        {restock.availableQuantity}
                        <span className="ops-restock__of"> / {restock.totalQuantity}</span>
                      </div>
                    </div>
                    <div>
                      <div className="ops-restock__label">After change</div>
                      <div className="ops-restock__num">
                        {restockAfter}
                        <span className="ops-restock__of">
                          {' '}/ {restockMode === 'increase'
                            ? restock.totalQuantity + Math.max(1, Math.floor(restockAmount || 0))
                            : restock.totalQuantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="ui-label" id="ops-restock-movement">Movement</span>
                    <div className="ui-seg" role="group" aria-labelledby="ops-restock-movement">
                      <button
                        type="button"
                        aria-pressed={restockMode === 'increase'}
                        onClick={() => setRestockMode('increase')}
                      >
                        Add stock
                      </button>
                      <button
                        type="button"
                        aria-pressed={restockMode === 'decrease'}
                        onClick={() => setRestockMode('decrease')}
                      >
                        Remove stock
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="ui-label" htmlFor="ops-restock-amount">Quantity</label>
                    <input
                      id="ops-restock-amount"
                      className="ui-field"
                      type="number"
                      min="1"
                      step="1"
                      value={restockAmount}
                      onChange={(e) => setRestockAmount(parseInt(e.target.value) || 1)}
                      required
                    />
                    <div className="ops-chips">
                      {[1, 5, 10].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className="ui-btn ui-btn--quiet ui-btn--sm"
                          aria-pressed={restockAmount === amount}
                          onClick={() => setRestockAmount(amount)}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {restockError && (
                  <div className="ui-notice ui-notice--error ops-form-error" role="alert">
                    {restockError}
                  </div>
                )}
              </div>
              <footer className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeRestock} disabled={adjusting}>
                  Cancel
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={adjusting}>
                  {adjusting ? 'Updating…' : restockMode === 'increase' ? 'Add stock' : 'Remove stock'}
                </button>
              </footer>
            </form>
          </div>
        </OpsOverlay>
      )}

      {removeTarget && (
        <OpsOverlay onClose={closeRemove}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-delete-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-delete-title">Delete item</h2>
                <p className="ops-modal__sub">This cannot be undone.</p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeRemove} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <div className="ui-modal__body">
              <p>
                Delete <strong>{removeTarget.name}</strong> from the store room? Existing allocation records
                are kept.
              </p>
              {removeError && (
                <div className="ui-notice ui-notice--error ops-form-error" role="alert">
                  {removeError}
                </div>
              )}
            </div>
            <footer className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={closeRemove} disabled={removing}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                onClick={() => handleDelete(removeTarget._id)}
                disabled={removing}
              >
                {removing ? 'Deleting…' : 'Delete item'}
              </button>
            </footer>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}
