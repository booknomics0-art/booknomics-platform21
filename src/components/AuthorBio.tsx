import { useEffect, useState } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { findReviewedAuthorProfile } from "@/lib/reviewedHindiAuthors";
import { findReviewedBookAuthorProfile } from "@/lib/reviewedBookAuthorProfiles";

interface Props { bookId?: string; author: string; category: string; title?: string; isHindi?: boolean }
interface OtherWork { title: string; slug: string; seo_slug: string | null }

const isPremchand = (name: string) =>
  /प्रेमचंद|premchand|prem chand/i.test(name);

// Source-checked editorial profile. Further authors must be verified individually;
// do not invent biographies or bibliography by reusing a generic author template.
const premchandBio = {
  hi: "मुंशी प्रेमचंद का जन्म 31 जुलाई 1880 को वाराणसी के पास लमही गाँव में हुआ था। उनका मूल नाम धनपत राय श्रीवास्तव था। हिंदी और उर्दू में लिखने वाले प्रेमचंद ने भारतीय कथा-साहित्य को ऐसे सामान्य लोगों के अनुभवों से जोड़ा जिन्हें अक्सर बड़ी ऐतिहासिक कथाओं में कम जगह मिलती थी। उनकी कहानियों और उपन्यासों में किसान, छोटे कर्मचारी, स्त्रियाँ, मजदूर तथा आर्थिक और सामाजिक दबाव से जूझते परिवार बार-बार दिखाई देते हैं। वे पात्रों की कमजोरियों को छिपाते नहीं, लेकिन उनकी परिस्थितियों और मानवीय गरिमा को भी गंभीरता से लेते हैं।\n\nप्रेमचंद का बचपन पारिवारिक कठिनाइयों में बीता। कम उम्र में उनकी माँ का निधन हो गया। उन्होंने पढ़ाई जारी रखते हुए शिक्षण से आजीविका शुरू की और लंबे समय तक शिक्षा विभाग से जुड़े रहे। आरंभिक लेखन उर्दू में 'नवाब राय' नाम से हुआ; बाद में 'प्रेमचंद' नाम ने उन्हें हिंदी-उर्दू के पाठकों में व्यापक पहचान दिलाई। उनकी साहित्यिक यात्रा उस दौर में आगे बढ़ी जब औपनिवेशिक शासन, राष्ट्रीय आंदोलन और समाज-सुधार के प्रश्न सार्वजनिक जीवन को बदल रहे थे। 1921 में असहयोग आंदोलन के प्रभाव से उन्होंने सरकारी नौकरी छोड़ दी।\n\nउनका साहित्य केवल सुधार के नारे नहीं देता। वे इस बात को देखते हैं कि कोई व्यक्ति सही निर्णय लेना भी चाहे तो गरीबी, कर्ज़, जातिगत ऊँच-नीच, पितृसत्ता और प्रतिष्ठा का दबाव उसके चुनावों को कैसे सीमित करता है। 'सेवासदन' में स्त्री के जीवन और सामाजिक नैतिकता के सवाल हैं; 'निर्मला' में विवाह और पारिवारिक अविश्वास की त्रासदी उभरती है; 'गबन' में दिखावे, लालसा और जिम्मेदारी के द्वंद्व को जगह मिलती है। 'रंगभूमि' तथा 'कर्मभूमि' में सामाजिक संघर्ष और सत्ता-संबंध दिखाई देते हैं। उनकी प्रसिद्ध कहानियाँ 'ईदगाह', 'पूस की रात', 'शतरंज के खिलाड़ी' और 'कफन' विभिन्न वर्गों के जीवन को अलग-अलग दृष्टियों से देखने का अवसर देती हैं।\n\n1936 में प्रकाशित 'गोदान' उनकी अंतिम पूर्ण उपन्यास-कृतियों में प्रमुख है। होरी और धनिया के माध्यम से यह उपन्यास किसान की इच्छा, श्रम, कर्ज़ और सामाजिक सम्मान के बीच का कठोर तनाव सामने रखता है। प्रेमचंद का महत्त्व इस बात में भी है कि उन्होंने आदर्शवाद और यथार्थवाद के बीच संवाद बनाए रखा: मनुष्य बेहतर जीवन चाहता है, लेकिन व्यवस्था हमेशा उसे अवसर नहीं देती। वे 'हंस' सहित साहित्यिक पत्रिकाओं के संपादन और प्रकाशन से भी जुड़े रहे। 8 अक्टूबर 1936 को उनका निधन हुआ। उनकी रचनाओं को पढ़ते समय लेखक की वैचारिक दृष्टि और पात्रों के अपने अनुभवों के बीच अंतर बनाए रखना उपयोगी है; इससे कहानी उपदेश नहीं, समाज के जटिल प्रश्नों की जाँच बनती है।",
  en: "Munshi Premchand was born on 31 July 1880 in Lamhi, a village near Varanasi, and died on 8 October 1936. His birth name was Dhanpat Rai Shrivastava. Writing in both Hindi and Urdu, he helped shape modern North Indian prose fiction by placing ordinary people at the centre of serious literary attention. Farmers, women, workers, clerks, debt-ridden households, and families struggling with status and duty populate his stories. He neither treats them as flawless heroes nor reduces them to examples of a single moral lesson.\n\nPremchand grew up amid economic and family difficulties. His mother died during his childhood, and he worked as a teacher while continuing his education and literary development. His early Urdu writing appeared under the name Nawab Rai before he became widely known as Premchand. His career unfolded during colonial rule, when debates about education, reform, national identity, and social inequality increasingly shaped public discussion. In 1921, influenced by the Non-Cooperation Movement, he left government service. His writing and editorial activities continued to engage with the political and ethical questions of his time.\n\nOne of Premchand's lasting achievements was to connect private decisions with the pressures of social institutions. An individual might wish to act fairly, but debt, caste hierarchy, gender expectations, family reputation, or bureaucratic power can restrict the choices available. Sevasadan examines women's lives and the contradictions of public morality. Nirmala explores the tragic effects of marriage arrangements, suspicion, and unequal power within a family. Gaban considers desire, social display, and responsibility. Rangbhoomi and Karmabhoomi broaden the view toward power, conflict, and collective action. His short stories, including Idgah, Poos Ki Raat, Shatranj Ke Khiladi, and Kafan, show how very different settings can reveal difficult truths about human relationships.\n\nGodaan, published in 1936, is among his most influential final novels. Through Hori, Dhaniya, and their community, it explores a farmer's hopes and the relentless demands of debt, labor, customary obligation, and social honor. The novel is more than a description of rural poverty: it asks how economic structures shape moral possibilities. Premchand also participated in literary publishing and editing, notably through the journal Hans, contributing to wider conversation around Hindi and Urdu literature.\n\nA useful way to read Premchand is to distinguish the author's sympathetic social perspective from the individual voices, motives, and limitations of his characters. His work invites readers to assess both personal agency and systemic constraint. This combination of realism, ethical concern, and attention to ordinary lives explains why his fiction remains central to discussions of modern Indian literature.",
  source: "https://www.rekhta.org/artists/premchand/profile",
};

export const AuthorBio = ({ bookId, author, category, title, isHindi = false }: Props) => {
  const [otherWorks, setOtherWorks] = useState<OtherWork[]>([]);
  useEffect(() => {
    let active = true;
    setOtherWorks([]);
    if (!author?.trim()) return () => { active = false; };
    supabase.from("books")
      .select("title,slug,seo_slug")
      .eq("author", author)
      .eq("is_draft", false)
      .eq("status", "published")
      .limit(12)
      .then(({ data }) => {
        if (active) setOtherWorks(((data || []) as OtherWork[])
          .filter((work) => work.title !== title)
          .filter((work, index, array) => array.findIndex((other) => other.title === work.title) === index)
          .slice(0, 5));
      });
    return () => { active = false; };
  }, [author, title]);

  const bookProfile = bookId ? findReviewedBookAuthorProfile(bookId) : undefined;
  const reviewedProfile = isPremchand(author) ? premchandBio : findReviewedAuthorProfile(author);
  const reviewed = Boolean(bookProfile || reviewedProfile);
  const sources = bookProfile?.sources ?? (reviewedProfile ? [reviewedProfile.source] : []);
  return (
    <section className="pt-2 pb-6 scroll-mt-28" aria-labelledby="author-bio">
      <div className="text-xs tracking-[0.14em] text-primary font-semibold mb-3">
        {isHindi ? "रचना और रचनाकार" : "About the author"}
      </div>
      <h2 id="author-bio" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-4">
        {isHindi ? `लेखक परिचय: ${author}` : `About ${author}`}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{isHindi ? "लेखक और प्रमुख कृतियाँ" : "The author and their works"}</span>
          </div>
          <p className="text-base text-foreground/90 leading-7 whitespace-pre-line">
            {bookProfile?.text ?? (reviewedProfile ? (isHindi ? reviewedProfile.hi : reviewedProfile.en) : (
              isHindi
                ? `${author} इस पुस्तक के रचनाकार हैं। यह कृति ${category} विधा से संबंधित है। लेखक के जीवन, साहित्यिक योगदान और अन्य रचनाओं का तथ्य-जाँचा हुआ विस्तृत परिचय अभी संपादकीय समीक्षा में है।`
                : `${author} wrote the original work, ${title || "this book"}, in the ${category} category. A source-checked account of their life, literary contribution, and bibliography is pending editorial review.`
            ))}
          </p>
          {bookProfile && bookProfile.language !== (isHindi ? "hi" : "en") && (
            <p className="text-xs text-muted-foreground mt-3">
              {isHindi ? "संपादकीय सत्यापन वाला यह पुस्तक-विशिष्ट परिचय अभी मूल भाषा में उपलब्ध है।" : "This verified book-specific introduction is currently available in the book’s original language."}
            </p>
          )}
          {reviewed && sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {sources.map((source, index) => (
                <a key={source} className="text-sm text-primary underline" href={source} target="_blank" rel="noopener noreferrer">
                  {isHindi ? `स्रोत ${index + 1}` : `Source ${index + 1}`}
                </a>
              ))}
            </div>
          )
          {otherWorks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold mb-2">{isHindi ? "Booknomics पर अन्य कृतियाँ" : "More works on Booknomics"}</h3>
              <ul className="text-sm space-y-1.5">
                {otherWorks.map((work) => (
                  <li key={work.slug}>
                    <Link className="text-primary hover:underline" to={`/books/${work.seo_slug || work.slug}`}>{work.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{isHindi ? "इस गाइड के बारे में" : "About this learning guide"}</span>
          </div>
          <p className="text-base text-muted-foreground leading-7">
            {isHindi
              ? "यह मूल पुस्तक का स्वतंत्र सारांश और आलोचनात्मक अध्ययन है, मूल लेखक की ओर से लिखा गया या उनके द्वारा समर्थित पाठ नहीं। संपूर्ण प्रसंग और भाषा के लिए मूल कृति पढ़ने की सलाह दी जाती है।"
              : "This is an independent Booknomics summary and analysis, not writing endorsed by the original author. Read the complete book for its original language, full context and nuance."}
          </p>
        </div>
      </div>
    </section>
  );
};
