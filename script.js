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
function addToCart(name, price) {
    const ex = cart.find(i => i.name === name);
    if (ex) { ex.qty++; } else { cart.push({ name, price, qty: 1 }); }
    rawTotal += price;
    saveCart();
    refreshCounters();
    showToast('✅ أُضيف للسلة: ' + name.split('(')[0].trim(), 'success');
    renderCart();
    // لا تفتح السلة تلقائياً
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
        // Fallback to header cart icon if floating cart is hidden or missing
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

    // Trigger reflow
    clone.getBoundingClientRect();

    // Move to cart
    Object.assign(clone.style, {
        top: `${cartRect.top + cartRect.height / 2 - imgRect.height / 2}px`,
        left: `${cartRect.left + cartRect.width / 2 - imgRect.width / 2}px`,
        transform: 'scale(0.1)',
        opacity: '0.2'
    });

    // Pop effect
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
    if (afterDisc >= 1999 && cart.length) ship = 0;

    document.getElementById('sum-subtotal').textContent = rawTotal.toLocaleString() + ' ج.م';

    const dr = document.getElementById('sum-disc-row');
    if (discount > 0) {
        dr.style.display = 'flex';
        document.getElementById('sum-disc').textContent = '-' + Math.round(discAmt).toLocaleString() + ' ج.م';
    } else { dr.style.display = 'none'; }

    const sh = document.getElementById('sum-ship');
    if (!cart.length) sh.textContent = 'يُحدد بالمحافظة';
    else if (!gov || !gov.value) sh.textContent = 'يُحدد بالمحافظة';
    else if (ship === 0 && afterDisc >= 1999) sh.innerHTML = '<span style="color:#25D366">مجاناً 🎉</span>';
    else sh.textContent = ship.toLocaleString() + ' ج.م';

    document.getElementById('sum-total').textContent = (afterDisc + ship).toLocaleString() + ' ج.م';
}

/* ---- DISCOUNT ---- */
function applyDiscount() {
    if (!cart.length) { showToast('أضف منتجات أولاً!', 'warn'); return; }
    const code = document.getElementById('discount-code').value.trim();
    const msg = document.getElementById('discount-message');
    if (code === 'Mo5%') { discount = 0.05; msg.style.color = '#25D366'; msg.textContent = '✅ تم تطبيق خصم ٥٪!'; showToast('✅ خصم ٥٪ مفعّل!', 'success'); }
    else if (code === 'NATURE10') { discount = 0.10; msg.style.color = '#25D366'; msg.textContent = '✅ تم تطبيق خصم ١٠٪!'; showToast('✅ خصم ١٠٪ مفعّل!', 'success'); }
    else { discount = 0; msg.style.color = 'var(--red)'; msg.textContent = '❌ كود غير صحيح أو منتهي'; showToast('❌ كود الخصم غير صحيح', 'error'); }
    updateSummary();
}

/* ---- OPEN CART (Legacy wrapper for floating button) ---- */
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

    // إخفاء عناوين الأقسام الأخرى بشكل صحيح
    document.querySelectorAll('.section-header').forEach(h => {
        const show = (cat === 'all' || h.dataset.cat === cat);
        // نستخدم classList بدلاً من style.display لتجنب تعارض !important مع Bootstrap
        if (show) {
            h.classList.remove('d-none');
            h.classList.add('d-flex');
        } else {
            h.classList.add('d-none');
            h.classList.remove('d-flex');
        }
    });

    // إخفاء صفوف المنتجات الفارغة بعد الفلتر
    document.querySelectorAll('section.container.pb-5 .row.g-4').forEach(row => {
        const visibleCards = row.querySelectorAll('.product-card-container:not(.d-none)');
        row.classList.toggle('d-none', visibleCards.length === 0);
    });

    setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refresh(); }, 100);
}

/* ---- WISHLIST ---- */
function toggleWish(btn) {
    const card = btn.closest('.product-card');
    const title = card.querySelector('.product-title').innerText;

    let cartName = title;
    let price = 0;

    const cartBtn = card.querySelector('.add-to-cart-btn');
    if (cartBtn) {
        const onclickAttr = cartBtn.getAttribute('onclick');
        if (onclickAttr) {
            // Extract the exact name used in the cart and the price
            const match = onclickAttr.match(/addToCart\('([^']+)',\s*(\d+)\)/);
            if (match) {
                cartName = match[1];
                price = parseInt(match[2]);
            }
        }
    }

    const img = card.querySelector('img').src;
    const cat = card.querySelector('.product-category').innerText;

    // Check by title (for display) or name (legacy support)
    let index = wishlist.findIndex(i => i && (i.title === title || i.name === title));
    const ic = btn.querySelector('i');

    if (index > -1) {
        wishlist.splice(index, 1);
        ic.classList.remove('fas');
        ic.classList.add('far');
        ic.style.color = '';
        btn.classList.remove('active');
        showToast('🗑️ تم الحذف من المفضلة', 'error');
    } else {
        wishlist.push({ title, name: title, cartName, price, img, cat });
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
    const wCount = document.getElementById('wishlist-counter');
    if (wCount) {
        wCount.textContent = wishlist.length;
        wCount.style.display = wishlist.length ? 'flex' : 'none';
    }
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
                        <button class="add-to-cart-btn mt-auto" onclick="addToCart('${it.cartName || it.name}', ${it.price || 0})">
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
    // type: 'success' (green), 'error' (red), 'info' (blue), 'warn' (orange)
    const t = document.getElementById('toast');
    const icon = t.querySelector('i');
    const msgEl = document.getElementById('toast-msg');

    // Reset classes
    t.classList.remove('toast-error', 'toast-info', 'toast-warn');

    if (type === 'error') t.classList.add('toast-error');
    else if (type === 'info') t.classList.add('toast-info');
    else if (type === 'warn') t.classList.add('toast-warn');
    // default = success (green)

    // Icon
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

    // Validate each field individually with a specific toast
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
    // Initialize AOS Animation Library
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            once: true,
            offset: 50
        });
    }

    // Refresh Counters on load
    refreshCounters();
    updateWishlistCount();
    renderCart();

    // Re-apply active state to wishlist buttons based on localStorage
    document.querySelectorAll('.product-card').forEach(card => {
        const titleEl = card.querySelector('.product-title');
        if (!titleEl) return;
        const name = titleEl.innerText;
        if (wishlist.some(i => i && (i.title === name || i.name === name))) {
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
