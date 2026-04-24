import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import api from '../api';
import ConfirmDialog from './ConfirmDialog';
import SkeletonLoader from './SkeletonLoader';

function GenericList({ title, apiEndpoint, columns, FormComponent, detailFields, filters }) {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeFilters, setActiveFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState('');
  const [bulkUpdateValue, setBulkUpdateValue] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const toast = useToast();

  useEffect(() => {
    fetchItems();
  }, [apiEndpoint]);

  useEffect(() => {
    applyClientFilters();
  }, [items, searchTerm, sortField, sortOrder, activeFilters]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiEndpoint);
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setItems(data);
      setFilteredItems(data);
    } catch (err) {
      toast.error('Failed to fetch data');
      console.error('Failed to fetch items:', err);
    }
    setLoading(false);
  };

  const applyClientFilters = () => {
    let result = [...items];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        columns.some(col => {
          const value = item[col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(term);
        })
      );
    }

    // Filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => String(item[key]) === String(value));
      }
    });

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        const comparison = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    setFilteredItems(result);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleFilterChange = (key, value) => {
    setActiveFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilter = (key) => {
    setActiveFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleAdd = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
    setShowDetailModal(false);
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`${apiEndpoint}/${id}`);
          toast.success('Item deleted successfully');
          fetchItems();
          setShowDetailModal(false);
          setSelectedIds(prev => prev.filter(i => i !== id));
        } catch (err) {
          toast.error('Failed to delete item');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (editItem) {
        await api.put(`${apiEndpoint}/${editItem.id}`, data);
        toast.success('Item updated successfully');
      } else {
        await api.post(apiEndpoint, data);
        toast.success('Item created successfully');
      }
      fetchItems();
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to save: ' + (err.response?.data?.error || err.message));
    }
  };

  // Selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(i => i.id));
    }
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.length} selected items? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`${apiEndpoint}/bulk`, { data: { ids: selectedIds } });
          toast.success(`${selectedIds.length} items deleted`);
          setSelectedIds([]);
          fetchItems();
        } catch (err) {
          toast.error('Bulk delete failed: ' + (err.response?.data?.error || err.message));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Bulk Update
  const handleBulkUpdate = async () => {
    if (!bulkUpdateField || !bulkUpdateValue) {
      toast.warning('Please select a field and value');
      return;
    }
    try {
      await api.put(`${apiEndpoint}/bulk`, { ids: selectedIds, updates: { [bulkUpdateField]: bulkUpdateValue } });
      toast.success(`${selectedIds.length} items updated`);
      setSelectedIds([]);
      setShowBulkUpdateModal(false);
      setBulkUpdateField('');
      setBulkUpdateValue('');
      fetchItems();
    } catch (err) {
      toast.error('Bulk update failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // CSV Export
  const exportToCSV = () => {
    const headers = columns.map(col => col.label).join(',');
    const rows = filteredItems.map(item =>
      columns.map(col => {
        let value = item[col.key];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'object') value = JSON.stringify(value);
        value = String(value).replace(/"/g, '""');
        return `"${value}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  // PDF Export
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const tableHTML = `
      <html><head><title>${title} - Export</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9fafb; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${title}</h1>
      <p>Exported on ${new Date().toLocaleString()} - ${filteredItems.length} records</p>
      <table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${filteredItems.map(item =>
        `<tr>${columns.map(col => {
          let v = item[col.key];
          if (v === null || v === undefined) v = '';
          if (typeof v === 'object') v = JSON.stringify(v);
          return `<td>${String(v)}</td>`;
        }).join('')}</tr>`
      ).join('')}</tbody></table></body></html>`;
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
    toast.success('PDF export opened');
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return <SkeletonLoader rows={8} columns={columns.length} />;

  const activeFilterKeys = Object.keys(activeFilters).filter(k => activeFilters[k]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>{title}</h1>
          <p style={styles.pageSubtitle}>{filteredItems.length} items {searchTerm && `(filtered from ${items.length})`}</p>
        </div>
        <div style={styles.headerActions}>
          <button className="btn btn-secondary" onClick={exportToCSV}>Export CSV</button>
          <button className="btn btn-export-pdf" onClick={exportToPDF}>Export PDF</button>
          <button className="btn btn-primary" onClick={handleAdd}>+ New Item</button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-bar">
          <span>{selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected</span>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBulkUpdateModal(true)}>Update Selected</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear Selection</button>
        </div>
      )}

      <div className="card">
        {/* Search and Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={styles.searchBox}>
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
            {searchTerm && <button style={styles.clearSearch} onClick={() => setSearchTerm('')}>&times;</button>}
          </div>
          {filters && filters.map(f => (
            <select key={f.key} value={activeFilters[f.key] || ''} onChange={(e) => handleFilterChange(f.key, e.target.value)}
              style={{ width: 'auto', minWidth: '140px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">{f.label}: All</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {sortField && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSortField(null); setSortOrder('asc'); }}>
              Clear Sort
            </button>
          )}
        </div>

        {/* Active Filter Chips */}
        {activeFilterKeys.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {activeFilterKeys.map(k => (
              <span key={k} className="filter-chip">
                {k}: {activeFilters[k]}
                <button onClick={() => clearFilter(k)}>&times;</button>
              </span>
            ))}
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" className="bulk-checkbox"
                  checked={paginatedItems.length > 0 && selectedIds.length === paginatedItems.length}
                  onChange={toggleSelectAll} />
              </th>
              {columns.map((col) => (
                <th key={col.key}
                  className={`sortable ${sortField === col.key ? (sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`}
                  onClick={() => handleSort(col.key)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={styles.noData}>
                  {searchTerm || activeFilterKeys.length ? 'No matching records found' : 'No data available'}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <tr key={item.id} style={{ cursor: 'pointer' }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="bulk-checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)} />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} onClick={() => handleRowClick(item)}>
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
            <span style={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editItem ? 'Edit Item' : 'New Item'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <FormComponent item={editItem} onSave={handleSave} onCancel={() => setShowModal(false)} />
          </div>
        </div>
      )}

      {/* Detail Modal with Edit/Delete */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Item Details</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={styles.detailContent}>
              {detailFields.map((field) => (
                <div key={field.key} style={styles.detailRow}>
                  <span style={styles.detailLabel}>{field.label}:</span>
                  <span style={styles.detailValue}>
                    {field.render ? field.render(selectedItem[field.key], selectedItem) : (selectedItem[field.key] || 'N/A')}
                  </span>
                </div>
              ))}
            </div>
            <div style={styles.detailActions}>
              <button className="btn btn-primary" onClick={() => handleEdit(selectedItem)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selectedItem.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowBulkUpdateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Bulk Update ({selectedIds.length} items)</h2>
              <button className="modal-close" onClick={() => setShowBulkUpdateModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label>Field to Update</label>
              <select value={bulkUpdateField} onChange={(e) => setBulkUpdateField(e.target.value)}>
                <option value="">Select field</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
              </select>
            </div>
            <div className="form-group">
              <label>New Value</label>
              <input value={bulkUpdateValue} onChange={(e) => setBulkUpdateValue(e.target.value)} placeholder="Enter new value" />
            </div>
            <div style={styles.detailActions}>
              <button className="btn btn-secondary" onClick={() => setShowBulkUpdateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkUpdate}>Update All</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '28px', fontWeight: '700', color: '#fff' },
  pageSubtitle: { color: '#9ca3af', fontSize: '14px', marginTop: '4px' },
  headerActions: { display: 'flex', gap: '12px' },
  searchBox: { position: 'relative', maxWidth: '300px' },
  searchInput: { width: '100%', padding: '10px 36px 10px 14px' },
  clearSearch: { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' },
  noData: { textAlign: 'center', padding: '40px', color: '#9ca3af' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #2d2d4a' },
  pageInfo: { color: '#9ca3af', fontSize: '14px', padding: '0 10px' },
  detailContent: { marginBottom: '24px' },
  detailRow: { display: 'flex', padding: '12px 0', borderBottom: '1px solid #2d2d4a' },
  detailLabel: { width: '40%', color: '#9ca3af', fontSize: '14px' },
  detailValue: { width: '60%', color: '#fff', fontSize: '14px', wordBreak: 'break-word' },
  detailActions: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
};

export default GenericList;
