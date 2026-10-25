import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../services/api';
import { Counter, KindGlyph } from '../ui/vis';

interface ProjectMaterialItem {
  _id: string;
  projectId: string;
  name: string;
  quantity: number;
  source: 'self_purchased' | 'owned' | 'guitar';
  inventoryItemId?: {
    _id: string;
    name: string;
    category?: string;
  };
  materialRequestId?: {
    _id: string;
    specifications?: string;
    reason?: string;
    documentUrl?: string;
    documentOriginalName?: string;
    imageUrl?: string;
  };
  addedBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  image?: string;
  imagePublicId?: string;
  specifications?: string;
  documentUrl?: string;
  documentOriginalName?: string;
  createdAt: string;
}

interface ProjectMaterialsProps {
  projectId: string;
  isTL?: boolean;
  /** Lifts the composition to the page so the aside can carry one coverage ring. */
  onSummaryChange?: (summary: {
    total: number;
    guitar: number;
    purchased: number;
    owned: number;
  }) => void;
}

const SOURCE_LABEL: Record<ProjectMaterialItem['source'], string> = {
  guitar: 'Central inventory',
  self_purchased: 'Team bought',
  owned: 'Already owned',
};

const FileMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 3.5h7l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const BoxMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m12 3.5 8 4v9l-8 4-8-4v-9l8-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m4 7.5 8 4 8-4M12 11.5v9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

/* One mark per source, so the table's source column reads at a glance. */
function SourceMark({ source }: { source: ProjectMaterialItem['source'] }) {
  if (source === 'guitar') return <KindGlyph kind="inventory" size={14} />;
  if (source === 'owned') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.6 12.4 9.4 17.2 19.4 6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.6 5.4h2.1l2.2 9.4h10.4l2-6.9H6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="18.8" r="1.1" fill="currentColor" />
      <circle cx="16.9" cy="18.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function ProjectMaterials({ projectId, isTL = false, onSummaryChange }: ProjectMaterialsProps) {
  const [materials, setMaterials] = useState<ProjectMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'guitar' | 'self_purchased' | 'owned'>('all');

  // Modal State for Team Leader Add Material
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [source, setSource] = useState<'self_purchased' | 'owned'>('self_purchased');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [specifications, setSpecifications] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const fieldId = useId();
  const addTrigger = useRef<HTMLButtonElement>(null);

  const fetchMaterials = () => {
    api<any>('GET', `/projects/${projectId}/materials`)
      .then((res) => setMaterials(res.data || []))
      .catch((err) => {
        if (err.status !== 403) setError(err.message || 'Failed to load project materials');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
  }, [projectId]);

  // Disable background scrolling when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !submitting) closeModal();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = origOverflow;
        document.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [isModalOpen, submitting]);

  const openModal = () => {
    setIsModalOpen(true);
    setName('');
    setSource('self_purchased');
    setQuantity(1);
    setSpecifications('');
    setDocumentFile(null);
    setImageFile(null);
    setImagePreview(null);
    setSubmitError('');
    setSubmitSuccess('');
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setSubmitError('');
    setSubmitSuccess('');
    addTrigger.current?.focus();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setDocumentFile(file || null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!name.trim()) {
      setSubmitError('Material name is required');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty < 1) {
      setSubmitError('Quantity must be at least 1');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('quantity', String(qty));
      formData.append('source', source);
      if (specifications.trim()) {
        formData.append('specifications', specifications.trim());
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }
      if (documentFile) {
        formData.append('document', documentFile);
      }

      await api('POST', `/projects/${projectId}/materials`, formData);
      setSubmitSuccess('Project material added successfully!');
      fetchMaterials();

      setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to add project material');
    } finally {
      setSubmitting(false);
    }
  };

  const guitarCount = materials.filter((m) => m.source === 'guitar').length;
  const selfPurchasedCount = materials.filter((m) => m.source === 'self_purchased').length;
  const ownedCount = materials.filter((m) => m.source === 'owned').length;

  useEffect(() => {
    onSummaryChange?.({
      total: materials.length,
      guitar: guitarCount,
      purchased: selfPurchasedCount,
      owned: ownedCount,
    });
  }, [materials, guitarCount, selfPurchasedCount, ownedCount, onSummaryChange]);

  const filteredMaterials = materials.filter((m) => {
    if (activeFilter === 'all') return true;
    return m.source === activeFilter;
  });

  const hasFiles = filteredMaterials.some(
    (m) => m.documentUrl || m.materialRequestId?.documentUrl,
  );

  if (loading) return null;
  if (error) {
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        {error}
      </div>
    );
  }

  const filters: { key: typeof activeFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: materials.length },
    { key: 'guitar', label: 'Central inventory', count: guitarCount },
    { key: 'self_purchased', label: 'Team bought', count: selfPurchasedCount },
    { key: 'owned', label: 'Owned', count: ownedCount },
  ];

  return (
    <section className="ui-panel prj-materials" id="materials" aria-labelledby="prj-materials-title">
      <header className="ui-panel__head prj-materials__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-materials-title">
            Materials
          </h2>
          <span className="ui-panel__meta">
            <Counter value={materials.length} /> items
          </span>
        </div>
        {isTL && (
          <button
            ref={addTrigger}
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--sm"
            onClick={openModal}
          >
            Add material
          </button>
        )}
      </header>

      <div className="ui-panel__body prj-materials__summary">
        <div
          className="prj-coverage"
          role="img"
          aria-label={`${guitarCount} from central inventory, ${selfPurchasedCount} team bought, ${ownedCount} already owned`}
        >
          {materials.length ? (
            <>
              {guitarCount > 0 && <span className="prj-coverage__part is-guitar" style={{ flexGrow: guitarCount }} />}
              {selfPurchasedCount > 0 && (
                <span className="prj-coverage__part is-bought" style={{ flexGrow: selfPurchasedCount }} />
              )}
              {ownedCount > 0 && <span className="prj-coverage__part is-owned" style={{ flexGrow: ownedCount }} />}
            </>
          ) : (
            <span className="prj-coverage__part is-empty" />
          )}
        </div>
        <ul className="prj-coverage__legend">
          <li>
            <span className="prj-coverage__swatch is-guitar" aria-hidden="true" />
            Central inventory <span className="prj-coverage__count">{guitarCount}</span>
          </li>
          <li>
            <span className="prj-coverage__swatch is-bought" aria-hidden="true" />
            Team bought <span className="prj-coverage__count">{selfPurchasedCount}</span>
          </li>
          <li>
            <span className="prj-coverage__swatch is-owned" aria-hidden="true" />
            Already owned <span className="prj-coverage__count">{ownedCount}</span>
          </li>
        </ul>
      </div>

      <div className="prj-materials__bar">
        <div className="ui-seg" role="group" aria-label="Filter materials by source">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={activeFilter === filter.key}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
              <span className="prj-statusfilter__count">{filter.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ui-panel__body ui-panel__body--flush">
        {filteredMaterials.length ? (
          <div className="ui-scroll-x">
            <table className="ui-table prj-materials__table">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Source</th>
                  <th scope="col" className="is-num">
                    Qty
                  </th>
                  <th scope="col">Added</th>
                  {hasFiles && <th scope="col">Files</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((mat) => {
                  const displayImage = mat.image || mat.materialRequestId?.imageUrl;
                  const displaySpecs = mat.specifications || mat.materialRequestId?.specifications;
                  const displayDocUrl = mat.documentUrl || mat.materialRequestId?.documentUrl;
                  const displayDocName =
                    mat.documentOriginalName || mat.materialRequestId?.documentOriginalName || 'Document';

                  return (
                    <tr key={mat._id}>
                      <td>
                        <div className="prj-mat">
                          {displayImage ? (
                            <a href={displayImage} target="_blank" rel="noopener noreferrer" className="prj-mat__thumb">
                              <img src={displayImage} alt="" />
                            </a>
                          ) : (
                            <span className="prj-mat__thumb prj-mat__thumb--empty" aria-hidden="true">
                              <BoxMark />
                            </span>
                          )}
                          <div className="prj-mat__text">
                            <p className="prj-mat__name">{mat.name}</p>
                            {displaySpecs && <p className="prj-mat__specs">{displaySpecs}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`prj-src is-${mat.source}`}>
                          <span className="prj-src__mark" aria-hidden="true">
                            <SourceMark source={mat.source} />
                          </span>
                          {SOURCE_LABEL[mat.source]}
                        </span>
                      </td>
                      <td className="is-num">{mat.quantity}</td>
                      <td>
                        <p className="prj-mat__added">{mat.addedBy?.name || 'Unknown'}</p>
                        <p className="prj-mat__date">
                          {new Date(mat.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </td>
                      {hasFiles && (
                        <td>
                          {displayDocUrl ? (
                            <a
                              className="prj-file-chip"
                              href={displayDocUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={displayDocName}
                            >
                              <FileMark />
                              Document
                            </a>
                          ) : (
                            <span className="ui-meta">None</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ui-empty prj-empty prj-empty--inset">
            <span className="ui-empty__mark">
              <BoxMark />
            </span>
            <p className="ui-empty__title">
              {activeFilter === 'all'
                ? 'No materials yet'
                : `No ${SOURCE_LABEL[activeFilter as ProjectMaterialItem['source']].toLowerCase()} materials`}
            </p>
            <p className="ui-empty__text">
              {isTL ? 'Add what the team bought or already owns.' : 'Materials added to this project appear here.'}
            </p>
            {isTL && (
              <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={openModal}>
                Add material
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add material · team leader */}
      {isModalOpen && (
        <div
          className="ui-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`}>
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id={`${fieldId}-title`}>
                  Add material
                </h2>
              </div>
              <button
                type="button"
                className="ui-icon-btn"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <form onSubmit={handleAddSubmit}>
              <div className="ui-modal__body ui-stack">
                {submitError && (
                  <div className="ui-notice ui-notice--error" role="alert">
                    {submitError}
                  </div>
                )}
                {submitSuccess && (
                  <div className="ui-notice prj-notice--ok" role="status">
                    {submitSuccess}
                  </div>
                )}

                <fieldset className="prj-fieldset">
                  <legend className="ui-label">
                    Source <span className="prj-required">required</span>
                  </legend>
                  <div className="prj-source-options">
                    <label className={`prj-source-option${source === 'self_purchased' ? ' is-checked' : ''}`}>
                      <input
                        type="radio"
                        name="source"
                        value="self_purchased"
                        checked={source === 'self_purchased'}
                        onChange={() => setSource('self_purchased')}
                      />
                      <span className="prj-source-option__body">
                        <span className="prj-source-option__title">Team bought</span>
                        <span className="prj-source-option__text">Purchased by the project team</span>
                      </span>
                    </label>
                    <label className={`prj-source-option${source === 'owned' ? ' is-checked' : ''}`}>
                      <input
                        type="radio"
                        name="source"
                        value="owned"
                        checked={source === 'owned'}
                        onChange={() => setSource('owned')}
                      />
                      <span className="prj-source-option__body">
                        <span className="prj-source-option__title">Already owned</span>
                        <span className="prj-source-option__text">Already in the team’s possession</span>
                      </span>
                    </label>
                  </div>
                  <p className="ui-hint">Central inventory comes through a material request.</p>
                </fieldset>

                <div className="ui-form-row ui-form-row--2">
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-name`}>
                      Material name
                    </label>
                    <input
                      id={`${fieldId}-name`}
                      type="text"
                      className="ui-field"
                      placeholder="e.g. PVC pipe 20mm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-qty`}>
                      Quantity
                    </label>
                    <input
                      id={`${fieldId}-qty`}
                      type="number"
                      min="1"
                      className="ui-field"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="ui-label" htmlFor={`${fieldId}-specs`}>
                    Specifications <span className="prj-label__hint">optional</span>
                  </label>
                  <textarea
                    id={`${fieldId}-specs`}
                    className="ui-field ui-field--area"
                    rows={2}
                    placeholder="Size, rating, where it was bought"
                    value={specifications}
                    onChange={(e) => setSpecifications(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="ui-form-row ui-form-row--2">
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-photo`}>
                      Photo <span className="prj-label__hint">optional</span>
                    </label>
                    <input
                      id={`${fieldId}-photo`}
                      type="file"
                      className="prj-file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      disabled={submitting}
                    />
                    {imagePreview && (
                      <div className="prj-attach">
                        <img src={imagePreview} alt="Material preview" />
                        <button
                          type="button"
                          className="ui-btn ui-btn--ghost ui-btn--sm"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-doc`}>
                      Document <span className="prj-label__hint">optional</span>
                    </label>
                    <input
                      id={`${fieldId}-doc`}
                      type="file"
                      className="prj-file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleDocumentChange}
                      disabled={submitting}
                    />
                    {documentFile && (
                      <div className="prj-file-chip prj-file-chip--selected">
                        <FileMark />
                        <span className="ui-truncate">{documentFile.name}</span>
                        <span className="ui-meta">{(documentFile.size / 1024).toFixed(1)} KB</span>
                        <button type="button" className="ui-icon-btn" onClick={() => setDocumentFile(null)} aria-label="Remove document">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <footer className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn--primary"
                  disabled={submitting || !name.trim() || Number(quantity) < 1}
                >
                  {submitting ? 'Adding…' : 'Add material'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
