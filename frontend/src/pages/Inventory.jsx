import React, { useState, useMemo } from 'react';
import { mockInventory } from '../data/mockData';
import { useUser } from '../context/UserContext';
import { Search, Plus, ArrowUpRight, ArrowDownLeft, Trash2, ShieldAlert } from 'lucide-react';
import Modal from '../components/Modal';

const Inventory = () => {
  const { activeRole } = useUser();
  const [inventory, setInventory] = useState(mockInventory);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals controllers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Form states
  const [addItemName, setAddItemName] = useState('');
  const [addItemCat, setAddItemCat] = useState('Microcontrollers');
  const [addItemQty, setAddItemQty] = useState(10);

  const [issueItemSelect, setIssueItemSelect] = useState('');
  const [issueStudent, setIssueStudent] = useState('');
  const [issueQty, setIssueQty] = useState(1);

  const [returnItemSelect, setReturnItemSelect] = useState('');
  const [returnStudent, setReturnStudent] = useState('');
  const [returnQty, setReturnQty] = useState(1);

  const categories = ['All', 'Microcontrollers', 'Single Board Computers', 'Media & Recording', 'Presentation', 'Lab Tools', 'Sensors & Components'];

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, search, categoryFilter]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!addItemName) return;

    const newItem = {
      id: `inv-${Date.now()}`,
      name: addItemName,
      category: addItemCat,
      total: Number(addItemQty),
      available: Number(addItemQty),
      issued: 0,
      damaged: 0
    };

    setInventory([...inventory, newItem]);
    setIsAddOpen(false);

    // Reset Form
    setAddItemName('');
    setAddItemQty(10);
  };

  const handleIssueItem = (e) => {
    e.preventDefault();
    const qty = Number(issueQty);
    if (!issueItemSelect || qty <= 0) return;

    const updated = inventory.map(item => {
      if (item.id === issueItemSelect) {
        if (item.available < qty) {
          alert(`Error: Only ${item.available} units of ${item.name} are available for issue.`);
          return item;
        }
        return {
          ...item,
          available: item.available - qty,
          issued: item.issued + qty
        };
      }
      return item;
    });

    setInventory(updated);
    setIsIssueOpen(false);

    // Reset Form
    setIssueStudent('');
    setIssueQty(1);
  };

  const handleReturnItem = (e) => {
    e.preventDefault();
    const qty = Number(returnQty);
    if (!returnItemSelect || qty <= 0) return;

    const updated = inventory.map(item => {
      if (item.id === returnItemSelect) {
        if (item.issued < qty) {
          alert(`Error: Cannot return ${qty} units. Only ${item.issued} units are currently issued.`);
          return item;
        }
        return {
          ...item,
          available: item.available + qty,
          issued: item.issued - qty
        };
      }
      return item;
    });

    setInventory(updated);
    setIsReturnOpen(false);

    // Reset Form
    setReturnStudent('');
    setReturnQty(1);
  };

  const handleDeleteItem = (id) => {
    if (window.confirm("Are you sure you want to delete this inventory item?")) {
      setInventory(inventory.filter(item => item.id !== id));
    }
  };

  const isAdmin = ['Admin', 'Mentor'].includes(activeRole);

  return (
    <div className="page-enter page-container">
      {/* Search and Buttons Panel */}
      <div 
        style={{
          backgroundColor: 'var(--white)',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '1rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} 
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search equipment by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Category Select Filter */}
          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>

        {/* Action button triggers */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (inventory.length > 0) {
                setIssueItemSelect(inventory[0].id);
              }
              setIsIssueOpen(true);
            }}
            className="btn-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              border: '1px solid var(--navy-900)',
              color: 'var(--navy-900)',
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            <ArrowUpRight size={16} />
            <span>Issue Item</span>
          </button>

          <button
            onClick={() => {
              if (inventory.length > 0) {
                setReturnItemSelect(inventory[0].id);
              }
              setIsReturnOpen(true);
            }}
            className="btn-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              border: '1px solid var(--navy-900)',
              color: 'var(--navy-900)',
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            <ArrowDownLeft size={16} />
            <span>Return Item</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="btn-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--navy-900)',
                color: 'var(--white)',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="table-wrapper">
        <table className="custom-table responsive-table">
          <thead>
            <tr>
              <th>Equipment Name</th>
              <th>Category</th>
              <th>Total Qty</th>
              <th>Available</th>
              <th>Issued</th>
              <th>Damaged</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map(item => (
                <tr key={item.id} className="row-hover">
                  <td data-label="Equipment Name" style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {item.name}
                  </td>
                  <td data-label="Category">
                    {item.category}
                  </td>
                  <td data-label="Total Qty">
                    {item.total}
                  </td>
                  <td data-label="Available">
                    <span 
                      style={{ 
                        fontWeight: 700, 
                        color: item.available === 0 ? 'var(--danger)' : (item.available < 5 ? 'var(--warning)' : 'var(--success)') 
                      }}
                    >
                      {item.available}
                    </span>
                  </td>
                  <td data-label="Issued" style={{ color: 'var(--navy-900)', fontWeight: 600 }}>
                    {item.issued}
                  </td>
                  <td data-label="Damaged" style={{ color: item.damaged > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {item.damaged}
                  </td>
                  {isAdmin && (
                    <td data-label="Actions">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="btn-hover"
                        style={{
                          padding: '0.35rem',
                          borderRadius: '0.25rem',
                          color: 'var(--danger)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No inventory equipment found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Equipment Item"
      >
        <form onSubmit={handleAddItem}>
          <div className="form-group">
            <label className="form-label" htmlFor="add-name">Equipment Name *</label>
            <input
              id="add-name"
              type="text"
              className="form-input"
              placeholder="e.g. Raspberry Pi 4"
              value={addItemName}
              onChange={(e) => setAddItemName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="add-cat">Category</label>
              <select
                id="add-cat"
                className="form-input"
                value={addItemCat}
                onChange={(e) => setAddItemCat(e.target.value)}
              >
                {categories.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="add-qty">Total Quantity</label>
              <input
                id="add-qty"
                type="number"
                min="1"
                className="form-input"
                value={addItemQty}
                onChange={(e) => setAddItemQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button 
              type="button" 
              onClick={() => setIsAddOpen(false)} 
              className="btn-hover"
              style={{ border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-hover"
              style={{ backgroundColor: 'var(--navy-900)', color: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Save Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue Item Modal */}
      <Modal
        isOpen={isIssueOpen}
        onClose={() => setIsIssueOpen(false)}
        title="Issue Equipment"
      >
        <form onSubmit={handleIssueItem}>
          <div className="form-group">
            <label className="form-label" htmlFor="issue-select">Select Equipment *</label>
            <select
              id="issue-select"
              className="form-input"
              value={issueItemSelect}
              onChange={(e) => setIssueItemSelect(e.target.value)}
            >
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.available} available)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="issue-student">Student Name/ID *</label>
              <input
                id="issue-student"
                type="text"
                className="form-input"
                placeholder="e.g. Sneha Reddy"
                value={issueStudent}
                onChange={(e) => setIssueStudent(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="issue-qty">Quantity *</label>
              <input
                id="issue-qty"
                type="number"
                min="1"
                className="form-input"
                value={issueQty}
                onChange={(e) => setIssueQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button 
              type="button" 
              onClick={() => setIsIssueOpen(false)} 
              className="btn-hover"
              style={{ border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-hover"
              style={{ backgroundColor: 'var(--navy-900)', color: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Confirm Issue
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Item Modal */}
      <Modal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        title="Return Equipment"
      >
        <form onSubmit={handleReturnItem}>
          <div className="form-group">
            <label className="form-label" htmlFor="return-select">Select Equipment *</label>
            <select
              id="return-select"
              className="form-input"
              value={returnItemSelect}
              onChange={(e) => setReturnItemSelect(e.target.value)}
            >
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.issued} issued)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }} className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="return-student">Student Name/ID *</label>
              <input
                id="return-student"
                type="text"
                className="form-input"
                placeholder="e.g. Sneha Reddy"
                value={returnStudent}
                onChange={(e) => setReturnStudent(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="return-qty">Quantity *</label>
              <input
                id="return-qty"
                type="number"
                min="1"
                className="form-input"
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button 
              type="button" 
              onClick={() => setIsReturnOpen(false)} 
              className="btn-hover"
              style={{ border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-hover"
              style={{ backgroundColor: 'var(--navy-900)', color: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600 }}
            >
              Confirm Return
            </button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
        }
      `}} />
    </div>
  );
};

export default Inventory;
