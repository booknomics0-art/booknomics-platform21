# रक्तकरबी — publish checklist

फ़ाइल: `content-drafts/raktakarabi-rabindranath-thakur.txt`

## जाँच के नतीजे (आपके ही कोड से चलाकर)

| जाँच | नतीजा |
|---|---|
| `parseBulkBooks` errors | **0** |
| कुल शब्द | **2,761** |
| Quiz | 5 प्रश्न, valid JSON |
| Flashcards | 11 कार्ड, valid JSON |
| `auditOnPage` | **96/100** (सिर्फ़ affiliate बाक़ी) |
| `auditPolish` | **100/100** |
| `auditHumanized` | **100/100** |
| slug audit | **100/100** |

तुलना के लिए, चित्रा पहले 70 / 65 / 40 पर था।

## Publish के क़दम

```
□ 1. फ़ाइल का पूरा content copy कीजिए
□ 2. /admin → Bulk Upload → paste → Parse
□ 3. errors 0 दिख रहे हैं? तभी आगे बढ़िए
□ 4. Publish
□ 5. Slug Optimizer में slug सेट कीजिए:
        raktakarabi-ravindranath-thakur-saransh
□ 6. meta_title:
        रक्तकरबी का सारांश हिंदी में — रवींद्रनाथ ठाकुर | Booknomics
□ 7. meta_description:
        रक्तकरबी (Red Oleanders) का पूरा हिंदी सारांश — यक्षपुरी, नंदिनी और
        राजा की कथा, मुख्य विचार, 7-दिन एक्शन प्लान। मुफ़्त पढ़ें।
□ 8. Cover generate कीजिए
□ 9. affiliate link जोड़िए (तब ON-PAGE 100 हो जाएगा)
□ 10. IndexNow ping
```

## meta के बारे में एक बात

`generateSeoTitle` ने अपने आप यह बनाया:

```
रक्तकरबी Summary in Hindi | Booknomics
```

यह 38 अक्षर का है और काम चलाऊ है, पर लेखक का नाम इसमें नहीं आता। ऊपर क़दम 6 में जो सुझाया है वह बेहतर है, क्योंकि लोग "रवींद्रनाथ ठाकुर" भी खोजते हैं।

## असेट्स

`asset_status: partial` है, क्योंकि audio और mindmap के URL नहीं हैं। quiz और flashcards मौजूद हैं। Audio के लिए `#AUDIO_SCRIPT` तैयार है, उसे `book-audio` function से generate कर लीजिए।

## internal linking

`autoLink.ts` अपने आप जोड़ देगा। इस सारांश में चित्रा और रवींद्रनाथ ठाकुर का ज़िक्र है, तो चित्रा के publish होते ही दोनों आपस में जुड़ जाएँगे।
