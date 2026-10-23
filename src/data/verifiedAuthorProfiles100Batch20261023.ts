/**
 * Author-level editorial biographies, independently researched on 23 October 2026.
 * Each biography is original, roughly 100 words, and backed by the URLs below.
 * Works are attributed to the AUTHOR, not asserted to be in the Booknomics catalogue.
 * Keep this dataset separate from the longer, book-specific Mastery biographies.
 */
export interface VerifiedAuthorProfile100 {
  author: string;
  language: "en" | "hi";
  biography: string;
  famousBooks: readonly string[];
  sources: readonly string[];
}

export const verifiedAuthorProfiles100Batch20261023: readonly VerifiedAuthorProfile100[] = [
  {
    author: "Stephen King",
    language: "en",
    biography: "Stephen King was born in Portland, Maine, in 1947 and grew up partly in Durham, Maine. He studied English at the University of Maine and worked as a teacher before Carrie, his first published novel, brought him a wider readership in 1974. King writes horror, suspense, fantasy and stories about ordinary lives disrupted by extraordinary events. His fictional Maine towns frequently reflect the communities he knows. The Shining examines isolation and family violence; The Stand imagines a society devastated by a pandemic; It follows childhood fears that return in adulthood. His career also includes the Dark Tower series and works adapted for film and television.",
    famousBooks: ["Carrie", "The Shining", "The Stand", "It"],
    sources: ["https://stephenking.com/the-author/", "https://stephenking.com/works/"],
  },
  {
    author: "Agatha Christie",
    language: "en",
    biography: "Agatha Christie was born in Torquay, England, in 1890. During the First World War, work in a dispensary gave her practical knowledge of medicines and poisons, which later enriched her crime plots. She published 66 detective novels and created two enduring investigators: Hercule Poirot and Miss Marple. The Murder of Roger Ackroyd became an early breakthrough, while Murder on the Orient Express and Death on the Nile display her skill with clues, motives and misdirection. And Then There Were None uses an isolated setting to sustain suspense without either famous detective. Christie also wrote the long-running stage play The Mousetrap. She died in 1976.",
    famousBooks: ["The Murder of Roger Ackroyd", "Murder on the Orient Express", "And Then There Were None", "Death on the Nile"],
    sources: ["https://www.agathachristie.com/en/about-christie", "https://www.agathachristie.com/en/stories/and-then-there-were-none"],
  },
  {
    author: "William Shakespeare",
    language: "en",
    biography: "William Shakespeare was born in Stratford-upon-Avon in 1564 and died there in 1616. He married Anne Hathaway and later established a career as an actor and playwright in London. He belonged to the Lord Chamberlain's Men, the company subsequently known as the King's Men. His plays range from romantic comedy to histories of political power and tragedies of ambition, jealousy and grief. Hamlet explores revenge and uncertainty; Macbeth examines destructive ambition; Romeo and Juliet portrays love amid family conflict. He also wrote sonnets and narrative poems. Fellow actors preserved many plays in the First Folio published after his death, helping secure their continuing theatrical life.",
    famousBooks: ["Hamlet", "Macbeth", "Romeo and Juliet", "A Midsummer Night's Dream"],
    sources: ["https://www.shakespeare.org.uk/explore-shakespeare/shakespedia/william-shakespeare/william-shakespeare-biography/", "https://www.rsc.org.uk/shakespeares-plays"],
  },
  {
    author: "Isaac Asimov",
    language: "en",
    biography: "Isaac Asimov (1920–1992) was a Russian-born American writer and biochemist whose enormous output spanned science fiction, popular science and history. His Foundation stories consider how knowledge and institutions might survive the decline of a vast galactic empire. In I, Robot and related stories, he developed the influential Three Laws of Robotics as a framework for ethical and logical conflicts involving machines. The Caves of Steel combines detective fiction with a future society shaped by robots; The Gods Themselves won major science-fiction recognition. Asimov's accessible explanations made him an important science communicator alongside his work as a novelist and short-story writer.",
    famousBooks: ["Foundation", "I, Robot", "The Caves of Steel", "The Gods Themselves"],
    sources: ["https://www.penguinrandomhouse.com/authors/947/isaac-asimov/", "https://us.macmillan.com/author/isaacasimov/"],
  },
  {
    author: "सुमित्रानंदन पंत",
    language: "hi",
    biography: "सुमित्रानंदन पंत (1900–1977) का जन्म उत्तराखंड के कौसानी में हुआ। हिमालयी प्रकृति ने उनके शुरुआती काव्य-बिंबों को गहराई से प्रभावित किया। वे हिंदी के छायावाद आंदोलन के प्रमुख कवियों में गिने जाते हैं। उनके आरंभिक संग्रह ‘वीणा’, ‘पल्लव’ और ‘गुंजन’ सौंदर्य, संवेदना और प्रकृति के लिए प्रसिद्ध हैं। आगे चलकर उनकी कविता में सामाजिक परिवर्तन, मनुष्य का श्रम और दार्शनिक प्रश्न भी आए। ‘ग्राम्या’ में ग्रामीण जीवन की ओर झुकाव दिखाई देता है। ‘कला और बूढ़ा चाँद’ के लिए उन्हें साहित्य अकादेमी पुरस्कार और ‘चिदंबरा’ के लिए ज्ञानपीठ पुरस्कार मिला। उनकी रचनात्मक यात्रा एक ही काव्य-दृष्टि तक सीमित नहीं रही।",
    famousBooks: ["पल्लव", "गुंजन", "ग्राम्या", "चिदंबरा"],
    sources: ["https://www.hindwi.org/poets/sumitranandan-pant/profile", "https://www.hindwi.org/poets/sumitranandan-pant"],
  },
  {
    author: "महादेवी वर्मा",
    language: "hi",
    biography: "महादेवी वर्मा (1907–1987) हिंदी छायावाद की प्रमुख कवयित्री, गद्यकार और शिक्षाविद् थीं। फ़र्रुख़ाबाद में जन्मी महादेवी ने संस्कृत का अध्ययन किया और प्रयाग महिला विद्यापीठ के संचालन से जुड़ी रहीं। उन्होंने ‘चाँद’ पत्रिका का संपादन भी किया। उनकी कविता में करुणा, आत्मचिंतन, विरह, प्रकृति और सूक्ष्म अनुभूतियों की विशेष अभिव्यक्ति मिलती है। ‘नीहार’, ‘रश्मि’, ‘नीरजा’ और ‘दीपशिखा’ उनके महत्वपूर्ण काव्य-संग्रह हैं; ‘यामा’ उनकी काव्य-यात्रा की उल्लेखनीय कृति है। गद्य में उन्होंने स्त्रियों की स्थिति तथा मनुष्यों और पशु-पक्षियों के संबंधों पर संवेदनशील लेखन किया। उन्हें ज्ञानपीठ और साहित्य अकादेमी फेलोशिप जैसे सम्मान मिले।",
    famousBooks: ["नीहार", "नीरजा", "यामा", "दीपशिखा"],
    sources: ["https://www.penguin.co.in/book_author/mahadevi-varma/", "https://www.hindwi.org/poets/mahadevi-varma/profile"],
  },
  {
    author: "कृष्णा सोबती",
    language: "hi",
    biography: "कृष्णा सोबती (1925–2019) आधुनिक हिंदी कथा-साहित्य की विशिष्ट लेखिका थीं। उनका जन्म अविभाजित पंजाब के गुजरात नगर में हुआ था। उनके उपन्यासों और लंबी कहानियों में बोलचाल की सजीव भाषा, स्त्रियों की इच्छाएँ, सामाजिक प्रतिबंध और बदलती सांस्कृतिक पहचान प्रमुख हैं। ‘मित्रो मरजानी’ स्त्री की स्पष्ट आवाज़ के लिए और ‘ज़िंदगीनामा’ पंजाब के सामुदायिक जीवन के व्यापक चित्रण के लिए पहचानी जाती है। ‘दिलो-दानिश’ और ‘समय सरगम’ उनकी अन्य उल्लेखनीय रचनाएँ हैं। ‘ज़िंदगीनामा’ के लिए उन्हें 1980 में साहित्य अकादेमी पुरस्कार मिला। आगे चलकर उन्हें साहित्य अकादेमी फेलोशिप और 2017 का ज्ञानपीठ सम्मान प्राप्त हुआ।",
    famousBooks: ["मित्रो मरजानी", "ज़िंदगीनामा", "दिलो-दानिश", "समय सरगम"],
    sources: ["https://www.penguin.co.in/book_author/krishna-sobti/", "https://www.hindwi.org/poets/krishna-sobti-1/profile"],
  },
  {
    author: "अज्ञेय",
    language: "hi",
    biography: "अज्ञेय (1911–1987) का मूल नाम सच्चिदानंद हीरानंद वात्स्यायन था। वे हिंदी के कवि, उपन्यासकार, संपादक और प्रयोगशील आधुनिक साहित्य के प्रमुख स्वर थे। स्वतंत्रता आंदोलन से जुड़ी गतिविधियों के कारण उन्हें ब्रिटिश शासन में कारावास का अनुभव हुआ। उनके उपन्यास ‘शेखर : एक जीवनी’ में विद्रोह, आत्मविश्लेषण और व्यक्ति के भीतर के संघर्ष उभरते हैं; ‘नदी के द्वीप’ संबंधों और आधुनिक संवेदना पर केंद्रित है। उन्होंने ‘तार सप्तक’ का संपादन करके नई काव्य-प्रवृत्तियों को मंच दिया। ‘आँगन के पार द्वार’ के लिए साहित्य अकादेमी पुरस्कार और ‘कितनी नावों में कितनी बार’ के लिए ज्ञानपीठ पुरस्कार मिला।",
    famousBooks: ["शेखर : एक जीवनी", "नदी के द्वीप", "आँगन के पार द्वार", "कितनी नावों में कितनी बार"],
    sources: ["https://www.penguin.co.in/book_author/agyeya/", "https://www.hindwi.org/ebooks/detail/shekhar-ek-jeevani-part-002-ebooks/"],
  },
  {
    author: "सूर्यकांत त्रिपाठी निराला",
    language: "hi",
    biography: "सूर्यकांत त्रिपाठी ‘निराला’ (1896–1961) छायावाद के महत्वपूर्ण कवि और मौलिक गद्यकार थे। बंगाल के महिषादल क्षेत्र में जन्मे निराला ने हिंदी, संस्कृत और बांग्ला साहित्य का गहरा अध्ययन किया। जीवन में पारिवारिक शोक और आर्थिक संघर्ष ने उनकी संवेदना को तीखा बनाया। उन्होंने कविता में मुक्तछंद और नई अभिव्यक्ति के प्रयोग किए। ‘सरोज-स्मृति’ व्यक्तिगत शोक से, ‘राम की शक्ति-पूजा’ संघर्ष और संकल्प से जुड़ी प्रसिद्ध कविताएँ हैं। ‘अनामिका’, ‘परिमल’ और ‘गीतिका’ महत्वपूर्ण काव्य-संग्रह हैं। गद्य में ‘कुल्ली भाट’ और ‘बिल्लेसुर बकरिहा’ उनके सामाजिक व्यंग्य तथा स्थापित मान्यताओं पर सवाल उठाने की दृष्टि दिखाते हैं।",
    famousBooks: ["अनामिका", "परिमल", "गीतिका", "कुल्ली भाट"],
    sources: ["https://www.penguin.co.in/book_author/nirala-suryakant-tripathi/", "https://www.hindwi.org/poets/surykant-tripathi-nirala/profile"],
  },
  {
    author: "स्वामी विवेकानंद",
    language: "hi",
    biography: "स्वामी विवेकानंद (1863–1902) वेदांत के प्रमुख आधुनिक व्याख्याता और रामकृष्ण परमहंस के शिष्य थे। उनका जन्म कोलकाता में नरेंद्रनाथ दत्त के रूप में हुआ। 1893 में शिकागो की विश्व धर्म संसद में उनके भाषण ने उन्हें अंतरराष्ट्रीय पहचान दिलाई। उन्होंने आध्यात्मिक साधना को सेवा, शिक्षा, आत्मविश्वास और सामाजिक उत्तरदायित्व से जोड़ा। रामकृष्ण मठ और मिशन के संगठन में उनकी केंद्रीय भूमिका रही। उनके भाषणों तथा शिक्षाओं का संकलन ‘कर्मयोग’, ‘राजयोग’, ‘ज्ञानयोग’ और ‘भक्तियोग’ जैसे प्रसिद्ध ग्रंथों में मिलता है। ये पुस्तकें अलग-अलग योगमार्गों और आध्यात्मिक चिंतन को समझाती हैं। उनके विचारों को पढ़ते समय ऐतिहासिक संदर्भ भी ध्यान में रखना उपयोगी है।",
    famousBooks: ["कर्मयोग", "राजयोग", "ज्ञानयोग", "भक्तियोग"],
    sources: ["https://ramakrishna.org/vivekananda.html", "https://www.ramakrishnavivekananda.info/vivekananda/master_index.htm"],
  },
];
