/* ===== ADMIN DASHBOARD JS ===== */
'use strict';

// ── Supabase Init ──────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ──────────────────────────────────────────────────────
let allProducts   = [];
let allCategories = [];
let currentImageFile = null;
let currentImageUrl  = null;
let confirmCallback  = null;

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
        products:   { title: 'إدارة المنتجات',  sub: 'إضافة وتعديل وحذف المنتجات' },
        categories: { title: 'إدارة الفئات',    sub: 'إضافة وتعديل وحذف الفئات'   }
    };
    document.getElementById('page-title').textContent    = titles[page].title;
    document.getElementById('page-subtitle').textContent = titles[page].sub;

    closeSidebar();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
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
    document.getElementById('stat-products').textContent  = allProducts.length;
    document.getElementById('stat-offers').textContent    = allProducts.filter(p => p.badge_type === 'offer').length;
    document.getElementById('stat-featured').textContent  = allProducts.filter(p => p.badge_type === 'featured').length;
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
                const badge   = p.badge ? `<span class="badge-pill ${p.badge_type === 'offer' ? 'badge-offer' : 'badge-featured'}">${p.badge}</span>` : '<span style="color:rgba(122,102,82,0.3);font-size:12px">—</span>';
                const imgHtml = p.image_url
                    ? `<img src="${p.image_url}" class="product-thumb" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=product-thumb-placeholder>🍯</div>'">`
                    : `<div class="product-thumb-placeholder">🍯</div>`;

                return `
                <tr>
                    <td data-label="الصورة">${imgHtml}</td>
                    <td data-label="المنتج">
                        <strong style="font-size:13px">${p.name}</strong>
                        ${p.description ? `<br><small style="color:var(--text-muted);font-size:11px">${p.description.slice(0,50)}${p.description.length>50?'...':''}</small>` : ''}
                    </td>
                    <td data-label="الفئة"><span style="font-size:13px">${catName}</span></td>
                    <td data-label="السعر"><strong style="color:var(--brown-dark)">${Number(p.price).toLocaleString()} ج.م</strong>
                        ${p.old_price ? `<br><small style="text-decoration:line-through;color:#bbb">${Number(p.old_price).toLocaleString()}</small>` : ''}
                    </td>
                    <td data-label="الوحدة" style="color:var(--text-muted);font-size:12px">${p.unit || '—'}</td>
                    <td data-label="Badge">${badge}</td>
                    <td>
                        <div class="td-actions">
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

    document.getElementById('product-id').value    = product?.id || '';
    document.getElementById('p-name').value        = product?.name || '';
    document.getElementById('p-price').value       = product?.price || '';
    document.getElementById('p-old-price').value   = product?.old_price || '';
    document.getElementById('p-unit').value        = product?.unit || '';
    document.getElementById('p-desc').value        = product?.description || '';
    document.getElementById('p-cat-label').value   = product?.cat_label || '';
    document.getElementById('p-badge').value       = product?.badge || '';

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
    currentImageUrl  = product?.image_url || null;
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
    const ext      = file.name.split('.').pop();
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
    const id       = document.getElementById('product-id').value;
    const name     = document.getElementById('p-name').value.trim();
    const price    = parseFloat(document.getElementById('p-price').value);
    const oldPrice = parseFloat(document.getElementById('p-old-price').value) || null;
    const unit     = document.getElementById('p-unit').value.trim();
    const desc     = document.getElementById('p-desc').value.trim();
    const catId    = document.getElementById('p-category').value;
    const catLabel = document.getElementById('p-cat-label').value.trim();
    const badgeType = document.getElementById('p-badge-type').value;
    let badgeText  = document.getElementById('p-badge').value.trim();

    if (!name)   { showToast('أدخل اسم المنتج', 'error'); return; }
    if (!price)  { showToast('أدخل سعر المنتج', 'error'); return; }
    if (!catId)  { showToast('اختر الفئة', 'error');       return; }

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
    document.getElementById('c-name').value      = cat?.name  || '';
    document.getElementById('c-emoji').value     = cat?.emoji || '';
    document.getElementById('c-slug').value      = cat?.slug  || '';
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
    const id    = document.getElementById('category-id').value;
    const name  = document.getElementById('c-name').value.trim();
    const emoji = document.getElementById('c-emoji').value.trim();
    const slug  = document.getElementById('c-slug').value.trim().toLowerCase().replace(/\s+/g, '_');
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
    document.getElementById('confirm-msg').textContent   = msg;
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
    const t    = document.getElementById('admin-toast');
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
