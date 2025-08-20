document.addEventListener('DOMContentLoaded', () => {
    // --- Global Elements ---
    const userList = document.getElementById('user-list');
    let allUsers = [];
    let currentUserForAction = null;

    // --- API Helper ---
    const api = {
        get: url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)),
        post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        delete: url => fetch(url, { method: 'DELETE' })
    };

    // --- Modal Elements ---
    const modals = {
        add: document.getElementById('add-user-modal'),
        role: document.getElementById('change-role-modal'),
        password: document.getElementById('change-password-modal'),
        delete: document.getElementById('delete-confirm-modal')
    };

    // --- Form Elements ---
    const forms = {
        add: document.getElementById('add-user-form'),
        role: document.getElementById('change-role-form'),
        password: document.getElementById('change-password-form')
    };
    
    // --- Main Functions ---
    const renderUsers = () => {
        if (allUsers.length === 0) {
            userList.innerHTML = '<p>No users found. Click "Add New User" to begin.</p>';
            return;
        }
        userList.innerHTML = allUsers.map(user => `
            <div class="user-list-item">
                <div class="user-details">
                    <span class="user-id">${user.id}</span>
                    <span class="user-role">${user.role.replace(/-/g, ' ')}</span>
                </div>
                <div class="list-item-actions">
                    <button class="btn-change-role" data-id="${user.id}" title="Change Role"><i class="ri-user-settings-line"></i></button>
                    <button class="btn-change-password" data-id="${user.id}" title="Change Password"><i class="ri-key-2-line"></i></button>
                    <button class="btn-delete" data-id="${user.id}" title="Delete User"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>
        `).join('');
    };

    const fetchUsers = async () => {
        try {
            allUsers = await api.get('/api/users');
            renderUsers();
        } catch (error) {
            console.error("Failed to fetch users:", error);
            alert('You do not have permission to manage users or the server is down.');
            window.location.href = '/admin.html';
        }
    };
    
    const handleApiError = async (response) => {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred.' }));
        alert(`Error: ${errorData.message}`);
    };

    // --- Modal Management ---
    const openModal = (modalName) => modals[modalName]?.classList.add('show-login');
    const closeModal = (modalName) => modals[modalName]?.classList.remove('show-login');

    // --- Event Handlers ---
    const handleUserListClick = (e) => {
        const target = e.target;
        const userId = target.closest('[data-id]')?.dataset.id;
        if (!userId) return;

        currentUserForAction = allUsers.find(u => u.id === userId);
        if (!currentUserForAction) return;

        if (target.closest('.btn-change-role')) {
            document.getElementById('change-role-user-info').textContent = `User: ${currentUserForAction.id}`;
            document.getElementById('change-role-user-id').value = currentUserForAction.id;
            document.getElementById('change-role-select').value = currentUserForAction.role;
            openModal('role');
        } else if (target.closest('.btn-change-password')) {
            document.getElementById('change-password-user-info').textContent = `User: ${currentUserForAction.id}`;
            document.getElementById('change-password-user-id').value = currentUserForAction.id;
            forms.password.reset();
            openModal('password');
        } else if (target.closest('.btn-delete')) {
            document.getElementById('delete-user-info').textContent = `User: ${currentUserForAction.id}`;
            openModal('delete');
        }
    };

    // Add User
    document.getElementById('add-user-btn').addEventListener('click', () => {
        forms.add.reset();
        document.getElementById('add-user-role').value = "";
        openModal('add');
    });

    forms.add.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userData = {
            id: document.getElementById('add-user-email').value,
            password: document.getElementById('add-user-password').value,
            role: document.getElementById('add-user-role').value
        };
        const response = await api.post('/api/users', userData);
        if (response.ok) {
            await fetchUsers();
            closeModal('add');
        } else {
            handleApiError(response);
        }
    });

    // Change Role
    forms.role.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('change-role-user-id').value;
        const roleData = { role: document.getElementById('change-role-select').value };
        
        const response = await api.put(`/api/users/${encodeURIComponent(userId)}`, roleData);
        if (response.ok) {
            await fetchUsers();
            closeModal('role');
        } else {
            handleApiError(response);
        }
    });

    // Change Password
    forms.password.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('change-password-user-id').value;
        const passwordData = { password: document.getElementById('new-password-input').value };

        const response = await api.put(`/api/users/${encodeURIComponent(userId)}`, passwordData);
        if (response.ok) {
            alert('Password updated successfully.');
            closeModal('password');
        } else {
            handleApiError(response);
        }
    });
    
    // Delete User
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (!currentUserForAction) return;
        const response = await api.delete(`/api/users/${encodeURIComponent(currentUserForAction.id)}`);
        if (response.ok) {
            await fetchUsers();
            closeModal('delete');
        } else {
            handleApiError(response);
        }
    });
    
    document.getElementById('cancel-delete-btn').addEventListener('click', () => closeModal('delete'));

    // Close Modal Listeners
    document.querySelectorAll('.login__close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });

    // --- Initialization ---
    userList.addEventListener('click', handleUserListClick);
    fetchUsers();
});