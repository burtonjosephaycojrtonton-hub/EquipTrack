
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import '../css/professional.css';

function readCookie(name) {
    const prefix = `${name}=`;
    const item = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith(prefix));

    return item ? decodeURIComponent(item.slice(prefix.length)) : '';
}

async function apiRequest(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        await fetch('/sanctum/csrf-cookie', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });
    }

    const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
    };

    const csrfToken = readCookie('XSRF-TOKEN');

    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errors = data.errors
            ? Object.values(data.errors).flat().join(' ')
            : data.message || `Request failed (${response.status}).`;

        throw new Error(errors);
    }

    return data;
}

const emptyForm = {
    name: '',
    category: '',
    quantity: '1',
    description: '',
};

function App() {
    const [mode, setMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [user, setUser] = useState(null);

    const [equipment, setEquipment] = useState([]);
    const [borrowings, setBorrowings] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const today = new Date().toISOString().slice(0, 10);
    const emptyBorrowingForm = {
        borrower_type: 'student',
        borrower_name: '',
        borrower_id: '',
        equipment_id: '',
        quantity: '1',
        borrowed_at: today,
        expected_return_at: '',
        notes: '',
    };
    const [borrowingForm, setBorrowingForm] = useState(emptyBorrowingForm);
    const [savingBorrowing, setSavingBorrowing] = useState(false);
    const [borrowingSearch, setBorrowingSearch] = useState('');
    const [borrowingFilter, setBorrowingFilter] = useState('all');
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState('');
    const [authMessage, setAuthMessage] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(false);

    useEffect(() => {
        apiRequest('/api/user')
            .then((data) => setUser(data))
            .catch(() => setUser(null));
    }, []);

    useEffect(() => {
        if (user) {
            loadEquipment();
            loadBorrowings();
        } else {
            setBorrowings([]);
        }
    }, [user]);

    async function loadEquipment() {
        setLoadingEquipment(true);
        setError('');

        try {
            const data = await apiRequest('/api/equipment');
            setEquipment(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingEquipment(false);
        }
    }

    async function loadBorrowings() {
        try {
            const data = await apiRequest('/api/borrowings');
            setBorrowings(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        }
    }

    async function saveBorrowing(event) {
        event.preventDefault();
        setSavingBorrowing(true);
        setError('');
        setNotice('');

        try {
            const payload = {
                ...borrowingForm,
                equipment_id: Number(borrowingForm.equipment_id),
                quantity: Number(borrowingForm.quantity),
                notes: borrowingForm.notes.trim() || null,
            };

            const data = await apiRequest('/api/borrowings', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            setNotice(data.message || 'Equipment borrowed successfully.');
            setBorrowingForm({
                ...emptyBorrowingForm,
                borrowed_at: new Date().toISOString().slice(0, 10),
            });
            await Promise.all([loadEquipment(), loadBorrowings()]);
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingBorrowing(false);
        }
    }

    async function returnBorrowing(item) {
        if (!window.confirm(`Mark the borrowing for ${item.borrower_name} as returned?`)) {
            return;
        }

        setError('');
        setNotice('');
        try {
            const data = await apiRequest(`/api/borrowings/${item.id}/return`, {
                method: 'POST',
            });
            setNotice(data.message || 'Equipment returned successfully.');
            await Promise.all([loadEquipment(), loadBorrowings()]);
        } catch (err) {
            setError(err.message);
        }
    }

    async function deleteBorrowing(item) {
        if (item.status !== 'returned') {
            setError('Only returned borrowing records can be deleted.');
            return;
        }
        if (!window.confirm('Delete this returned borrowing record?')) return;

        setError('');
        setNotice('');
        try {
            await apiRequest(`/api/borrowings/${item.id}`, { method: 'DELETE' });
            setNotice('Borrowing record deleted.');
            await loadBorrowings();
        } catch (err) {
            setError(err.message);
        }
    }

    async function submitAuth(event) {
        event.preventDefault();
        setAuthLoading(true);
        setAuthMessage('');

        try {
            const isRegister = mode === 'register';

            const data = await apiRequest(
                isRegister ? '/api/register' : '/api/login',
                {
                    method: 'POST',
                    body: JSON.stringify(
                        isRegister
                            ? {
                                name,
                                email,
                                password,
                                password_confirmation: passwordConfirmation,
                            }
                            : { email, password }
                    ),
                }
            );

            if (isRegister) {
                setMode('login');
                setPassword('');
                setPasswordConfirmation('');
                setAuthMessage('Account created! Please sign in.');
            } else {
                setUser(data.user);
                setPassword('');
            }
        } catch (err) {
            setAuthMessage(err.message);
        } finally {
            setAuthLoading(false);
        }
    }

    function resetForm() {
        setForm(emptyForm);
        setEditingId(null);
    }

    async function saveEquipment(event) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');

        const payload = {
            name: form.name.trim(),
            category: form.category.trim(),
            quantity: Number(form.quantity),
            description: form.description.trim() || null,
        };

        try {
            const data = await apiRequest(
                editingId
                    ? `/api/equipment/${editingId}`
                    : '/api/equipment',
                {
                    method: editingId ? 'PUT' : 'POST',
                    body: JSON.stringify(payload),
                }
            );

            setNotice(data.message || 'Equipment saved successfully.');
            resetForm();
            await loadEquipment();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    function startEdit(item) {
        setEditingId(item.id);
        setForm({
            name: item.name || '',
            category: item.category || '',
            quantity: String(item.quantity ?? 0),
            description: item.description || '',
        });
        setNotice('');
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deleteEquipment(item) {
        if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
            return;
        }

        setError('');
        setNotice('');

        try {
            const data = await apiRequest(`/api/equipment/${item.id}`, {
                method: 'DELETE',
            });
            setNotice(data.message || 'Equipment deleted successfully.');
            await loadEquipment();
        } catch (err) {
            setError(err.message);
        }
    }

    async function logout() {
        try {
            await apiRequest('/api/logout', { method: 'POST' });
        } catch (err) {
            setError(err.message);
            return;
        }

        setUser(null);
        setEquipment([]);
        setBorrowings([]);
        setPassword('');
        setNotice('');
        setError('');
        setAuthMessage('You have been logged out.');
    }

    const filteredEquipment = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return equipment;

        return equipment.filter((item) =>
            [item.name, item.category, item.description]
                .some((value) => String(value || '').toLowerCase().includes(term))
        );
    }, [equipment, search]);

    const filteredBorrowings = useMemo(() => {
        const term = borrowingSearch.trim().toLowerCase();
        const todayDate = new Date().toISOString().slice(0, 10);

        return borrowings.filter((item) => {
            const matchesSearch = !term || [
                item.borrower_name,
                item.borrower_id,
                item.borrower_type,
                item.equipment?.name,
                item.status,
            ].some((value) => String(value || '').toLowerCase().includes(term));

            const overdue = item.status === 'borrowed'
                && item.expected_return_at
                && String(item.expected_return_at).slice(0, 10) < todayDate;
            const matchesFilter = borrowingFilter === 'all'
                || (borrowingFilter === 'overdue' && overdue)
                || (borrowingFilter === 'active' && item.status === 'borrowed' && !overdue)
                || (borrowingFilter === 'returned' && item.status === 'returned');

            return matchesSearch && matchesFilter;
        });
    }, [borrowings, borrowingSearch, borrowingFilter]);

    const totalItems = equipment.reduce(
        (sum, item) => sum + Number(item.quantity || 0), 0
    );
    const availableItems = equipment.reduce(
        (sum, item) => sum + Number(item.available_quantity || 0), 0
    );

    const reportToday = new Date().toISOString().slice(0, 10);
    const activeBorrowings = borrowings.filter((item) => item.status === 'borrowed');
    const overdueBorrowings = activeBorrowings.filter((item) =>
        item.expected_return_at
        && String(item.expected_return_at).slice(0, 10) < reportToday
    );
    const returnedBorrowings = borrowings.filter((item) => item.status === 'returned');
    const borrowedItemCount = activeBorrowings.reduce(
        (sum, item) => sum + Number(item.quantity || 0), 0
    );

    function exportBorrowingReport() {
        const columns = [
            'Borrower Type', 'Borrower Name', 'Borrower ID', 'Equipment',
            'Quantity', 'Borrowed Date', 'Expected Return Date', 'Returned Date', 'Status',
        ];
        const rows = borrowings.map((item) => [
            item.borrower_type,
            item.borrower_name,
            item.borrower_id,
            item.equipment?.name || `Equipment #${item.equipment_id}`,
            item.quantity,
            String(item.borrowed_at || '').slice(0, 10),
            String(item.expected_return_at || '').slice(0, 10),
            String(item.returned_at || '').slice(0, 10),
            item.status === 'returned'
                ? 'Returned'
                : item.expected_return_at && String(item.expected_return_at).slice(0, 10) < reportToday
                    ? 'Overdue'
                    : 'Borrowed',
        ]);
        const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `equiptrack-borrowing-report-${reportToday}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    if (!user) {
        return (
            <main className="equiptrack-page">
                <section className="equiptrack-card">
                    <div className="equiptrack-logo">E</div>
                    <h1>EquipTrack</h1>
                    <p className="equiptrack-subtitle">
                        IT Equipment Borrowing System
                    </p>

                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={mode === 'login' ? 'active' : ''}
                            onClick={() => {
                                setMode('login');
                                setAuthMessage('');
                            }}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={mode === 'register' ? 'active' : ''}
                            onClick={() => {
                                setMode('register');
                                setAuthMessage('');
                            }}
                        >
                            Create Account
                        </button>
                    </div>

                    <form onSubmit={submitAuth}>
                        {mode === 'register' && (
                            <label>
                                Full name
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                    required
                                />
                            </label>
                        )}

                        <label>
                            Email address
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </label>

                        <label>
                            Password
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={mode === 'login'
                                    ? 'current-password'
                                    : 'new-password'}
                                minLength={8}
                                required
                            />
                        </label>

                        {mode === 'register' && (
                            <label>
                                Confirm password
                                <input
                                    type="password"
                                    value={passwordConfirmation}
                                    onChange={(e) =>
                                        setPasswordConfirmation(e.target.value)}
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                            </label>
                        )}

                        <button className="auth-button" disabled={authLoading}>
                            {authLoading
                                ? 'Please wait...'
                                : mode === 'login'
                                    ? 'Sign In'
                                    : 'Create Account'}
                        </button>
                    </form>

                    {authMessage && (
                        <p className="auth-message" role="status">
                            {authMessage}
                        </p>
                    )}

                    <p className="equiptrack-footer">
                        Secure equipment management, made simple.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="inventory-page">
            <header className="inventory-header">
                <div className="inventory-brand">
                    <div className="equiptrack-logo">E</div>
                    <div>
                        <h1>EquipTrack</h1>
                        <p>IT Equipment Borrowing System</p>
                    </div>
                </div>

                <div className="inventory-account">
                    <span>Signed in as <strong>{user.name}</strong></span>
                    <button className="secondary-button" onClick={logout}>
                        Log out
                    </button>
                </div>
            </header>

            <section className="inventory-content">
                <div className="inventory-heading">
                    <div>
                        <p className="eyebrow">INVENTORY MANAGEMENT</p>
                        <h2>Equipment Dashboard</h2>
                        <p>Manage your equipment and monitor available stock.</p>
                    </div>
                    <button
                        className="auth-button add-top-button"
                        onClick={() => {
                            resetForm();
                            document.getElementById('equipment-form')
                                ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        + Add Equipment
                    </button>
                </div>

                {notice && <div className="inventory-notice">{notice}</div>}
                {error && <div className="inventory-error">{error}</div>}

                <div className="inventory-stats">
                    <article className="inventory-stat">
                        <span>Equipment Types</span>
                        <strong>{equipment.length}</strong>
                        <small>Different inventory entries</small>
                    </article>
                    <article className="inventory-stat">
                        <span>Total Items</span>
                        <strong>{totalItems}</strong>
                        <small>Items recorded in inventory</small>
                    </article>
                    <article className="inventory-stat">
                        <span>Available Items</span>
                        <strong>{availableItems}</strong>
                        <small>Currently available to borrow</small>
                    </article>
                </div>

                <section className="inventory-panel" id="reports">
                    <div className="panel-heading">
                        <div>
                            <p className="eyebrow">REPORTS</p>
                            <h3>Borrowing Summary</h3>
                            <p>Current borrowing activity and downloadable records.</p>
                        </div>
                        <button
                            type="button"
                            className="auth-button"
                            onClick={exportBorrowingReport}
                            disabled={borrowings.length === 0}
                        >
                            Export CSV
                        </button>
                    </div>
                    <div className="inventory-stats">
                        <article className="inventory-stat">
                            <span>Active Borrowings</span>
                            <strong>{activeBorrowings.length}</strong>
                            <small>{borrowedItemCount} item(s) currently borrowed</small>
                        </article>
                        <article className="inventory-stat">
                            <span>Overdue Records</span>
                            <strong>{overdueBorrowings.length}</strong>
                            <small>Past their expected return date</small>
                        </article>
                        <article className="inventory-stat">
                            <span>Returned Records</span>
                            <strong>{returnedBorrowings.length}</strong>
                            <small>Completed borrowings</small>
                        </article>
                    </div>
                    {borrowings.length === 0 && (
                        <p className="inventory-empty">Borrowing reports will appear after the first borrowing is recorded.</p>
                    )}
                </section>

                <section className="inventory-panel" id="borrowing-form">
                    <div className="panel-heading">
                        <div>
                            <h3>Borrow Equipment</h3>
                            <p>Record equipment issued to a student or staff member.</p>
                        </div>
                    </div>

                    <form className="equipment-form" onSubmit={saveBorrowing}>
                        <label>
                            Borrower type
                            <select
                                value={borrowingForm.borrower_type}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, borrower_type: e.target.value,
                                })}
                                required
                            >
                                <option value="student">Student</option>
                                <option value="staff">Staff</option>
                            </select>
                        </label>
                        <label>
                            Borrower full name
                            <input
                                value={borrowingForm.borrower_name}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, borrower_name: e.target.value,
                                })}
                                required
                            />
                        </label>
                        <label>
                            Student / Staff ID
                            <input
                                value={borrowingForm.borrower_id}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, borrower_id: e.target.value,
                                })}
                                required
                            />
                        </label>
                        <label>
                            Equipment
                            <select
                                value={borrowingForm.equipment_id}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, equipment_id: e.target.value,
                                })}
                                required
                            >
                                <option value="">Select equipment</option>
                                {equipment.filter((item) => Number(item.available_quantity) > 0).map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} — {item.available_quantity} available
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Quantity
                            <input
                                type="number"
                                min="1"
                                max={equipment.find((item) => String(item.id) === String(borrowingForm.equipment_id))?.available_quantity || 1}
                                value={borrowingForm.quantity}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, quantity: e.target.value,
                                })}
                                required
                            />
                        </label>
                        <label>
                            Borrowed date
                            <input
                                type="date"
                                value={borrowingForm.borrowed_at}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, borrowed_at: e.target.value,
                                })}
                                required
                            />
                        </label>
                        <label>
                            Expected return date
                            <input
                                type="date"
                                min={borrowingForm.borrowed_at}
                                value={borrowingForm.expected_return_at}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, expected_return_at: e.target.value,
                                })}
                                required
                            />
                        </label>
                        <label className="description-field">
                            Notes (optional)
                            <textarea
                                rows="2"
                                value={borrowingForm.notes}
                                onChange={(e) => setBorrowingForm({
                                    ...borrowingForm, notes: e.target.value,
                                })}
                                placeholder="Additional information"
                            />
                        </label>
                        <div className="form-actions">
                            <button className="auth-button" disabled={savingBorrowing || equipment.every((item) => Number(item.available_quantity) < 1)}>
                                {savingBorrowing ? 'Saving...' : 'Record Borrowing'}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="inventory-panel" id="equipment-form">
                    <div className="panel-heading">
                        <div>
                            <h3>{editingId ? 'Edit Equipment' : 'Add Equipment'}</h3>
                            <p>Enter the equipment details below.</p>
                        </div>
                        {editingId && (
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={resetForm}
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>

                    <form className="equipment-form" onSubmit={saveEquipment}>
                        <label>
                            Equipment name
                            <input
                                value={form.name}
                                onChange={(e) => setForm({
                                    ...form, name: e.target.value,
                                })}
                                placeholder="e.g. Laptop"
                                required
                            />
                        </label>

                        <label>
                            Category
                            <input
                                value={form.category}
                                onChange={(e) => setForm({
                                    ...form, category: e.target.value,
                                })}
                                placeholder="e.g. Computer"
                                required
                            />
                        </label>

                        <label>
                            Total quantity
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.quantity}
                                onChange={(e) => setForm({
                                    ...form, quantity: e.target.value,
                                })}
                                required
                            />
                        </label>

                        <label className="description-field">
                            Description (optional)
                            <textarea
                                rows="3"
                                value={form.description}
                                onChange={(e) => setForm({
                                    ...form, description: e.target.value,
                                })}
                                placeholder="Add notes about this equipment"
                            />
                        </label>

                        <div className="form-actions">
                            <button className="auth-button" disabled={saving}>
                                {saving
                                    ? 'Saving...'
                                    : editingId
                                        ? 'Save Changes'
                                        : 'Add Equipment'}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="inventory-panel">
                    <div className="panel-heading equipment-list-heading">
                        <div>
                            <h3>Equipment Inventory</h3>
                            <p>{filteredEquipment.length} record(s) found</p>
                        </div>
                        <input
                            className="inventory-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search equipment..."
                            aria-label="Search equipment"
                        />
                    </div>

                    {loadingEquipment ? (
                        <p className="inventory-empty">Loading equipment...</p>
                    ) : filteredEquipment.length === 0 ? (
                        <p className="inventory-empty">
                            {search
                                ? 'No equipment matches your search.'
                                : 'No equipment yet. Add your first item above.'}
                        </p>
                    ) : (
                        <div className="inventory-table-wrap">
                            <table className="inventory-table">
                                <thead>
                                    <tr>
                                        <th>Equipment</th>
                                        <th>Category</th>
                                        <th>Total</th>
                                        <th>Available</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEquipment.map((item) => (
                                        <tr key={item.id}>
                                            <td data-label="Equipment">
                                                <strong>{item.name}</strong>
                                            </td>
                                            <td data-label="Category">
                                                {item.category}
                                            </td>
                                            <td data-label="Total">
                                                {item.quantity}
                                            </td>
                                            <td data-label="Available">
                                                <span className="stock-pill">
                                                    {item.available_quantity}
                                                </span>
                                            </td>
                                            <td data-label="Description">
                                                {item.description || '—'}
                                            </td>
                                            <td data-label="Actions">
                                                <div className="table-actions">
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => startEdit(item)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() =>
                                                            deleteEquipment(item)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="inventory-panel">
                    <div className="panel-heading equipment-list-heading">
                        <div>
                            <h3>Borrowing History</h3>
                            <p>{filteredBorrowings.length} record(s) found</p>
                        </div>
                        <input
                            className="inventory-search"
                            value={borrowingSearch}
                            onChange={(e) => setBorrowingSearch(e.target.value)}
                            placeholder="Search borrower or equipment..."
                            aria-label="Search borrowing records"
                        />
                    </div>

                    <div className="borrowing-filters">
                        <label>
                            Filter records
                            <select value={borrowingFilter} onChange={(e) => setBorrowingFilter(e.target.value)}>
                                <option value="all">All records</option>
                                <option value="active">Currently borrowed</option>
                                <option value="overdue">Overdue</option>
                                <option value="returned">Returned</option>
                            </select>
                        </label>
                    </div>

                    {filteredBorrowings.length === 0 ? (
                        <p className="inventory-empty">No borrowing records match your search or filter.</p>
                    ) : (
                        <div className="inventory-table-wrap">
                            <table className="inventory-table">
                                <thead>
                                    <tr>
                                        <th>Borrower</th>
                                        <th>ID / Type</th>
                                        <th>Equipment</th>
                                        <th>Qty</th>
                                        <th>Borrowed</th>
                                        <th>Due date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBorrowings.map((item) => {
                                        const overdue = item.status === 'borrowed'
                                            && item.expected_return_at
                                            && String(item.expected_return_at).slice(0, 10) < new Date().toISOString().slice(0, 10);
                                        return (
                                            <tr key={item.id}>
                                                <td data-label="Borrower"><strong>{item.borrower_name}</strong></td>
                                                <td data-label="ID / Type">{item.borrower_id}<br />{item.borrower_type}</td>
                                                <td data-label="Equipment">{item.equipment?.name || `Equipment #${item.equipment_id}`}</td>
                                                <td data-label="Qty">{item.quantity}</td>
                                                <td data-label="Borrowed">{String(item.borrowed_at || '').slice(0, 10)}</td>
                                                <td data-label="Due date">{String(item.expected_return_at || '').slice(0, 10)}</td>
                                                <td data-label="Status">
                                                    <span className="stock-pill">
                                                        {item.status === 'returned' ? 'Returned' : overdue ? 'Overdue' : 'Borrowed'}
                                                    </span>
                                                </td>
                                                <td data-label="Actions">
                                                    <div className="table-actions">
                                                        {item.status === 'borrowed' && (
                                                            <button className="edit-button" onClick={() => returnBorrowing(item)}>
                                                                Return
                                                            </button>
                                                        )}
                                                        {item.status === 'returned' && (
                                                            <button className="delete-button" onClick={() => deleteBorrowing(item)}>
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}

const rootElement = document.getElementById('app');

if (rootElement) {
    createRoot(rootElement).render(<App />);
}
