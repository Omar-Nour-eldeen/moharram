/* ===== ADMIN DASHBOARD JS ===== */
'use strict';

// ── Supabase Init ──────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ──────────────────────────────────────────────────────
let allProducts = [];
let allCategories = [];
let allDiscounts = [];
let currentImageFile = null;
let currentImageUrl = null;
let confirmCallback = null;

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    // Show admin email
    const emailEl = document.getElementById('admin-email-display');
    if (emailEl && session.user?.email) {
        emailEl.textContent = session.user.email.split('@')[0];
    }

    await loadCategories();
    await loadProducts();
    await loadDiscountCodes();
});

// ══════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('nav-' + page).classList.add('active');

    const titles = {
        products: { title: 'إدارة المنتجات', sub: 'إضافة وتعديل وحذف المنتجات' },
        categories: { title: 'إدارة الفئات', sub: 'إضافة وتعديل وحذف الفئات' },
        discounts: { title: 'أكواد الخصم', sub: 'إضافة وتعديل وإيقاف أكواد الخصم' }
    };
    document.getElementById('page-title').textContent = titles[page].title;
    document.getElementById('page-subtitle').textContent = titles[page].sub;

    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open', isOpen);

    const toggle = document.getElementById('sidebar-toggle');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
    toggle.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');

    const toggle = document.getElementById('sidebar-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'فتح القائمة');
    toggle.querySelector('i').className = 'fas fa-bars';
}

// ══════════════════════════════════════════════════════════════
// LOAD CATEGORIES
// ══════════════════════════════════════════════════════════════
async function loadCategories() {
    const { data, error } = await sb
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

    if (error) { showToast('خطأ في تحميل الفئات', 'error'); return; }

    allCategories = data || [];
    document.getElementById('stat-categories').textContent = allCategories.length;
    renderCategoriesTable();
    populateCategoryDropdown();
}

function renderCategoriesTable() {
    const wrap = document.getElementById('categories-table-wrap');
    if (!allCategories.length) {
        wrap.innerHTML = `<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد فئات بعد</p></div>`;
        return;
    }

    wrap.innerHTML = `
    <table>
        <thead>
            <tr>
                <th>الإيموجي</th>
                <th>اسم الفئة</th>
                <th>الـ Slug</th>
                <th>عدد المنتجات</th>
                <th>إجراءات</th>
            </tr>
        </thead>
        <tbody>
            ${allCategories.map(cat => {
        const count = allProducts.filter(p => p.category_id === cat.id).length;
        return `
                <tr>
                    <td data-label="الإيموجي" style="font-size:22px">${cat.emoji || '—'}</td>
                    <td data-label="الفئة"><strong>${cat.name}</strong></td>
                    <td data-label="Slug"><code style="background:var(--bg-cream);padding:2px 8px;border-radius:6px;font-size:12px">${cat.slug}</code></td>
                    <td data-label="المنتجات"><span style="font-weight:700;color:var(--brown-mid)">${count}</span></td>
                    <td>
                        <div class="td-actions">
                            <button class="btn btn-outline btn-icon btn-sm" onclick="editCategory('${cat.id}')" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteCategory('${cat.id}')" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

function populateCategoryDropdown() {
    const sel = document.getElementById('p-category');
    const val = sel.value;
    sel.innerHTML = '<option value="">-- اختر الفئة --</option>';
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.emoji || ''} ${cat.name}`;
        sel.appendChild(opt);
    });
    if (val) sel.value = val;
}

// ══════════════════════════════════════════════════════════════
// LOAD PRODUCTS
// ══════════════════════════════════════════════════════════════
async function loadProducts() {
    const wrap = document.getElementById('products-table-wrap');
    wrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل المنتجات...</p></div>';

    const { data, error } = await sb
        .from('products')
        .select('*, categories(name, emoji, slug)')
        .order('id', { ascending: true });

    if (error) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ في تحميل المنتجات</p></div>';
        showToast('خطأ في تحميل المنتجات', 'error');
        return;
    }

    allProducts = data || [];
    updateStats();
    renderProductsTable(allProducts);
    renderCategoriesTable();
}

function updateStats() {
    document.getElementById('stat-products').textContent = allProducts.length;
    document.getElementById('stat-offers').textContent = allProducts.filter(p => p.badge_type === 'offer').length;
    document.getElementById('stat-featured').textContent = allProducts.filter(p => p.badge_type === 'featured').length;
    document.getElementById('stat-categories').textContent = allCategories.length;
}

function renderProductsTable(products) {
    const wrap = document.getElementById('products-table-wrap');

    if (!products.length) {
        wrap.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات بعد — ابدأ بإضافة أول منتج!</p></div>`;
        return;
    }

    wrap.innerHTML = `
    <table>
        <thead>
            <tr>
                <th>الصورة</th>
                <th>المنتج</th>
                <th>الفئة</th>
                <th>السعر</th>
                <th>الوحدة</th>
                <th>Badge</th>
                <th>إجراءات</th>
            </tr>
        </thead>
        <tbody>
            ${products.map(p => {
        const catName = p.categories ? `${p.categories.emoji || ''} ${p.categories.name}` : '—';
        const badge = p.badge ? `<span class="badge-pill ${p.badge_type === 'offer' ? 'badge-offer' : 'badge-featured'}">${p.badge}</span>` : '<span style="color:rgba(122,102,82,0.3);font-size:12px">—</span>';
        const imgHtml = p.image_url
            ? `<img src="${p.image_url}" class="product-thumb" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=product-thumb-placeholder>🍯</div>'">`
            : `<div class="product-thumb-placeholder">🍯</div>`;

        return `
                <tr>
                    <td data-label="الصورة">${imgHtml}</td>
                    <td data-label="المنتج">
                        <strong style="font-size:13px">${p.name}</strong>
                        ${p.description ? `<br><small style="color:var(--text-muted);font-size:11px">${p.description.slice(0, 50)}${p.description.length > 50 ? '...' : ''}</small>` : ''}
                    </td>
                    <td data-label="الفئة"><span style="font-size:13px">${catName}</span></td>
                    <td data-label="السعر"><strong style="color:var(--brown-dark)">${Number(p.price).toLocaleString()} ج.م</strong>
                        ${p.old_price ? `<br><small style="text-decoration:line-through;color:#bbb">${Number(p.old_price).toLocaleString()}</small>` : ''}
                    </td>
                    <td data-label="الوحدة" style="color:var(--text-muted);font-size:12px">${p.unit || '—'}</td>
                    <td data-label="Badge">${badge}</td>
                    <td>
                        <div class="td-actions">
                            <label class="toggle-switch" title="${p.is_active !== false ? 'إخفاء من الموقع' : 'عرض في الموقع'}">
                                <input type="checkbox" ${p.is_active !== false ? 'checked' : ''} onchange="toggleProductVisibility('${p.id}', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                            <button class="btn btn-outline btn-icon btn-sm" onclick="editProduct('${p.id}')" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteProduct('${p.id}')" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

function filterProducts(query) {
    const q = query.toLowerCase().trim();
    const filtered = q ? allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.categories?.name && p.categories.name.toLowerCase().includes(q))
    ) : allProducts;
    renderProductsTable(filtered);
}

// ══════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ══════════════════════════════════════════════════════════════
function openProductModal(product = null) {
    document.getElementById('product-modal-title').innerHTML =
        `<i class="fas fa-box-open" style="color:var(--brown-mid);margin-left:8px"></i> ${product ? 'تعديل المنتج' : 'إضافة منتج جديد'}`;

    document.getElementById('product-id').value = product?.id || '';
    document.getElementById('p-name').value = product?.name || '';
    document.getElementById('p-price').value = product?.price || '';
    document.getElementById('p-old-price').value = product?.old_price || '';
    document.getElementById('p-unit').value = product?.unit || '';
    document.getElementById('p-desc').value = product?.description || '';
    document.getElementById('p-cat-label').value = product?.cat_label || '';
    document.getElementById('p-badge').value = product?.badge || '';

    // Badge type select
    const badgeSel = document.getElementById('p-badge-type');
    if (product?.badge_type === 'featured') {
        if (product?.badge === 'الأكثر مبيعاً') badgeSel.value = 'الأكثر مبيعاً (يسار)';
        else badgeSel.value = product.badge_type;
    } else if (product?.badge_type === 'offer') {
        if (product?.badge && product.badge !== 'عرض') badgeSel.value = 'offer_custom';
        else badgeSel.value = 'offer';
    } else {
        badgeSel.value = '';
    }
    toggleBadgeInput();

    // Category
    if (product?.category_id) {
        document.getElementById('p-category').value = product.category_id;
    } else {
        document.getElementById('p-category').value = '';
    }

    // Image
    currentImageFile = null;
    currentImageUrl = product?.image_url || null;
    document.getElementById('image-preview-wrap').innerHTML = '';
    document.getElementById('upload-progress').style.display = 'none';

    const curWrap = document.getElementById('current-image-wrap');
    if (currentImageUrl) {
        curWrap.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding:10px;background:var(--bg-cream);border-radius:10px;">
                <img src="${currentImageUrl}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">
                <div>
                    <div style="font-size:12px;font-weight:700;color:var(--brown-dark)">الصورة الحالية</div>
                    <div style="font-size:11px;color:var(--text-muted)">سيتم الاحتفاظ بها إلا إذا اخترت صورة جديدة</div>
                </div>
                <button onclick="clearCurrentImage()" style="margin-right:auto;background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;" title="إزالة الصورة">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
    } else {
        curWrap.innerHTML = '';
    }

    document.getElementById('product-modal').classList.add('open');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('open');
}

function editProduct(id) {
    const p = allProducts.find(x => x.id == id);
    if (p) openProductModal(p);
}

function clearCurrentImage() {
    currentImageUrl = null;
    document.getElementById('current-image-wrap').innerHTML = '';
}

function toggleBadgeInput() {
    const sel = document.getElementById('p-badge-type');
    const field = document.getElementById('badge-text-field');
    const val = sel.value;
    if (val === 'featured' || val === 'offer' || val === 'offer_custom') {
        field.style.display = 'block';
        if (val === 'offer' && !document.getElementById('p-badge').value) {
            document.getElementById('p-badge').value = 'عرض';
        }
    } else {
        field.style.display = 'none';
        document.getElementById('p-badge').value = '';
    }
}

// ── Image Upload ───────────────────────────────────────────────
function handleImageSelect(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('الصورة كبيرة جداً (الحد الأقصى 5MB)', 'error'); return; }

    currentImageFile = file;

    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('image-preview-wrap').innerHTML = `
            <div class="upload-preview">
                <img src="${e.target.result}" alt="معاينة">
            </div>`;
        document.getElementById('current-image-wrap').innerHTML = '';
    };
    reader.readAsDataURL(file);
}

async function uploadImage(file, productName) {
    const ext = file.name.split('.').pop();
    const safeName = Math.random().toString(36).substring(2, 8);
    const fileName = `${Date.now()}_${safeName}.${ext}`;
    const filePath = `products/${fileName}`;

    const progressBar = document.getElementById('upload-progress-bar');
    const progressWrap = document.getElementById('upload-progress');
    progressWrap.style.display = 'block';
    progressBar.style.width = '30%';

    const { error } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (error) { showToast('فشل رفع الصورة: ' + error.message, 'error'); return null; }

    progressBar.style.width = '100%';
    setTimeout(() => { progressWrap.style.display = 'none'; }, 600);

    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
}

// ── Save Product ───────────────────────────────────────────────
async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('p-name').value.trim();
    const price = parseFloat(document.getElementById('p-price').value);
    const oldPrice = parseFloat(document.getElementById('p-old-price').value) || null;
    const unit = document.getElementById('p-unit').value.trim();
    const desc = document.getElementById('p-desc').value.trim();
    const catId = document.getElementById('p-category').value;
    const catLabel = document.getElementById('p-cat-label').value.trim();
    const badgeType = document.getElementById('p-badge-type').value;
    let badgeText = document.getElementById('p-badge').value.trim();

    if (!name) { showToast('أدخل اسم المنتج', 'error'); return; }
    if (!price) { showToast('أدخل سعر المنتج', 'error'); return; }
    if (!catId) { showToast('اختر الفئة', 'error'); return; }

    const btn = document.getElementById('save-product-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    // Resolve badge
    let finalBadgeType = null;
    let finalBadge = null;
    if (badgeType === 'featured') {
        finalBadgeType = 'featured';
        finalBadge = badgeText || 'مميز';
    } else if (badgeType === 'offer') {
        finalBadgeType = 'offer';
        finalBadge = badgeText || 'عرض';
    } else if (badgeType === 'offer_custom') {
        finalBadgeType = 'offer';
        finalBadge = badgeText || 'وفر';
    }

    // Upload image if new file selected
    let imageUrl = currentImageUrl;
    if (currentImageFile) {
        imageUrl = await uploadImage(currentImageFile, name);
        if (!imageUrl) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ المنتج'; return; }
    }

    const payload = {
        name,
        price,
        old_price: oldPrice,
        unit: unit || null,
        description: desc || null,
        category_id: catId,
        cat_label: catLabel || null,
        image_url: imageUrl || null,
        badge: finalBadge,
        badge_type: finalBadgeType
    };

    let error;
    if (id) {
        ({ error } = await sb.from('products').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('products').insert(payload));
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ المنتج';

    if (error) { showToast('خطأ في الحفظ: ' + error.message, 'error'); return; }

    showToast(id ? '✅ تم تعديل المنتج' : '✅ تم إضافة المنتج', 'success');
    closeProductModal();
    await loadProducts();
}

// ── Toggle Product Visibility ───────────────────────────────────
async function toggleProductVisibility(id, isActive) {
    const { error } = await sb.from('products').update({ is_active: isActive }).eq('id', id);
    if (error) {
        showToast('خطأ: ' + error.message, 'error');
        return;
    }
    showToast(isActive ? 'تم عرض المنتج في الموقع ✅' : 'تم إخفاء المنتج من الموقع', 'warn');
    await loadProducts();
}

// ── Delete Product ─────────────────────────────────────────────
function deleteProduct(id) {
    const p = allProducts.find(x => x.id == id);
    if (!p) return;
    openConfirmModal(`حذف "${p.name}"`, 'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع.', async () => {
        if (p.image_url) {
            try {
                const url = new URL(p.image_url);
                const fileName = url.pathname.split('/').pop();
                if (fileName) {
                    await sb.storage.from(STORAGE_BUCKET).remove([`products/${fileName}`]);
                }
            } catch (err) {
                console.error('Failed to delete image', err);
            }
        }

        const { error } = await sb.from('products').delete().eq('id', id);
        if (error) { showToast('خطأ في الحذف', 'error'); return; }
        showToast('🗑️ تم حذف المنتج', 'success');
        await loadProducts();
    });
}

// ══════════════════════════════════════════════════════════════
// CATEGORY MODAL
// ══════════════════════════════════════════════════════════════
function openCategoryModal(cat = null) {
    document.getElementById('category-modal-title').innerHTML =
        `<i class="fas fa-tag" style="color:var(--brown-mid);margin-left:8px"></i> ${cat ? 'تعديل الفئة' : 'إضافة فئة جديدة'}`;

    document.getElementById('category-id').value = cat?.id || '';
    document.getElementById('c-name').value = cat?.name || '';
    document.getElementById('c-emoji').value = cat?.emoji || '';
    document.getElementById('c-slug').value = cat?.slug || '';
    document.getElementById('c-sort-order').value = cat?.sort_order || '';

    document.getElementById('category-modal').classList.add('open');
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.remove('open');
}

function editCategory(id) {
    const cat = allCategories.find(x => x.id == id);
    if (cat) openCategoryModal(cat);
}

async function saveCategory() {
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('c-name').value.trim();
    const emoji = document.getElementById('c-emoji').value.trim();
    const slug = document.getElementById('c-slug').value.trim().toLowerCase().replace(/\s+/g, '_');
    let sortOrder = document.getElementById('c-sort-order').value.trim();

    if (!name) { showToast('أدخل اسم الفئة', 'error'); return; }
    if (!slug) { showToast('أدخل الـ slug', 'error'); return; }

    if (sortOrder === '') {
        const maxSort = allCategories.length > 0 ? Math.max(...allCategories.map(c => c.sort_order || 0)) : 0;
        sortOrder = maxSort + 1;
    } else {
        sortOrder = parseInt(sortOrder, 10);
    }

    const btn = document.getElementById('save-category-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    const payload = { name, emoji: emoji || null, slug, sort_order: sortOrder };
    let error;

    if (id) {
        ({ error } = await sb.from('categories').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('categories').insert(payload));
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ الفئة';

    if (error) { showToast('خطأ في الحفظ: ' + error.message, 'error'); return; }

    showToast(id ? '✅ تم تعديل الفئة' : '✅ تم إضافة الفئة', 'success');
    closeCategoryModal();
    await loadCategories();
    renderCategoriesTable();
}

function deleteCategory(id) {
    const cat = allCategories.find(x => x.id == id);
    if (!cat) return;
    const productsInCat = allProducts.filter(p => p.category_id == id).length;
    if (productsInCat > 0) {
        showToast(`لا يمكن حذف الفئة — بها ${productsInCat} منتج`, 'error');
        return;
    }
    openConfirmModal(`حذف فئة "${cat.name}"`, 'هل أنت متأكد؟ سيتم حذف الفئة نهائياً.', async () => {
        const { error } = await sb.from('categories').delete().eq('id', id);
        if (error) { showToast('خطأ في الحذف', 'error'); return; }
        showToast('🗑️ تم حذف الفئة', 'success');
        await loadCategories();
    });
}

// ══════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════════
function openConfirmModal(title, msg, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.add('open');

    document.getElementById('confirm-delete-btn').onclick = async () => {
        const cb = confirmCallback;
        closeConfirmModal();
        if (cb) await cb();
    };
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('open');
    confirmCallback = null;
}

// ══════════════════════════════════════════════════════════════
// DISCOUNT CODES
// ══════════════════════════════════════════════════════════════
async function loadDiscountCodes() {
    const wrap = document.getElementById('discounts-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل الأكواد...</p></div>';

    const { data, error } = await sb
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        showToast('خطأ في تحميل أكواد الخصم', 'error');
        if (wrap) wrap.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ في تحميل الأكواد</p></div>';
        return;
    }

    allDiscounts = data || [];
    updateDiscountStats();
    renderDiscountsTable();
}

function updateDiscountStats() {
    const now = new Date();
    const active = allDiscounts.filter(d => d.is_active && (!d.expires_at || new Date(d.expires_at) > now));
    const el = id => document.getElementById(id);
    if (el('ds-total')) el('ds-total').textContent = allDiscounts.length;
    if (el('ds-active')) el('ds-active').textContent = active.length;
}

function renderDiscountsTable() {
    const wrap = document.getElementById('discounts-table-wrap');
    if (!wrap) return;

    if (!allDiscounts.length) {
        wrap.innerHTML = '<div class="empty-state"><i class="fas fa-percent"></i><p>لا توجد أكواد خصم بعد — أضف أول كود!</p></div>';
        return;
    }

    const now = new Date();
    wrap.innerHTML = `
    <table>
        <thead>
            <tr>
                <th>الكود</th>
                <th>النوع</th>
                <th>القيمة</th>
                <th>انتهاء الصلاحية</th>
                <th>الحالة</th>
                <th>إجراءات</th>
            </tr>
        </thead>
        <tbody>
            ${allDiscounts.map(d => {
        const isExpired = d.expires_at && new Date(d.expires_at) < now;
        let statusClass, statusText;
        if (isExpired) {
            statusClass = 'expired'; statusText = 'منتهي الصلاحية';
        } else if (d.is_active) {
            statusClass = 'active'; statusText = 'مفعّل';
        } else {
            statusClass = 'inactive'; statusText = 'موقوف';
        }

        const typeLabel = d.discount_type === 'percent' ? 'نسبة %' : 'مبلغ ثابت';
        const typeClass = d.discount_type === 'percent' ? 'percent' : 'fixed';
        const valueLabel = d.discount_type === 'percent'
            ? `${d.value}%`
            : `${Number(d.value).toLocaleString()} ج.م`;



        const expText = d.expires_at
            ? new Date(d.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
            : '<span style="color:var(--text-muted);font-size:12px">لا ينتهي</span>';

        return `
                <tr>
                    <td data-label="الكود">
                        <code style="background:var(--bg-cream);padding:4px 10px;border-radius:8px;font-size:13px;font-weight:800;letter-spacing:1.5px;color:var(--brown-dark)">${d.code}</code>
                        ${d.description ? `<br><small style="color:var(--text-muted);font-size:11px">${d.description}</small>` : ''}
                    </td>
                    <td data-label="النوع"><span class="disc-type-pill ${typeClass}">${typeLabel}</span></td>
                    <td data-label="القيمة"><strong style="color:var(--brown-dark);font-size:15px">${valueLabel}</strong></td>
                    <td data-label="انتهاء الصلاحية">${expText}</td>
                    <td data-label="الحالة"><span class="status-badge ${statusClass}">● ${statusText}</span></td>
                    <td>
                        <div class="td-actions">
                            <label class="toggle-switch" title="${d.is_active ? 'إيقاف' : 'تفعيل'}">
                                <input type="checkbox" ${d.is_active ? 'checked' : ''} onchange="toggleDiscountStatus('${d.id}', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                            <button class="btn btn-outline btn-icon btn-sm" onclick="editDiscount('${d.id}')" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteDiscount('${d.id}', '${d.code}')" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

function openDiscountModal(discount = null) {
    document.getElementById('discount-modal-title').innerHTML =
        `<i class="fas fa-percent" style="color:var(--brown-mid);margin-left:8px"></i> ${discount ? 'تعديل كود الخصم' : 'إضافة كود خصم'}`;

    document.getElementById('discount-id').value = discount?.id || '';
    document.getElementById('d-code').value = discount?.code || '';
    document.getElementById('d-type').value = discount?.discount_type || 'percent';
    document.getElementById('d-value').value = discount?.value || '';
    document.getElementById('d-desc').value = discount?.description || '';
    document.getElementById('d-active').checked = discount ? discount.is_active : true;

    if (discount?.expires_at) {
        const d = new Date(discount.expires_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        document.getElementById('d-expires').value = local.toISOString().slice(0, 10);
    } else {
        document.getElementById('d-expires').value = '';
    }

    // قفل الأيام السابقة في النتيجة (Calendar)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('d-expires').min = `${yyyy}-${mm}-${dd}`;

    updateDiscountSuffix();
    document.getElementById('discount-modal').classList.add('open');
}

function closeDiscountModal() {
    document.getElementById('discount-modal').classList.remove('open');
}

function updateDiscountSuffix() {
    const type = document.getElementById('d-type').value;
    const suffix = document.getElementById('d-suffix');
    if (suffix) suffix.textContent = type === 'percent' ? '%' : 'ج.م';
}

function editDiscount(id) {
    const disc = allDiscounts.find(d => d.id === id);
    if (disc) openDiscountModal(disc);
}

async function saveDiscount() {
    const id = document.getElementById('discount-id').value;
    const code = document.getElementById('d-code').value.trim().toUpperCase();
    const type = document.getElementById('d-type').value;
    const value = parseFloat(document.getElementById('d-value').value);
    const exp = document.getElementById('d-expires').value || null;
    const desc = document.getElementById('d-desc').value.trim() || null;
    const active = document.getElementById('d-active').checked;

    if (!code) { showToast('أدخل كود الخصم', 'error'); return; }
    if (!value || value <= 0) { showToast('أدخل قيمة صحيحة للخصم', 'error'); return; }
    if (type === 'percent' && value > 100) { showToast('النسبة لا تتجاوز 100%', 'error'); return; }
    let isoExp = null;
    if (exp) {
        // Safe parsing for "YYYY-MM-DD" to local Date at 23:59:59
        const [y, m, d] = exp.split('-');
        if (y && m && d) {
            // Set expiry to the very end of the selected day
            const expDate = new Date(y, m - 1, d, 23, 59, 59);

            if (expDate <= new Date()) {
                showToast('❌ لا يمكن أن يكون تاريخ الانتهاء في الماضي', 'error');
                return;
            }
            isoExp = expDate.toISOString();
        }
    }

    const btn = document.getElementById('save-discount-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    const payload = {
        code,
        discount_type: type,
        value,
        expires_at: isoExp,
        description: desc,
        is_active: active
    };

    let error;
    if (id) {
        ({ error } = await sb.from('discount_codes').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('discount_codes').insert([payload]));
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ الكود';

    if (error) {
        if (error.code === '23505') showToast('هذا الكود موجود مسبقاً!', 'error');
        else showToast('خطأ في حفظ الكود: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'تم تحديث الكود بنجاح ✅' : 'تم إضافة الكود بنجاح ✅', 'success');
    closeDiscountModal();
    await loadDiscountCodes();
}

async function toggleDiscountStatus(id, active) {
    const { error } = await sb
        .from('discount_codes')
        .update({ is_active: active })
        .eq('id', id);

    if (error) { showToast('خطأ في تغيير الحالة', 'error'); return; }
    showToast(active ? 'تم تفعيل الكود ✅' : 'تم إيقاف الكود', 'warn');
    await loadDiscountCodes();
}

async function deleteDiscount(id, code) {
    openConfirmModal(
        'حذف كود الخصم',
        `هل أنت متأكد من حذف كود "${code}"? لا يمكن التراجع.`,
        async () => {
            const { error } = await sb.from('discount_codes').delete().eq('id', id);
            if (error) { showToast('خطأ في الحذف', 'error'); return; }
            showToast('تم حذف الكود بنجاح', 'success');
            await loadDiscountCodes();
        }
    );
}

// ══════════════════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════════════════
async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = 'success') {
    const t = document.getElementById('admin-toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-text');

    t.classList.remove('success', 'error', 'warn');
    t.classList.add(type);

    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warn: 'fa-exclamation-circle' };
    icon.className = `fas ${icons[type] || 'fa-info-circle'}`;
    text.textContent = msg;

    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
        }
    });
});
