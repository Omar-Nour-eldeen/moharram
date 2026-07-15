let cart = [];
let wishlist = [];
try {
    cart = JSON.parse(localStorage.getItem('moharram_cart')) || [];
    if (!Array.isArray(cart)) cart = [];
    cart = cart.filter(i => i && typeof i === 'object');

    wishlist = JSON.parse(localStorage.getItem('moharram_wishlist')) || [];
    if (!Array.isArray(wishlist)) wishlist = [];
    wishlist = wishlist.filter(i => i && typeof i === 'object');
} catch (e) {
    console.error("Error parsing localStorage", e);
    cart = [];
    wishlist = [];
}
let rawTotal = 0;
let discount = 0;

// Recalculate rawTotal from loaded cart
if (cart.length > 0) {
    rawTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

/* ---- ADD TO CART ---- */
function addToCart(id, name, price) {
    price = parseFloat(price) || 0;  // تأكد أن السعر رقم دائماً
    const ex = cart.find(i => (i.id && i.id == id) || (!i.id && i.name === name));
    if (ex) { ex.qty++; ex.id = id; ex.name = name; ex.price = price; } else { cart.push({ id, name, price, qty: 1 }); }
    rawTotal += price;
    saveCart();
    refreshCounters();
    showToast('✅ أُضيف للسلة: ' + name.split('(')[0].trim(), 'success');
    renderCart();
}

// Add event listener for flying animation
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.add-to-cart-btn');
    if (btn) {
        const card = btn.closest('.product-card');
        if (card) {
            const img = card.querySelector('.product-image img');
            if (img) {
                flyToCartAnimation(img);
            }
        }
    }
});

function flyToCartAnimation(imgEl) {
    let cartIcon = document.querySelector('.float-cart-btn');
    if (!cartIcon || window.getComputedStyle(cartIcon).display === 'none' || cartIcon.offsetParent === null) {
        cartIcon = document.querySelector('button[onclick="openCart()"]');
    }
    if (!cartIcon || !imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const clone = imgEl.cloneNode(true);
    Object.assign(clone.style, {
        position: 'fixed',
        top: `${imgRect.top}px`,
        left: `${imgRect.left}px`,
        width: `${imgRect.width}px`,
        height: `${imgRect.height}px`,
        zIndex: 9999,
        transition: 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
        borderRadius: '50%',
        pointerEvents: 'none',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        objectFit: 'cover'
    });

    document.body.appendChild(clone);
    clone.getBoundingClientRect();

    Object.assign(clone.style, {
        top: `${cartRect.top + cartRect.height / 2 - imgRect.height / 2}px`,
        left: `${cartRect.left + cartRect.width / 2 - imgRect.width / 2}px`,
        transform: 'scale(0.1)',
        opacity: '0.2'
    });

    setTimeout(() => {
        clone.remove();
        cartIcon.style.transition = 'transform 0.2s';
        cartIcon.style.transform = 'scale(1.3)';
        setTimeout(() => {
            cartIcon.style.transform = '';
        }, 200);
    }, 800);
}

function saveCart() {
    localStorage.setItem('moharram_cart', JSON.stringify(cart));
}

/* ---- QTY CONTROLS ---- */
function changeQty(idx, delta) {
    const item = cart[idx];
    if (item.qty + delta <= 0) {
        removeItem(idx);
        return;
    }
    item.qty += delta;
    rawTotal += item.price * delta;
    saveCart();
    refreshCounters();
    renderCart();
}

function setQty(idx, val) {
    const item = cart[idx];
    let newQty = parseInt(val);
    if (isNaN(newQty) || newQty <= 0) newQty = 1;

    let diff = newQty - item.qty;
    item.qty = newQty;
    rawTotal += item.price * diff;
    saveCart();
    refreshCounters();
    renderCart();
}

function removeItem(idx) {
    rawTotal -= cart[idx].price * cart[idx].qty;
    cart.splice(idx, 1);
    if (!cart.length) { discount = 0; document.getElementById('discount-message').innerText = ''; }
    saveCart();
    refreshCounters();
    renderCart();
}

function refreshCounters() {
    const n = cart.reduce((a, i) => a + i.qty, 0);
    ['cart-counter', 'float-cart-counter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = n;
            el.style.display = n ? 'flex' : 'none';
        }
    });
}

/* ---- RENDER CART ---- */
function renderCart() {
    const box = document.getElementById('cart-items-container');
    const sum = document.getElementById('cart-summary');
    if (!box || !sum) return;

    if (!cart.length) {
        box.innerHTML = `<div class="cart-empty-state"><i class="fas fa-shopping-basket"></i><p>سلتك فارغة حتى الآن</p><small>أضف منتجاتك المفضلة</small></div>`;
        sum.style.display = 'none'; return;
    }
    box.innerHTML = cart.map((it, i) => `
        <div class="cart-item d-flex align-items-center py-3 border-bottom">
            <div class="cart-item-info flex-grow-1">
                <div class="cart-item-name fw-bold mb-1">${it.name}</div>
                <div class="cart-item-price text-brown-mid fw-bolder">${(it.price * it.qty).toLocaleString()} ج.م</div>
            </div>
            <div class="qty-controls d-flex align-items-center mx-2 border rounded overflow-hidden">
                <button class="qty-btn minus bg-light border-0 px-2 py-1" onclick="changeQty(${i}, -1)">-</button>
                <input type="number" class="qty-input border-0 text-center" style="width: 36px; -moz-appearance: textfield;" value="${it.qty}" onchange="setQty(${i}, this.value)">
                <button class="qty-btn plus bg-light border-0 px-2 py-1" onclick="changeQty(${i}, 1)">+</button>
            </div>
            <button class="cart-remove btn btn-link text-danger p-0 ms-2" onclick="removeItem(${i})"><i class="fas fa-trash-alt"></i></button>
        </div>`).join('');
    sum.style.display = 'block';
    updateSummary();
}

/* ---- SUMMARY ---- */
function updateSummary() {
    const discAmt = rawTotal * discount;
    const afterDisc = rawTotal - discAmt;
    const gov = document.getElementById('governorate');
    let ship = gov && gov.value ? parseInt(gov.value) : 0;
    if (rawTotal >= 1999 && cart.length) ship = 0;

    document.getElementById('sum-subtotal').textContent = rawTotal.toLocaleString() + ' ج.م';

    const dr = document.getElementById('sum-disc-row');
    if (discount > 0) {
        dr.style.display = 'flex';
        document.getElementById('sum-disc').textContent = '-' + Math.round(discAmt).toLocaleString() + ' ج.م';
    } else { dr.style.display = 'none'; }

    const sh = document.getElementById('sum-ship');
    if (!cart.length) sh.textContent = 'يُحدد بالمحافظة';
    else if (!gov || !gov.value) sh.textContent = 'يُحدد بالمحافظة';
    else if (ship === 0 && rawTotal >= 1999) sh.innerHTML = '<span style="color:#25D366">مجاناً 🎉</span>';
    else sh.textContent = ship.toLocaleString() + ' ج.م';

    document.getElementById('sum-total').textContent = (afterDisc + ship).toLocaleString() + ' ج.م';
}

/* ---- DISCOUNT ---- */
function applyDiscount() {
    if (!cart.length) { showToast('أضف منتجات أولاً!', 'warn'); return; }
    const code = document.getElementById('discount-code').value.trim();
    const msg = document.getElementById('discount-message');
    if (code === 'Mo5%') { discount = 0.05; msg.style.color = '#25D366'; msg.textContent = '✅ تم تطبيق خصم 5٪!'; showToast('✅ خصم 5٪ مفعّل!', 'success'); }
    else if (code === 'NATURE10') { discount = 0.10; msg.style.color = '#25D366'; msg.textContent = '✅ تم تطبيق خصم 10٪!'; showToast('✅ خصم 10٪ مفعّل!', 'success'); }
    else { discount = 0; msg.style.color = 'var(--red)'; msg.textContent = '❌ كود غير صحيح أو منتهي'; showToast('❌ كود الخصم غير صحيح', 'error'); }
    updateSummary();
}

/* ---- OPEN CART ---- */
function openCart() {
    const cartOffcanvasEl = document.getElementById('cartOffcanvas');
    if (cartOffcanvasEl) {
        let bsOffcanvas = bootstrap.Offcanvas.getInstance(cartOffcanvasEl) || new bootstrap.Offcanvas(cartOffcanvasEl);
        bsOffcanvas.show();
    }
}

/* ---- WHATSAPP ORDER ---- */
function sendOrder() {
    if (!cart.length) { showToast('🛒 السلة فارغة!', 'warn'); return; }
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const gov = document.getElementById('governorate');
    const pay = document.querySelector('input[name="pay"]:checked').value;
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!name || !addr || !phone || !gov.value) {
        showToast('⚠️ يرجى إكمال بيانات التوصيل أولاً', 'warn');
        return;
    }
    if (!phoneRegex.test(phone)) {
        showToast('❌ رقم الهاتف غير صحيح (مثال: 01012345678)', 'error');
        return;
    }

    const discAmt = rawTotal * discount;
    const after = rawTotal - discAmt;
    let ship = parseInt(gov.value);
    if (after >= 1999) ship = 0;
    const govName = gov.options[gov.selectedIndex].text;
    const final = after + ship;

    let msg = `*🍯 طلب جديد - متجر محرم*\n━━━━━━━━━━━━━━━━\n*المنتجات:*\n`;
    cart.forEach(i => { msg += `• ${i.name} × ${i.qty} = ${(i.price * i.qty).toLocaleString()} ج.م\n`; });
    msg += `━━━━━━━━━━━━━━━━\n*الفاتورة:*\nإجمالي المنتجات: ${rawTotal.toLocaleString()} ج.م\n`;
    if (discount > 0) msg += `خصم الكوبون: -${Math.round(discAmt).toLocaleString()} ج.م\n`;
    msg += `الشحن (${govName}): ${ship === 0 ? 'مجاناً 🎉' : ship + ' ج.م'}\n*الإجمالي النهائي: ${final.toLocaleString()} ج.م*\n`;
    msg += `━━━━━━━━━━━━━━━━\n*طريقة الدفع:* ${pay}\n━━━━━━━━━━━━━━━━\n*بيانات التوصيل:*\nالاسم: ${name}\nالمحافظة: ${govName}\nالعنوان: ${addr}\nالهاتف: ${phone}`;

    window.open('https://wa.me/201067986822?text=' + encodeURIComponent(msg), '_blank');
}

/* ---- CATEGORY FILTER ---- */
function filterCat(cat, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active', 'bg-brown-dark', 'text-white'));
    btn.classList.add('active', 'bg-brown-dark', 'text-white');

    document.querySelectorAll('.product-card-container').forEach(c => {
        const show = (cat === 'all' || c.dataset.cat === cat);
        c.classList.toggle('d-none', !show);
    });

    document.querySelectorAll('.section-header').forEach(h => {
        const show = (cat === 'all' || h.dataset.cat === cat);
        if (show) {
            h.classList.remove('d-none');
            h.classList.add('d-flex');
        } else {
            h.classList.add('d-none');
            h.classList.remove('d-flex');
        }
    });

    document.querySelectorAll('#products-dynamic-wrapper .row.g-4').forEach(row => {
        const visibleCards = row.querySelectorAll('.product-card-container:not(.d-none)');
        row.classList.toggle('d-none', visibleCards.length === 0);
    });

    setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
}

/* ---- WISHLIST ---- */
function toggleWish(btn, id) {
    const card = btn.closest('.product-card');
    const title = card.querySelector('.product-title').innerText;

    let cartName = title;
    let price = 0;

    const cartBtn = card.querySelector('.add-to-cart-btn');
    if (cartBtn) {
        const onclickAttr = cartBtn.getAttribute('onclick');
        if (onclickAttr) {
            // Match: addToCart('id', 'name', price)
            const match3 = onclickAttr.match(/addToCart\('([^']+)',\s*'([^']+)',\s*(\d+)\)/);
            // Match: addToCart('name', price)  -- legacy
            const match2 = onclickAttr.match(/addToCart\('([^']+)',\s*(\d+)\)/);
            if (match3) {
                cartName = match3[2];
                price = parseInt(match3[3]);
            } else if (match2) {
                cartName = match2[1];
                price = parseInt(match2[2]);
            }
        }
    }

    const imgEl = card.querySelector('img');
    const img = imgEl ? imgEl.src : '';
    const cat = card.querySelector('.product-category').innerText;

    // Check by id or title (legacy)
    let index = wishlist.findIndex(i => (id && i.id == id) || (!id && i && (i.title === title || i.name === title)));
    const ic = btn.querySelector('i');

    if (index > -1) {
        wishlist.splice(index, 1);
        ic.classList.remove('fas');
        ic.classList.add('far');
        ic.style.color = '';
        btn.classList.remove('active');
        showToast('🗑️ تم الحذف من المفضلة', 'error');
    } else {
        wishlist.push({ id, title, name: title, cartName, price, img, cat });
        ic.classList.remove('far');
        ic.classList.add('fas');
        ic.style.color = 'var(--red)';
        btn.classList.add('active');
        showToast('❤️ تمت الإضافة للمفضلة', 'info');
    }
    localStorage.setItem('moharram_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

function updateWishlistCount() {
    const validWishlist = wishlist.filter(it => it && (it.title || it.name));
    document.querySelectorAll('#wishlist-counter').forEach(wCount => {
        wCount.textContent = validWishlist.length;
        wCount.style.display = validWishlist.length ? 'flex' : 'none';
    });
}

function renderWishlistPage() {
    const container = document.getElementById('wishlist-page-container');
    if (!container) return;

    const validWishlist = wishlist.filter(it => it && (it.title || it.name));

    if (!validWishlist.length) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="far fa-heart" style="font-size: 60px; color: rgba(186,163,130,0.3); margin-bottom: 20px;"></i>
                <h3 class="fw-bold mb-3 text-brown-dark">المفضلة فارغة</h3>
                <p class="text-muted mb-4">لم تقم بإضافة أي منتجات إلى المفضلة بعد.</p>
                <a href="index.html#products" class="btn btn-primary btn-lg rounded-pill px-4">تصفح المنتجات</a>
            </div>`;
        return;
    }

    try {
        container.innerHTML = `<div class="row g-4">` + validWishlist.map((it, i) => `
            <div class="col-12 col-sm-6 col-lg-3" data-aos="fade-up" data-aos-delay="${100 + (i % 4) * 100}">
                <div class="card h-100 product-card border-0 position-relative">
                    <button class="wishlist-btn active position-absolute" style="top: 10px; right: 10px; z-index: 10;" onclick="removeWishlistItem(${i})">
                        <i class="fas fa-heart"></i>
                    </button>
                    <div class="product-image"><img src="${it.img || ''}" alt="${it.title || it.name}" onerror="this.parentElement.innerHTML='<span class=ph-icon>🍯</span>'"></div>
                    <div class="card-body product-body d-flex flex-column">
                        <div class="product-category">${it.cat || 'منتج'}</div>
                        <h3 class="product-title">${it.title || it.name}</h3>
                        <p class="product-desc flex-grow-1"></p>
                        <div class="product-price-row mb-3"><span class="product-price">${Number(it.price || 0).toLocaleString()} ج.م</span></div>
                        <button class="add-to-cart-btn mt-auto" onclick="addToCart('${it.id || ''}', '${it.cartName || it.name}', ${it.price || 0})">
                            <i class="fas fa-cart-plus"></i> أضف للسلة
                        </button>
                    </div>
                </div>
            </div>
`).join('') + `</div>`;
    } catch (err) {
        console.error("Error rendering wishlist:", err);
        container.innerHTML = '<div class="alert alert-danger text-center">حدث خطأ أثناء عرض المفضلة. الرجاء تفريغ المفضلة وإعادة المحاولة.</div>';
    }
}

function removeWishlistItem(idx) {
    wishlist = wishlist.filter(it => it && (it.title || it.name));
    wishlist.splice(idx, 1);
    localStorage.setItem('moharram_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    renderWishlistPage();
    showToast('🗑️ تم الحذف من المفضلة', 'error');
}

/* ---- SOCIAL TOGGLE ---- */
function toggleSocial() {
    const links = document.getElementById('social-links');
    const btn = document.getElementById('social-toggle-btn');
    links.classList.toggle('open');
    btn.classList.toggle('active');
}

/* ---- TOAST ---- */
let toastT;
function showToast(msg, type) {
    const t = document.getElementById('toast');
    const icon = t.querySelector('i');
    const msgEl = document.getElementById('toast-msg');

    t.classList.remove('toast-error', 'toast-info', 'toast-warn');

    if (type === 'error') t.classList.add('toast-error');
    else if (type === 'info') t.classList.add('toast-info');
    else if (type === 'warn') t.classList.add('toast-warn');

    if (type === 'error') icon.className = 'fas fa-times-circle';
    else if (type === 'info') icon.className = 'fas fa-heart';
    else if (type === 'warn') icon.className = 'fas fa-exclamation-circle';
    else icon.className = 'fas fa-check-circle';

    msgEl.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2700);
}

/* ---- CONTACT FORM ---- */
function sendContactMsg(e) {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const msg = document.getElementById('contact-msg').value.trim();

    if (!name) {
        showToast('⚠️ من فضلك أدخل اسمك', 'warn');
        document.getElementById('contact-name').focus();
        return;
    }
    if (!phone) {
        showToast('⚠️ من فضلك أدخل رقم هاتفك', 'warn');
        document.getElementById('contact-phone').focus();
        return;
    }
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        showToast('❌ رقم الهاتف غير صحيح (مثال: 01012345678)', 'error');
        document.getElementById('contact-phone').focus();
        return;
    }
    if (!msg) {
        showToast('⚠️ من فضلك اكتب رسالتك', 'warn');
        document.getElementById('contact-msg').focus();
        return;
    }

    let waMsg = `*📩 رسالة جديدة - تواصل معنا*\n━━━━━━━━━━━━━━━━\n`;
    waMsg += `*الاسم:* ${name}\n*الهاتف:* ${phone}\n━━━━━━━━━━━━━━━━\n`;
    waMsg += `*الرسالة:*\n${msg}`;

    window.open('https://wa.me/201067986822?text=' + encodeURIComponent(waMsg), '_blank');

    document.getElementById('contactForm').reset();
    showToast('✅ تم تحويلك للواتساب لإرسال الرسالة', 'success');
}

/* ---- INITIALIZATION ---- */
document.addEventListener("DOMContentLoaded", function () {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            once: true,
            offset: 50
        });
    }

    refreshCounters();
    updateWishlistCount();
    renderCart();

    // Re-apply active state to wishlist buttons based on localStorage
    document.querySelectorAll('.product-card').forEach(card => {
        const titleEl = card.querySelector('.product-title');
        if (!titleEl) return;
        const name = titleEl.innerText;
        const cardId = card.dataset.id;
        if (wishlist.some(i => i && ((i.id && i.id == cardId) || (!i.id && (i.title === name || i.name === name))))) {
            const btn = card.querySelector('.wishlist-btn');
            if (btn) {
                const ic = btn.querySelector('i');
                ic.classList.remove('far');
                ic.classList.add('fas');
                ic.style.color = 'var(--red)';
                btn.classList.add('active');
            }
        }
    });

    renderWishlistPage();
});


const canvas = document.getElementById('tickerCanvas');
const ctx = canvas.getContext('2d');

const items = [
    '🚚 شحن مجاني للطلبات فوق 1999 ج.م',
    '✨ كود خصم [Mo5%] يوفر 5% على طلبك',
    '🍯 منتجات طبيعية 100% مضمونة الجودة',
    '📦 توصيل لجميع محافظات مصر',
    '🌿 خبرة أكثر من 3 سنوات في المنتجات الطبيعية'
];

const GAP = 80;
const SPEED = 2.5;
const BG = '#403124';
const FG = '#BAA382';

const isMobile = window.innerWidth <= 768;
const FONT = `bold ${isMobile ? '11' : '13'}px sans-serif`;
const H = isMobile ? 30 : 36;

function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = H;
}
resize();
window.addEventListener('resize', () => {
    resize();
    recalc();
});

ctx.font = FONT;
let itemWidths = [];
let segW = 0;

function recalc() {
    ctx.font = FONT;
    itemWidths = items.map(t => ctx.measureText(t).width);
    segW = itemWidths.reduce((a, b) => a + b, 0) + GAP * items.length;
}
recalc();

let x = canvas.width;

function draw() {
    const W = canvas.width;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.font = FONT;
    ctx.fillStyle = FG;
    ctx.textBaseline = 'middle';

    let offset = x % segW;
    if (offset > 0) offset -= segW;

    while (offset < W) {
        let cx = offset;
        for (let i = 0; i < items.length; i++) {
            ctx.fillText(items[i], cx, H / 2);
            cx += itemWidths[i] + GAP;
        }
        offset += segW;
    }

    x -= SPEED;
    requestAnimationFrame(draw);
}

draw();

/* ==== SUPABASE DYNAMIC PRODUCTS ==== */
let allProducts = [];
let allCategories = [];
let sbClient = null;  // global client علشان الـ Realtime يفضل شغال

async function loadStoreData() {
    try {
        if (typeof supabase === 'undefined') {
            document.getElementById('products-dynamic-wrapper').innerHTML = '<div class="alert alert-danger">Supabase not loaded</div>';
            return;
        }
        if (typeof SUPABASE_URL === 'undefined') {
            document.getElementById('products-dynamic-wrapper').innerHTML = '<div class="alert alert-danger">SUPABASE_URL not defined</div>';
            return;
        }

        // إنشاء client واحد غلوبال يفضل شغال مع الـ Realtime
        if (!sbClient) {
            sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // ===== REALTIME: تحديث فوري عند تغيير المنتجات =====
            sbClient.channel('store-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
                    console.log('🔄 Products Realtime update:', payload);
                    const { data: newProdData } = await sbClient
                        .from('products')
                        .select('*, categories(name, emoji, slug)')
                        .order('id', { ascending: true });
                    if (newProdData) allProducts = newProdData;
                    syncPricesWithDB();
                    renderDynamicProducts();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async (payload) => {
                    console.log('🔄 Categories Realtime update:', payload);
                    const { data: newCatData } = await sbClient
                        .from('categories')
                        .select('*')
                        .order('sort_order', { ascending: true })
                        .order('id', { ascending: true });
                    if (newCatData) allCategories = newCatData;
                    renderDynamicProducts();
                })
                .subscribe((status) => {
                    console.log('🟢 Realtime status:', status);
                });
        }

        const { data: catData, error: catErr } = await sbClient.from('categories').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
        if (catErr) throw new Error('Categories error: ' + catErr.message);
        if (catData) allCategories = catData;

        const { data: prodData, error: prodErr } = await sbClient.from('products').select('*, categories(name, emoji, slug)').order('id', { ascending: true });
        if (prodErr) throw new Error('Products error: ' + prodErr.message);
        if (prodData) allProducts = prodData;

        syncPricesWithDB();
        renderDynamicProducts();

    } catch (err) {
        const w = document.getElementById('products-dynamic-wrapper');
        if (w) w.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>';
    }
}

function syncPricesWithDB() {
    let cartChanged = false;
    cart.forEach(item => {
        const dbProduct = allProducts.find(p => p.id == item.id || (!item.id && p.name === item.name));
        if (dbProduct) {
            if (!item.id || item.name !== dbProduct.name || item.price !== dbProduct.price) {
                item.id = dbProduct.id;
                item.name = dbProduct.name;
                item.price = dbProduct.price;
                cartChanged = true;
            }
        }
    });

    if (cartChanged) {
        rawTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        saveCart();
        renderCart();
    }

    let wishlistChanged = false;
    wishlist.forEach(item => {
        const dbProduct = allProducts.find(p => p.id == item.id || (!item.id && (p.name === item.title || p.name === item.name)));
        if (dbProduct) {
            if (!item.id || item.title !== dbProduct.name || item.price !== dbProduct.price || item.img !== dbProduct.image_url || item.cat !== (dbProduct.categories && dbProduct.categories.name)) {
                item.id = dbProduct.id;
                item.title = dbProduct.name;
                item.name = dbProduct.name;
                item.price = dbProduct.price;
                if (dbProduct.image_url) item.img = dbProduct.image_url;
                if (dbProduct.categories && dbProduct.categories.name) item.cat = dbProduct.categories.name;
                wishlistChanged = true;
            }
        }
    });

    if (wishlistChanged) {
        localStorage.setItem('moharram_wishlist', JSON.stringify(wishlist));
        if (document.getElementById('wishlist-page-container')) {
            renderWishlistPage();
        }
    }
}

function renderDynamicProducts() {
    const wrapper = document.getElementById('products-dynamic-wrapper');
    if (!wrapper) return;

    if (!allProducts.length) {
        wrapper.innerHTML = '<div class="text-center py-5"><p>لا توجد منتجات متاحة حالياً.</p></div>';
        return;
    }

    wrapper.innerHTML = '';

    // === FILTER TABS ===
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'container py-4';
    tabsContainer.id = 'products-tabs';

    const tabsRow = document.createElement('div');
    tabsRow.className = 'd-flex justify-content-center flex-wrap gap-2';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-tab active bg-brown-dark text-white';
    allBtn.textContent = 'الكل';
    allBtn.onclick = function() { filterCat('all', this); };
    tabsRow.appendChild(allBtn);

    allCategories.forEach(function(cat) {
        const catProds = allProducts.filter(function(p) { return p.category_id === cat.id; });
        if (!catProds.length) return;
        const btn = document.createElement('button');
        btn.className = 'filter-tab';
        btn.textContent = (cat.emoji || '') + ' ' + (cat.slug || cat.name);
        btn.onclick = function() { filterCat(cat.slug, this); };
        tabsRow.appendChild(btn);
    });

    tabsContainer.appendChild(tabsRow);
    wrapper.appendChild(tabsContainer);

    // === CATEGORY SECTIONS ===
    allCategories.forEach(function(cat) {
        const catProds = allProducts.filter(function(p) { return p.category_id === cat.id; });
        if (!catProds.length) return;

        const header = document.createElement('div');
        header.className = 'section-header d-flex align-items-center gap-3 mt-5 mb-4';
        header.dataset.cat = cat.slug;
        header.innerHTML = '<h2 class="section-title">' + (cat.emoji || '') + ' ' + cat.name + '</h2><div class="section-line"></div>';
        wrapper.appendChild(header);

        const row = document.createElement('div');
        row.className = 'row g-4';
        catProds.forEach(function(p, idx) {
            row.appendChild(buildProductCard(p, cat.slug, idx));
        });
        wrapper.appendChild(row);
    });

    // Re-apply wishlist states
    document.querySelectorAll('.product-card').forEach(function(card) {
        const titleEl = card.querySelector('.product-title');
        if (!titleEl) return;
        const name = titleEl.innerText;
        const cardId = card.dataset.id;
        if (wishlist.some(function(i) { return i && ((i.id && i.id == cardId) || (!i.id && (i.title === name || i.name === name))); })) {
            const btn = card.querySelector('.wishlist-btn');
            if (btn) {
                const ic = btn.querySelector('i');
                ic.classList.remove('far');
                ic.classList.add('fas');
                ic.style.color = 'var(--red)';
                btn.classList.add('active');
            }
        }
    });

    if (typeof AOS !== 'undefined') AOS.refresh();
}

function buildProductCard(p, dataCat, index) {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-lg-3 product-card-container';
    col.dataset.cat = dataCat;

    const isOffer = p.badge_type === 'offer';
    const isFeatured = p.badge_type === 'featured';

    const card = document.createElement('div');
    card.className = 'card h-100 product-card ' + (isOffer ? 'border-2 border-danger' : 'border-0');
    card.dataset.id = p.id;
    col.appendChild(card);

    // Badge
    if (isFeatured) {
        const badge = document.createElement('div');
        badge.className = 'highlight-badge';
        badge.textContent = p.badge || 'مميز';
        card.appendChild(badge);
    } else if (isOffer) {
        const badge = document.createElement('div');
        badge.className = 'discount-tag';
        badge.textContent = p.badge || 'عرض';
        card.appendChild(badge);
    }

    // Image
    const imgWrap = document.createElement('div');
    imgWrap.className = 'product-image';
    const fallback = (p.categories && p.categories.emoji) ? p.categories.emoji : '🍯';
    if (p.image_url) {
        const img = document.createElement('img');
        img.src = p.image_url;
        img.alt = p.name;
        img.onerror = function() {
            imgWrap.innerHTML = '<span class="ph-icon">' + fallback + '</span>';
        };
        imgWrap.appendChild(img);
    } else {
        imgWrap.innerHTML = '<span class="ph-icon">' + fallback + '</span>';
    }
    card.appendChild(imgWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'card-body product-body d-flex flex-column';

    const catLabelEl = document.createElement('div');
    catLabelEl.className = 'product-category';
    catLabelEl.textContent = p.cat_label || (p.categories && p.categories.name) || 'منتج';
    body.appendChild(catLabelEl);

    const titleEl = document.createElement('h3');
    titleEl.className = 'product-title';
    titleEl.textContent = p.name;
    body.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'product-desc flex-grow-1 pt-3';
    descEl.textContent = p.description || '';
    body.appendChild(descEl);

    const priceRow = document.createElement('div');
    priceRow.className = 'product-price-row';
    if (p.old_price) {
        priceRow.innerHTML = '<span class="old-price">' + Number(p.old_price).toLocaleString() + ' ج.م</span>' +
            '<span class="product-price text-danger">' + Number(p.price).toLocaleString() + ' ج.م</span>';
    } else {
        priceRow.innerHTML = '<span class="product-price">' + Number(p.price).toLocaleString() + ' ج.م</span>' +
            (p.unit ? '<span class="price-unit">/ ' + p.unit + '</span>' : '');
    }
    body.appendChild(priceRow);

    const btns = document.createElement('div');
    btns.className = 'd-flex gap-2 mt-auto';

    const cartName = p.name.replace(/'/g, "\\'");
    const cartBtn = document.createElement('button');
    cartBtn.className = 'add-to-cart-btn';
    cartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> أضف للسلة';
    cartBtn.setAttribute('onclick', `addToCart('${p.id}', '${cartName}', ${p.price})`);
    btns.appendChild(cartBtn);

    const wishBtn = document.createElement('button');
    wishBtn.className = 'wishlist-btn';
    wishBtn.innerHTML = '<i class="far fa-heart"></i>';
    wishBtn.setAttribute('onclick', `toggleWish(this, '${p.id}')`);
    btns.appendChild(wishBtn);

    body.appendChild(btns);
    card.appendChild(body);

    return col;
}

window.addEventListener('load', function() {
    loadStoreData();
});
