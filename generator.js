// ==== AYARLAR ====================================================
// Broşürü mobilde (extension olmadan) açabilmek için bu dosyayı GitHub
// Pages / Netlify gibi bir yere yükleyip aşağıdaki adresi kendi linkinle
// değiştir. Kurulum adımları için DEPLOY.md dosyasına bak.
const STANDALONE_BASE_URL = "https://KULLANICI-ADIN.github.io/man-brosur/generator.html"; // TODO: kendi hosting linkinle değiştir

const VAT_RATE = 0.20; // KDV oranı — ilana göre değişirse burayı güncelle

// ==== YARDIMCI FONKSİYONLAR =======================================

async function loadFx(){
  try{
    const res = await fetch('https://api.frankfurter.app/latest?from=TRY&to=EUR');
    const data = await res.json();
    return { eur: 1/data.rates.EUR, date: data.date, ok:true };
  }catch(e){
    return { eur: 55.18, date: 'sabit değer', ok:false };
  }
}

function fmtTL(n){ return new Intl.NumberFormat('tr-TR').format(Math.round(n)) + ' TL'; }
function fmtFx(n, symbol){ return symbol + new Intl.NumberFormat('tr-TR').format(Math.round(n)); }

function pick(specs, ...keys){
  for(const k of keys){ if(specs && specs[k]) return specs[k]; }
  return null;
}

function isExtensionContext(){
  return typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
}

function encodeShareData(obj){
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeShareData(str){
  return JSON.parse(decodeURIComponent(escape(atob(str))));
}

// QR kod üretici (qrcode.js, yerel/offline kütüphane). Payload uzunluğuna
// göre gereken en küçük QR "type"ını bulana kadar dener — çok kısa
// seçilirse kütüphane "code length overflow" hatası fırlatıyor, o zaman
// bir üst boyutu deniyoruz.
function buildQrSvg(text){
  if(typeof qrcode === 'undefined') return null;
  for(let tn = 1; tn <= 40; tn++){
    try{
      const qr = qrcode(tn, 'L');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag(3, 6);
    }catch(e){ /* sığmadı, bir üst boyutu dene */ }
  }
  return null;
}

// Broşürde göstereceğimiz teknik özellik kataloğu. Her satır birkaç olası
// kaynak anahtarını dener (kamyon/otobüs/minibüs arasında etiket farkları
// olabiliyor) ve İLANDA GERÇEKTEN BULUNANLAR dışında hiçbir şey göstermez —
// böylece kamyon ilanında boş "Koltuk Düzeni" satırı çıkmaz, otobüs ilanında
// çıkar.
const SPEC_CATALOG = [
  { label: 'Araç Tipi', keys: ['Araç Tipi'] },
  { label: 'Model Yılı', keys: ['Model Yılı','Yıl'] },
  { label: 'Kilometre', keys: ['Kilometre','KM'] },
  { label: 'Renk', keys: ['Renk'] },
  { label: 'Araç Durumu', keys: ['Araç Durumu'] },
  { label: 'Model Seri', keys: ['Model Seri','Seri'] },
  { label: 'Paket / Donanım', keys: ['Paket / Donanım','Donanım Paketi'] },
  { label: 'Yolcu Kapasitesi', keys: ['Yolcu Kapasitesi','Kapasite'] },
  { label: 'Koltuk Düzeni', keys: ['Koltuk Düzeni'] },
  { label: 'Koltuk Arkası Ekran', keys: ['Koltuk Arkası Ekran'] },
  { label: 'Şanzıman', keys: ['Vites','Şanzıman'] },
  { label: 'Vites Sayısı', keys: ['Vites Sayısı'] },
  { label: 'Yakıt Tipi', keys: ['Yakıt Tipi'] },
  { label: 'Yakıt Hacmi', keys: ['Yakıt Hacmi'] },
  { label: 'Hacim', keys: ['Hacim'] },
  { label: 'Şase Tipi', keys: ['Şase Tipi'] },
  { label: 'Lastik Durumu', keys: ['Lastik Durumu'] },
  { label: 'Hasar Kaydı', keys: ['Hasar Kaydı','Ağır Hasar Kayıtlı'] },
  { label: 'Plaka / Uyruk', keys: ['Plaka / Uyruk'] },
  { label: 'Takas', keys: ['Takas'] },
];

function buildSpecRows(specs, lang){
  specs = specs || {};
  const consumedKeys = new Set();
  const rows = [];

  for(const entry of SPEC_CATALOG){
    const val = pick(specs, ...entry.keys);
    if(val){
      entry.keys.forEach(k => { if(specs[k]) consumedKeys.add(k); });
      rows.push({ label: i18nSpecLabel(lang, entry.label), value: i18nTranslateFreeText(lang, val) });
    }
  }

  // Güvenlik ağı: kataloğa girmemiş ama sayfada bulunmuş bir alan varsa
  // ("hepsinin girili olduğuna emin olalım" isteği için) onu da göster.
  Object.keys(specs).forEach(k => {
    if(!consumedKeys.has(k) && specs[k] && !['İlan No','İlan Tarihi','Marka','Model','Kimden'].includes(k)){
      rows.push({ label: i18nSpecLabel(lang, k), value: i18nTranslateFreeText(lang, specs[k]) });
    }
  });

  return rows;
}

// ==== FOTOĞRAF GALERİSİ (tıkla → sıradaki fotoğrafa geç) ===========
// Her kare (slot), ilandaki TÜM fotoğraf adaylarını (allPhotoPool) kendi
// içinde sırayla gezer. Her adayın kendi çözünürlük yedekleme zinciri var:
// önce büyük boy tahmini (url) denenir, o çalışmazsa "orjinal" adres
// (fallback), o da olmazsa sayfadan okunan ham adres (raw) kullanılır.

let allPhotoPool = [];   // [{url, fallback, raw}]
let galleryState = [];   // [{label, poolIndex}]
let currentListing = null;
let currentFx = null;
let currentLang = 'tr';

function buildSharePayload(){
  return {
    title: currentListing.title, priceRaw: currentListing.priceRaw, specs: currentListing.specs, url: currentListing.url,
    photos: galleryState.map(s => (allPhotoPool[s.poolIndex] || {}).url), photoLabels: galleryState.map(s => s.label)
  };
}

function buildShareLink(){
  return STANDALONE_BASE_URL + '#d=' + encodeShareData(buildSharePayload());
}

function renderQr(){
  const container = document.getElementById('qrRoot');
  if(!container || !currentListing) return;
  const svg = buildQrSvg(buildShareLink());
  container.innerHTML = svg || '';
}

function zipPhotoPool(urls, fallbacks, raws){
  urls = urls || [];
  return urls.map((u, i) => ({ url: u, fallback: (fallbacks && fallbacks[i]) || null, raw: (raws && raws[i]) || null }));
}

function renderGallery(container){
  const hint = i18nLabel(currentLang, 'photo_hint');
  container.innerHTML = galleryState.map((slot, i) => {
    const entry = allPhotoPool[slot.poolIndex] || { url: '' };
    return `
      <figure class="photo" data-idx="${i}" data-hint="${hint}">
        <img src="${entry.url}" data-fallback="${entry.fallback || ''}" data-raw="${entry.raw || ''}" data-step="0">
        <figcaption><span class="counter">${slot.poolIndex + 1}/${allPhotoPool.length}</span></figcaption>
      </figure>
    `;
  }).join('');

  container.querySelectorAll('.photo').forEach(fig => {
    fig.addEventListener('click', () => {
      if(container.dataset.busy === '1') return; // ard arda hızlı tıklamayı yok say
      const idx = Number(fig.dataset.idx);
      if(allPhotoPool.length < 2) return;
      galleryState[idx].poolIndex = (galleryState[idx].poolIndex + 1) % allPhotoPool.length;
      container.dataset.busy = '1';
      renderGallery(container);
      renderQr();
      setTimeout(() => { container.dataset.busy = '0'; }, 220);
    });
  });

  function advanceToNextCandidate(img){
    const step = Number(img.dataset.step || 0);
    const chain = [img.dataset.fallback, img.dataset.raw].filter(Boolean);
    if(step < chain.length && chain[step] && chain[step] !== img.getAttribute('src')){
      img.dataset.step = step + 1;
      img.src = chain[step];
      return true;
    }
    return false;
  }

  container.querySelectorAll('img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      if(!advanceToNextCandidate(img)) img.closest('.photo').style.display = 'none';
    });
    img.addEventListener('load', () => {
      // Görsel yüklendi ama çözünürlüğü çok düşükse (yanlış/küçük bir adaya
      // düşmüş olabiliriz) hata beklemeden bir sonraki adayı sessizce dene.
      if(img.naturalWidth && img.naturalWidth < 400){
        advanceToNextCandidate(img);
      }
    });
  });
}

// ==== ANA RENDER ====================================================

function renderBrochure(){
  const root = document.getElementById('root');
  const d = currentListing;
  const fx = currentFx;
  const lang = currentLang;

  const priceNum = d.priceRaw ? parseFloat(String(d.priceRaw).replace(/\./g,'').replace(',','.')) : 0;
  const priceInclusive = priceNum; // scrape edilen fiyat KDV dahil kabul ediliyor
  const priceExclusive = priceNum / (1 + VAT_RATE);

  const ilanNo = pick(d.specs, 'İlan No');
  const specRows = buildSpecRows(d.specs, lang);
  const priceEurInclusive = priceNum ? priceInclusive / fx.eur : 0;
  const priceEurExclusive = priceNum ? priceExclusive / fx.eur : 0;
  const t = (key) => i18nLabel(lang, key);
  const langBtn = (code, text) => `<button data-lang="${code}" class="${lang === code ? 'active' : ''}">${text}</button>`;

  root.innerHTML = `
    <div class="toolbar">
      <div class="lang-tabs" id="langTabs">
        ${langBtn('tr','TR')}${langBtn('en','EN')}${langBtn('de','DE')}
      </div>
      <div class="toolbar-actions">
        ${isExtensionContext() ? `<button id="shareBtn" class="secondary">${t('share_btn')}</button>` : ''}
        <button id="printBtn">${t('print_btn')}</button>
      </div>
    </div>
    <div class="sheet">
      <header>
        <img class="logo-left" src="logo-left.png" alt="MAN TopUsed">
        <div class="header-mid">
          <h1>${i18nTranslateFreeText(lang, d.title) || 'Araç İlanı'}</h1>
        </div>
        <div class="header-right">
          <img class="logo-right" src="logo-right.png" alt="MAN">
          <div class="listing-no">
            ${ilanNo ? `<b>${t('listing_no')} ${ilanNo}</b>` : ''}
            ${d.url ? `<a href="${d.url}" target="_blank" rel="noopener">${t('view_listing')}</a>` : 'sahibinden.com'}
          </div>
        </div>
      </header>
      <div class="hero-strip"></div>

      <div class="gallery" id="galleryRoot"></div>

      <div class="body-grid">
        <div class="price-card">
          <div class="price-col">
            <div class="label">${t('sale_price_tl')}</div>
            <div class="price-main">${priceNum ? fmtTL(priceInclusive) : (d.priceRaw || t('not_specified'))}${priceNum ? ` <span class="vat-tag">${t('vat_incl')}</span>` : ''}</div>
            ${priceNum ? `<div class="price-sub">(${t('vat_excl_prefix')} ${fmtTL(priceExclusive)})</div>` : ''}
          </div>
          ${priceNum ? `
          <div class="price-col">
            <div class="label">${t('eur_equivalent')}</div>
            <div class="price-main">${fmtFx(priceEurInclusive,'€')} <span class="vat-tag">${t('vat_incl')}</span></div>
            <div class="price-sub">(${t('vat_excl_prefix')} ${fmtFx(priceEurExclusive,'€')})</div>
          </div>` : ''}
          <div class="qr-col">
            <div id="qrRoot"></div>
            <span>${t('open_online')}</span>
          </div>
        </div>
        ${priceNum ? `<div class="fx-note">${t('rate_prefix')} 1 EUR ≈ ${fx.eur.toFixed(2)} TL (${fx.date}${fx.ok ? '' : ', ' + t('rate_live_fail')})</div>` : ''}
      </div>

      <div class="specs">
        <h2>${t('tech_specs')}</h2>
        <div class="spec-grid">
          ${specRows.map(r => `<div class="spec"><div class="k">${r.label}</div><div class="v">${r.value}</div></div>`).join('')}
        </div>
      </div>

      <img class="footer-strip" src="footer-strip.png" alt="MAN">
    </div>
  `;

  renderGallery(document.getElementById('galleryRoot'));
  renderQr();

  // Logo/footer görselleri klasörde yoksa kırık resim ikonu yerine görseli gizle.
  document.querySelectorAll('.logo-left, .logo-right, .footer-strip').forEach(img => {
    img.addEventListener('error', () => { img.style.display = 'none'; });
  });

  document.querySelectorAll('#langTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.dataset.lang === currentLang) return;
      currentLang = btn.dataset.lang;
      renderBrochure();
    });
  });

  // Inline onclick/onerror CSP'de yasak olduğu için handler'ları burada, JS tarafında bağlıyoruz.
  const printBtn = document.getElementById('printBtn');
  if(printBtn) printBtn.addEventListener('click', () => window.print());

  const shareBtn = document.getElementById('shareBtn');
  if(shareBtn){
    shareBtn.addEventListener('click', async () => {
      const link = buildShareLink();
      try{
        await navigator.clipboard.writeText(link);
        shareBtn.textContent = t('share_btn_done');
      }catch(e){
        window.prompt('Linki kopyala ve telefonuna gönder:', link);
      }
      setTimeout(() => { shareBtn.textContent = t('share_btn'); }, 2500);
    });
  }
}

async function render(){
  const root = document.getElementById('root');
  let d;

  if(isExtensionContext()){
    try{
      const store = await chrome.storage.local.get('brosurData');
      d = store.brosurData;
    }catch(e){
      root.innerHTML = '<div class="empty">Depolanan veriye erişilemedi: ' + String(e) + '</div>';
      return;
    }
  }else{
    // Extension dışında (mobil / paylaşılan link) çalışıyoruz — veri URL'nin
    // #d= parçasında base64 olarak taşınıyor.
    const hash = location.hash.startsWith('#d=') ? location.hash.slice(3) : null;
    if(hash){
      try{ d = decodeShareData(hash); }
      catch(e){ d = null; }
    }
  }

  if(!d){
    root.innerHTML = '<div class="empty">' + i18nLabel('tr', 'empty_state') + '</div>';
    return;
  }

  currentFx = await loadFx();

  allPhotoPool = (d.allPhotoUrls && d.allPhotoUrls.length)
    ? zipPhotoPool(d.allPhotoUrls, d.allPhotoFallbacks, d.allPhotoRaw)
    : zipPhotoPool(d.photos, d.photoFallbacks, d.photoRaw);
  const labels = d.photoLabels || [];
  galleryState = (d.photos || []).slice(0, 6).map((url, i) => {
    let poolIndex = allPhotoPool.findIndex(p => p.url === url);
    if(poolIndex < 0) poolIndex = Math.min(i, Math.max(allPhotoPool.length - 1, 0));
    return { label: labels[i] || 'Görünüm', poolIndex };
  });
  currentListing = d;

  renderBrochure();
}

render();
