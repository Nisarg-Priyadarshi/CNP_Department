import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../services/api';

interface InventoryItem {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  availableQuantity: number;
  totalQuantity: number;
  location?: string;
}

interface MaterialRequestItem {
  _id: string;
  projectId: string;
  materialName?: string;
  inventoryItemId?: InventoryItem;
  quantity: number;
  specifications?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  documentUrl?: string;
  documentOriginalName?: string;
  imageUrl?: string;
}

interface ProjectMaterialRequestsProps {
  projectId: string;
  isTL?: boolean;
  /** Lifts the queue counts so the aside can plot approval coverage. */
  onStatsChange?: (stats: { total: number; approved: number; pending: number }) => void;
}

const STATUS_LABEL: Record<MaterialRequestItem['status'], string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<MaterialRequestItem['status'], string> = {
  pending: 'is-warning',
  approved: 'is-positive',
  rejected: 'is-negative',
};

const FileMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 3.5h7l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const ImageMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    <path d="m5 17 4.5-4.5 3 3L15 13l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const CartMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3.5 5.5h2.2l2.2 9.5h10.6l2-7H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="19" r="1.1" fill="currentColor" />
    <circle cx="17" cy="19" r="1.1" fill="currentColor" />
  </svg>
);

export function ProjectMaterialRequests({ projectId, isTL = false, onStatsChange }: ProjectMaterialRequestsProps) {
  const [requests, setRequests] = useState<MaterialRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const fieldId = useId();
  const requestTrigger = useRef<HTMLButtonElement>(null);

  const fetchRequests = () => {
    api<any>('GET', `/material-requests/project/${projectId}`)
      .then((res) => setRequests(res.data || []))
      .catch((err) => {
        if (err.status !== 403) setError(err.message || 'Failed to load requests');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [projectId]);

  useEffect(() => {
    onStatsChange?.({
      total: requests.length,
      approved: requests.filter((request) => request.status === 'approved').length,
      pending: requests.filter((request) => request.status === 'pending').length,
    });
  }, [requests, onStatsChange]);

  // Disable background page scrolling when the modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !submitting) closeModal();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [isModalOpen, submitting]);

  const openModal = async () => {
    setIsModalOpen(true);
    setSubmitError('');
    setSubmitSuccess('');
    setLoadingInventory(true);
    try {
      const res = await api<any>('GET', '/inventory');
      setInventoryItems(res.data || []);
      if (res.data && res.data.length > 0 && !selectedItemId) {
        const firstAvailable = res.data.find((i: InventoryItem) => i.availableQuantity > 0) || res.data[0];
        setSelectedItemId(firstAvailable._id);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to load inventory items');
    } finally {
      setLoadingInventory(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setSelectedItemId('');
    setSpecifications('');
    setQuantity(1);
    setReason('');
    setDocumentFile(null);
    setImageFile(null);
    setImagePreview(null);
    setSubmitError('');
    setSubmitSuccess('');
    requestTrigger.current?.focus();
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

  const selectedItem = inventoryItems.find((i) => i._id === selectedItemId);
  const maxAvailable = selectedItem ? selectedItem.availableQuantity : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!selectedItemId) {
      setSubmitError('Please select a material from inventory');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty < 1) {
      setSubmitError('Requested quantity must be at least 1');
      return;
    }

    if (qty > maxAvailable) {
      setSubmitError(`Requested quantity (${qty}) exceeds available stock (${maxAvailable})`);
      return;
    }

    if (!reason.trim()) {
      setSubmitError('Please provide a reason or explanation for this request');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('inventoryItemId', selectedItemId);
      formData.append('quantity', String(qty));
      formData.append('reason', reason.trim());
      if (specifications.trim()) {
        formData.append('specifications', specifications.trim());
      }
      if (documentFile) {
        formData.append('document', documentFile);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await api('POST', '/material-requests', formData);
      setSubmitSuccess('Material request submitted successfully! Awaiting Project Admin review.');
      fetchRequests();

      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit material request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (error) {
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <section className="ui-panel prj-requests" id="material-requests" aria-labelledby="prj-requests-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-requests-title">
            Material requests
          </h2>
          <span className="ui-panel__meta">{requests.length}</span>
        </div>
        {isTL && (
          <button
            ref={requestTrigger}
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--sm"
            onClick={openModal}
          >
            Request materials
          </button>
        )}
      </header>

      <div className="ui-panel__body ui-panel__body--flush">
        {requests.length ? (
          <ul className="prj-request-list">
            {requests.map((req) => {
              const materialDisplayName = req.materialName || req.inventoryItemId?.name || 'Central inventory item';
              return (
                <li className="prj-request" key={req._id}>
                  <div className="prj-request__main">
                    <div className="prj-request__title-row">
                      <p className="prj-request__name">{materialDisplayName}</p>
                      <span className="prj-request__qty">×{req.quantity}</span>
                      {req.inventoryItemId?.category && (
                        <span className="ui-tag ui-tag--plain">{req.inventoryItemId.category}</span>
                      )}
                      <span className={`ui-tag ${STATUS_TONE[req.status] || STATUS_TONE.pending}`}>
                        {STATUS_LABEL[req.status] || 'Pending review'}
                      </span>
                    </div>

                    {req.reason && <p className="prj-request__reason">{req.reason}</p>}
                    {req.specifications && (
                      <p className="prj-request__specs">
                        <span className="prj-request__label">Specifications</span> {req.specifications}
                      </p>
                    )}

                    <p className="prj-request__meta">
                      Requested{' '}
                      {new Date(req.createdAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {req.status !== 'pending' && req.reviewedAt && (
                        <>
                          <span aria-hidden="true"> · </span>
                          Reviewed{' '}
                          {new Date(req.reviewedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {req.reviewedBy?.name ? ` by ${req.reviewedBy.name}` : ''}
                        </>
                      )}
                    </p>

                    {req.status === 'rejected' && req.rejectionReason && (
                      <div className="ui-notice ui-notice--error prj-request__rejection">
                        <div>
                          <strong>Rejection reason</strong>
                          <p>{req.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(req.imageUrl || req.documentUrl) && (
                    <div className="prj-request__files">
                      {req.imageUrl && (
                        <a
                          className="prj-file-chip"
                          href={req.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ImageMark />
                          Photo
                        </a>
                      )}
                      {req.documentUrl && (
                        <a
                          className="prj-file-chip"
                          href={req.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={req.documentOriginalName || undefined}
                        >
                          <FileMark />
                          Document
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="ui-empty prj-empty prj-empty--inset">
            <span className="ui-empty__mark">
              <CartMark />
            </span>
            <p className="ui-empty__title">No material requests yet</p>
            <p className="ui-empty__text">
              {isTL
                ? 'Ask central inventory for components; approvals land back here.'
                : 'Requests raised by the team leader appear here.'}
            </p>
            {isTL && (
              <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={openModal}>
                Request materials
              </button>
            )}
          </div>
        )}
      </div>

      {/* Request materials · team leader */}
      {isModalOpen && (
        <div
          className="ui-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="ui-modal ui-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-title`}
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id={`${fieldId}-title`}>
                  Request materials
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

            <form onSubmit={handleSubmit}>
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

                <div>
                  <label className="ui-label" htmlFor={`${fieldId}-item`}>
                    Material from central inventory
                  </label>
                  {loadingInventory ? (
                    <span className="ui-skel" style={{ display: 'block', height: 40 }} />
                  ) : (
                    <select
                      id={`${fieldId}-item`}
                      className="ui-field ui-field--select"
                      value={selectedItemId}
                      onChange={(e) => {
                        setSelectedItemId(e.target.value);
                        setQuantity(1);
                      }}
                      required
                      disabled={submitting}
                    >
                      <option value="" disabled>
                        Choose an item
                      </option>
                      {inventoryItems.map((item) => (
                        <option key={item._id} value={item._id} disabled={item.availableQuantity <= 0}>
                          {item.name}
                          {item.category ? ` (${item.category})` : ''}
                          {item.availableQuantity > 0
                            ? ` · ${item.availableQuantity} available`
                            : ' · Out of stock'}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedItem && (
                    <div className="prj-stock">
                      <div className="prj-stock__top">
                        <span className={`ui-tag ${selectedItem.availableQuantity > 0 ? 'is-positive' : 'is-negative'}`}>
                          {selectedItem.availableQuantity > 0
                            ? `${selectedItem.availableQuantity} units available`
                            : 'Out of stock'}
                        </span>
                        {selectedItem.location && <span className="ui-meta">{selectedItem.location}</span>}
                      </div>
                      {selectedItem.description && (
                        <p className="prj-stock__text">{selectedItem.description}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="ui-form-row ui-form-row--2">
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-specs`}>
                      Specifications <span className="prj-label__hint">optional</span>
                    </label>
                    <input
                      id={`${fieldId}-specs`}
                      type="text"
                      className="ui-field"
                      placeholder="e.g. 5V 2-channel relay module"
                      value={specifications}
                      onChange={(e) => setSpecifications(e.target.value)}
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
                      className="ui-field"
                      min="1"
                      max={maxAvailable || 1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                      required
                      disabled={submitting}
                    />
                    {Number(quantity) > maxAvailable && maxAvailable > 0 && (
                      <p className="ui-error">
                        Requested quantity exceeds the {maxAvailable} units in stock.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="ui-label" htmlFor={`${fieldId}-reason`}>
                    Reason
                  </label>
                  <textarea
                    id={`${fieldId}-reason`}
                    className="ui-field ui-field--area"
                    rows={3}
                    placeholder="What milestone or experiment needs this material?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="ui-form-row ui-form-row--2">
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
                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-photo`}>
                      Reference photo <span className="prj-label__hint">optional</span>
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
                        <img src={imagePreview} alt="Component preview" />
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
                </div>
              </div>

              <footer className="ui-modal__foot">
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn--primary"
                  disabled={submitting || Number(quantity) > maxAvailable || maxAvailable <= 0}
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
