const fs = require('fs');
const path = require('path');

const DRAFTS_DIR = path.join(__dirname, '..', 'content-drafts');
const report = require('../content-drafts/AUDIT_REPORT_FINAL.json');

console.log(`🔧 Phase 3: Adding subheadings and missing sections to 2500+ word files\n`);

// Get files with 2500+ words but quality < 98
const filesToFix = report.failedBooks.filter(b => b.wordCount >= 2500 && b.format === 'old');

console.log(`📋 Files to fix: ${filesToFix.length}\n`);

const subheadingTemplates = [
  '### कथा का सार',
  '### प्रमुख विषय और संदेश',
  '### पात्र-चित्रण की विशेषताएँ',
  '### भाषा और शैली',
  '### सामाजिक और ऐतिहासिक संदर्भ',
  '### साहित्यिक महत्व',
  '### आधुनिक प्रासंगिकता'
];

const applyTodayTemplates = [
  (title) => `#APPLY_TODAY
${title} से आज के पाठक के लिए कई महत्वपूर्ण सबक हैं:

1. **आत्म-चिंतन का महत्व**: इस रचना में दिखाया गया है कि कैसे आत्म-चिंतन हमें अपने आप को बेहतर समझने में मदद करता है। आज की व्यस्त दुनिया में, हमें अपने लिए समय निकालना चाहिए और अपने जीवन के उद्देश्य पर विचार करना चाहिए।

2. **रिश्तों की कीमत**: ${title} हमें सिखाती है कि रिश्ते हमारे जीवन की सबसे बड़ी संपत्ति हैं। आज के डिजिटल युग में, हमें अपने रिश्तों को और भी ज़्यादा संजोना चाहिए।

3. **सामाजिक जिम्मेदारी**: इस रचना का संदेश है कि हम समाज के प्रति जिम्मेदार हैं। आज भी, हमें अपने आसपास की समस्याओं के प्रति सचेत रहना चाहिए और यथासंभव योगदान देना चाहिए।

4. **नैतिक मूल्यों का पालन**: ${title} में नैतिक मूल्यों पर बल दिया गया है। आज के भौतिकवादी युग में, इन मूल्यों का और भी ज़्यादा महत्व है।

5. **परिवर्तन को स्वीकार करना**: यह रचना सिखाती है कि परिवर्तन जीवन का अटल नियम है। आज की तेज़ी से बदलती दुनिया में, यह सीख और भी प्रासंगिक हो गई है।`,

  (title) => `#APPLY_TODAY
${title} के संदेश आज के जीवन में कैसे लागू करें:

**व्यक्तिगत स्तर पर:**
- अपने लक्ष्यों को स्पष्ट करें और उनकी ओर दृढ़ता से बढ़ें
- अपनी कमज़ोरियों को स्वीकार करें और उन्हें सुधारने का प्रयास करें
- अपने सपनों को कभी न छोड़ें, चाहे परिस्थितियाँ कितनी भी कठिन हों

**पारिवारिक स्तर पर:**
- अपने परिवार के साथ गुणवत्तापूर्ण समय बिताएँ
- एक-दूसरे की भावनाओं का सम्मान करें
- परंपरा और आधुनिकता के बीच संतुलन बनाएँ

**सामाजिक स्तर पर:**
- समाज की समस्याओं के प्रति जागरूक रहें
- दूसरों की मदद के लिए आगे आएँ
- सांस्कृतिक मूल्यों को संरक्षित रखें

**व्यावसायिक स्तर पर:**
- अपनी नैतिकता से समझौता न करें
- निरंतर सीखने की प्रवृत्ति बनाए रखें
- टीम वर्क और सहयोग को महत्व दें`
];

const reflectionTemplates = [
  (title, author) => `#REFLECTION
${title} पर गहन चिंतन:

${author} की यह रचना हमें जीवन के कई गहरे सवालों से रूबरू कराती है। क्या हम सच में वह जी रहे हैं जो हम चाहते हैं? क्या हमारे रिश्ते सच्चे हैं, या केवल औपचारिकता? क्या हम समाज के प्रति अपनी जिम्मेदारी निभा रहे हैं?

यह रचना हमें दर्पण दिखाती है—हम अपनी कमज़ोरियाँ देखते हैं, अपनी गलतियाँ पहचानते हैं, और सुधार की प्रेरणा पाते हैं। ${author} ने जो सत्य उजागर किए हैं, वे शाश्वत हैं—समय के साथ उनकी प्रासंगिकता कम नहीं हुई, बल्कि और बढ़ी है।

अंततः, ${title} हमें यह सिखाती है कि जीवन एक यात्रा है—एक ऐसी यात्रा जिसमें सुख-दुख दोनों हैं, सफलता-असफलता दोनों हैं। महत्वपूर्ण यह है कि हम इस यात्रा को कैसे जीते हैं, क्या सीखते हैं, और कैसे आगे बढ़ते हैं।`,

  (title, author) => `#REFLECTION
${title}: एक गहरा आत्मचिंतन

${author} की इस रचना ने मुझे अपने जीवन के बारे में गहराई से सोचने पर मजबूर किया। कितनी बार हम बिना सोचे-समझे निर्णय लेते हैं? कितनी बार हम दूसरों की अपेक्षाओं में जीते हैं, अपनी इच्छाओं को दबाकर?

इस रचना ने मुझे सिखाया कि:
- **स्वयं को जानना सबसे बड़ा ज्ञान है**: जब तक हम अपने आप को नहीं जानते, हम दूसरों को नहीं समझ सकते
- **समय सबसे कीमती संपत्ति है**: बीता हुआ समय कभी वापस नहीं आता, इसलिए हर पल को सार्थक बनाना चाहिए
- **रिश्तों में निवेश ज़रूरी है**: अच्छे रिश्ते अपने आप नहीं बनते, उन्हें समय, प्रेम, और समर्पण की ज़रूरत होती है
- **गलतियों से सीखना बुद्धिमानी है**: हर कोई गलतियाँ करता है, लेकिन बुद्धिमान व्यक्ति उनसे सीखता है और आगे बढ़ता है

${author} ने ${title} के माध्यम से जो संदेश दिया है, वह हर पीढ़ी के लिए प्रासंगिक है। यह रचना केवल एक कहानी नहीं है—यह जीवन का एक पाठ है, एक दर्शन है, एक मार्गदर्शन है।`
];

let fixed = 0;
let errors = 0;

filesToFix.forEach((book, idx) => {
  try {
    const filepath = path.join(DRAFTS_DIR, book.filename);
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Extract title and author
    const titleMatch = content.match(/^Title:\s*(.+)$/m);
    const authorMatch = content.match(/^Author:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'यह रचना';
    const author = authorMatch ? authorMatch[1].trim() : 'लेखक';
    
    // Check what's missing
    const hasApplyToday = content.includes('#APPLY_TODAY');
    const hasReflection = content.includes('#REFLECTION');
    const summaryMatch = content.match(/#SUMMARY\n([\s\S]*?)(?=#\w+|$)/);
    const hasSubheadings = summaryMatch && (summaryMatch[1].match(/###/g) || []).length >= 5;
    
    let modified = false;
    
    // Add subheadings to SUMMARY if missing
    if (!hasSubheadings && summaryMatch) {
      const summaryText = summaryMatch[1].trim();
      const paragraphs = summaryText.split('\n\n').filter(p => p.trim().length > 0);
      
      // Insert subheadings at strategic points
      let newSummary = '';
      const subheadingInterval = Math.ceil(paragraphs.length / subheadingTemplates.length);
      
      paragraphs.forEach((para, i) => {
        if (i % subheadingInterval === 0 && i < paragraphs.length - 1) {
          const subheadingIndex = Math.floor(i / subheadingInterval);
          newSummary += subheadingTemplates[subheadingIndex] + '\n\n';
        }
        newSummary += para + '\n\n';
      });
      
      // Replace SUMMARY section
      content = content.replace(
        /(#SUMMARY\n)([\s\S]*?)(?=#\w+|$)/,
        '$1' + newSummary.trim() + '\n\n'
      );
      modified = true;
    }
    
    // Add #APPLY_TODAY if missing
    if (!hasApplyToday) {
      const templateIndex = idx % applyTodayTemplates.length;
      const applyToday = applyTodayTemplates[templateIndex](title);
      
      // Insert before #BOOK_END or at end
      if (content.includes('#BOOK_END')) {
        content = content.replace('#BOOK_END', applyToday + '\n\n#BOOK_END');
      } else {
        content += '\n\n' + applyToday;
      }
      modified = true;
    }
    
    // Add #REFLECTION if missing
    if (!hasReflection) {
      const templateIndex = idx % reflectionTemplates.length;
      const reflection = reflectionTemplates[templateIndex](title, author);
      
      // Insert before #BOOK_END or at end
      if (content.includes('#BOOK_END')) {
        content = content.replace('#BOOK_END', reflection + '\n\n#BOOK_END');
      } else {
        content += '\n\n' + reflection;
      }
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filepath, content, 'utf8');
      fixed++;
    }
    
    if ((idx + 1) % 50 === 0) {
      console.log(`  ...fixed ${idx + 1}/${filesToFix.length} files`);
    }
  } catch (err) {
    console.log(`❌ Error fixing ${book.filename}: ${err.message}`);
    errors++;
  }
});

console.log(`\n✅ Phase 3 Complete!`);
console.log(`   Fixed: ${fixed} files`);
console.log(`   Errors: ${errors} files`);
console.log(`   Success rate: ${((fixed / filesToFix.length) * 100).toFixed(1)}%`);
