# मौजूदा book covers का विश्लेषण

**स्रोत:** `booknomics.com/image-sitemap.xml` (109 covers) + `src/components/BookCard.tsx`
**तारीख़:** 16 अगस्त 2026

---

## 1. सबसे बड़ी समस्या: 5 अलग-अलग स्रोत

109 covers पाँच अलग जगहों से आ रहे हैं। कोई एक मानक नहीं है।

| स्रोत | कितने | % | दिक़्क़त |
|---|---|---|---|
| Supabase (UUID फ़ोल्डर) | 59 | 54% | ठीक है, यही मानक होना चाहिए |
| `booknomics.com/__l5e/assets-v1/` | 22 | 20% | **Lovable का पुराना asset पथ** |
| Google Books API | 11 | 10% | **बाहरी निर्भरता, कभी भी टूट सकता है** |
| Supabase (नाम वाली फ़ाइल) | 10 | 9% | जैसे `73_1984_cover.jpg` — अलग नामकरण |
| OpenLibrary | 4 | 4% | **बाहरी निर्भरता** |
| Supabase `hindi/` फ़ोल्डर | 3 | 3% | तीसरा नामकरण |

**असर:** 15 covers (Google + OpenLibrary) आपके नियंत्रण में नहीं हैं। अगर वे URL बदल दें या rate-limit लगा दें, तो 15 books पर cover ग़ायब हो जाएगा। Google Books के URL में `zoom=3` भी है, जो अक्सर धुँधली तस्वीर देता है।

---

## 2. 17 books पर cover है ही नहीं

इनमें cover_url खाली है, इसलिए `BookCover` का fallback चलता है — सिर्फ़ रंगीन डिब्बा जिस पर title और author लिखा आता है।

```
deep-work          educated        hooked          influence
jeevan-vidya       kabir-beejak    kamayani        meghdutam
nirmala            nudge           ramcharitmanas  srikant
the-100-startup    the-e-myth      the-one-thing   the-tipping-point
thinking-fast-and-slow
```

इनमें **कामायनी, निर्मला, रामचरितमानस, मेघदूतम्, श्रीकांत, कबीर बीजक** जैसी बड़ी हिंदी कृतियाँ हैं। ये आपकी सबसे ऊँची priority (0.9) वाली books हैं, और इन्हीं पर cover नहीं है।

---

## 3. सबसे ज़रूरी खोज: `object-contain`

`src/components/BookCard.tsx` की पंक्ति 54:

```
className="absolute inset-0 h-full w-full object-contain object-center bg-muted"
```

यह `object-contain` है, `object-cover` नहीं। इसका मतलब:

- तस्वीर कटती नहीं, पूरी दिखती है
- पर अगर उसका अनुपात 2:3 नहीं है, तो **दोनों तरफ़ खाली पट्टियाँ** बन जाती हैं
- Google Books के covers अक्सर 1:1.55 या ऐसे अनुपात में आते हैं, इसलिए वहाँ पट्टियाँ दिखती होंगी

इसीलिए हर नया cover **ठीक 2:3 (800×1200)** होना चाहिए। हमने दोनों नए covers इसी माप में बनाए हैं।

---

## 4. Format बिखरा हुआ है

| Format | कितने |
|---|---|
| `.jpg` | 48 |
| `.png` | 46 |
| `.jpeg` | 4 |
| Google API | 11 |

46 PNG चिंता की बात है। तस्वीरों के लिए PNG, JPEG से 3 से 5 गुना भारी होता है। हमारे अपने generated PNG 2.6 MB के थे, JPEG में 254 KB हो गए।

राहत की बात यह है कि Supabase वाले सब WebP में बदल जाते हैं:

```
/render/image/public/...?width=W&height=H&resize=cover&quality=78&format=webp
```

पर यह सिर्फ़ Supabase पर लागू होता है। Google, OpenLibrary और `__l5e` वाले 37 covers बिना अनुकूलन के सीधे परोसे जा रहे हैं।

---

## 5. Alt text ठीक है

पंक्ति 51:

```
alt={`${book.title} book summary cover by ${book.author} - Booknomics`}
```

यह सही बना हुआ है। हिंदी books के लिए हिंदी alt बेहतर होता, पर यह कोई बड़ी कमी नहीं है।

---

## 6. Cover पर text — असली सवाल

आपने कहा कि cover पर book name और author भी लिखा हो। इस पर एक बात साफ़ करनी ज़रूरी है।

`BookCard` में cover के **नीचे** पहले से title, author और category दिखते हैं (पंक्ति 79 से 90)। तो cover पर text लिखने से वह दो बार दिखेगा।

लेकिन इसके पक्ष में भी मज़बूत तर्क हैं:

- **Pinterest, WhatsApp और Google Images** में तस्वीर अकेली जाती है, बिना आसपास के text के। वहाँ बिना नाम वाला cover पहचाना नहीं जाता।
- असली किताबों के cover पर नाम होता ही है। बिना नाम वाला cover "स्टॉक इलस्ट्रेशन" जैसा लगता है, किताब जैसा नहीं।
- `image-sitemap.xml` में हर cover दर्ज है, यानी Google Images से ट्रैफ़िक आने की संभावना है।

**निष्कर्ष:** text लिखना सही फ़ैसला है। पर उसे सोच-समझकर रखना होगा, ताकि नीचे के text से टकराए नहीं और भीड़ न लगे।

---

## 7. नए covers का मानक

इस विश्लेषण से यह ढाँचा तय होता है:

| तत्व | नियम |
|---|---|
| माप | ठीक 800×1200 (2:3), क्योंकि `object-contain` है |
| Format | JPEG, quality 88, progressive |
| आकार | 300 KB से कम |
| Title | ऊपर या नीचे एक तिहाई में, बड़ा, स्पष्ट |
| Author | Title से छोटा, उसी संरेखण में |
| Booknomics | बहुत छोटा, नीचे, हल्का — ब्रांड की पहचान |
| चित्र | प्रतीकात्मक, बीच का हिस्सा साफ़ रखें ताकि text पढ़ा जाए |
| भाषा | हिंदी किताब पर देवनागरी, अंग्रेज़ी पर Latin |

**अपलोड कहाँ:** Supabase `book-covers` bucket, ताकि WebP रूपांतरण मिले। बाहरी URL से बचें।
