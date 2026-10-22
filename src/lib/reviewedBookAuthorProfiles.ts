/** Book-specific, human-edited author introductions for the Mastery tab.
 * Each record is anchored to a published book ID. Never expand this list using
 * title/author substitution or unreviewed biographical generation.
 */
export interface ReviewedBookAuthorProfile {
  bookId: string;
  title: string;
  author: string;
  language: "en" | "hi";
  text: string;
  sources: string[];
}

export const reviewedBookAuthorProfiles: ReviewedBookAuthorProfile[] = [
  {
    bookId: "cbec904d-f2e0-41bc-b3be-76f24571be23",
    title: "Crime and Punishment",
    author: "Fyodor Dostoevsky",
    language: "en",
    sources: [
      "https://www.penguin.co.in/book/crime-punishment/",
      "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Dostoievsky%2C_Feodor_Mikhailovich",
    ],
    text: `Fyodor Dostoevsky (1821–1881) wrote Crime and Punishment after a life already marked by literary success, political persecution, imprisonment and financial strain. Born in Moscow, he trained at a military engineering school but turned toward fiction. His debut novel, Poor Folk, attracted attention in 1846. He later became involved in an intellectual discussion circle; the Russian authorities arrested him, and he endured a staged execution before a sentence of imprisonment and exile in Siberia. These experiences do not explain every character he invented, but they sharpen the ethical questions that make his fiction distinctive.

Crime and Punishment, published in 1866, follows Rodion Raskolnikov, a former student living in poverty in Saint Petersburg. Rather than presenting his crime as the start of an ordinary detective story, Dostoevsky makes the reader inhabit a mind attempting to justify, conceal and survive its own actions. Raskolnikov's theory that certain extraordinary people may step beyond conventional morality becomes unstable when it meets actual suffering. The book is concerned with guilt, but also with pride, isolation, compassion and the limits of abstract reasoning.

The author's gift lies in allowing competing arguments to sound persuasive before exposing their human costs. Porfiry Petrovich's conversations with Raskolnikov resemble intellectual contests as much as an investigation. Sonia's presence offers an alternative moral vocabulary shaped by sacrifice and faith, yet she should not be reduced to a convenient symbol of redemption. Poverty and the city's crowded rooms matter because thought and action take place inside material circumstances. Dostoevsky asks readers to notice how an apparently coherent idea changes when another person's life becomes its consequence.

His later novels The Idiot, Demons and The Brothers Karamazov continued his exploration of belief, freedom and responsibility. His method was not to resolve every tension from above; it was to let contrary voices confront one another dramatically. The story also rewards attention to secondary characters whose lives reveal forms of suffering that Raskolnikov's narrow theory cannot explain. Their needs are not merely background to his intellectual crisis; they challenge the scale on which he measures human worth. While reading Crime and Punishment, distinguish Raskolnikov's arguments from Dostoevsky's own position and track moments when physical detail interrupts the hero's grand theories. That tension between self-justification and moral encounter is why this particular novel remains powerful: the punishment begins before any formal sentence, inside a consciousness that can no longer avoid what it has done.`,
  },
  {
    bookId: "c70c2ebb-8d7d-4d0d-b5cb-75c075b9962a",
    title: "Middlemarch",
    author: "George Eliot",
    language: "en",
    sources: [
      "https://www.penguinrandomhouse.com/authors/7953/george-eliot/",
      "https://www.oup.com.au/books/higher-education/literature/9780198815518",
    ],
    text: `George Eliot was the pen name of Mary Ann Evans (1819–1880), a major English novelist, editor and intellectual of the Victorian period. Her career included translation, journalism and editorial work before she emerged as a fiction writer. She chose a male literary name in a publishing culture that frequently interpreted women's novels through restrictive expectations. The name is historically important, but her achievement rests in the close attention she gave to how people think, misunderstand one another and grow within social limits.

Middlemarch appeared in parts in 1871–72 and is subtitled A Study of Provincial Life. Eliot sets its action in an English town during the years before the Reform Act of 1832. Through Dorothea Brooke, Tertius Lydgate and the people around them, she examines idealism meeting institutions: marriage, medicine, religion, property, class and local politics. Dorothea dreams of meaningful service but mistakes intellectual authority for genuine partnership. Lydgate wants to improve medical practice yet discovers that talent alone cannot protect him from money, reputation or compromise.

Eliot's distinctive method is patient moral observation. Her narrator can move from a character's private hope to the pressures exerted by neighbours who believe they already know that person's motives. This broad view invites empathy without suspending judgment. Even a seemingly minor act of gossip, generosity or vanity can alter another person's options. Readers should watch how Eliot distinguishes a person's intention from the effect of an action, and how the town's relationships create consequences nobody individually planned.

Her other notable novels include Adam Bede, The Mill on the Floss, Silas Marner and Daniel Deronda. Across these books she returned to sympathy, belonging, social duty and the difficulty of understanding lives unlike one's own. Middlemarch is especially ambitious because it makes several lives matter at once: there is no single heroic career that contains the whole meaning of the community.

When studying this book, avoid treating Dorothea or Lydgate simply as moral examples to copy. Ask instead how Eliot positions their hopes beside historical change and ordinary dependence on other people. Her authorial perspective turns a provincial setting into a laboratory of ethical complexity. The novel's enduring insight is that private aspirations become intelligible only when we also see the relationships and structures through which they must pass.`,
  },
  {
    bookId: "626ffdc1-1e71-4c5b-bfeb-132ed1c2c9ab",
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas",
    language: "en",
    sources: [
      "https://www.penguinrandomhouse.com/authors/7552/alexandre-dumas/",
      "https://www.penguinrandomhouse.com/books/43535/the-count-of-monte-cristo-by-alexandre-dumas/",
    ],
    text: `Alexandre Dumas (1802–1870), often called Dumas père to distinguish him from his playwright son, became one of nineteenth-century France's most successful storytellers. The son of General Thomas-Alexandre Dumas, he grew up with an unusually close family connection to the upheavals of the revolutionary and Napoleonic periods. He first won major attention through the theatre: his historical drama Henri III et sa cour was a success in 1829. He later turned historical episodes, invented intrigues and vividly drawn personalities into immensely popular serialized adventures.

The Count of Monte Cristo began appearing in the 1840s, when installment publication rewarded suspense, reversals and memorable endings. Its central figure, Edmond Dantès, is falsely accused, imprisoned and eventually transformed into a man capable of elaborate revenge. Dumas places his story against the political instability after Napoleon's fall. The novel's movement across prisons, ports, Parisian society and hidden fortunes makes private betrayal feel inseparable from public influence, patronage and social rank.

Dumas's storytelling has exceptional momentum, but speed is only one part of its appeal. The book repeatedly asks whether restoring justice permits a victim to become judge and executioner. Dantès gains knowledge, money and control over other people's circumstances; readers must assess what those advantages do to his sense of proportion. Mercy and unintended suffering complicate the satisfaction that a neatly executed revenge plot might otherwise provide. Notice the difference between what Dantès believes he is entitled to do and what the novel eventually reveals about the consequences.

Collaboration was central to Dumas's working practice; the writer Auguste Maquet contributed to the development of major narratives, including this one. It is important to acknowledge that history rather than imagine every scene arose from a single isolated genius. Dumas also wrote The Three Musketeers, Twenty Years After and other dramatic historical romances. His imagination made political history accessible through character, danger and emotion, even when fiction freely reshaped historical material.

For this Mastery reading, pay attention to the author's architecture: delayed revelations, changed identities and carefully planted obligations connect events separated by years. Then move beyond plot mechanics. Ask who can forgive, who can repay, and who suffers when another person pursues perfect retribution. Dumas's achievement is to make those ethical questions inseparable from the pleasures of adventure, so that an absorbing story becomes an inquiry into power and restraint.`,
  },
  {
    bookId: "b94e3f25-05e0-4c6a-a195-0e938fc7db4e",
    title: "कर्मभूमि",
    author: "मुंशी प्रेमचंद",
    language: "hi",
    sources: [
      "https://www.hindwi.org/ebooks/detail/karmabhoomi-ebooks",
      "https://www.rekhta.org/artists/premchand/profile",
    ],
    text: `मुंशी प्रेमचंद (1880–1936) को समझने के लिए ‘कर्मभूमि’ को केवल स्वतंत्रता आंदोलन की पृष्ठभूमि में लिखी कहानी मानना पर्याप्त नहीं है। प्रेमचंद का जन्म वाराणसी के पास लमही में हुआ। उनका मूल नाम धनपत राय था और उन्होंने हिंदी तथा उर्दू दोनों में लेखन किया। शिक्षक और शिक्षा विभाग के कर्मचारी के रूप में काम करने के अनुभव, पारिवारिक कठिनाइयों तथा बदलते राजनीतिक वातावरण ने उन्हें सामान्य लोगों की आर्थिक और नैतिक उलझनों के प्रति सजग बनाया। उन्होंने साहित्य में ऐसे पात्रों को केंद्र में रखा जिनकी आवाज़ प्रतिष्ठित सामाजिक संस्थाओं में अक्सर दब जाती थी।

‘कर्मभूमि’ में प्रेमचंद का ध्यान निजी चरित्र और सार्वजनिक जिम्मेदारी के संबंध पर है। यहाँ आंदोलन केवल नारों या नेताओं का इतिहास नहीं, बल्कि यह प्रश्न है कि सामाजिक अन्याय के सामने व्यक्ति अपना आचरण कैसे बदले। किसान, स्त्री, छात्र और धार्मिक समुदायों के अनुभव एक ही राजनीतिक क्षण में अलग-अलग प्रकार की कठिनाइयाँ पैदा करते हैं। इसीलिए पुस्तक पढ़ते समय एक पात्र के भाषण को पूरे उपन्यास का अंतिम संदेश मान लेने की गलती नहीं करनी चाहिए। प्रेमचंद विचारों की कसौटी उन कार्यों में ढूँढ़ते हैं जिनसे दूसरों का जीवन प्रभावित होता है।

लेखक ने औपनिवेशिक भारत में उभरते राष्ट्रीय आंदोलन को देखा था। 1921 में असहयोग आंदोलन के प्रभाव से उन्होंने सरकारी नौकरी छोड़ी। यह तथ्य ‘कर्मभूमि’ के राजनीतिक सवालों को संदर्भ देता है, पर उपन्यास को आत्मकथा नहीं बना देता। प्रेमचंद समाज-सुधार, शिक्षा, जातिगत असमानता और स्त्री की भूमिका जैसे मुद्दों को एक-दूसरे से जुड़ा हुआ दिखाते हैं। उनके यथार्थवाद का अर्थ यह नहीं कि हर पात्र सर्वदा विवेकपूर्ण है; कमजोरियाँ, अहंकार और अधूरी समझ भी सामाजिक परिवर्तन का हिस्सा बनती हैं।

‘सेवासदन’, ‘प्रेमाश्रम’, ‘रंगभूमि’, ‘गबन’ और ‘गोदान’ में भी प्रेमचंद ने व्यवस्था और व्यक्ति के संबंध को अलग-अलग कोणों से देखा। ‘गबन’ में प्रतिष्ठा तथा उपभोग का दबाव प्रमुख है, जबकि ‘गोदान’ में किसान के श्रम और कर्ज़ की त्रासदी गहरी होती है। ‘कर्मभूमि’ की विशिष्टता उसकी सक्रिय नागरिकता की चिंता है: अच्छे इरादे तब कितने सार्थक हैं जब सामाजिक जोखिम उठाने की बारी आती है?

इस रचना को पढ़ते हुए देखें कि पात्रों की नैतिक समझ किसी बहस से बदलती है या वास्तविक अनुभव से। साथ ही यह भी पूछें कि प्रेमचंद किन समूहों को बोलने देते हैं और किनकी पीड़ा दूसरे पात्रों के माध्यम से सामने आती है। ऐसी सावधान पढ़ाई लेखक के राजनीतिक विश्वास और उपन्यास की बहुविध मानवीय स्थितियों के बीच आवश्यक अंतर बनाए रखती है।`,
  },
  {
    bookId: "59bc4712-6bca-436a-bee9-4b6335823052",
    title: "गबन",
    author: "मुंशी प्रेमचंद",
    language: "hi",
    sources: [
      "https://rekhtabooks.com/hi/products/gaban-by-premchand",
      "https://www.rekhta.org/artists/premchand/profile",
    ],
    text: `मुंशी प्रेमचंद (1880–1936) ने हिंदी-उर्दू कथा-साहित्य को उन प्रश्नों के करीब पहुँचाया जो सामान्य परिवारों के दैनिक जीवन में छिपे रहते हैं। लमही में जन्मे धनपत राय ने आरंभिक उर्दू लेखन ‘नवाब राय’ नाम से किया और आगे चलकर प्रेमचंद के रूप में प्रसिद्ध हुए। अध्यापन, सामाजिक बदलाव और राष्ट्रीय चेतना के दौर से गुजरते हुए उन्होंने देखा कि व्यक्ति का नैतिक निर्णय केवल निजी गुण का प्रश्न नहीं होता; धन, दिखावा, प्रतिष्ठा तथा पारिवारिक अपेक्षाएँ उसे लगातार प्रभावित करती हैं। ‘गबन’ में यही दृष्टि घरेलू जीवन की बारीकियों के माध्यम से सामने आती है।

‘गबन’ का संसार ‘गोदान’ के किसानों या ‘रंगभूमि’ के भूमि-संघर्ष से अलग है। यहाँ रमानाथ और जालपा के संबंध में आभूषण, मान-सम्मान और आर्थिक सामर्थ्य का सवाल असाधारण महत्व ले लेता है। प्रेमचंद दिखाते हैं कि सामाजिक छवि बनाए रखने की इच्छा धीरे-धीरे बेईमानी के निर्णयों को कैसे सामान्य बना सकती है। फिर भी पुस्तक को ‘गहनों का लालच बुरा है’ जैसे एक वाक्य के उपदेश में समेटना उसके मनोवैज्ञानिक और सामाजिक स्तरों के साथ अन्याय होगा। पाठक को यह भी देखना चाहिए कि पुरुष-अहंकार, स्त्री से जुड़ी सामाजिक अपेक्षाएँ और उपभोग की संस्कृति कैसे एक-दूसरे को ताकत देते हैं।

प्रेमचंद पात्रों की आलोचना करते हुए भी उन्हें समझने की जगह देते हैं। रमानाथ की गलतियाँ केवल अचानक आए किसी प्रलोभन का परिणाम नहीं लगतीं; उनके पीछे अपनी वास्तविक स्थिति छिपाने की आदत और दूसरों की निगाहों में सफल दिखने की बेचैनी है। जालपा का रूपांतरण भी महत्वपूर्ण है, क्योंकि लेखक उसे स्थिर प्रतीक बनाकर नहीं छोड़ते। कथा में राष्ट्रीय आंदोलन और सामाजिक जिम्मेदारी की उपस्थिति निजी नैतिकता को बड़े सार्वजनिक प्रश्नों से जोड़ती है। यह परत जाँचती है कि बदलाव केवल पछतावे से आता है या व्यवहार और जिम्मेदारी में भी दिखना चाहिए।

‘निर्मला’ में विवाह, संदेह और असमान शक्ति का तनाव मिलता है; ‘सेवासदन’ में स्त्री की सामाजिक स्थिति का प्रश्न उठता है; ‘कर्मभूमि’ में सक्रिय नागरिकता प्रमुख हो जाती है। ‘गबन’ की अलग पहचान मध्यवर्गीय प्रतिष्ठा के उस जाल में है जहाँ साधन कम हैं, लेकिन दिखावे की माँग बड़ी है। लेखक यहाँ आर्थिक निर्णय की नैतिक कीमत को कहानी का केंद्र बनाते हैं।

पढ़ते समय रमानाथ के प्रत्येक महत्वपूर्ण निर्णय के सामने तीन बातें लिखें: वह क्या चाहता है, वह किससे डरता है और उस फैसले का जोखिम कौन उठाता है। फिर जालपा की दृष्टि से उन्हीं प्रसंगों पर लौटें। यह अभ्यास प्रेमचंद के यथार्थवादी लेखन की ताकत दिखाएगा—वे अपराध या प्रायश्चित से अधिक उस सामाजिक वातावरण को समझने के लिए प्रेरित करते हैं जिसमें दोनों संभव होते हैं।`,
  },
  {
    bookId: "e19bf759-5854-458a-bed1-d5b67c61740c",
    title: "रक्तकरबी",
    author: "रवींद्रनाथ ठाकुर",
    language: "hi",
    sources: [
      "https://ebooks.inflibnet.ac.in/engp09/chapter/rabindranath-tagore-theory-and-plays-post-office-muktadhara-rakta-karabi-chitra/",
      "https://india.oup.com/product/rabindranath-tagore-9780195653656/",
    ],
    text: `रवींद्रनाथ ठाकुर (1861–1941) को अक्सर ‘गीतांजलि’ और उनके गीतों के कारण याद किया जाता है, लेकिन ‘रक्तकरबी’ उनकी नाट्य-दृष्टि की विशिष्ट पहचान कराती है। बंगाली साहित्य में कविता, कथा, नाटक, संगीत और शिक्षा के क्षेत्र में सक्रिय ठाकुर ने मनुष्य की स्वतंत्रता और सृजनशीलता को बार-बार केंद्र में रखा। 1913 में साहित्य का नोबेल पुरस्कार मिलने से उनकी अंतरराष्ट्रीय पहचान बढ़ी, पर वे केवल विश्वप्रसिद्ध कवि नहीं थे; उनके नाटक सत्ता, भय, आत्मा और मानवीय संबंधों की जटिल पड़ताल करते हैं। ‘रक्तकरबी’ उसी व्यापक रचनात्मक यात्रा का हिस्सा है।

इस नाटक का स्थान यक्षपुरी है, जहाँ सोना निकालने का श्रम और राजा की अदृश्य सत्ता जीवन को नियंत्रित करते हैं। मजदूर मनुष्य कम और संख्या अधिक बनते जाते हैं। नंदिनी के आगमन से इस व्यवस्था में एक भिन्न संवेदना प्रवेश करती है: प्रेम, गीत, सहजता और किसी व्यक्ति को उसके उपयोग से आगे पहचानने की क्षमता। ठाकुर यहाँ यथार्थवादी सामाजिक रिपोर्ट नहीं लिखते। वे प्रतीक, मंचीय संवाद और वातावरण के माध्यम से पूछते हैं कि उत्पादन तथा अनुशासन की व्यवस्था कब मनुष्य की अस्मिता के विरुद्ध खड़ी हो जाती है।

‘रक्तकरबी’ पढ़ते समय ठाकुर की रचनात्मक भाषा पर विशेष ध्यान देना चाहिए। बंद दरवाजे, मुखौटे, सोने की चाह और फूल किसी सरल पहेली के निश्चित उत्तर नहीं हैं। वे विभिन्न पात्रों के अनुभवों में अलग अर्थ लेते हैं। राजा को केवल एक दुष्ट व्यक्ति और नंदिनी को केवल सद्गुण का संकेत मान लेने से नाटक की बेचैनी कम हो जाती है। असली प्रश्न यह भी है कि भय और व्यवस्था उन लोगों के भीतर कैसे बस जाते हैं जो स्वयं उससे पीड़ित हैं। इस दृष्टि से नाटक में मुक्ति केवल सत्ता-परिवर्तन नहीं, संवेदना लौटने की प्रक्रिया भी है।

ठाकुर के ‘डाकघर’ में भी बाहरी बंदिशों और खुली दुनिया की कल्पना का तनाव है। ‘मुक्तधारा’ तकनीकी शक्ति और जीवित समुदाय के रिश्ते पर विचार करता है। ‘रक्तकरबी’ इन प्रश्नों को श्रम, धन और मानवीय इच्छाओं के प्रतीकात्मक रंगमंच पर ले आता है। यही कारण है कि इसे केवल औद्योगिक व्यवस्था का विरोध कह देना पर्याप्त नहीं; यह उन संबंधों की खोज भी है जो मनुष्य को फिर से मनुष्य बनाते हैं।

इस पाठ में नंदिनी के संवादों और मजदूरों की पहचान के बीच अंतर को चिह्नित करें। देखें कि किस क्षण कोई पात्र संख्या या भूमिका से आगे बढ़कर अपनी आवाज़ पाता है। साथ ही लेखक की कविता और नाटक के फर्क को समझें: यहाँ विचारों को पात्रों के टकराव, मौन, संगीत और मंचीय प्रतीकों से अनुभव कराया जाता है। इस तरह ‘रक्तकरबी’ ठाकुर के मानवतावाद को सुंदर आदर्श की जगह कठिन नाटकीय प्रश्न बना देती है।`,
  },
];

export function findReviewedBookAuthorProfile(bookId: string): ReviewedBookAuthorProfile | undefined {
  return reviewedBookAuthorProfiles.find(profile => profile.bookId === bookId);
}
