// i18n.js — sözlük tabanlı çeviri. Gerçek zamanlı çeviri API'si kullanmıyor
// (anahtar/kurulum gerektirmesin diye), bu yüzden:
//   - Sabit arayüz metinleri (başlıklar, etiketler) EKSİKSİZ çevriliyor.
//   - İlan içeriğindeki değerler (Otomatik, Dizel, Beyaz, Evet/Hayır vb.)
//     bilinen kelime dağarcığı için çevriliyor.
//   - İlan başlığı gibi serbest metinler kelime/öbek bazında, sözlükte
//     bulunanlar çevrilerek, bulunmayanlar Türkçe bırakılarak işleniyor —
//     yani kaba bir çeviri olur, profesyonel çeviri kalitesi garanti edilmez.

const I18N_LABELS = {
  tr: {
    brand_row: 'MAN TopUsed',
    listing_no: 'İlan No',
    view_listing: 'İlanı Görüntüle ↗',
    sale_price_tl: 'Satış Fiyatı (TL)',
    vat_incl: 'KDV Dahil',
    vat_excl_prefix: 'KDV Hariç:',
    eur_equivalent: 'Euro Karşılığı',
    rate_prefix: 'Kur:',
    rate_live_fail: 'canlı çekilemedi',
    open_online: "Web'de aç",
    tech_specs: 'Teknik Özellikler',
    print_btn: 'Yazdır / PDF Kaydet',
    share_btn: 'Mobil için Link Oluştur',
    share_btn_done: 'Link kopyalandı! ✓',
    not_specified: 'Belirtilmemiş',
    empty_state: 'Veri bulunamadı. Bir sahibinden ilan sayfasında eklenti butonuna tekrar bas, ya da sana paylaşılan broşür linkini kullan.',
    photo_hint: '⟳ Değiştirmek için tıkla'
  },
  en: {
    brand_row: 'MAN TopUsed',
    listing_no: 'Listing No',
    view_listing: 'View Listing ↗',
    sale_price_tl: 'Sale Price (TRY)',
    vat_incl: 'VAT Incl.',
    vat_excl_prefix: 'VAT Excl.:',
    eur_equivalent: 'Euro Equivalent',
    rate_prefix: 'Rate:',
    rate_live_fail: "couldn't fetch live rate",
    open_online: 'Open online',
    tech_specs: 'Technical Specifications',
    print_btn: 'Print / Save PDF',
    share_btn: 'Create Mobile Link',
    share_btn_done: 'Link copied! ✓',
    not_specified: 'Not specified',
    empty_state: 'No data found. Press the extension button again on a sahibinden listing page, or use the brochure link that was shared with you.',
    photo_hint: '⟳ Tap to change'
  },
  de: {
    brand_row: 'MAN TopUsed',
    listing_no: 'Anzeigen-Nr.',
    view_listing: 'Anzeige ansehen ↗',
    sale_price_tl: 'Verkaufspreis (TRY)',
    vat_incl: 'inkl. MwSt.',
    vat_excl_prefix: 'zzgl. MwSt.:',
    eur_equivalent: 'Euro-Gegenwert',
    rate_prefix: 'Kurs:',
    rate_live_fail: 'konnte nicht live abgerufen werden',
    open_online: 'Online öffnen',
    tech_specs: 'Technische Daten',
    print_btn: 'Drucken / Als PDF speichern',
    share_btn: 'Mobilen Link erstellen',
    share_btn_done: 'Link kopiert! ✓',
    not_specified: 'Nicht angegeben',
    empty_state: 'Keine Daten gefunden. Klicke auf einer sahibinden-Anzeigenseite erneut auf den Erweiterungs-Button, oder verwende den dir zugesendeten Broschürenlink.',
    photo_hint: '⟳ Tippen zum Wechseln'
  }
};

// SPEC_CATALOG etiketleri (generator.js) için TR anahtar -> {en, de}
const I18N_SPEC_LABELS = {
  'Araç Tipi': { en: 'Vehicle Type', de: 'Fahrzeugtyp' },
  'Model Yılı': { en: 'Model Year', de: 'Baujahr' },
  'Kilometre': { en: 'Mileage', de: 'Kilometerstand' },
  'Renk': { en: 'Color', de: 'Farbe' },
  'Araç Durumu': { en: 'Vehicle Condition', de: 'Fahrzeugzustand' },
  'Model Seri': { en: 'Model Series', de: 'Modellreihe' },
  'Paket / Donanım': { en: 'Package / Trim', de: 'Ausstattung' },
  'Yolcu Kapasitesi': { en: 'Passenger Capacity', de: 'Sitzplätze' },
  'Koltuk Düzeni': { en: 'Seat Layout', de: 'Sitzanordnung' },
  'Koltuk Arkası Ekran': { en: 'Seatback Screen', de: 'Bildschirm an Rückenlehne' },
  'Şanzıman': { en: 'Transmission', de: 'Getriebe' },
  'Vites Sayısı': { en: 'Number of Gears', de: 'Anzahl der Gänge' },
  'Yakıt Tipi': { en: 'Fuel Type', de: 'Kraftstoffart' },
  'Yakıt Hacmi': { en: 'Fuel Tank Volume', de: 'Tankvolumen' },
  'Hacim': { en: 'Volume', de: 'Volumen' },
  'Şase Tipi': { en: 'Chassis Type', de: 'Fahrgestelltyp' },
  'Lastik Durumu': { en: 'Tire Condition', de: 'Reifenzustand' },
  'Hasar Kaydı': { en: 'Damage Record', de: 'Schadenshistorie' },
  'Ağır Hasar Kayıtlı': { en: 'Heavy Damage Record', de: 'Schwerer Unfallschaden' },
  'Plaka / Uyruk': { en: 'Plate / Registration', de: 'Kennzeichen / Zulassung' },
  'Takas': { en: 'Trade-in', de: 'Tausch möglich' }
};

// Serbest metin (başlık) ve bilinmeyen özellik değerleri içinde geçebilecek
// yaygın araç ilanı kelime dağarcığı. Öbekler (birden fazla kelime) önce,
// tekil kelimeler sonra denenir.
const I18N_VALUE_PHRASES = [
  ['Türkiye (TR) Plakalı', { en: 'Turkish (TR) Plate', de: 'Türkisches (TR) Kennzeichen' }],
  ['İkinci El', { en: 'Used', de: 'Gebraucht' }],
  ['Yarı Otomatik', { en: 'Semi-Automatic', de: 'Halbautomatik' }],
  ['Ağır Hasar Kayıtlı', { en: 'Heavy Damage Record', de: 'Schwerer Unfallschaden' }],
  ['Hasar Kaydı Yok', { en: 'No Damage Record', de: 'Kein Unfallschaden' }],
];

const I18N_VALUE_WORDS = {
  // renkler
  'beyaz': { en: 'White', de: 'Weiß' },
  'siyah': { en: 'Black', de: 'Schwarz' },
  'gri': { en: 'Gray', de: 'Grau' },
  'kırmızı': { en: 'Red', de: 'Rot' },
  'mavi': { en: 'Blue', de: 'Blau' },
  'yeşil': { en: 'Green', de: 'Grün' },
  'sarı': { en: 'Yellow', de: 'Gelb' },
  'turuncu': { en: 'Orange', de: 'Orange' },
  'kahverengi': { en: 'Brown', de: 'Braun' },
  'bej': { en: 'Beige', de: 'Beige' },
  'gümüş': { en: 'Silver', de: 'Silber' },
  'lacivert': { en: 'Navy', de: 'Marineblau' },
  // evet/hayır/var/yok
  'evet': { en: 'Yes', de: 'Ja' },
  'hayır': { en: 'No', de: 'Nein' },
  'var': { en: 'Yes', de: 'Vorhanden' },
  'yok': { en: 'No', de: 'Nicht vorhanden' },
  // durum
  'sıfır': { en: 'New', de: 'Neu' },
  // yakıt
  'dizel': { en: 'Diesel', de: 'Diesel' },
  'benzin': { en: 'Gasoline', de: 'Benzin' },
  'elektrik': { en: 'Electric', de: 'Elektro' },
  'hibrit': { en: 'Hybrid', de: 'Hybrid' },
  // vites
  'otomatik': { en: 'Automatic', de: 'Automatik' },
  'manuel': { en: 'Manual', de: 'Manuell' },
  // araç tipi
  'kamyon': { en: 'Truck', de: 'LKW' },
  'otobüs': { en: 'Bus', de: 'Bus' },
  'minibüs': { en: 'Minibus', de: 'Kleinbus' },
  'midibüs': { en: 'Midibus', de: 'Midibus' },
  'çekici': { en: 'Tractor Unit', de: 'Sattelzugmaschine' },
  'kamyonet': { en: 'Pickup Truck', de: 'Kleinlaster' },
  // başlıkta sık geçen kelimeler
  'model': { en: 'Model', de: 'Modell' },
  'taksit': { en: 'installment', de: 'Rate' },
  'oran': { en: 'rate', de: 'Zinssatz' },
  'faiz': { en: 'interest', de: 'Zinsen' },
  'ay': { en: 'months', de: 'Monate' },
  'galeriden': { en: 'from dealer', de: 'vom Händler' },
  'satılık': { en: 'for sale', de: 'zu verkaufen' },
  'sahibinden': { en: 'private seller', de: 'vom Eigentümer' }
};

function i18nLabel(lang, key){
  const table = I18N_LABELS[lang] || I18N_LABELS.tr;
  return table[key] || I18N_LABELS.tr[key] || key;
}

function i18nSpecLabel(lang, trLabel){
  if(lang === 'tr') return trLabel;
  const entry = I18N_SPEC_LABELS[trLabel];
  if(entry && entry[lang]) return entry[lang];
  return trLabel; // sözlükte yoksa Türkçe kalır
}

// Serbest metin ya da bilinmeyen bir özellik değeri için "kaba" çeviri:
// önce çok kelimeli öbekleri, sonra tekil kelimeleri sözlükte arar;
// bulamadığını olduğu gibi bırakır.
function i18nTranslateFreeText(lang, text){
  if(lang === 'tr' || !text) return text;

  let result = text;
  for(const [phrase, table] of I18N_VALUE_PHRASES){
    if(!table[lang]) continue;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(re, table[lang]);
  }

  result = result.replace(/[A-Za-zÇĞİıÖŞÜçğıöşü]+/g, (word) => {
    const lower = word.toLocaleLowerCase('tr');
    const entry = I18N_VALUE_WORDS[lower];
    if(!entry || !entry[lang]) return word;
    const translated = entry[lang];
    // Basit büyük/küçük harf uyumu: orijinal kelime tamamen büyükse büyük yap,
    // ilk harfi büyükse ilk harfi büyült, aksi halde olduğu gibi bırak.
    if(word === word.toUpperCase()) return translated.toUpperCase();
    if(word[0] === word[0].toUpperCase()) return translated[0].toUpperCase() + translated.slice(1);
    return translated.toLowerCase();
  });

  return result;
}
