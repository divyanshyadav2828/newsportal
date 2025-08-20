document.addEventListener('DOMContentLoaded', () => {
    // This script is specifically for the MAIN admin dashboard (admin.html)
    // It handles the homepage news and categories.

    // --- DOM ELEMENTS ---
    const newsForm = document.getElementById('news-form');
    const newsIdInput = document.getElementById('news-id-input');
    const newsHeadingInput = document.getElementById('news-heading-input');
    const newsCategorySelect = document.getElementById('news-category-select');
    const newsStatusSelect = document.getElementById('news-status-select');
    const newsContentInput = document.getElementById('news-content-input');
    const newsSourceInput = document.getElementById('news-source-input');
    const newsWebsiteLinkInput = document.getElementById('news-website-link-input');
    const formTitle = document.getElementById('form-title');
    const newsList = document.getElementById('news-list');
    
    const categoryForm = document.getElementById('category-form');
    const newCategoryInput = document.getElementById('new-category-input');
    const categoryList = document.getElementById('category-list');
    
    const clearFormBtn = document.getElementById('clear-form-btn');

    let allNews = [], allCategories = [];

    // --- API HELPERS (for general /api routes) ---
    const api = {
        get: url => fetch(url).then(res => res.json()),
        post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        delete: url => fetch(url, { method: 'DELETE' })
    };
    const API_BASE = '/api';

    // --- RENDER FUNCTIONS ---
    const renderNewsList = () => {
        newsList.innerHTML = allNews.map(n => `
            <div class="news-list-item">
                <span class="news-list-item-title">${n.heading} ${n.isOlder ? '(Older)' : ''}</span>
                <div class="list-item-actions">
                    <button class="btn-edit" data-id="${n.id}"><i class="ri-pencil-line"></i></button>
                    <button class="btn-delete" data-id="${n.id}"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>`).join('');
    };

    const renderCategories = () => {
        categoryList.innerHTML = allCategories.map(c => `
            <div class="category-list-item">
                <span>${c}</span>
                <div class="list-item-actions">
                    <button class="btn-delete" data-category="${c}"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>`).join('');
        newsCategorySelect.innerHTML = allCategories.map(c => `<option value="${c}">${c}</option>`).join('');
    };

    // --- DATA FETCHING ---
    const fetchData = async () => {
        try {
            [allNews, allCategories] = await Promise.all([
                api.get(`${API_BASE}/news`), 
                api.get(`${API_BASE}/news-categories`)
            ]);
            renderNewsList();
            renderCategories();
        } catch (error) {
            console.error("Failed to fetch data for admin dashboard:", error);
        }
    };

    // --- EVENT HANDLERS ---
    const handleNewsFormSubmit = async (e) => {
        e.preventDefault();
        const id = newsIdInput.value;
        const data = { 
            heading: newsHeadingInput.value, 
            category: newsCategorySelect.value, 
            content: newsContentInput.value, 
            source: newsSourceInput.value, 
            websiteLink: newsWebsiteLinkInput.value,
            isOlder: newsStatusSelect.value === 'older'
        };
        const url = id ? `${API_BASE}/news/${id}` : `${API_BASE}/news`;
        const method = id ? 'put' : 'post';
        await api[method](url, data);
        resetForm();
        fetchData();
    };

    const handleCategoryFormSubmit = async (e) => {
        e.preventDefault();
        await api.post(`${API_BASE}/news-categories`, { category: newCategoryInput.value });
        newCategoryInput.value = '';
        fetchData();
    };

    const handleNewsListClick = (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');
        if (editBtn) populateFormForEdit(editBtn.dataset.id);
        if (deleteBtn) deleteNews(deleteBtn.dataset.id);
    };

    const handleCategoryListClick = async (e) => {
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const category = deleteBtn.dataset.category;
            if (!confirm(`Are you sure you want to delete the category "${category}"?`)) return;
            const res = await api.delete(`${API_BASE}/news-categories/${category}`);
            if (!res.ok) {
                const error = await res.json();
                alert(error.message || 'Failed to delete category.');
            }
            fetchData();
        }
    };

    const populateFormForEdit = (id) => {
        const newsItem = allNews.find(n => n.id === id);
        if (!newsItem) return;
        formTitle.textContent = 'Edit Article';
        newsIdInput.value = newsItem.id;
        newsHeadingInput.value = newsItem.heading;
        newsCategorySelect.value = newsItem.category;
        newsContentInput.value = newsItem.content;
        newsSourceInput.value = newsItem.source;
        newsWebsiteLinkInput.value = newsItem.websiteLink;
        newsStatusSelect.value = newsItem.isOlder ? 'older' : 'latest';
        window.scrollTo(0, 0);
    };

    const deleteNews = async (id) => {
        if (confirm('Are you sure you want to delete this article?')) {
            await api.delete(`${API_BASE}/news/${id}`);
            fetchData();
        }
    };

    const resetForm = () => {
        newsForm.reset();
        newsIdInput.value = '';
        newsStatusSelect.value = 'latest';
        formTitle.textContent = 'Add New Article (Homepage)';
    };

    // --- INITIALIZATION ---
    newsForm.addEventListener('submit', handleNewsFormSubmit);
    categoryForm.addEventListener('submit', handleCategoryFormSubmit);
    newsList.addEventListener('click', handleNewsListClick);
    categoryList.addEventListener('click', handleCategoryListClick);
    clearFormBtn.addEventListener('click', resetForm);

    fetchData();
});

