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
  {
    bookId: "567693f2-e622-41b2-afeb-135497282d94",
    title: "रंगभूमि",
    author: "मुंशी प्रेमचंद",
    language: "hi",
    sources: [
      "https://india.oup.com/product/rangbhumi-the-arena-of-life-9780195667127/",
      "https://www.rekhta.org/artists/premchand/profile",
    ],
    text: `मुंशी प्रेमचंद (1880–1936) का साहित्य भारतीय समाज में सत्ता, गरीबी और मानवीय गरिमा की पड़ताल करता है। लमही में जन्मे धनपत राय ने उर्दू में ‘नवाब राय’ नाम से लिखना शुरू किया और बाद में प्रेमचंद के रूप में हिंदी-उर्दू कथा-जगत में व्यापक पहचान बनाई। उन्होंने अध्यापक तथा शिक्षा विभाग के कर्मचारी के रूप में काम किया। उनके जीवनकाल में औपनिवेशिक शासन, राष्ट्रीय आंदोलन और समाज-सुधार की बहसें तेज थीं। ‘रंगभूमि’ में इन सभी प्रश्नों की छाया है, लेकिन उपन्यास की शक्ति किसी राजनीतिक वक्तव्य को दोहराने में नहीं, बल्कि संघर्षरत मनुष्यों को पूरी जटिलता से दिखाने में है।

‘रंगभूमि’ का केंद्रीय पात्र सूरदास एक दृष्टिहीन भिक्षुक है, जिसके पास ऐसी भूमि है जिस पर प्रभावशाली लोग अधिकार चाहते हैं। प्रेमचंद इस स्थिति को संपत्ति के साधारण विवाद की तरह प्रस्तुत नहीं करते। भूमि यहाँ रोज़गार, समुदाय, निजी अस्तित्व और निर्णय की स्वतंत्रता का प्रश्न बन जाती है। औद्योगिक विकास तथा सार्वजनिक हित का दावा करने वाले पात्र भी कहानी में मौजूद हैं। पाठक के लिए जरूरी है कि वह उनके तर्कों को सुनकर पूछे कि प्रस्तावित लाभ किसे मिलेगा और जोखिम किसके हिस्से आएगा।

सूरदास का चरित्र लेखक के नैतिक साहस की कल्पना को सामने लाता है, फिर भी उसे निर्दोष प्रतीक समझ लेना उपन्यास को सरल बना देगा। प्रेमचंद मानवीय संबंधों, धार्मिक पहचान, प्रशासनिक शक्ति और सामाजिक पदानुक्रम के बीच उसकी सीमाएँ तथा दृढ़ता दोनों दिखाते हैं। उपन्यास का विस्तृत आकार भी उद्देश्यपूर्ण है: अलग वर्गों और संस्थाओं के लोग एक ही संघर्ष को अलग हितों से देखते हैं। इस तरह ‘रंगभूमि’ बताती है कि अन्याय केवल किसी एक खलनायक की इच्छाशक्ति से नहीं, बल्कि कई सामान्य दिखाई देने वाली प्रक्रियाओं से भी बनता है।

प्रेमचंद की अन्य रचनाओं से तुलना इस पुस्तक की विशिष्टता स्पष्ट करती है। ‘गबन’ में प्रतिष्ठा और आर्थिक छल का दबाव सामने है, ‘कर्मभूमि’ में जन-आंदोलन तथा नागरिक आचरण का प्रश्न, और ‘गोदान’ में किसान के श्रम, कर्ज़ तथा सम्मान का संघर्ष। ‘रंगभूमि’ में निजी भूमि पर बाहरी अधिकार की कोशिश सामाजिक-राजनीतिक व्यवस्था की व्यापक आलोचना में बदल जाती है। लेखक की सहानुभूति वंचित के साथ है, पर वे विरोधी तर्कों को भी कथा से पूरी तरह गायब नहीं करते।

इस पुस्तक को पढ़ते समय सूरदास की बातों को उसके कार्यों के साथ मिलाएँ। विकास के दावों में छिपी आर्थिक भाषा को पहचानें और अलग-अलग पात्रों की शक्ति की तुलना करें। साथ ही विचार करें कि दृष्टिहीनता लेखक के लिए संवेदना जगाने का साधन भर है या सूरदास की स्वतंत्र नैतिक दृष्टि को सामने लाने का एक विरोधाभासी साहित्यिक तरीका। यही प्रश्न प्रेमचंद के यथार्थवाद को आज के भूमि, विस्थापन और न्याय संबंधी विमर्श से जोड़ते हैं।`,
  },
  {
    bookId: "377afb77-5d5a-4738-9cfe-1413756cfd41",
    title: "सेवासदन",
    author: "मुंशी प्रेमचंद",
    language: "hi",
    sources: [
      "https://india.oup.com/product/sevasadan-9780195696585/",
      "https://fingerprintpublishing.com/book-details/sevasadan-hindi",
    ],
    text: `मुंशी प्रेमचंद (1880–1936) ने अपने कथा-साहित्य में उन सामाजिक नियमों की जाँच की जिन्हें अक्सर परिवार और समुदाय स्वाभाविक मान लेते हैं। उनका जन्म वाराणसी के निकट लमही में हुआ था और मूल नाम धनपत राय था। वे हिंदी तथा उर्दू में लिखते थे; आरंभिक लेखन ‘नवाब राय’ नाम से प्रकाशित हुआ। अध्यापन, आर्थिक संघर्ष और सामाजिक परिवर्तन के अनुभवों ने उन्हें यह देखने की दृष्टि दी कि नैतिकता के सार्वजनिक नियम कई बार स्त्रियों और गरीब परिवारों पर असमान बोझ डालते हैं। ‘सेवासदन’ में यह चिंता उनके प्रारंभिक उपन्यासकार रूप को विशेष पहचान देती है।

‘सेवासदन’ की नायिका सुमन के जीवन के माध्यम से प्रेमचंद विवाह, दहेज, सम्मान, यौन नैतिकता और स्त्री की स्वतंत्रता पर गंभीर प्रश्न उठाते हैं। कथा उस समाज को देखती है जहाँ किसी महिला के निर्णयों पर कठोर फैसला सुनाना आसान है, लेकिन उसके सामने उपलब्ध विकल्पों को समझना कठिन। प्रेमचंद का साहस इसी दूसरे प्रश्न को मुख्य बनाना है। पाठक को सुमन की स्थिति पर केवल दया करने के बजाय यह जाँचना चाहिए कि आर्थिक निर्भरता, घर की अपेक्षाएँ और सामाजिक प्रतिष्ठा उसकी इच्छाओं को कैसे सीमित करती हैं।

यह उपन्यास सामाजिक सुधार के आग्रह से जुड़ा है, पर इसे सीधे नीति-पत्र की तरह पढ़ना ठीक नहीं होगा। कथा में मनुष्यों की आकांक्षाएँ, ईर्ष्या, अपमान, भ्रम और निर्णय मौजूद हैं। प्रेमचंद सार्वजनिक सदाचार की भाषा और निजी व्यवहार के बीच का अंतर उजागर करते हैं। वही समाज जो स्त्री के जीवन पर निगरानी रखता है, उसके लिए सुरक्षित और गरिमापूर्ण रास्ते बनाने में अक्सर असफल होता है। इस विरोधाभास को समझना लेखक की आलोचना का महत्वपूर्ण हिस्सा है।

प्रेमचंद की साहित्यिक यात्रा में ‘सेवासदन’ उस बिंदु पर आता है जहाँ सामाजिक प्रश्न उपन्यास की संरचना के केंद्र में हैं। ‘निर्मला’ में विवाह और अविश्वास की त्रासदी एक दूसरे कोण से सामने आती है; ‘गबन’ में मध्यवर्गीय दिखावा और आर्थिक नैतिकता प्रमुख होते हैं। ‘गोदान’ में श्रम तथा ऋण के दबाव व्यापक ग्रामीण संसार को रचते हैं। इन पुस्तकों में विषय अलग हैं, पर लेखक बार-बार पूछते हैं कि व्यक्ति को दोष देने से पहले उसकी परिस्थितियों को कितना समझना चाहिए।

‘सेवासदन’ को पढ़ते समय सुमन के बारे में दूसरे पात्र जो निर्णय देते हैं, उन्हें उसके वास्तविक अनुभवों से अलग लिखें। देखें कि कथानक में आर्थिक स्वतंत्रता और सामाजिक सम्मान कभी साथ चलते हैं या एक-दूसरे के विरुद्ध हो जाते हैं। उपन्यास के ऐतिहासिक संदर्भ और आज के सामाजिक प्रश्नों के बीच समानताएँ पहचानते समय अंतर भी ध्यान में रखें। इस सावधानी से प्रेमचंद का लेखक-परिचय मात्र प्रशंसा नहीं रहता; वह स्त्री की गरिमा, सामाजिक दोहरे मानदंड और सुधार की सीमाओं पर गंभीर विचार का आरंभ बनता है।`,
  },
  {
    bookId: "01400c5e-655d-48d7-9b5a-0d7335baa3e1",
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    language: "en",
    sources: [
      "https://www.penguinrandomhouse.com/books/77010/a-brief-history-of-time-by-stephen-hawking/",
      "https://www.penguinrandomhouse.com/books/77019/the-illustrated-a-brief-history-of-time-by-stephen-hawking/",
    ],
    text: `Stephen Hawking (1942–2018) was a British theoretical physicist whose research and public writing changed how many non-specialists encountered cosmology. Educated at Oxford and Cambridge, he investigated gravity, black holes and the behaviour of the universe on the largest scales. His scientific work connected general relativity with quantum ideas, most famously through the prediction that black holes can emit radiation. Living for decades with motor neurone disease, he also became a highly visible public intellectual. Neither his medical history nor his celebrity should overshadow the mathematical and conceptual work behind his contributions.

A Brief History of Time was first published in 1988. Its central ambition is remarkable: to guide a curious general reader through questions about the origin, structure and possible fate of the universe without relying heavily on equations. Hawking explains why scientists developed models of cosmic expansion, what a black hole is, why time appears to have a direction, and where familiar descriptions become inadequate. He presents not a finished account of everything but a map of questions that physics was still struggling to answer.

The author's voice combines confidence in scientific inquiry with awareness of its limitations. A theory can organize observations and make predictions, yet it is not identical with the universe itself. Hawking moves between established results, active hypotheses and philosophical questions about explanation. Readers should preserve those distinctions. In particular, discussions of singularities, the beginning of time and a possible unified theory depend on assumptions that scientists may revise as evidence and mathematical understanding improve.

Hawking later wrote The Universe in a Nutshell, Black Holes and Baby Universes, and, with collaborators, books intended to make complex science more approachable. A Brief History of Time remains his most influential popular introduction because it joins difficult physics to basic human curiosity. Its accessible analogies have great teaching value, but analogies are not substitutes for precise claims; they are stepping stones toward better questions.

For Mastery, study the book as both a scientific explanation and an artifact of its era. Note which claims describe observation, which describe mathematical models, and which express open problems in 1988. Contemporary cosmology has continued to develop, so do not treat the book as an up-to-date textbook in every detail. The enduring lesson from Hawking's writing is methodological: even the largest questions become more useful when framed so that reasoning and evidence can challenge our first intuitions.`,
  },
  {
    bookId: "b49bf80d-9cde-4e4f-a561-059f758b8556",
    title: "Antifragile: Things That Gain from Disorder",
    author: "Nassim Nicholas Taleb",
    language: "en",
    sources: [
      "https://www.penguinrandomhouse.com/books/176227/antifragile-by-nassim-nicholas-taleb/",
      "https://www.penguin.co.uk/books/56655/antifragile-by-taleb-nassim-nicholas/9780718197902",
    ],
    text: `Nassim Nicholas Taleb is a writer and former options trader whose work examines uncertainty, chance, risk and the limits of prediction. His books ask why people become confident in explanations built from incomplete evidence, particularly when rare events can have enormous consequences. Before Antifragile, Fooled by Randomness explored our tendency to mistake luck for skill, while The Black Swan examined unexpected events and the stories invented after they occur. These books belong to his broader Incerto project, an interconnected investigation rather than a set of simple motivational formulas.

Antifragile: Things That Gain from Disorder develops a distinction that is easy to repeat but harder to apply. The fragile suffers when subjected to certain stresses; the robust withstands them; the antifragile can benefit from some variation, shocks or volatility. Taleb uses examples from biology, business, finance and everyday decisions to suggest that systems may improve through exposure to limited stress. Yet the argument is not that every crisis is beneficial. The size of the shock, the distribution of risk and the possibility of irreversible ruin all matter.

Taleb's style is deliberately provocative. He mixes mathematical intuition, historical anecdotes, polemic and practical rules, often challenging credentialed experts who underestimate uncertainty. This makes the book stimulating but also demands an alert reader. Distinguish an illustrative story from evidence that an intervention actually works. Test whether a supposed antifragile arrangement benefits the people taking the risks or merely protects a powerful decision-maker who can transfer losses to others.

One recurring concern in the author's work is asymmetry: gaining from favourable outcomes while limiting exposure to catastrophic ones. Optionality, small experiments and avoiding ruin connect the theoretical idea with practical choice. His discussion of skin in the game raises a related ethical question about who bears consequences. Readers need not accept every example or rhetorical attack to appreciate the discipline of looking closely at payoff structures rather than trusting a single forecast.

When studying this particular book, make three columns for fragile, robust and antifragile responses in a real situation. Specify the stress involved and ask what happens at both modest and extreme levels. Do not confuse survivorship with proof that disorder creates progress. Taleb's lasting contribution here is a vocabulary for judging exposure to uncertainty and recognizing situations where excessive efforts to remove all variation may create a deeper, less visible vulnerability.`,
  },
];

export function findReviewedBookAuthorProfile(bookId: string): ReviewedBookAuthorProfile | undefined {
  return reviewedBookAuthorProfiles.find(profile => profile.bookId === bookId);
}
